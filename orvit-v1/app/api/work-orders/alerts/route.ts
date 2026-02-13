/**
 * API: /api/work-orders/alerts
 *
 * GET - Alertas de órdenes de trabajo que requieren atención urgente
 *       Similar a failure-occurrences/alerts pero para OTs
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface WorkOrderAlert {
  id: number;
  type: 'OVERDUE' | 'SLA_BREACHED' | 'UNASSIGNED_CRITICAL' | 'WAITING_TOO_LONG' | 'WITH_DOWNTIME';
  priority: string;
  title: string;
  machineName: string | null;
  machineId: number | null;
  scheduledDate: string | null;
  hoursOverdue: number;
  status: string;
  assignedToName: string | null;
  waitingReason: string | null;
  slaStatus: string | null;
}

export interface WorkOrderAlertsSummary {
  total: number;
  overdue: number;
  slaBreeched: number;
  unassignedCritical: number;
  waitingTooLong: number;
  withDowntime: number;
}

/**
 * GET /api/work-orders/alerts
 * Retorna alertas de OTs que necesitan atención urgente
 */
export async function GET(request: NextRequest) {
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

    // 2. Parsear parámetros
    const searchParams = request.nextUrl.searchParams;
    const waitingHoursThreshold = parseInt(searchParams.get('waitingHours') || '24');
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50);

    const now = new Date();
    const waitingThreshold = new Date(now.getTime() - waitingHoursThreshold * 60 * 60 * 1000);

    // 3. Obtener OTs que necesitan atención
    const criticalWorkOrders = await prisma.workOrder.findMany({
      where: {
        companyId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        OR: [
          // Vencidas (scheduledDate pasada)
          {
            scheduledDate: { lt: now },
            status: { notIn: ['COMPLETED', 'CANCELLED'] }
          },
          // SLA breached
          {
            slaStatus: 'BREACHED'
          },
          // Críticas sin asignar (HIGH/URGENT)
          {
            priority: { in: ['HIGH', 'URGENT'] },
            assignedToId: null
          },
          // En espera demasiado tiempo
          {
            status: 'WAITING',
            waitingSince: { lt: waitingThreshold }
          },
          // Con downtime activo
          {
            downtimeLogs: {
              some: {
                endedAt: null
              }
            }
          }
        ]
      },
      include: {
        machine: { select: { id: true, name: true } },
        assignedTo: { select: { name: true } },
        downtimeLogs: {
          where: { endedAt: null },
          select: { id: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledDate: 'asc' }
      ],
      take: limit
    });

    // 4. Transformar a formato de alertas
    const alerts: WorkOrderAlert[] = criticalWorkOrders.map((wo) => {
      const scheduledDate = wo.scheduledDate ? new Date(wo.scheduledDate) : null;
      const hoursOverdue = scheduledDate && scheduledDate < now
        ? Math.floor((now.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60))
        : 0;

      const isOverdue = scheduledDate && scheduledDate < now;
      const isSLABreeched = wo.slaStatus === 'BREACHED';
      const isUnassignedCritical = !wo.assignedToId && (wo.priority === 'HIGH' || wo.priority === 'URGENT');
      const isWaitingTooLong = wo.status === 'WAITING' && wo.waitingSince && new Date(wo.waitingSince) < waitingThreshold;
      const hasActiveDowntime = wo.downtimeLogs && wo.downtimeLogs.length > 0;

      // Determinar tipo de alerta (priorizar la más urgente)
      let type: WorkOrderAlert['type'];
      if (hasActiveDowntime) {
        type = 'WITH_DOWNTIME';
      } else if (isSLABreeched) {
        type = 'SLA_BREACHED';
      } else if (isUnassignedCritical) {
        type = 'UNASSIGNED_CRITICAL';
      } else if (isWaitingTooLong) {
        type = 'WAITING_TOO_LONG';
      } else {
        type = 'OVERDUE';
      }

      return {
        id: wo.id,
        type,
        priority: wo.priority,
        title: wo.title,
        machineName: wo.machine?.name || null,
        machineId: wo.machineId,
        scheduledDate: wo.scheduledDate?.toISOString() || null,
        hoursOverdue,
        status: wo.status,
        assignedToName: wo.assignedTo?.name || null,
        waitingReason: wo.waitingReason,
        slaStatus: wo.slaStatus
      };
    });

    // 5. Calcular resumen
    const summary: WorkOrderAlertsSummary = {
      total: alerts.length,
      overdue: alerts.filter(a => a.type === 'OVERDUE').length,
      slaBreeched: alerts.filter(a => a.type === 'SLA_BREACHED').length,
      unassignedCritical: alerts.filter(a => a.type === 'UNASSIGNED_CRITICAL').length,
      waitingTooLong: alerts.filter(a => a.type === 'WAITING_TOO_LONG').length,
      withDowntime: alerts.filter(a => a.type === 'WITH_DOWNTIME').length
    };

    return NextResponse.json({
      alerts,
      summary,
      generatedAt: now.toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error en GET /api/work-orders/alerts:', error);
    return NextResponse.json(
      {
        alerts: [],
        summary: {
          total: 0,
          overdue: 0,
          slaBreeched: 0,
          unassignedCritical: 0,
          waitingTooLong: 0,
          withDowntime: 0
        },
        _error: error?.message
      },
      { status: 200 } // Return 200 with empty data to not break UI
    );
  }
}
