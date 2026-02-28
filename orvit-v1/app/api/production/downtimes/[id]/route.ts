import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';
import { logProductionEvent } from '@/lib/production/event-logger';

export const dynamic = 'force-dynamic';

// Schema para actualización
const DowntimeUpdateSchema = z.object({
  endTime: z.string().datetime().optional().nullable(),
  durationMinutes: z.number().optional().nullable(),
  description: z.string().optional(),
  rootCause: z.string().optional().nullable(),
  reasonCodeId: z.number().optional().nullable(),
});

// Schema para crear WorkOrder desde parada
const CreateWorkOrderSchema = z.object({
  action: z.literal('create_workorder'),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARADAS.VIEW);
    if (error) return error;

    const downtimeId = parseInt(params.id);
    if (isNaN(downtimeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const downtime = await prisma.productionDowntime.findFirst({
      where: {
        id: downtimeId,
        companyId: user!.companyId,
      },
      include: {
        productionOrder: {
          select: {
            id: true,
            code: true,
            status: true,
            product: {
              select: {
                id: true,
                name: true,
                unitLabel: true,
              },
            },
          },
        },
        dailyReport: {
          select: {
            id: true,
            date: true,
          },
        },
        shift: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        workCenter: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
        machine: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        reasonCode: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            triggersMaintenance: true,
            requiresNote: true,
          },
        },
        workOrder: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
        reportedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!downtime) {
      return NextResponse.json({ error: 'Parada no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      downtime,
    });
  } catch (error) {
    console.error('Error fetching downtime:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARADAS.EDIT);
    if (error) return error;

    const downtimeId = parseInt(params.id);
    if (isNaN(downtimeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la parada existe
    const existingDowntime = await prisma.productionDowntime.findFirst({
      where: {
        id: downtimeId,
        companyId: user!.companyId,
      },
      include: {
        reasonCode: true,
        machine: true,
        workCenter: true,
      },
    });

    if (!existingDowntime) {
      return NextResponse.json({ error: 'Parada no encontrada' }, { status: 404 });
    }

    const body = await request.json();

    // Detectar si es acción de crear WorkOrder
    if (body.action === 'create_workorder') {
      const { title, description, priority } = CreateWorkOrderSchema.parse(body);

      if (existingDowntime.workOrderId) {
        return NextResponse.json(
          { error: 'Esta parada ya tiene una orden de trabajo asociada' },
          { status: 400 }
        );
      }

      // Construir título y descripción si no se proporcionan
      const woTitle = title || `Parada de producción: ${existingDowntime.reasonCode?.name || existingDowntime.description}`;
      const woDescription = description || `
Parada registrada en producción:
- Descripción: ${existingDowntime.description}
- Tipo: ${existingDowntime.type === 'PLANNED' ? 'Planificada' : 'No Planificada'}
- Duración: ${existingDowntime.durationMinutes || '?'} minutos
- Causa raíz: ${existingDowntime.rootCause || 'No especificada'}
${existingDowntime.workCenter ? `- Centro de trabajo: ${existingDowntime.workCenter.name}` : ''}
${existingDowntime.machine ? `- Máquina: ${existingDowntime.machine.name}` : ''}
      `.trim();

      // Crear WorkOrder
      const workOrder = await prisma.workOrder.create({
        data: {
          title: woTitle,
          description: woDescription,
          priority,
          status: 'pending',
          machineId: existingDowntime.machineId,
          companyId: user!.companyId,
          createdById: user!.id,
        },
      });

      // Vincular a la parada
      const updatedDowntime = await prisma.productionDowntime.update({
        where: { id: downtimeId },
        data: { workOrderId: workOrder.id },
        include: {
          workOrder: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      });

      // Registrar evento
      if (existingDowntime.productionOrderId) {
        await logProductionEvent({
          entityType: 'DOWNTIME',
          entityId: downtimeId,
          eventType: 'DOWNTIME_LINKED_TO_WO',
          newValue: { workOrderId: workOrder.id },
          performedById: user!.id,
          productionOrderId: existingDowntime.productionOrderId,
          companyId: user!.companyId,
        });
      }

      return NextResponse.json({
        success: true,
        downtime: updatedDowntime,
        workOrder,
        message: 'Orden de trabajo creada y vinculada',
      });
    }

    // Actualización normal
    const validatedData = DowntimeUpdateSchema.parse(body);

    // Calcular duración si se cierra la parada
    let durationMinutes = validatedData.durationMinutes;
    if (validatedData.endTime && !durationMinutes) {
      const start = new Date(existingDowntime.startTime);
      const end = new Date(validatedData.endTime);
      durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    }

    const downtime = await prisma.productionDowntime.update({
      where: { id: downtimeId },
      data: {
        ...validatedData,
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : undefined,
        durationMinutes: durationMinutes !== undefined ? durationMinutes : undefined,
      },
      include: {
        reasonCode: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // Registrar evento de cierre
    if (validatedData.endTime && !existingDowntime.endTime) {
      if (existingDowntime.productionOrderId) {
        await logProductionEvent({
          entityType: 'DOWNTIME',
          entityId: downtimeId,
          eventType: 'DOWNTIME_ENDED',
          newValue: { durationMinutes },
          performedById: user!.id,
          productionOrderId: existingDowntime.productionOrderId,
          companyId: user!.companyId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      downtime,
    });
  } catch (error) {
    console.error('Error updating downtime:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARADAS.DELETE);
    if (error) return error;

    const downtimeId = parseInt(params.id);
    if (isNaN(downtimeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la parada existe
    const existingDowntime = await prisma.productionDowntime.findFirst({
      where: {
        id: downtimeId,
        companyId: user!.companyId,
      },
    });

    if (!existingDowntime) {
      return NextResponse.json({ error: 'Parada no encontrada' }, { status: 404 });
    }

    // No permitir eliminar si tiene WorkOrder vinculada
    if (existingDowntime.workOrderId) {
      return NextResponse.json(
        { error: 'No se puede eliminar una parada con orden de trabajo vinculada' },
        { status: 400 }
      );
    }

    await prisma.productionDowntime.delete({
      where: { id: downtimeId },
    });

    return NextResponse.json({
      success: true,
      message: 'Parada eliminada',
    });
  } catch (error) {
    console.error('Error deleting downtime:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
