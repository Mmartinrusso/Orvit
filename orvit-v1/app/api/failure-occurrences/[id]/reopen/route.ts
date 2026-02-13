/**
 * API: /api/failure-occurrences/[id]/reopen
 *
 * POST - Reabrir una falla previamente resuelta
 *        Requiere motivo obligatorio
 *        Crea nueva OT si la anterior fue cerrada
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const reopenSchema = z.object({
  reason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
  createNewWorkOrder: z.boolean().optional().default(false),
});

/**
 * POST /api/failure-occurrences/[id]/reopen
 * Reabrir una falla resuelta
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear body
    const body = await request.json();
    const validationResult = reopenSchema.safeParse(body);

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

    // 3. Obtener la falla
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: {
        id: occurrenceId,
        companyId,
      },
      include: {
        workOrder: true,
        machine: { select: { id: true, name: true } },
      },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 4. Verificar que la falla está resuelta
    if (occurrence.status !== 'RESOLVED' && occurrence.status !== 'RESOLVED_IMMEDIATE') {
      return NextResponse.json(
        { error: 'Solo se pueden reabrir fallas resueltas' },
        { status: 400 }
      );
    }

    // 5. Transacción: reabrir falla + crear nueva OT si es necesario
    const result = await prisma.$transaction(async (tx) => {
      // 5.1 Actualizar FailureOccurrence
      const updatedOccurrence = await tx.failureOccurrence.update({
        where: { id: occurrenceId },
        data: {
          status: 'IN_PROGRESS',
          reopenedFrom: occurrence.id,
          reopenReason: data.reason,
          reopenedAt: new Date(),
          reopenedById: userId,
          resolvedAt: null,
          resolvedImmediately: false,
        },
      });

      // 5.2 Reabrir o crear WorkOrder
      let workOrder = occurrence.workOrder;
      if (workOrder) {
        if (workOrder.status === 'completed' || workOrder.status === 'cancelled') {
          if (data.createNewWorkOrder) {
            // Crear nueva OT
            workOrder = await tx.workOrder.create({
              data: {
                title: `[REABIERTO] ${workOrder.title}`,
                description: `Reabierto: ${data.reason}\n\nOriginal: ${workOrder.description || ''}`,
                type: 'CORRECTIVE',
                status: 'PENDING',
                priority: workOrder.priority,
                origin: 'FAILURE',
                machineId: occurrence.machineId,
                componentId: workOrder.componentId,
                companyId,
                createdById: userId,
                failureDescription: occurrence.title || '',
                isSafetyRelated: workOrder.isSafetyRelated,
              },
            });

            // Actualizar referencia en FailureOccurrence
            await tx.failureOccurrence.update({
              where: { id: occurrenceId },
              data: { failureId: workOrder.id },
            });
          } else {
            // Reabrir OT existente
            workOrder = await tx.workOrder.update({
              where: { id: workOrder.id },
              data: {
                status: 'in_progress',
                closedAt: null,
                closedById: null,
                notes: `[REABIERTO ${new Date().toISOString()}] ${data.reason}\n\n${workOrder.notes || ''}`,
              },
            });
          }
        } else {
          // OT ya está abierta, solo actualizar notas
          workOrder = await tx.workOrder.update({
            where: { id: workOrder.id },
            data: {
              notes: `[REABIERTO ${new Date().toISOString()}] ${data.reason}\n\n${workOrder.notes || ''}`,
            },
          });
        }
      }

      // 5.3 Agregar comentario de sistema
      try {
        await tx.workOrderComment.create({
          data: {
            workOrderId: workOrder!.id,
            content: `Falla reabierta por usuario. Motivo: ${data.reason}`,
            type: 'system',
            authorId: userId,
          },
        });
      } catch (e) {
        // Ignorar si falla el comentario
      }

      return { updatedOccurrence, workOrder };
    });

    console.log(`🔄 Falla ${occurrenceId} reabierta por usuario ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Falla reabierta exitosamente',
      occurrence: result.updatedOccurrence,
      workOrder: result.workOrder,
    });
  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/[id]/reopen:', error);
    return NextResponse.json(
      { error: 'Error al reabrir falla', detail: error.message },
      { status: 500 }
    );
  }
}
