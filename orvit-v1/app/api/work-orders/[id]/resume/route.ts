/**
 * API: /api/work-orders/[id]/resume
 *
 * POST - Reanudar orden de trabajo desde estado de espera
 *        Limpia waitingReason, waitingETA, waitingSince
 *        Retorna estado a 'in_progress'
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para resume (opcional)
 */
const resumeSchema = z.object({
  notes: z.string().optional(), // Nota opcional sobre la reanudación
}).optional();

/**
 * POST /api/work-orders/[id]/resume
 * Reanuda una orden de trabajo desde estado de espera
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
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear body (opcional)
    let notes: string | undefined;
    try {
      const body = await request.json();
      const validationResult = resumeSchema.safeParse(body);
      if (validationResult.success && validationResult.data) {
        notes = validationResult.data.notes;
      }
    } catch {
      // Body vacío es válido
    }

    // ✅ TRANSACCIÓN: Cambiar estado de waiting a in_progress es crítico
    const result = await prisma.$transaction(async (tx) => {
      // 3. Verificar que la orden existe y pertenece a la empresa
      const workOrder = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          assignedTo: { select: { id: true, name: true } }
        }
      });

      if (!workOrder || workOrder.companyId !== companyId) {
        throw new Error('Orden de trabajo no encontrada');
      }

      // 4. Validaciones de negocio
      if (workOrder.status !== 'WAITING') {
        throw new Error(`La orden no está en espera (estado actual: ${workOrder.status})`);
      }

      if (!workOrder.waitingReason) {
        throw new Error('La orden no tiene motivo de espera registrado');
      }

      // 5. Calcular tiempo en espera
      const waitingSince = workOrder.waitingSince || new Date();
      const waitingMinutes = Math.floor((new Date().getTime() - waitingSince.getTime()) / 60000);

      // 6. Actualizar estado a in_progress
      const updatedWorkOrder = await tx.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: 'IN_PROGRESS', // Volver a in_progress
          waitingReason: null,   // Limpiar motivo
          waitingDescription: null,
          waitingETA: null,
          waitingSince: null,
          // Agregar nota en el historial
          notes: workOrder.notes
            ? `${workOrder.notes}\n\n[${new Date().toISOString()}] Reanudada después de ${waitingMinutes} minutos en espera${notes ? `: ${notes}` : ''}`
            : `[${new Date().toISOString()}] Reanudada después de ${waitingMinutes} minutos en espera${notes ? `: ${notes}` : ''}`
        },
        include: {
          assignedTo: { select: { id: true, name: true } },
          failureOccurrences: {
            select: {
              id: true,
              title: true,
              status: true,
              machine: { select: { id: true, name: true } }
            }
          }
        }
      });

      // 7. Crear registro de WorkLog (si existe la tabla)
      try {
        await tx.workLog.create({
          data: {
            workOrderId,
            performedById: userId,
            performedByType: 'USER',
            startedAt: new Date(),
            endedAt: new Date(),
            actualMinutes: 0,
            description: `Orden reanudada después de ${waitingMinutes} minutos en espera${notes ? `: ${notes}` : ''}`,
            activityType: 'EXECUTION'
          }
        });
      } catch (error) {
        // Si WorkLog no existe, no es crítico
        console.warn('WorkLog table might not exist yet:', error);
      }

      return {
        workOrder: updatedWorkOrder,
        waitingMinutes
      };
    });

    // 8. Retornar resultado
    return NextResponse.json({
      success: true,
      message: `Orden #${workOrderId} reanudada exitosamente (estuvo ${result.waitingMinutes} minutos en espera)`,
      data: result
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/work-orders/[id]/resume:', error);

    // Si es error de validación de negocio, retornar 400
    if (error.message?.includes('no encontrada') ||
        error.message?.includes('no está en espera') ||
        error.message?.includes('no tiene motivo')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al reanudar orden' },
      { status: 500 }
    );
  }
}
