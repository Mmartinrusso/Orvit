import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';
import { logProductionEvent, logOrderStatusChange } from '@/lib/production/event-logger';

export const dynamic = 'force-dynamic';

// Schema de validación para actualización
const ProductionOrderUpdateSchema = z.object({
  productId: z.string().min(1).optional(),
  productVariantId: z.string().optional().nullable(),
  recipeId: z.string().optional().nullable(),
  plannedQuantity: z.number().positive().optional(),
  targetUom: z.string().min(1).optional(),
  plannedCycleTimeSec: z.number().optional().nullable(),
  plannedSetupMinutes: z.number().optional().nullable(),
  plannedStartDate: z.string().datetime().optional(),
  plannedEndDate: z.string().datetime().optional().nullable(),
  workCenterId: z.number().optional().nullable(),
  sectorId: z.number().optional().nullable(),
  responsibleId: z.number().optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  notes: z.string().optional().nullable(),
});

// Schema para cambio de estado
const StatusChangeSchema = z.object({
  status: z.enum(['RELEASED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED']),
  notes: z.string().optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.ORDENES.VIEW);
    if (error) return error;

    const orderId = parseInt(params.id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const order = await prisma.productionOrder.findFirst({
      where: {
        id: orderId,
        companyId: user!.companyId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            unitLabel: true,
            line: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        recipe: {
          select: {
            id: true,
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
        sector: {
          select: {
            id: true,
            name: true,
          },
        },
        responsible: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        dailyReports: {
          orderBy: { date: 'desc' },
          take: 10,
          include: {
            operator: {
              select: {
                id: true,
                name: true,
              },
            },
            shift: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        downtimes: {
          orderBy: { startTime: 'desc' },
          take: 10,
          include: {
            reasonCode: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
        },
        batchLots: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        events: {
          orderBy: { performedAt: 'desc' },
          take: 20,
          include: {
            performedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Orden de producción no encontrada' }, { status: 404 });
    }

    // Calcular métricas de progreso
    const metrics = {
      completionPercentage: order.plannedQuantity
        ? (Number(order.producedQuantity) / Number(order.plannedQuantity)) * 100
        : 0,
      scrapPercentage: (Number(order.producedQuantity) + Number(order.scrapQuantity)) > 0
        ? (Number(order.scrapQuantity) / (Number(order.producedQuantity) + Number(order.scrapQuantity))) * 100
        : 0,
      totalDowntimeMinutes: order.downtimes.reduce((acc, d) => acc + (d.durationMinutes || 0), 0),
      totalGoodQuantity: Number(order.producedQuantity),
      totalScrap: Number(order.scrapQuantity),
      totalRework: Number(order.reworkQuantity),
    };

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        metrics,
      },
    });
  } catch (error) {
    console.error('Error fetching production order:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.ORDENES.EDIT);
    if (error) return error;

    const orderId = parseInt(params.id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la orden existe
    const existingOrder = await prisma.productionOrder.findFirst({
      where: {
        id: orderId,
        companyId: user!.companyId,
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Orden de producción no encontrada' }, { status: 404 });
    }

    const body = await request.json();

    // Detectar si es un cambio de estado
    if (body.status && Object.keys(body).length <= 2) {
      const statusData = StatusChangeSchema.parse(body);
      return handleStatusChange(existingOrder, statusData, { user: { id: user!.id }, companyId: user!.companyId });
    }

    // Actualización normal - solo permitida en DRAFT o RELEASED
    if (!['DRAFT', 'RELEASED'].includes(existingOrder.status)) {
      return NextResponse.json(
        { error: 'Solo se pueden editar órdenes en estado BORRADOR o LIBERADA' },
        { status: 400 }
      );
    }

    const validatedData = ProductionOrderUpdateSchema.parse(body);

    // Guardar valores anteriores para el log
    const previousValues = {
      plannedQuantity: Number(existingOrder.plannedQuantity),
      priority: existingOrder.priority,
      workCenterId: existingOrder.workCenterId,
    };

    const order = await prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        ...validatedData,
        plannedStartDate: validatedData.plannedStartDate
          ? new Date(validatedData.plannedStartDate)
          : undefined,
        plannedEndDate: validatedData.plannedEndDate
          ? new Date(validatedData.plannedEndDate)
          : validatedData.plannedEndDate === null
            ? null
            : undefined,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            unitLabel: true,
          },
        },
        workCenter: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // Registrar evento de actualización
    await logProductionEvent({
      entityType: 'PRODUCTION_ORDER',
      entityId: order.id,
      eventType: 'ORDER_UPDATED',
      previousValue: previousValues,
      newValue: validatedData,
      performedById: user!.id,
      productionOrderId: order.id,
      companyId: user!.companyId,
    });

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Error updating production order:', error);

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

async function handleStatusChange(
  order: any,
  data: z.infer<typeof StatusChangeSchema>,
  auth: any
) {
  const currentStatus = order.status;
  const newStatus = data.status;

  // Validar transiciones permitidas
  const allowedTransitions: Record<string, string[]> = {
    DRAFT: ['RELEASED', 'CANCELLED'],
    RELEASED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['PAUSED', 'COMPLETED', 'CANCELLED'],
    PAUSED: ['IN_PROGRESS', 'CANCELLED'],
    COMPLETED: [], // Estado final
    CANCELLED: [], // Estado final
  };

  if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
    return NextResponse.json(
      {
        error: `Transición no permitida de ${currentStatus} a ${newStatus}`,
        allowedTransitions: allowedTransitions[currentStatus],
      },
      { status: 400 }
    );
  }

  // Actualizar campos según el nuevo estado
  const updateData: any = { status: newStatus };

  if (newStatus === 'IN_PROGRESS' && !order.actualStartDate) {
    updateData.actualStartDate = new Date();
  }

  if (newStatus === 'COMPLETED') {
    updateData.actualEndDate = new Date();
  }

  const updatedOrder = await prisma.productionOrder.update({
    where: { id: order.id },
    data: updateData,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          unitLabel: true,
        },
      },
      workCenter: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  // Registrar evento de cambio de estado
  await logOrderStatusChange(
    order.id,
    currentStatus,
    newStatus,
    auth.user.id,
    auth.companyId,
    data.notes
  );

  return NextResponse.json({
    success: true,
    order: updatedOrder,
    message: `Orden ${order.code} cambiada a ${newStatus}`,
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.ORDENES.DELETE);
    if (error) return error;

    const orderId = parseInt(params.id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la orden existe
    const existingOrder = await prisma.productionOrder.findFirst({
      where: {
        id: orderId,
        companyId: user!.companyId,
      },
      include: {
        _count: {
          select: {
            dailyReports: true,
            batchLots: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Orden de producción no encontrada' }, { status: 404 });
    }

    // Solo permitir eliminar órdenes en estado DRAFT
    if (existingOrder.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar órdenes en estado BORRADOR. Use la acción de cancelar en su lugar.' },
        { status: 400 }
      );
    }

    // Verificar si tiene datos asociados
    if (existingOrder._count.dailyReports > 0 || existingOrder._count.batchLots > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar la orden porque tiene datos asociados. Cancélela en su lugar.' },
        { status: 400 }
      );
    }

    // Eliminar eventos asociados primero
    await prisma.productionEvent.deleteMany({
      where: { productionOrderId: orderId },
    });

    // Eliminar la orden
    await prisma.productionOrder.delete({
      where: { id: orderId },
    });

    return NextResponse.json({
      success: true,
      message: `Orden ${existingOrder.code} eliminada`,
    });
  } catch (error) {
    console.error('Error deleting production order:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
