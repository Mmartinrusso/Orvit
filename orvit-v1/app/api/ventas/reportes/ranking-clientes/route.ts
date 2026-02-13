import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

// GET - Ranking de clientes por volumen de compras (optimized - no N+1)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const limite = parseInt(searchParams.get('limite') || '20');
    const ordenarPor = searchParams.get('ordenarPor') || 'monto'; // 'monto' | 'cantidad' | 'frecuencia'

    const dateFilter = {
      ...(fechaDesde && { gte: new Date(fechaDesde) }),
      ...(fechaHasta && { lte: new Date(fechaHasta) }),
    };
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // =====================================================
    // OPTIMIZED: Use groupBy to aggregate all data in bulk
    // Instead of N queries per client, we use 4 total queries
    // =====================================================

    // 1. Get all active clients in one query
    const clientes = await prisma.client.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        legalName: true,
        cuit: true,
        email: true,
        phone: true,
        currentBalance: true,
        creditLimit: true,
      },
    });

    // 2. Aggregate sales by client in ONE query
    const salesByClient = await prisma.sale.groupBy({
      by: ['clientId'],
      where: applyViewMode({
        companyId,
        ...(hasDateFilter && { fechaEmision: dateFilter }),
      }, viewMode),
      _sum: { total: true },
      _count: { id: true },
      _min: { fechaEmision: true },
      _max: { fechaEmision: true },
    });

    // 3. Aggregate invoices by client in ONE query
    const invoicesByClient = await prisma.salesInvoice.groupBy({
      by: ['clientId'],
      where: applyViewMode({
        companyId,
        ...(hasDateFilter && { fechaEmision: dateFilter }),
      }, viewMode),
      _sum: { total: true },
      _count: { id: true },
    });

    // 4. Aggregate payments by client in ONE query
    const paymentsByClient = await prisma.clientPayment.groupBy({
      by: ['clientId'],
      where: applyViewMode({
        companyId,
        estado: 'CONFIRMADO',
        ...(hasDateFilter && { fechaPago: dateFilter }),
      }, viewMode),
      _sum: { totalPago: true },
    });

    // 5. Get ultima compra per client (most recent sale date without date filter)
    const ultimaCompraByClient = await prisma.sale.groupBy({
      by: ['clientId'],
      where: applyViewMode({ companyId }, viewMode),
      _max: { fechaEmision: true },
    });

    // Create lookup maps for O(1) access
    const salesMap = new Map(salesByClient.map(s => [s.clientId, s]));
    const invoicesMap = new Map(invoicesByClient.map(i => [i.clientId, i]));
    const paymentsMap = new Map(paymentsByClient.map(p => [p.clientId, p]));
    const ultimaCompraMap = new Map(ultimaCompraByClient.map(u => [u.clientId, u._max.fechaEmision]));

    // Build client metrics from aggregated data
    const clientesConMetricas = clientes.map(cliente => {
      const sales = salesMap.get(cliente.id);
      const invoices = invoicesMap.get(cliente.id);
      const payments = paymentsMap.get(cliente.id);
      const ultimaCompra = ultimaCompraMap.get(cliente.id);

      const totalOrdenes = Number(sales?._sum.total || 0);
      const cantidadOrdenes = sales?._count.id || 0;

      // Calculate frequency (purchases per month)
      let frecuencia = 0;
      if (cantidadOrdenes > 1 && sales?._min.fechaEmision && sales?._max.fechaEmision) {
        const minDate = new Date(sales._min.fechaEmision).getTime();
        const maxDate = new Date(sales._max.fechaEmision).getTime();
        const diasEntrePrimeroYUltimo = (maxDate - minDate) / (1000 * 60 * 60 * 24);
        const meses = Math.max(1, diasEntrePrimeroYUltimo / 30);
        frecuencia = Math.round((cantidadOrdenes / meses) * 10) / 10;
      }

      return {
        cliente: {
          id: cliente.id,
          nombre: cliente.legalName || cliente.name,
          cuit: cliente.cuit,
          email: cliente.email,
          telefono: cliente.phone,
        },
        metricas: {
          totalCompras: totalOrdenes,
          cantidadOrdenes,
          totalFacturado: Number(invoices?._sum.total || 0),
          cantidadFacturas: invoices?._count.id || 0,
          totalPagado: Number(payments?._sum.totalPago || 0),
          deudaActual: Number(cliente.currentBalance) || 0,
          creditoDisponible: (Number(cliente.creditLimit) || 0) - (Number(cliente.currentBalance) || 0),
          ticketPromedio: cantidadOrdenes > 0 ? Math.round(totalOrdenes / cantidadOrdenes) : 0,
          frecuenciaCompra: frecuencia,
          ultimaCompra: ultimaCompra || null,
        },
      };
    });

    // Filter clients with purchases
    const clientesActivos = clientesConMetricas.filter(c => c.metricas.cantidadOrdenes > 0);

    // Sort by criteria
    clientesActivos.sort((a, b) => {
      switch (ordenarPor) {
        case 'cantidad':
          return b.metricas.cantidadOrdenes - a.metricas.cantidadOrdenes;
        case 'frecuencia':
          return b.metricas.frecuenciaCompra - a.metricas.frecuenciaCompra;
        case 'monto':
        default:
          return b.metricas.totalCompras - a.metricas.totalCompras;
      }
    });

    // Calculate participation
    const totalGeneral = clientesActivos.reduce((sum, c) => sum + c.metricas.totalCompras, 0);
    const ranking = clientesActivos.slice(0, limite).map((c, index) => ({
      posicion: index + 1,
      ...c,
      participacion: totalGeneral > 0
        ? Math.round((c.metricas.totalCompras / totalGeneral) * 1000) / 10
        : 0,
    }));

    // 80/20 concentration analysis
    let acumulado = 0;
    let clientesPara80 = 0;
    for (const c of ranking) {
      acumulado += c.metricas.totalCompras;
      clientesPara80++;
      if (acumulado >= totalGeneral * 0.8) break;
    }

    // General totals
    const totales = {
      clientesConCompras: clientesActivos.length,
      clientesSinCompras: clientes.length - clientesActivos.length,
      totalVentas: totalGeneral,
      ticketPromedioGeneral: clientesActivos.length > 0
        ? Math.round(totalGeneral / clientesActivos.reduce((sum, c) => sum + c.metricas.cantidadOrdenes, 0))
        : 0,
      concentracion: {
        clientesPara80Porciento: clientesPara80,
        porcentajeClientes: clientesActivos.length > 0
          ? Math.round((clientesPara80 / clientesActivos.length) * 100)
          : 0,
      },
    };

    // Distribution by purchase range
    const rangos = [
      { nombre: 'Más de $1M', min: 1000000, count: 0, monto: 0 },
      { nombre: '$500K - $1M', min: 500000, max: 1000000, count: 0, monto: 0 },
      { nombre: '$100K - $500K', min: 100000, max: 500000, count: 0, monto: 0 },
      { nombre: '$50K - $100K', min: 50000, max: 100000, count: 0, monto: 0 },
      { nombre: 'Menos de $50K', max: 50000, count: 0, monto: 0 },
    ];

    clientesActivos.forEach(c => {
      const monto = c.metricas.totalCompras;
      for (const rango of rangos) {
        if ((!rango.min || monto >= rango.min) && (!rango.max || monto < rango.max)) {
          rango.count++;
          rango.monto += monto;
          break;
        }
      }
    });

    const response = NextResponse.json({
      periodo: {
        desde: fechaDesde || 'Inicio',
        hasta: fechaHasta || 'Hoy',
      },
      ordenadoPor: ordenarPor,
      ranking,
      totales,
      distribucion: rangos,
      generadoEn: new Date().toISOString(),
    });

    // Add cache headers (30 seconds cache for reports)
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    return response;
  } catch (error) {
    console.error('Error generando reporte ranking-clientes:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
