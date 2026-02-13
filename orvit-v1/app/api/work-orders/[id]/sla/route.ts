/**
 * API: /api/work-orders/[id]/sla
 *
 * GET - Obtener estado de SLA de una orden de trabajo
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getSLAConfig, calculateSLAStatus } from '@/lib/corrective/sla-manager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/work-orders/[id]/sla
 * Obtener estado de SLA
 */
export async function GET(
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
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    // 2. Obtener OT con falla asociada
    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id: workOrderId,
        companyId
      },
      include: {
        failureOccurrences: {
          select: { id: true, priority: true, reportedAt: true }
        }
      }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // 3. Obtener configuración de SLA
    const config = await getSLAConfig(companyId);

    // 4. Usar prioridad de FailureOccurrence si existe
    const priority = workOrder.failureOccurrences[0]?.priority || workOrder.priority;
    const createdAt = workOrder.failureOccurrences[0]?.reportedAt || workOrder.createdAt;

    // 5. Calcular estado de SLA
    const slaStatus = calculateSLAStatus(
      createdAt,
      priority,
      config,
      workOrder.completedDate
    );

    return NextResponse.json({
      workOrderId,
      slaStatus,
      config: {
        slaP1Hours: config.slaP1Hours,
        slaP2Hours: config.slaP2Hours,
        slaP3Hours: config.slaP3Hours,
        slaP4Hours: config.slaP4Hours,
      }
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/work-orders/[id]/sla:', error);
    return NextResponse.json(
      { error: 'Error al obtener SLA', detail: error.message },
      { status: 500 }
    );
  }
}
