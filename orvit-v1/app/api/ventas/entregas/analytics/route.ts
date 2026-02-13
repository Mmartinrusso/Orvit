import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET - Delivery Analytics Dashboard
 * Returns comprehensive metrics about delivery performance
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    const viewMode = getViewMode(request);
    const companyId = user!.companyId;

    // Build date filter
    const dateFilter: Prisma.SaleDeliveryWhereInput = {};
    if (fechaDesde) {
      dateFilter.createdAt = { gte: new Date(fechaDesde) };
    }
    if (fechaHasta) {
      dateFilter.createdAt = {
        ...dateFilter.createdAt,
        lte: new Date(fechaHasta),
      };
    }

    const baseWhere = applyViewMode({ companyId, ...dateFilter }, viewMode);

    // Execute all analytics queries in parallel
    const [
      totalDeliveries,
      statusBreakdown,
      onTimeStats,
      avgDeliveryTime,
      failureReasons,
      topDrivers,
      deliveriesByType,
      recentTrends,
    ] = await Promise.all([
      // Total deliveries
      prisma.saleDelivery.count({ where: baseWhere }),

      // Status breakdown
      prisma.saleDelivery.groupBy({
        by: ['estado'],
        where: baseWhere,
        _count: { estado: true },
      }),

      // On-time delivery rate (delivered before or on scheduled date)
      calculateOnTimeRate(baseWhere),

      // Average delivery time (from creation to delivery)
      calculateAvgDeliveryTime(baseWhere),

      // Failure reasons (from notes)
      calculateFailureReasons(baseWhere),

      // Top performing drivers
      prisma.saleDelivery.groupBy({
        by: ['conductorNombre'],
        where: {
          ...baseWhere,
          conductorNombre: { not: null },
          estado: 'ENTREGADA',
        },
        _count: { conductorNombre: true },
        orderBy: { _count: { conductorNombre: 'desc' } },
        take: 10,
      }),

      // Deliveries by type (ENVIO vs RETIRO)
      prisma.saleDelivery.groupBy({
        by: ['tipo'],
        where: baseWhere,
        _count: { tipo: true },
      }),

      // Recent 7 days trend
      calculateRecentTrends(baseWhere),
    ]);

    // Calculate on-time percentage
    const onTimePercentage =
      onTimeStats.total > 0
        ? Math.round((onTimeStats.onTime / onTimeStats.total) * 100)
        : 0;

    // Format response
    const analytics = {
      overview: {
        totalDeliveries,
        onTimeRate: onTimePercentage,
        avgDeliveryTimeHours: avgDeliveryTime,
      },
      statusBreakdown: statusBreakdown.map((s) => ({
        estado: s.estado,
        count: s._count.estado,
        percentage: Math.round((s._count.estado / totalDeliveries) * 100),
      })),
      deliveriesByType: deliveriesByType.map((t) => ({
        tipo: t.tipo,
        count: t._count.tipo,
        percentage: Math.round((t._count.tipo / totalDeliveries) * 100),
      })),
      topDrivers: topDrivers
        .filter((d) => d.conductorNombre)
        .map((d) => ({
          nombre: d.conductorNombre!,
          entregas: d._count.conductorNombre,
        })),
      failureAnalysis: failureReasons,
      trends: recentTrends,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching delivery analytics:', error);
    return NextResponse.json(
      { error: 'Error al obtener analíticas de entregas' },
      { status: 500 }
    );
  }
}

/**
 * Calculate on-time delivery rate
 */
async function calculateOnTimeRate(where: Prisma.SaleDeliveryWhereInput) {
  const delivered = await prisma.saleDelivery.findMany({
    where: {
      ...where,
      estado: 'ENTREGADA',
      fechaProgramada: { not: null },
      fechaEntrega: { not: null },
    },
    select: {
      fechaProgramada: true,
      fechaEntrega: true,
    },
  });

  const total = delivered.length;
  const onTime = delivered.filter(
    (d) => d.fechaEntrega && d.fechaProgramada && d.fechaEntrega <= d.fechaProgramada
  ).length;

  return { total, onTime };
}

/**
 * Calculate average delivery time in hours
 */
async function calculateAvgDeliveryTime(where: Prisma.SaleDeliveryWhereInput) {
  const deliveries = await prisma.saleDelivery.findMany({
    where: {
      ...where,
      estado: 'ENTREGADA',
      fechaEntrega: { not: null },
    },
    select: {
      createdAt: true,
      fechaEntrega: true,
    },
  });

  if (deliveries.length === 0) return 0;

  const totalHours = deliveries.reduce((sum, d) => {
    const diff = d.fechaEntrega!.getTime() - d.createdAt.getTime();
    return sum + diff / (1000 * 60 * 60); // Convert to hours
  }, 0);

  return Math.round((totalHours / deliveries.length) * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate failure reasons from notes
 */
async function calculateFailureReasons(where: Prisma.SaleDeliveryWhereInput) {
  const failed = await prisma.saleDelivery.findMany({
    where: {
      ...where,
      estado: 'ENTREGA_FALLIDA',
      notas: { not: null },
    },
    select: {
      notas: true,
    },
  });

  // Parse reasons from notes
  const reasons: Record<string, number> = {};

  failed.forEach((d) => {
    if (d.notas) {
      // Extract failure reason from notes (format: "ENTREGA FALLIDA - Motivo: X")
      const match = d.notas.match(/Motivo:\s*([^\n]+)/);
      if (match) {
        const reason = match[1].trim();
        reasons[reason] = (reasons[reason] || 0) + 1;
      }
    }
  });

  return Object.entries(reasons)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 reasons
}

/**
 * Calculate recent 7 days trend
 */
async function calculateRecentTrends(where: Prisma.SaleDeliveryWhereInput) {
  const trends = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.saleDelivery.count({
      where: {
        ...where,
        createdAt: {
          gte: date,
          lt: nextDate,
        },
      },
    });

    const delivered = await prisma.saleDelivery.count({
      where: {
        ...where,
        estado: 'ENTREGADA',
        fechaEntrega: {
          gte: date,
          lt: nextDate,
        },
      },
    });

    trends.push({
      date: date.toISOString().split('T')[0],
      created: count,
      delivered,
    });
  }

  return trends;
}
