/**
 * API: /api/metrics/corrective
 *
 * GET - Dashboard de métricas correctivas
 *       Incluye: MTTR, Recurrence, SLA, Top subcomponents
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getCorrectiveSettings } from '@/lib/corrective/qa-rules';

export const dynamic = 'force-dynamic';

/**
 * GET /api/metrics/corrective
 * Dashboard de métricas correctivas
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

    // 2. Parsear query params
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 días
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();
    const machineId = searchParams.get('machineId') ? parseInt(searchParams.get('machineId')!) : undefined;

    // 3. Obtener settings
    const settings = await getCorrectiveSettings(companyId);

    // 4. Fallas en período (excluyendo duplicados vinculados)
    const failures = await prisma.failureOccurrence.findMany({
      where: {
        companyId,
        reportedAt: { gte: startDate, lte: endDate },
        isLinkedDuplicate: false,
        ...(machineId && { machineId })
      },
      select: {
        id: true,
        status: true,
        priority: true,
        reportedAt: true,
        resolvedAt: true,
        causedDowntime: true,
        machineId: true,
        subcomponentId: true
      }
    });

    // 5. Work Orders correctivas cerradas
    const closedWorkOrders = await prisma.workOrder.findMany({
      where: {
        companyId,
        type: 'CORRECTIVE',
        status: 'completed',
        closedAt: { gte: startDate, lte: endDate },
        ...(machineId && { machineId })
      },
      select: {
        id: true,
        createdAt: true,
        closedAt: true,
        priority: true
      }
    });

    // 6. Calcular MTTR (Mean Time To Repair)
    const resolvedFailures = failures.filter(f => f.resolvedAt);
    let mttrMinutes = 0;
    if (resolvedFailures.length > 0) {
      const totalMinutes = resolvedFailures.reduce((sum, f) => {
        const diff = new Date(f.resolvedAt!).getTime() - new Date(f.reportedAt).getTime();
        return sum + (diff / 60000);
      }, 0);
      mttrMinutes = Math.round(totalMinutes / resolvedFailures.length);
    }

    // 7. Calcular SLA compliance
    const slaByPriority = {
      P1: { total: 0, onTime: 0, threshold: settings.slaP1Hours },
      P2: { total: 0, onTime: 0, threshold: settings.slaP2Hours },
      P3: { total: 0, onTime: 0, threshold: settings.slaP3Hours },
      P4: { total: 0, onTime: 0, threshold: settings.slaP4Hours },
    };

    closedWorkOrders.forEach(wo => {
      const priority = (wo.priority || 'P3') as keyof typeof slaByPriority;
      if (slaByPriority[priority]) {
        slaByPriority[priority].total++;
        const resolutionHours = (new Date(wo.closedAt!).getTime() - new Date(wo.createdAt).getTime()) / (1000 * 60 * 60);
        if (resolutionHours <= slaByPriority[priority].threshold) {
          slaByPriority[priority].onTime++;
        }
      }
    });

    const slaCompliance = Object.entries(slaByPriority).reduce((acc, [key, val]) => {
      acc[key] = val.total > 0 ? Math.round((val.onTime / val.total) * 100) : 100;
      return acc;
    }, {} as Record<string, number>);

    // 8. Calcular recurrencia
    const windowDate = new Date();
    windowDate.setDate(windowDate.getDate() - settings.recurrenceWindowDays);

    const recentFailuresByMachine = failures.reduce((acc, f) => {
      if (!acc[f.machineId!]) acc[f.machineId!] = 0;
      if (new Date(f.reportedAt) >= windowDate) acc[f.machineId!]++;
      return acc;
    }, {} as Record<number, number>);

    const recurrentMachines = Object.entries(recentFailuresByMachine)
      .filter(([, count]) => count >= 2)
      .length;

    // 9. Top subcomponentes con más fallas
    const subcomponentCounts = failures.reduce((acc, f) => {
      if (f.subcomponentId) {
        if (!acc[f.subcomponentId]) acc[f.subcomponentId] = 0;
        acc[f.subcomponentId]++;
      }
      return acc;
    }, {} as Record<number, number>);

    const topSubcomponentIds = Object.entries(subcomponentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => parseInt(id));

    // Obtener nombres de subcomponentes
    let topSubcomponents: any[] = [];
    if (topSubcomponentIds.length > 0) {
      const subcomponents = await prisma.machineSubComponent.findMany({
        where: { id: { in: topSubcomponentIds } },
        select: { id: true, name: true }
      });

      topSubcomponents = topSubcomponentIds.map(id => {
        const sub = subcomponents.find(s => s.id === id);
        return {
          id,
          name: sub?.name || `Subcomponente ${id}`,
          count: subcomponentCounts[id]
        };
      });
    }

    // 10. Downtime total
    const downtimeLogs = await prisma.downtimeLog.findMany({
      where: {
        companyId,
        startedAt: { gte: startDate, lte: endDate },
        endedAt: { not: null },
        ...(machineId && { machineId })
      },
      select: { totalMinutes: true }
    });

    const totalDowntimeMinutes = downtimeLogs.reduce((sum, d) => sum + (d.totalMinutes || 0), 0);

    // 11. Resumen
    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate,
          endDate,
          days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        },
        summary: {
          totalFailures: failures.length,
          openFailures: failures.filter(f => !['RESOLVED', 'RESOLVED_IMMEDIATE', 'CANCELLED'].includes(f.status || '')).length,
          resolvedFailures: resolvedFailures.length,
          closedWorkOrders: closedWorkOrders.length,
          failuresWithDowntime: failures.filter(f => f.causedDowntime).length
        },
        mttr: {
          minutes: mttrMinutes,
          hours: Math.round(mttrMinutes / 60 * 10) / 10,
          formatted: mttrMinutes < 60
            ? `${mttrMinutes}m`
            : `${Math.floor(mttrMinutes / 60)}h ${mttrMinutes % 60}m`
        },
        sla: {
          overall: closedWorkOrders.length > 0
            ? Math.round((Object.values(slaByPriority).reduce((sum, p) => sum + p.onTime, 0) /
                Object.values(slaByPriority).reduce((sum, p) => sum + p.total, 0)) * 100) || 100
            : 100,
          byPriority: slaCompliance,
          thresholds: {
            P1: settings.slaP1Hours,
            P2: settings.slaP2Hours,
            P3: settings.slaP3Hours,
            P4: settings.slaP4Hours
          }
        },
        recurrence: {
          recurrentMachines,
          windowDays: settings.recurrenceWindowDays,
          rate: failures.length > 0
            ? Math.round((recurrentMachines / Object.keys(recentFailuresByMachine).length) * 100) || 0
            : 0
        },
        downtime: {
          totalMinutes: totalDowntimeMinutes,
          totalHours: Math.round(totalDowntimeMinutes / 60 * 10) / 10,
          formatted: totalDowntimeMinutes < 60
            ? `${totalDowntimeMinutes}m`
            : `${Math.floor(totalDowntimeMinutes / 60)}h ${totalDowntimeMinutes % 60}m`
        },
        topSubcomponents
      }
    });

  } catch (error) {
    console.error('❌ Error en GET /api/metrics/corrective:', error);
    return NextResponse.json(
      { error: 'Error al obtener métricas' },
      { status: 500 }
    );
  }
}
