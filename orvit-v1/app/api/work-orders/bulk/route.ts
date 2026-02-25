/**
 * API: /api/work-orders/bulk
 *
 * POST - Operaciones en lote sobre múltiples órdenes de trabajo
 *        Soporta: assign, updatePriority, updateStatus, cancel
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { notifyOTAssigned } from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

// Schema de validación
const bulkOperationSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos una orden'),
  operation: z.enum(['assign', 'updatePriority', 'updateStatus', 'cancel', 'schedule']),
  // Datos según la operación
  assignToId: z.number().int().positive().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING', 'ON_HOLD']).optional(),
  scheduledDate: z.string().optional(),
  cancelReason: z.string().min(3).optional(),
});

type BulkOperation = z.infer<typeof bulkOperationSchema>;

/**
 * POST /api/work-orders/bulk
 * Ejecutar operación en lote
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = bulkOperationSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 3. Verificar que las OTs existen y pertenecen a la empresa
    const existingWorkOrders = await prisma.workOrder.findMany({
      where: {
        id: { in: data.ids },
        companyId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] }
      },
      select: {
        id: true,
        status: true,
        assignedToId: true,
        title: true
      }
    });

    if (existingWorkOrders.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron órdenes válidas para actualizar' },
        { status: 404 }
      );
    }

    const validIds = existingWorkOrders.map((wo) => wo.id);
    const skippedIds = data.ids.filter((id) => !validIds.includes(id));

    // 4. Ejecutar operación según tipo
    let result: { updated: number; details: string };

    switch (data.operation) {
      case 'assign':
        if (!data.assignToId) {
          return NextResponse.json(
            { error: 'assignToId es requerido para la operación assign' },
            { status: 400 }
          );
        }
        result = await bulkAssign(validIds, data.assignToId, companyId);
        break;

      case 'updatePriority':
        if (!data.priority) {
          return NextResponse.json(
            { error: 'priority es requerido para la operación updatePriority' },
            { status: 400 }
          );
        }
        result = await bulkUpdatePriority(validIds, data.priority);
        break;

      case 'updateStatus':
        if (!data.status) {
          return NextResponse.json(
            { error: 'status es requerido para la operación updateStatus' },
            { status: 400 }
          );
        }
        result = await bulkUpdateStatus(validIds, data.status);
        break;

      case 'cancel':
        result = await bulkCancel(validIds, userId, data.cancelReason);
        break;

      case 'schedule':
        if (!data.scheduledDate) {
          return NextResponse.json(
            { error: 'scheduledDate es requerido para la operación schedule' },
            { status: 400 }
          );
        }
        result = await bulkSchedule(validIds, data.scheduledDate);
        break;

      default:
        return NextResponse.json(
          { error: 'Operación no soportada' },
          { status: 400 }
        );
    }

    console.log(`✅ Bulk ${data.operation}: ${result.updated} OTs actualizadas por usuario ${userId}`);

    // Notificaciones Discord para bulk assign (fire-and-forget)
    if (data.operation === 'assign' && data.assignToId) {
      prisma.workOrder.findMany({
        where: { id: { in: validIds } },
        select: { id: true, title: true, priority: true, sectorId: true, machine: { select: { name: true } } },
      }).then(workOrders => {
        const techName = result.details.match(/asignadas a (.+)$/)?.[1] ?? String(data.assignToId);
        return Promise.all(workOrders.map(wo => notifyOTAssigned({
          id: wo.id,
          title: wo.title,
          priority: wo.priority,
          machineName: (wo as any).machine?.name,
          sectorId: (wo as any).sectorId ?? 0,
          assignedTo: techName,
          assignedToId: data.assignToId!,
          assignedBy: String(userId),
        })));
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      operation: data.operation,
      requested: data.ids.length,
      updated: result.updated,
      skipped: skippedIds.length,
      skippedIds: skippedIds.length > 0 ? skippedIds : undefined,
      details: result.details
    });
  } catch (error: any) {
    console.error('❌ Error en POST /api/work-orders/bulk:', error);
    return NextResponse.json(
      { error: 'Error en operación bulk', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * Asignar técnico a múltiples OTs
 */
async function bulkAssign(ids: number[], assignToId: number, companyId: number) {
  // Verificar que el técnico existe y pertenece a la empresa
  const technician = await prisma.user.findFirst({
    where: {
      id: assignToId,
      isActive: true,
      companies: { some: { companyId } }
    },
    select: { id: true, name: true }
  });

  if (!technician) {
    throw new Error('Técnico no encontrado o no tiene acceso a la empresa');
  }

  const now = new Date();

  const result = await prisma.workOrder.updateMany({
    where: { id: { in: ids } },
    data: {
      assignedToId,
      assignedAt: now,
      status: 'SCHEDULED' // Cambiar a SCHEDULED al asignar
    }
  });

  return {
    updated: result.count,
    details: `${result.count} OTs asignadas a ${technician.name}`
  };
}

/**
 * Actualizar prioridad de múltiples OTs
 */
async function bulkUpdatePriority(ids: number[], priority: string) {
  const result = await prisma.workOrder.updateMany({
    where: { id: { in: ids } },
    data: { priority: priority as any }
  });

  return {
    updated: result.count,
    details: `${result.count} OTs actualizadas a prioridad ${priority}`
  };
}

/**
 * Actualizar status de múltiples OTs
 */
async function bulkUpdateStatus(ids: number[], status: string) {
  const updateData: any = { status };

  // Auto-completar fechas según el estado
  if (status === 'IN_PROGRESS') {
    updateData.startedDate = new Date();
  }

  const result = await prisma.workOrder.updateMany({
    where: { id: { in: ids } },
    data: updateData
  });

  return {
    updated: result.count,
    details: `${result.count} OTs actualizadas a status ${status}`
  };
}

/**
 * Cancelar múltiples OTs
 */
async function bulkCancel(ids: number[], userId: number, cancelReason?: string) {
  const now = new Date();
  const bulkNote = cancelReason
    ? `[BULK CANCEL ${now.toISOString()}] ${cancelReason}`
    : `[BULK CANCEL ${now.toISOString()}] Cancelado en lote`;

  // Usar transacción para actualizar OTs y sus notas
  await prisma.$transaction(async (tx) => {
    // Actualizar status
    await tx.workOrder.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'CANCELLED',
        completedDate: now,
        isCompleted: true
      }
    });

    // Actualizar notas individualmente (para concatenar)
    for (const id of ids) {
      const wo = await tx.workOrder.findUnique({
        where: { id },
        select: { notes: true }
      });
      await tx.workOrder.update({
        where: { id },
        data: {
          notes: wo?.notes ? `${wo.notes}\n${bulkNote}` : bulkNote
        }
      });
    }
  });

  return {
    updated: ids.length,
    details: `${ids.length} OTs canceladas`
  };
}

/**
 * Programar múltiples OTs
 */
async function bulkSchedule(ids: number[], scheduledDate: string) {
  const date = new Date(scheduledDate);

  const result = await prisma.workOrder.updateMany({
    where: { id: { in: ids } },
    data: {
      scheduledDate: date,
      status: 'SCHEDULED',
      plannedAt: new Date()
    }
  });

  return {
    updated: result.count,
    details: `${result.count} OTs programadas para ${date.toLocaleDateString('es-AR')}`
  };
}
