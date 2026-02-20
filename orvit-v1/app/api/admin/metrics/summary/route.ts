import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/metrics/summary
 *
 * KPIs rápidos de los últimos 30 días vs período anterior:
 * - work_orders_created (total)
 * - work_orders_completed (total)
 * - resolution_time (promedio en ms)
 * - costs_calculated (total)
 * - successful_logins (total)
 * - failed_logins (total)
 */
export const GET = withGuards(async (request: NextRequest, { user }) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const metricNames = [
      'work_orders_created',
      'work_orders_completed',
      'resolution_time',
      'costs_calculated',
      'successful_logins',
      'failed_logins',
    ];

    // Obtener datos de período actual y anterior en paralelo
    const [currentPeriod, previousPeriod] = await Promise.all([
      prisma.businessMetric.groupBy({
        by: ['name'],
        where: {
          companyId: user.companyId,
          name: { in: metricNames },
          timestamp: { gte: thirtyDaysAgo, lte: now },
        },
        _sum: { value: true },
        _avg: { value: true },
        _count: { _all: true },
      }),
      prisma.businessMetric.groupBy({
        by: ['name'],
        where: {
          companyId: user.companyId,
          name: { in: metricNames },
          timestamp: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
        _sum: { value: true },
        _avg: { value: true },
        _count: { _all: true },
      }),
    ]);

    // Construir mapa de métricas
    const currentMap = new Map(
      currentPeriod.map(m => [m.name, {
        total: m._sum.value ?? 0,
        avg: m._avg.value ?? 0,
        count: m._count._all,
      }])
    );

    const previousMap = new Map(
      previousPeriod.map(m => [m.name, {
        total: m._sum.value ?? 0,
        avg: m._avg.value ?? 0,
        count: m._count._all,
      }])
    );

    // Helper para calcular cambio porcentual
    const pctChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const buildKPI = (name: string, useAvg = false) => {
      const curr = currentMap.get(name) ?? { total: 0, avg: 0, count: 0 };
      const prev = previousMap.get(name) ?? { total: 0, avg: 0, count: 0 };
      const currentValue = useAvg ? curr.avg : curr.total;
      const previousValue = useAvg ? prev.avg : prev.total;

      return {
        current: currentValue,
        previous: previousValue,
        change: pctChange(currentValue, previousValue),
        count: curr.count,
      };
    };

    const summary = {
      work_orders_created: buildKPI('work_orders_created'),
      work_orders_completed: buildKPI('work_orders_completed'),
      resolution_time: buildKPI('resolution_time', true),
      costs_calculated: buildKPI('costs_calculated'),
      successful_logins: buildKPI('successful_logins'),
      failed_logins: buildKPI('failed_logins'),
      period: {
        current: { start: thirtyDaysAgo.toISOString(), end: now.toISOString() },
        previous: { start: sixtyDaysAgo.toISOString(), end: thirtyDaysAgo.toISOString() },
      },
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error en GET /api/admin/metrics/summary:', error);
    return NextResponse.json(
      { error: 'Error al obtener resumen de métricas' },
      { status: 500 }
    );
  }
});
