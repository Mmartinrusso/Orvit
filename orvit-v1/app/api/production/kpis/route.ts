import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.DASHBOARD_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const workCenterId = searchParams.get('workCenterId');

    // Default: last 30 days
    const startDate = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateTo ? new Date(dateTo) : new Date();

    // Build where clause for date filtering
    const dateFilter: any = {
      gte: startDate,
      lte: endDate,
    };

    // ====== PRODUCTION ORDER METRICS ======
    const orderStats = await prisma.productionOrder.groupBy({
      by: ['status'],
      where: {
        companyId: user!.companyId,
        ...(workCenterId ? { workCenterId: parseInt(workCenterId) } : {}),
      },
      _count: { id: true },
    });

    const ordersInProgress = orderStats.find(s => s.status === 'IN_PROGRESS')?._count?.id || 0;
    const ordersCompleted = orderStats.find(s => s.status === 'COMPLETED')?._count?.id || 0;
    const ordersPaused = orderStats.find(s => s.status === 'PAUSED')?._count?.id || 0;
    const ordersTotal = orderStats.reduce((acc, s) => acc + (s._count?.id || 0), 0);

    // Plan vs Real for orders completed in period
    const completedOrders = await prisma.productionOrder.findMany({
      where: {
        companyId: user!.companyId,
        status: 'COMPLETED',
        actualEndDate: dateFilter,
        ...(workCenterId ? { workCenterId: parseInt(workCenterId) } : {}),
      },
      select: {
        plannedQuantity: true,
        producedQuantity: true,
        scrapQuantity: true,
        reworkQuantity: true,
      },
    });

    const totalPlanned = completedOrders.reduce((acc, o) => acc + Number(o.plannedQuantity), 0);
    const totalProduced = completedOrders.reduce((acc, o) => acc + Number(o.producedQuantity), 0);
    const planVsRealPercent = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;

    // ====== DAILY REPORTS METRICS ======
    const dailyReports = await prisma.dailyProductionReport.findMany({
      where: {
        companyId: user!.companyId,
        date: dateFilter,
        ...(workCenterId ? { workCenterId: parseInt(workCenterId) } : {}),
      },
      select: {
        goodQuantity: true,
        scrapQuantity: true,
        reworkQuantity: true,
        productiveMinutes: true,
        downtimeMinutes: true,
        setupMinutes: true,
        shiftDurationMinutes: true,
      },
    });

    const totalGood = dailyReports.reduce((acc, r) => acc + Number(r.goodQuantity), 0);
    const totalScrap = dailyReports.reduce((acc, r) => acc + Number(r.scrapQuantity), 0);
    const totalRework = dailyReports.reduce((acc, r) => acc + Number(r.reworkQuantity), 0);
    const totalProductiveMinutes = dailyReports.reduce((acc, r) => acc + r.productiveMinutes, 0);
    const totalDowntimeMinutes = dailyReports.reduce((acc, r) => acc + r.downtimeMinutes, 0);
    const totalShiftMinutes = dailyReports.reduce((acc, r) => acc + r.shiftDurationMinutes, 0);

    const scrapPercent = (totalGood + totalScrap) > 0
      ? (totalScrap / (totalGood + totalScrap)) * 100
      : 0;

    const availabilityPercent = totalShiftMinutes > 0
      ? ((totalShiftMinutes - totalDowntimeMinutes) / totalShiftMinutes) * 100
      : 0;

    // ====== DOWNTIME METRICS ======
    const downtimes = await prisma.productionDowntime.findMany({
      where: {
        companyId: user!.companyId,
        startTime: dateFilter,
        ...(workCenterId ? { workCenterId: parseInt(workCenterId) } : {}),
      },
      include: {
        reasonCode: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    const totalDowntimeEvents = downtimes.length;
    const totalDowntimeDuration = downtimes.reduce((acc, d) => acc + (d.durationMinutes || 0), 0);
    const unplannedDowntimes = downtimes.filter(d => d.type === 'UNPLANNED').length;
    const plannedDowntimes = downtimes.filter(d => d.type === 'PLANNED').length;

    // Pareto: Top downtime reasons
    const downtimeByReason: Record<string, { code: string; name: string; count: number; minutes: number }> = {};
    for (const dt of downtimes) {
      const key = dt.reasonCodeId?.toString() || 'sin-codigo';
      if (!downtimeByReason[key]) {
        downtimeByReason[key] = {
          code: dt.reasonCode?.code || 'N/A',
          name: dt.reasonCode?.name || 'Sin código',
          count: 0,
          minutes: 0,
        };
      }
      downtimeByReason[key].count++;
      downtimeByReason[key].minutes += dt.durationMinutes || 0;
    }

    const paretoDowntimes = Object.values(downtimeByReason)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10);

    // ====== QUALITY METRICS ======
    const qualityStats = await prisma.productionQualityControl.groupBy({
      by: ['result'],
      where: {
        companyId: user!.companyId,
        inspectedAt: dateFilter,
      },
      _count: { id: true },
    });

    const qualityApproved = qualityStats.find(s => s.result === 'APPROVED')?._count?.id || 0;
    const qualityRejected = qualityStats.find(s => s.result === 'REJECTED')?._count?.id || 0;
    const qualityHold = qualityStats.find(s => s.result === 'HOLD')?._count?.id || 0;
    const qualityTotal = qualityStats.reduce((acc, s) => acc + (s._count?.id || 0), 0);

    // ====== LOT METRICS ======
    const lotStats = await prisma.productionBatchLot.groupBy({
      by: ['qualityStatus'],
      where: {
        companyId: user!.companyId,
      },
      _count: { id: true },
    });

    const lotsBlocked = lotStats.find(s => s.qualityStatus === 'BLOCKED')?._count?.id || 0;
    const lotsPending = lotStats.find(s => s.qualityStatus === 'PENDING')?._count?.id || 0;
    const lotsApproved = lotStats.find(s => s.qualityStatus === 'APPROVED')?._count?.id || 0;

    // ====== RECENT EVENTS ======
    const recentEvents = await prisma.productionEvent.findMany({
      where: {
        companyId: user!.companyId,
        performedAt: dateFilter,
      },
      include: {
        performedBy: {
          select: {
            name: true,
          },
        },
        productionOrder: {
          select: {
            code: true,
          },
        },
      },
      orderBy: { performedAt: 'desc' },
      take: 10,
    });

    // ====== PRODUCTION BY DAY (for chart) ======
    const productionByDay = await prisma.dailyProductionReport.groupBy({
      by: ['date'],
      where: {
        companyId: user!.companyId,
        date: dateFilter,
        ...(workCenterId ? { workCenterId: parseInt(workCenterId) } : {}),
      },
      _sum: {
        goodQuantity: true,
        scrapQuantity: true,
      },
      orderBy: { date: 'asc' },
    });

    const chartData = productionByDay.map(d => ({
      date: d.date.toISOString().split('T')[0],
      good: Number(d._sum.goodQuantity) || 0,
      scrap: Number(d._sum.scrapQuantity) || 0,
    }));

    return NextResponse.json({
      success: true,
      kpis: {
        // Orders
        orders: {
          total: ordersTotal,
          inProgress: ordersInProgress,
          completed: ordersCompleted,
          paused: ordersPaused,
          planVsRealPercent: Math.round(planVsRealPercent * 10) / 10,
        },
        // Production
        production: {
          totalGood,
          totalScrap,
          totalRework,
          scrapPercent: Math.round(scrapPercent * 100) / 100,
          totalProductiveMinutes,
          totalDowntimeMinutes,
          availabilityPercent: Math.round(availabilityPercent * 10) / 10,
        },
        // Downtimes
        downtimes: {
          total: totalDowntimeEvents,
          totalMinutes: totalDowntimeDuration,
          unplanned: unplannedDowntimes,
          planned: plannedDowntimes,
          paretoByReason: paretoDowntimes,
        },
        // Quality
        quality: {
          total: qualityTotal,
          approved: qualityApproved,
          rejected: qualityRejected,
          hold: qualityHold,
          approvalRate: qualityTotal > 0
            ? Math.round((qualityApproved / qualityTotal) * 1000) / 10
            : 0,
        },
        // Lots
        lots: {
          blocked: lotsBlocked,
          pending: lotsPending,
          approved: lotsApproved,
        },
        // Charts
        charts: {
          productionByDay: chartData,
        },
        // Recent Activity
        recentEvents: recentEvents.map(e => ({
          id: e.id,
          type: e.eventType,
          entityType: e.entityType,
          orderCode: e.productionOrder?.code,
          performedBy: e.performedBy?.name,
          performedAt: e.performedAt,
          notes: e.notes,
        })),
      },
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching production KPIs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
