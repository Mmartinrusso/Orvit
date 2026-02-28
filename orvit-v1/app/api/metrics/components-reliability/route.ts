/**
 * API: /api/metrics/components-reliability
 *
 * GET - Análisis de confiabilidad por componente
 *       Combina FailureOccurrence.subcomponentId con WorkOrder.componentId
 *       para calcular: fallas por componente, MTTR, ranking, isSafetyCritical
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Autenticación
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

    // 2. Params
    const searchParams = request.nextUrl.searchParams;
    const period = parseInt(searchParams.get('period') || '90');
    const machineId = searchParams.get('machineId') ? parseInt(searchParams.get('machineId')!) : undefined;

    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    // 3. Fallas con subcomponente identificado
    const failureFilter: any = {
      companyId,
      subcomponentId: { not: null },
      reportedAt: { gte: startDate },
      isLinkedDuplicate: false,
    };
    if (machineId) failureFilter.machineId = machineId;

    const failures = await prisma.failureOccurrence.findMany({
      where: failureFilter,
      select: {
        subcomponentId: true,
        reportedAt: true,
        resolvedAt: true,
        machineId: true,
      },
    });

    // 4. Work orders correctivas con componente identificado (para MTTR)
    const woFilter: any = {
      companyId,
      componentId: { not: null },
      type: { in: ['CORRECTIVE', 'FAILURE'] },
      status: 'COMPLETED',
      completedDate: { gte: startDate },
    };
    if (machineId) woFilter.machineId = machineId;

    const workOrders = await prisma.workOrder.findMany({
      where: woFilter,
      select: {
        componentId: true,
        actualHours: true,
        startedDate: true,
        completedDate: true,
      },
    });

    // 5. Agrupar fallas por componentId
    const failuresByComponent: Record<number, { count: number; machineIds: Set<number> }> = {};
    for (const f of failures) {
      const cid = f.subcomponentId!;
      if (!failuresByComponent[cid]) {
        failuresByComponent[cid] = { count: 0, machineIds: new Set() };
      }
      failuresByComponent[cid].count++;
      if (f.machineId) failuresByComponent[cid].machineIds.add(f.machineId);
    }

    // 6. Agrupar work orders por componentId para MTTR
    const woByComponent: Record<number, { totalMinutes: number; count: number }> = {};
    for (const wo of workOrders) {
      const cid = wo.componentId!;
      if (!woByComponent[cid]) woByComponent[cid] = { totalMinutes: 0, count: 0 };

      let repairMinutes = 0;
      if (wo.actualHours) {
        repairMinutes = wo.actualHours * 60;
      } else if (wo.startedDate && wo.completedDate) {
        repairMinutes = (new Date(wo.completedDate).getTime() - new Date(wo.startedDate).getTime()) / 60000;
      }
      if (repairMinutes > 0) {
        woByComponent[cid].totalMinutes += repairMinutes;
        woByComponent[cid].count++;
      }
    }

    // 7. Todos los componentIds involucrados
    const allComponentIds = new Set([
      ...Object.keys(failuresByComponent).map(Number),
      ...Object.keys(woByComponent).map(Number),
    ]);

    if (allComponentIds.size === 0) {
      return NextResponse.json({
        success: true,
        data: {
          period: { days: period, startDate, machineId },
          components: [],
          kpis: {
            totalComponents: 0,
            safetyCriticalFailing: 0,
            topComponentName: null,
            avgMttrMinutes: null,
          },
        },
      });
    }

    // 8. Fetch nombres e info de componentes
    const components = await prisma.component.findMany({
      where: { id: { in: Array.from(allComponentIds) } },
      select: {
        id: true,
        name: true,
        criticality: true,
        isSafetyCritical: true,
        machineId: true,
        machine: { select: { name: true } },
      },
    });

    const componentMap = new Map(components.map(c => [c.id, c]));

    // 9. Construir resultado por componente
    const periodHours = period * 24;
    const result = Array.from(allComponentIds).map(cid => {
      const comp = componentMap.get(cid);
      const failData = failuresByComponent[cid];
      const woData = woByComponent[cid];

      const failureCount = failData?.count ?? 0;
      const mttrMinutes =
        woData && woData.count > 0 ? Math.round(woData.totalMinutes / woData.count) : null;

      // MTBF simple: horas del período / número de fallas
      const mtbfHours = failureCount > 0 ? Math.round((periodHours / failureCount) * 10) / 10 : null;

      return {
        componentId: cid,
        componentName: comp?.name ?? `Componente #${cid}`,
        machineName: comp?.machine?.name ?? null,
        machineId: comp?.machineId ?? null,
        criticality: comp?.criticality ?? null,
        isSafetyCritical: comp?.isSafetyCritical ?? false,
        failureCount,
        mttrMinutes,
        mtbfHours,
      };
    });

    // 10. Ordenar por fallas desc
    result.sort((a, b) => b.failureCount - a.failureCount);

    // 11. KPIs globales
    const totalFailures = result.reduce((s, c) => s + c.failureCount, 0);
    const safetyCriticalFailing = result.filter(c => c.isSafetyCritical && c.failureCount > 0).length;
    const topComponent = result[0] ?? null;

    const mttrValues = result.filter(c => c.mttrMinutes !== null).map(c => c.mttrMinutes!);
    const avgMttrMinutes =
      mttrValues.length > 0 ? Math.round(mttrValues.reduce((s, v) => s + v, 0) / mttrValues.length) : null;

    return NextResponse.json({
      success: true,
      data: {
        period: { days: period, startDate, machineId },
        components: result,
        kpis: {
          totalComponents: result.filter(c => c.failureCount > 0).length,
          totalFailures,
          safetyCriticalFailing,
          topComponentName: topComponent?.componentName ?? null,
          topComponentFailures: topComponent?.failureCount ?? 0,
          avgMttrMinutes,
        },
      },
    });
  } catch (error) {
    console.error('Error en GET /api/metrics/components-reliability:', error);
    return NextResponse.json(
      { error: 'Error al obtener confiabilidad por componentes' },
      { status: 500 }
    );
  }
}
