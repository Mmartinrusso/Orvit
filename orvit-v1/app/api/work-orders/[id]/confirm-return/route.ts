/**
 * API: /api/work-orders/[id]/confirm-return
 *
 * POST - Confirmar retorno a producción directamente en la OT
 *        (cuando no hay downtime log asociado pero se requiere confirmación)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    // 2. Verificar que la orden existe y pertenece a la empresa
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder || workOrder.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // 3. Parsear body (notas opcionales)
    const body = await request.json().catch(() => ({}));
    const { notes, productionImpact } = body;

    // 4. Actualizar WorkOrder.returnToProductionConfirmed = true
    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        returnToProductionConfirmed: true,
        // Guardar notas si se proporcionaron
        notes: notes
          ? `${workOrder.notes || ''}\n[Retorno a Producción] ${notes}`.trim()
          : workOrder.notes,
      },
    });

    // 5. Si hay QA activo, también marcar el retorno
    try {
      const qa = await prisma.qualityAssurance.findUnique({
        where: { workOrderId },
      });

      if (qa && qa.isRequired) {
        await prisma.qualityAssurance.update({
          where: { workOrderId },
          data: {
            returnToProductionConfirmed: true,
            returnConfirmedById: userId,
            returnConfirmedAt: new Date(),
          },
        });
      }
    } catch (qaError) {
      // Ignorar si QA no existe
      console.warn('QA update failed (ignoring):', qaError);
    }

    // Notificaciones in-app (fire-and-forget)
    const notifTargets = new Set<number>();
    if (workOrder.assignedToId) notifTargets.add(workOrder.assignedToId);
    if (workOrder.createdById && workOrder.createdById !== userId) notifTargets.add(workOrder.createdById);

    if (notifTargets.size > 0) {
      Promise.all(
        Array.from(notifTargets).map(targetUserId =>
          prisma.notification.create({
            data: {
              type: 'system_alert',
              title: 'Retorno a producción confirmado',
              message: `La OT #${workOrderId} fue confirmada como lista para retornar a producción.`,
              userId: targetUserId,
              companyId,
              priority: 'MEDIUM',
              metadata: { workOrderId, confirmedById: userId },
            }
          })
        )
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      workOrder: updatedWorkOrder,
      message: 'Retorno a producción confirmado',
    });
  } catch (error: any) {
    console.error('❌ Error en POST /api/work-orders/[id]/confirm-return:', error);
    return NextResponse.json(
      {
        error: 'Error al confirmar retorno',
        detail: error?.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
