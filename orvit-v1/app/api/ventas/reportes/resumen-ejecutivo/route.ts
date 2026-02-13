import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

// GET - Resumen ejecutivo con métricas clave
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const isExtended = viewMode === 'E';

    const { searchParams } = new URL(request.url);
    const fechaDesdeParam = searchParams.get('fechaDesde');
    const fechaHastaParam = searchParams.get('fechaHasta');

    // Período actual
    const fechaHasta = fechaHastaParam ? new Date(fechaHastaParam) : new Date();
    const fechaDesde = fechaDesdeParam
      ? new Date(fechaDesdeParam)
      : new Date(fechaHasta.getFullYear(), fechaHasta.getMonth(), 1); // Inicio del mes actual

    // Período anterior (mismo rango)
    const diasPeriodo = Math.ceil((fechaHasta.getTime() - fechaDesde.getTime()) / (1000 * 60 * 60 * 24));
    const fechaDesdeAnterior = new Date(fechaDesde.getTime() - (diasPeriodo * 24 * 60 * 60 * 1000));
    const fechaHastaAnterior = new Date(fechaDesde.getTime() - (24 * 60 * 60 * 1000));

    const docTypeFilter = isExtended ? {} : { docType: 'T1' as const };

    // Métricas período actual
    const [
      cotizacionesActual,
      ordenesActual,
      facturasActual,
      pagosActual,
      clientesNuevosActual,
    ] = await Promise.all([
      prisma.quote.aggregate({
        where: {
          companyId,
          fechaEmision: { gte: fechaDesde, lte: fechaHasta },
        },
        _count: true,
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: {
          companyId,
          ...docTypeFilter,
          fechaEmision: { gte: fechaDesde, lte: fechaHasta },
        },
        _count: true,
        _sum: { total: true },
      }),
      prisma.salesInvoice.aggregate({
        where: {
          companyId,
          ...docTypeFilter,
          fechaEmision: { gte: fechaDesde, lte: fechaHasta },
        },
        _count: true,
        _sum: { total: true, saldoPendiente: true },
      }),
      prisma.clientPayment.aggregate({
        where: {
          companyId,
          ...docTypeFilter,
          estado: 'CONFIRMADO',
          fechaPago: { gte: fechaDesde, lte: fechaHasta },
        },
        _sum: { totalPago: true },
      }),
      prisma.client.count({
        where: {
          companyId,
          createdAt: { gte: fechaDesde, lte: fechaHasta },
        },
      }),
    ]);

    // Métricas período anterior (para comparación)
    const [
      ordenesAnterior,
      facturasAnterior,
      pagosAnterior,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          companyId,
          ...docTypeFilter,
          fechaEmision: { gte: fechaDesdeAnterior, lte: fechaHastaAnterior },
        },
        _sum: { total: true },
      }),
      prisma.salesInvoice.aggregate({
        where: {
          companyId,
          ...docTypeFilter,
          fechaEmision: { gte: fechaDesdeAnterior, lte: fechaHastaAnterior },
        },
        _sum: { total: true },
      }),
      prisma.clientPayment.aggregate({
        where: {
          companyId,
          ...docTypeFilter,
          estado: 'CONFIRMADO',
          fechaPago: { gte: fechaDesdeAnterior, lte: fechaHastaAnterior },
        },
        _sum: { totalPago: true },
      }),
    ]);

    // Calcular variaciones
    const calcVariacion = (actual: number, anterior: number) => {
      if (anterior === 0) return actual > 0 ? 100 : 0;
      return Math.round(((actual - anterior) / anterior) * 100);
    };

    const ventasActual = Number(ordenesActual._sum.total || 0);
    const ventasAnterior = Number(ordenesAnterior._sum.total || 0);
    const facturadoActual = Number(facturasActual._sum.total || 0);
    const facturadoAnterior = Number(facturasAnterior._sum.total || 0);
    const cobradoActual = Number(pagosActual._sum.totalPago || 0);
    const cobradoAnterior = Number(pagosAnterior._sum.totalPago || 0);

    // KPIs de conversión
    const cotizacionesAceptadas = await prisma.quote.count({
      where: {
        companyId,
        estado: 'ACEPTADA',
        fechaEmision: { gte: fechaDesde, lte: fechaHasta },
      },
    });

    const tasaConversion = cotizacionesActual._count > 0
      ? Math.round((cotizacionesAceptadas / cotizacionesActual._count) * 100)
      : 0;

    // Cobranzas pendientes totales
    const cobranzasPendientes = await prisma.salesInvoice.aggregate({
      where: {
        companyId,
        ...docTypeFilter,
        estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
        saldoPendiente: { gt: 0 },
      },
      _sum: { saldoPendiente: true },
      _count: true,
    });

    // Top 5 clientes del período
    const ventasPorCliente = await prisma.sale.groupBy({
      by: ['clientId'],
      where: {
        companyId,
        ...docTypeFilter,
        fechaEmision: { gte: fechaDesde, lte: fechaHasta },
      },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    });

    const clientesIds = ventasPorCliente.map(v => v.clientId);
    const clientesInfo = await prisma.client.findMany({
      where: { id: { in: clientesIds } },
      select: { id: true, legalName: true, name: true },
    });

    const topClientes = ventasPorCliente.map(v => {
      const cliente = clientesInfo.find(c => c.id === v.clientId);
      return {
        cliente: cliente?.legalName || cliente?.name || 'Cliente',
        total: Number(v._sum.total || 0),
        ordenes: v._count,
      };
    });

    // Top 5 vendedores del período
    const ventasPorVendedor = await prisma.sale.groupBy({
      by: ['sellerId'],
      where: {
        companyId,
        ...docTypeFilter,
        fechaEmision: { gte: fechaDesde, lte: fechaHasta },
        sellerId: { not: null },
      },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    });

    const vendedoresIds = ventasPorVendedor.map(v => v.sellerId).filter(Boolean) as number[];
    const vendedoresInfo = await prisma.user.findMany({
      where: { id: { in: vendedoresIds } },
      select: { id: true, name: true },
    });

    const topVendedores = ventasPorVendedor.map(v => {
      const vendedor = vendedoresInfo.find(u => u.id === v.sellerId);
      return {
        vendedor: vendedor?.name || 'Vendedor',
        total: Number(v._sum.total || 0),
        ordenes: v._count,
      };
    });

    // Ventas por día (últimos 30 días para gráfico)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const ventasDiarias = await prisma.sale.findMany({
      where: {
        companyId,
        ...docTypeFilter,
        fechaEmision: { gte: hace30Dias },
      },
      select: {
        fechaEmision: true,
        total: true,
      },
    });

    // Agrupar por día
    const ventasPorDia = new Map<string, number>();
    ventasDiarias.forEach(v => {
      const dia = new Date(v.fechaEmision).toISOString().split('T')[0];
      ventasPorDia.set(dia, (ventasPorDia.get(dia) || 0) + Number(v.total));
    });

    const graficoVentas = Array.from(ventasPorDia.entries())
      .map(([fecha, total]) => ({ fecha, total }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    return NextResponse.json({
      periodo: {
        desde: fechaDesde.toISOString().split('T')[0],
        hasta: fechaHasta.toISOString().split('T')[0],
        dias: diasPeriodo,
      },
      kpis: {
        ventas: {
          valor: ventasActual,
          variacion: calcVariacion(ventasActual, ventasAnterior),
          ordenes: ordenesActual._count,
        },
        facturado: {
          valor: facturadoActual,
          variacion: calcVariacion(facturadoActual, facturadoAnterior),
          facturas: facturasActual._count,
        },
        cobrado: {
          valor: cobradoActual,
          variacion: calcVariacion(cobradoActual, cobradoAnterior),
        },
        pendiente: {
          valor: Number(cobranzasPendientes._sum.saldoPendiente || 0),
          facturas: cobranzasPendientes._count,
        },
        cotizaciones: {
          emitidas: cotizacionesActual._count,
          total: Number(cotizacionesActual._sum.total || 0),
          tasaConversion,
        },
        clientesNuevos: clientesNuevosActual,
        ticketPromedio: ordenesActual._count > 0
          ? Math.round(ventasActual / ordenesActual._count)
          : 0,
      },
      topClientes,
      topVendedores,
      graficoVentas,
      comparativa: {
        periodoActual: {
          desde: fechaDesde.toISOString().split('T')[0],
          hasta: fechaHasta.toISOString().split('T')[0],
          ventas: ventasActual,
        },
        periodoAnterior: {
          desde: fechaDesdeAnterior.toISOString().split('T')[0],
          hasta: fechaHastaAnterior.toISOString().split('T')[0],
          ventas: ventasAnterior,
        },
      },
      generadoEn: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generando resumen ejecutivo:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
