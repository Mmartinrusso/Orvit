import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

/**
 * GET /api/machines/[id]/stats
 * Obtiene estadísticas completas de una máquina para el overview
 * ✨ OPTIMIZADO: Queries paralelas y raw SQL donde es beneficioso
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const machineId = parseInt(params.id);

    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'Invalid machine ID' }, { status: 400 });
    }

    // ✨ OPTIMIZADO: Ejecutar todas las queries en paralelo
    const [
      machine,
      countsResult,
      failuresCount,
      workOrdersCount,
      upcomingMaintenance,
      recentWorkOrders,
      recentFailures
    ] = await Promise.all([
      // Query 1: Machine básico
      prisma.machine.findUnique({
        where: { id: machineId },
        select: {
          id: true,
          name: true,
          companyId: true,
          acquisitionDate: true,
        },
      }),

      // Query 2: Conteos simples en una query raw
      prisma.$queryRaw<{ components: bigint; documents: bigint }[]>`
        SELECT
          (SELECT COUNT(*) FROM "Component" WHERE "machineId" = ${machineId}) as components,
          (SELECT COUNT(*) FROM "Document" WHERE "machineId" = ${machineId}) as documents
      `,

      // Query 3: Failures por status
      prisma.failure.groupBy({
        by: ['status'],
        where: { machine_id: machineId },
        _count: true,
      }),

      // Query 4: Work orders por status
      prisma.workOrder.groupBy({
        by: ['status'],
        where: { machineId },
        _count: true,
      }),

      // Query 5: Próximos mantenimientos
      prisma.workOrder.findMany({
        where: {
          machineId,
          status: { in: ['PENDING', 'SCHEDULED'] },
          scheduledDate: { gte: new Date() },
        },
        select: {
          id: true,
          title: true,
          scheduledDate: true,
          priority: true,
        },
        orderBy: { scheduledDate: 'asc' },
        take: 5,
      }),

      // Query 6: Últimas órdenes de trabajo
      prisma.workOrder.findMany({
        where: { machineId },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          completedDate: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // Query 7: Últimas fallas
      prisma.failure.findMany({
        where: { machine_id: machineId },
        select: {
          id: true,
          title: true,
          status: true,
          reported_date: true,
        },
        orderBy: { reported_date: 'desc' },
        take: 5,
      })
    ]);

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
    }

    // Procesar conteos de failures
    const openFailures = failuresCount.find(f => f.status === 'OPEN' || f.status === 'PENDING')?._count || 0;
    const inProgressFailures = failuresCount.find(f => f.status === 'IN_PROGRESS')?._count || 0;
    const resolvedFailures = failuresCount.find(f => f.status === 'RESOLVED' || f.status === 'COMPLETED')?._count || 0;
    const totalFailures = failuresCount.reduce((sum, f) => sum + f._count, 0);

    // Procesar conteos de work orders
    const pendingWorkOrders = workOrdersCount.find(w => w.status === 'PENDING')?._count || 0;
    const inProgressWorkOrders = workOrdersCount.find(w => w.status === 'IN_PROGRESS')?._count || 0;
    const completedWorkOrders = workOrdersCount.find(w => w.status === 'COMPLETED')?._count || 0;
    const totalWorkOrders = workOrdersCount.reduce((sum, w) => sum + w._count, 0);

    // Conteos simples
    const totalComponents = Number(countsResult[0]?.components || 0);
    const totalDocuments = Number(countsResult[0]?.documents || 0);

    // Combine and sort recent activity
    const recentActivity = [
      ...recentWorkOrders.map(wo => ({
        id: wo.id,
        type: 'workOrder' as const,
        title: wo.title,
        date: (wo.completedDate || wo.createdAt).toISOString(),
        status: wo.status,
      })),
      ...recentFailures.map(f => ({
        id: f.id,
        type: 'failure' as const,
        title: f.title,
        date: (f.reported_date || new Date()).toISOString(),
        status: f.status,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

    // ✨ OPTIMIZADO: KPIs y costos en paralelo
    const [completedWOs, resolvedFailuresData, costsData] = await Promise.all([
      // Query para MTTR
      prisma.workOrder.findMany({
        where: {
          machineId,
          status: 'COMPLETED',
          completedDate: { not: null },
          startedDate: { not: null },
        },
        select: {
          startedDate: true,
          completedDate: true,
          actualHours: true,
        },
        orderBy: { completedDate: 'desc' },
        take: 20,
      }),

      // Query para MTBF
      prisma.failure.findMany({
        where: {
          machine_id: machineId,
          status: { in: ['RESOLVED', 'COMPLETED'] },
          resolved_date: { not: null },
        },
        select: { reported_date: true, resolved_date: true },
        orderBy: { reported_date: 'asc' },
        take: 100, // Limitar para performance
      }),

      // Query para costos (una sola query raw)
      prisma.$queryRaw<{ total_cost: number; last_month_cost: number }[]>`
        SELECT
          COALESCE(SUM(cost), 0) as total_cost,
          COALESCE(SUM(CASE WHEN "executedAt" >= NOW() - INTERVAL '1 month' THEN cost ELSE 0 END), 0) as last_month_cost
        FROM "maintenance_history"
        WHERE "machineId" = ${machineId}
      `.catch(() => [{ total_cost: 0, last_month_cost: 0 }])
    ]);

    // MTTR: Mean Time To Repair (hours)
    let mttr: number | null = null;
    if (completedWOs.length > 0) {
      const totalRepairTime = completedWOs.reduce((sum, wo) => {
        if (wo.actualHours) return sum + wo.actualHours;
        if (wo.startedDate && wo.completedDate) {
          const hours = (new Date(wo.completedDate).getTime() - new Date(wo.startedDate).getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);
      mttr = Math.round(totalRepairTime / completedWOs.length * 10) / 10;
    }

    // MTBF: Mean Time Between Failures (hours)
    let mtbf: number | null = null;
    if (resolvedFailuresData.length >= 2) {
      const firstFailure = resolvedFailuresData[0];
      const lastFailure = resolvedFailuresData[resolvedFailuresData.length - 1];
      if (firstFailure.reported_date && lastFailure.reported_date) {
        const totalHours = (new Date(lastFailure.reported_date).getTime() - new Date(firstFailure.reported_date).getTime()) / (1000 * 60 * 60);
        mtbf = Math.round(totalHours / (resolvedFailuresData.length - 1));
      }
    }

    // Availability
    let availability: number | null = null;
    if (mtbf !== null && mttr !== null && mtbf > 0) {
      availability = Math.round((mtbf / (mtbf + mttr)) * 100);
    }

    // Costos
    const costs = {
      totalMaintenance: Number(costsData[0]?.total_cost) || 0,
      lastMonth: Number(costsData[0]?.last_month_cost) || 0,
      spareParts: 0,
      labor: 0,
    };

    return NextResponse.json({
      stats: {
        totalFailures,
        openFailures: openFailures + inProgressFailures,
        resolvedFailures,
        totalWorkOrders,
        pendingWorkOrders,
        completedWorkOrders,
        inProgressWorkOrders,
        totalComponents,
        totalDocuments,
        upcomingMaintenance,
        recentActivity,
      },
      kpis: {
        mtbf,
        mttr,
        availability,
        oee: null, // Requires production data
      },
      costs,
      warranty: null, // Handled by separate warranty endpoint
      counters: [], // Handled by separate counters endpoint
    });
  } catch (error) {
    console.error('Error fetching machine stats:', error);
    return NextResponse.json(
      { error: 'Error fetching machine stats' },
      { status: 500 }
    );
  }
}
