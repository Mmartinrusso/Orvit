import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/work-orders/stats?companyId=123&sectorId=456
 *
 * ✅ OPTIMIZADO: Queries paralelas + métricas reales
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID es requerido' }, { status: 400 });
    }

    const companyIdNum = Number(companyId);
    const sectorIdNum = sectorId ? Number(sectorId) : null;

    // Base where con filtro opcional de sector
    const baseWhere: any = { companyId: companyIdNum };
    if (sectorIdNum) {
      baseWhere.OR = [
        { sectorId: sectorIdNum },
        { machine: { sectorId: sectorIdNum } }
      ];
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // ✅ OPTIMIZADO: Ejecutar TODAS las queries en paralelo
    const [
      statusStats,
      priorityStats,
      typeStats,
      totalCount,
      overdueCount,
      dueSoonCount,
      unassignedCount,
      completedThisMonth,
      mttrData,
      slaBreeched,
      waitingCount
    ] = await Promise.all([
      // 1. Por estado
      prisma.workOrder.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: true,
      }),

      // 2. Por prioridad (solo activas)
      prisma.workOrder.groupBy({
        by: ['priority'],
        where: {
          ...baseWhere,
          status: { notIn: ['COMPLETED', 'CANCELLED'] }
        },
        _count: true,
      }),

      // 3. Por tipo
      prisma.workOrder.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: true,
      }),

      // 4. Total
      prisma.workOrder.count({ where: baseWhere }),

      // 5. Vencidas REAL (scheduledDate pasada y no completada)
      prisma.workOrder.count({
        where: {
          ...baseWhere,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          scheduledDate: { lt: now }
        },
      }),

      // 6. Vencen pronto (próximas 24h)
      prisma.workOrder.count({
        where: {
          ...baseWhere,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          scheduledDate: {
            gte: now,
            lte: twentyFourHoursFromNow
          }
        },
      }),

      // 7. Sin asignar (P1/P2 críticas)
      prisma.workOrder.count({
        where: {
          ...baseWhere,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          assignedToId: null,
          priority: { in: ['HIGH', 'URGENT'] }
        },
      }),

      // 8. Completadas este mes
      prisma.workOrder.count({
        where: {
          ...baseWhere,
          status: 'COMPLETED',
          completedDate: { gte: startOfMonth },
        },
      }),

      // 9. MTTR real (tiempo promedio de resolución últimos 30 días)
      prisma.workOrder.aggregate({
        where: {
          ...baseWhere,
          status: 'COMPLETED',
          completedDate: { gte: thirtyDaysAgo },
          startedDate: { not: null },
        },
        _avg: { actualHours: true },
        _count: { id: true },
      }),

      // 10. SLA breached count
      prisma.workOrder.count({
        where: {
          ...baseWhere,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          slaStatus: 'BREACHED'
        },
      }),

      // 11. En espera
      prisma.workOrder.count({
        where: {
          ...baseWhere,
          status: 'WAITING'
        },
      }),
    ]);

    // Construir mapas
    const byStatus: Record<string, number> = {};
    statusStats.forEach(stat => { byStatus[stat.status] = stat._count; });

    const byPriority: Record<string, number> = {};
    priorityStats.forEach(stat => { byPriority[stat.priority] = stat._count; });

    const byType: Record<string, number> = {};
    typeStats.forEach(stat => { byType[stat.type] = stat._count; });

    // Calcular MTTR en horas
    const mttrHours = mttrData._avg.actualHours || 0;
    const mttrSampleSize = mttrData._count.id || 0;

    const stats = {
      total: totalCount,
      byStatus,
      byPriority,
      byType,
      // Métricas críticas
      overdue: overdueCount,
      dueSoon: dueSoonCount,
      unassigned: unassignedCount,
      waiting: waitingCount,
      slaBreeched,
      completedThisMonth,
      // MTTR real
      mttr: {
        hours: Math.round(mttrHours * 10) / 10,
        sampleSize: mttrSampleSize
      },
      // Computed
      activeCount: (byStatus['PENDING'] || 0) + (byStatus['SCHEDULED'] || 0) +
                   (byStatus['IN_PROGRESS'] || 0) + (byStatus['WAITING'] || 0) +
                   (byStatus['INCOMING'] || 0),
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error('Error en GET /api/work-orders/stats:', error);
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
} 