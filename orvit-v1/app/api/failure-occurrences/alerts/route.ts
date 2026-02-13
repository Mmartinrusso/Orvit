/**
 * API: /api/failure-occurrences/alerts
 *
 * GET - Alertas de fallas críticas que requieren atención
 *       Similar a preventive/alerts pero para correctivo
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface FailureAlert {
  id: number;
  type: 'CRITICAL_UNASSIGNED' | 'CRITICAL_STALE' | 'WITH_DOWNTIME' | 'RECURRENCE';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  title: string;
  machineName: string;
  machineId: number;
  reportedAt: string;
  hoursOpen: number;
  hasWorkOrder: boolean;
  assignedToName: string | null;
  causedDowntime: boolean;
  isRecurrence: boolean;
}

export interface FailureAlertsSummary {
  total: number;
  criticalUnassigned: number;
  criticalStale: number;
  withDowntime: number;
  recurrences: number;
}

/**
 * GET /api/failure-occurrences/alerts
 * Retorna alertas de fallas que necesitan atención urgente
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
    const staleHours = parseInt(searchParams.get('staleHours') || '4'); // Default: 4 horas
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const now = new Date();
    const staleThreshold = new Date(now.getTime() - staleHours * 60 * 60 * 1000);

    // 3. Obtener fallas que necesitan atención
    const criticalFailures = await prisma.failureOccurrence.findMany({
      where: {
        companyId,
        isLinkedDuplicate: false,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        OR: [
          // P1/P2 sin asignar
          {
            priority: { in: ['P1', 'P2'] },
            OR: [
              { workOrder: null },
              { workOrder: { assignedToId: null } },
            ],
          },
          // P1/P2 abiertas por más de X horas
          {
            priority: { in: ['P1', 'P2'] },
            reportedAt: { lt: staleThreshold },
          },
          // Cualquier falla con downtime activo
          {
            causedDowntime: true,
          },
          // Reincidencias
          {
            reopenedFrom: { not: null },
          },
        ],
      },
      include: {
        machine: { select: { id: true, name: true } },
        workOrder: {
          select: {
            id: true,
            assignedToId: true,
            assignedTo: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { priority: 'asc' }, // P1 primero
        { reportedAt: 'asc' }, // Más antiguas primero
      ],
      take: limit,
    });

    // 4. Transformar a formato de alertas
    const alerts: FailureAlert[] = criticalFailures.map((failure) => {
      const hoursOpen = Math.floor(
        (now.getTime() - new Date(failure.reportedAt).getTime()) / (1000 * 60 * 60)
      );

      const hasWorkOrder = !!failure.workOrder;
      const isUnassigned = !failure.workOrder?.assignedToId;
      const isStale = new Date(failure.reportedAt) < staleThreshold;
      const isRecurrence = !!failure.reopenedFrom;

      // Determinar tipo de alerta (priorizar la más urgente)
      let type: FailureAlert['type'];
      if (failure.priority === 'P1' && isUnassigned) {
        type = 'CRITICAL_UNASSIGNED';
      } else if ((failure.priority === 'P1' || failure.priority === 'P2') && isStale) {
        type = 'CRITICAL_STALE';
      } else if (failure.causedDowntime) {
        type = 'WITH_DOWNTIME';
      } else {
        type = 'RECURRENCE';
      }

      return {
        id: failure.id,
        type,
        priority: failure.priority as FailureAlert['priority'],
        title: failure.title,
        machineName: failure.machine?.name || 'Sin máquina',
        machineId: failure.machineId,
        reportedAt: failure.reportedAt.toISOString(),
        hoursOpen,
        hasWorkOrder,
        assignedToName: failure.workOrder?.assignedTo?.name || null,
        causedDowntime: failure.causedDowntime,
        isRecurrence,
      };
    });

    // 5. Calcular resumen
    const summary: FailureAlertsSummary = {
      total: alerts.length,
      criticalUnassigned: alerts.filter((a) => a.type === 'CRITICAL_UNASSIGNED').length,
      criticalStale: alerts.filter((a) => a.type === 'CRITICAL_STALE').length,
      withDowntime: alerts.filter((a) => a.causedDowntime).length,
      recurrences: alerts.filter((a) => a.isRecurrence).length,
    };

    return NextResponse.json({
      alerts,
      summary,
      generatedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences/alerts:', error);
    return NextResponse.json(
      {
        alerts: [],
        summary: {
          total: 0,
          criticalUnassigned: 0,
          criticalStale: 0,
          withDowntime: 0,
          recurrences: 0,
        },
        _error: error?.message,
      },
      { status: 200 } // Return 200 with empty data to not break UI
    );
  }
}
