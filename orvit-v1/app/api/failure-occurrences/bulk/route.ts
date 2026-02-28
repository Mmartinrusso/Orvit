/**
 * API: /api/failure-occurrences/bulk
 *
 * POST - Operaciones en lote sobre múltiples fallas
 *        Soporta: close, assign, updatePriority, updateStatus
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema de validación
const bulkOperationSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos una falla'),
  operation: z.enum(['close', 'assign', 'updatePriority', 'updateStatus', 'createWorkOrders', 'delete']),
  // Datos según la operación
  assignToId: z.number().int().positive().optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
  // Para close
  closeReason: z.string().min(3).optional(),
});

type BulkOperation = z.infer<typeof bulkOperationSchema>;

/**
 * POST /api/failure-occurrences/bulk
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

    // 3. Verificar que las fallas existen y pertenecen a la empresa
    const existingFailures = await prisma.failureOccurrence.findMany({
      where: {
        id: { in: data.ids },
        companyId,
        ...(data.operation !== 'delete' && { isLinkedDuplicate: false }),
      },
      select: {
        id: true,
        status: true,
        failureId: true, // workOrderId
      },
    });

    if (existingFailures.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron fallas válidas' },
        { status: 404 }
      );
    }

    const validIds = existingFailures.map((f) => f.id);
    const skippedIds = data.ids.filter((id) => !validIds.includes(id));

    // 4. Ejecutar operación según tipo
    let result: any;

    switch (data.operation) {
      case 'close':
        result = await bulkClose(validIds, existingFailures, userId, data.closeReason);
        break;

      case 'assign':
        if (!data.assignToId) {
          return NextResponse.json(
            { error: 'assignToId es requerido para la operación assign' },
            { status: 400 }
          );
        }
        result = await bulkAssign(validIds, existingFailures, data.assignToId, companyId);
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

      case 'createWorkOrders':
        result = await bulkCreateWorkOrders(validIds, existingFailures, userId, companyId, data.assignToId);
        break;

      case 'delete':
        result = await bulkDelete(validIds, companyId);
        break;

      default:
        return NextResponse.json(
          { error: 'Operación no soportada' },
          { status: 400 }
        );
    }

    console.log(`✅ Bulk ${data.operation}: ${result.updated} fallas actualizadas por usuario ${userId}`);

    return NextResponse.json({
      success: true,
      operation: data.operation,
      requested: data.ids.length,
      updated: result.updated,
      skipped: skippedIds.length,
      skippedIds: skippedIds.length > 0 ? skippedIds : undefined,
      details: result.details,
    });
  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/bulk:', error);
    return NextResponse.json(
      { error: 'Error en operación bulk', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * Cerrar múltiples fallas
 */
async function bulkClose(
  ids: number[],
  failures: { id: number; status: string | null; failureId: number | null }[],
  userId: number,
  closeReason?: string
) {
  // Filtrar solo las que no están ya cerradas
  const toClose = failures.filter(
    (f) => f.status !== 'RESOLVED' && f.status !== 'RESOLVED_IMMEDIATE'
  );

  if (toClose.length === 0) {
    return { updated: 0, details: 'Todas las fallas ya estaban cerradas' };
  }

  const idsToClose = toClose.map((f) => f.id);
  const workOrderIds = toClose.map((f) => f.failureId).filter(Boolean) as number[];
  const now = new Date();
  const bulkNote = closeReason ? `[BULK CLOSE ${now.toISOString()}] ${closeReason}` : undefined;

  // Usar transacción para actualizar fallas y sus OTs
  await prisma.$transaction(async (tx) => {
    // Actualizar FailureOccurrences
    await tx.failureOccurrence.updateMany({
      where: { id: { in: idsToClose } },
      data: {
        status: 'RESOLVED',
        resolvedAt: now,
      },
    });

    // Si hay razón de cierre, actualizar notas individualmente
    if (bulkNote) {
      for (const id of idsToClose) {
        const failure = await tx.failureOccurrence.findUnique({
          where: { id },
          select: { notes: true },
        });
        await tx.failureOccurrence.update({
          where: { id },
          data: {
            notes: failure?.notes ? `${failure.notes}\n${bulkNote}` : bulkNote,
          },
        });
      }
    }

    // Actualizar WorkOrders asociadas
    if (workOrderIds.length > 0) {
      await tx.workOrder.updateMany({
        where: {
          id: { in: workOrderIds },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        data: {
          status: 'COMPLETED',
          completedDate: now,
          isCompleted: true,
        },
      });
    }
  });

  return {
    updated: idsToClose.length,
    details: `${idsToClose.length} fallas cerradas, ${workOrderIds.length} OTs completadas`,
  };
}

/**
 * Asignar técnico a múltiples fallas (vía WorkOrder)
 */
async function bulkAssign(
  ids: number[],
  failures: { id: number; status: string | null; failureId: number | null }[],
  assignToId: number,
  companyId: number
) {
  // Verificar que el técnico existe y pertenece a la empresa
  const technician = await prisma.user.findFirst({
    where: {
      id: assignToId,
      isActive: true,
      companies: { some: { companyId } },
    },
    select: { id: true, name: true },
  });

  if (!technician) {
    throw new Error('Técnico no encontrado o no tiene acceso a la empresa');
  }

  // Obtener WorkOrders que necesitan asignación
  const workOrderIds = failures.map((f) => f.failureId).filter(Boolean) as number[];

  if (workOrderIds.length === 0) {
    return { updated: 0, details: 'Ninguna falla tiene OT asociada para asignar' };
  }

  const result = await prisma.workOrder.updateMany({
    where: {
      id: { in: workOrderIds },
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    },
    data: {
      assignedToId,
      status: 'IN_PROGRESS', // Cambiar a IN_PROGRESS al asignar
    },
  });

  // Actualizar status de las fallas también
  await prisma.failureOccurrence.updateMany({
    where: {
      failureId: { in: workOrderIds },
      status: 'OPEN',
    },
    data: {
      status: 'IN_PROGRESS',
    },
  });

  return {
    updated: result.count,
    details: `${result.count} OTs asignadas a ${technician.name}`,
  };
}

/**
 * Actualizar prioridad de múltiples fallas
 */
async function bulkUpdatePriority(ids: number[], priority: string) {
  const result = await prisma.failureOccurrence.updateMany({
    where: { id: { in: ids } },
    data: { priority },
  });

  return {
    updated: result.count,
    details: `${result.count} fallas actualizadas a prioridad ${priority}`,
  };
}

/**
 * Actualizar status de múltiples fallas
 */
async function bulkUpdateStatus(ids: number[], status: string) {
  const updateData: any = { status };

  // Si se está cerrando, agregar fecha de resolución
  if (status === 'RESOLVED') {
    updateData.resolvedAt = new Date();
  }

  const result = await prisma.failureOccurrence.updateMany({
    where: { id: { in: ids } },
    data: updateData,
  });

  return {
    updated: result.count,
    details: `${result.count} fallas actualizadas a status ${status}`,
  };
}

/**
 * Crear OTs para múltiples fallas que no tienen OT activa
 */
async function bulkCreateWorkOrders(
  ids: number[],
  failures: { id: number; status: string | null; failureId: number | null }[],
  userId: number,
  companyId: number,
  assignToId?: number
) {
  // Filtrar solo las que NO tienen OT activa
  const withoutOT = failures.filter((f) => !f.failureId);
  const alreadyWithOT = failures.filter((f) => f.failureId);

  if (withoutOT.length === 0) {
    return {
      updated: 0,
      details: `Todas las fallas seleccionadas ya tienen OT asociada (${alreadyWithOT.length} con OT)`,
    };
  }

  const idsToProcess = withoutOT.map((f) => f.id);

  // Obtener detalles de las fallas para crear las OTs
  const fullFailures = await prisma.failureOccurrence.findMany({
    where: { id: { in: idsToProcess } },
    include: {
      machine: { select: { id: true, name: true, criticality: true } },
    },
  });

  let created = 0;
  const createdOTs: { failureId: number; workOrderId: number }[] = [];

  for (const failure of fullFailures) {
    try {
      // Mapear prioridad de FailureOccurrence a WorkOrder
      const woPriority = failure.priority === 'P1' ? 'URGENT' :
                          failure.priority === 'P2' ? 'HIGH' :
                          failure.priority === 'P3' ? 'MEDIUM' : 'LOW';

      const workOrder = await prisma.workOrder.create({
        data: {
          title: `Solucionar — ${failure.title}`,
          description: failure.description || `Falla reportada: ${failure.title}`,
          type: 'CORRECTIVE',
          status: 'PENDING',
          priority: woPriority,
          origin: 'FAILURE',
          machineId: failure.machineId,
          companyId,
          createdById: userId,
          assignedToId: assignToId || null,
          failureDescription: failure.title,
          isSafetyRelated: failure.isSafetyRelated || false,
        },
      });

      // Vincular la falla a la OT
      await prisma.failureOccurrence.update({
        where: { id: failure.id },
        data: { failureId: workOrder.id },
      });

      createdOTs.push({ failureId: failure.id, workOrderId: workOrder.id });
      created++;
    } catch (err: any) {
      console.warn(`⚠️ Error creando OT para falla ${failure.id}:`, err.message);
    }
  }

  return {
    updated: created,
    details: `${created} OTs creadas${alreadyWithOT.length > 0 ? `, ${alreadyWithOT.length} ya tenían OT` : ''}`,
    createdOTs,
  };
}

/**
 * Eliminar múltiples fallas
 */
async function bulkDelete(ids: number[], companyId: number) {
  const result = await prisma.failureOccurrence.deleteMany({
    where: { id: { in: ids }, companyId },
  });

  return {
    updated: result.count,
    details: `${result.count} fallas eliminadas`,
  };
}
