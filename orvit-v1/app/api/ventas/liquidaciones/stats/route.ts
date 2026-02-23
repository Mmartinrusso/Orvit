import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - KPIs globales de liquidaciones
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LIQUIDACIONES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const finMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0);

    // Queries en paralelo
    const [
      pendientesPago,
      confirmadas,
      pagadasEsteMes,
      pagadasMesAnterior,
      totalAcumulado,
      porVendedor,
      ultimasLiquidaciones,
    ] = await Promise.all([
      // Total pendiente de pago (CONFIRMADA)
      prisma.sellerLiquidacion.aggregate({
        where: { companyId, estado: 'CONFIRMADA' },
        _sum: { totalLiquidacion: true },
        _count: true,
      }),

      // Cantidad confirmadas esperando pago
      prisma.sellerLiquidacion.count({
        where: { companyId, estado: 'CONFIRMADA' },
      }),

      // Pagado este mes
      prisma.sellerLiquidacion.aggregate({
        where: {
          companyId,
          estado: 'PAGADA',
          pagadoAt: { gte: inicioMes },
        },
        _sum: { totalLiquidacion: true },
        _count: true,
      }),

      // Pagado mes anterior (para variación)
      prisma.sellerLiquidacion.aggregate({
        where: {
          companyId,
          estado: 'PAGADA',
          pagadoAt: { gte: inicioMesAnterior, lte: finMesAnterior },
        },
        _sum: { totalLiquidacion: true },
      }),

      // Total acumulado pagado
      prisma.sellerLiquidacion.aggregate({
        where: { companyId, estado: 'PAGADA' },
        _sum: { totalLiquidacion: true },
        _count: true,
      }),

      // Desglose por vendedor (top 5 pendiente)
      prisma.sellerLiquidacion.groupBy({
        by: ['sellerId'],
        where: { companyId, estado: { in: ['CONFIRMADA', 'BORRADOR'] } },
        _sum: { totalLiquidacion: true },
        _count: true,
        orderBy: { _sum: { totalLiquidacion: 'desc' } },
        take: 5,
      }),

      // Últimas 5 liquidaciones
      prisma.sellerLiquidacion.findMany({
        where: { companyId },
        select: {
          id: true,
          numero: true,
          estado: true,
          totalLiquidacion: true,
          createdAt: true,
          seller: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Obtener nombres de vendedores para el desglose
    const sellerIds = porVendedor.map(pv => pv.sellerId);
    const sellers = await prisma.user.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, name: true },
    });
    const sellerMap = new Map(sellers.map(s => [s.id, s.name]));

    const pagadoEsteMesTotal = Number(pagadasEsteMes._sum.totalLiquidacion || 0);
    const pagadoMesAnteriorTotal = Number(pagadasMesAnterior._sum.totalLiquidacion || 0);
    const variacionPagos = pagadoMesAnteriorTotal > 0
      ? ((pagadoEsteMesTotal - pagadoMesAnteriorTotal) / pagadoMesAnteriorTotal) * 100
      : 0;

    return NextResponse.json({
      pendientePago: {
        total: Number(pendientesPago._sum.totalLiquidacion || 0),
        cantidad: pendientesPago._count,
      },
      confirmadas: {
        cantidad: confirmadas,
      },
      pagadoEsteMes: {
        total: pagadoEsteMesTotal,
        cantidad: pagadasEsteMes._count,
        variacion: variacionPagos,
      },
      totalAcumulado: {
        total: Number(totalAcumulado._sum.totalLiquidacion || 0),
        cantidad: totalAcumulado._count,
      },
      porVendedor: porVendedor.map(pv => ({
        sellerId: pv.sellerId,
        sellerName: sellerMap.get(pv.sellerId) || 'Desconocido',
        totalPendiente: Number(pv._sum.totalLiquidacion || 0),
        cantidad: pv._count,
      })),
      ultimasLiquidaciones: ultimasLiquidaciones.map(l => ({
        ...l,
        totalLiquidacion: Number(l.totalLiquidacion),
      })),
    });
  } catch (error) {
    console.error('Error fetching liquidaciones stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas de liquidaciones' },
      { status: 500 }
    );
  }
}
