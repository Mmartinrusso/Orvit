import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode, applyViewMode, ViewMode } from '@/lib/view-mode';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// Helper para aplicar ViewMode a todas las queries del dashboard
function whereVM<T extends Record<string, any>>(
  where: T,
  viewMode: ViewMode
): T {
  return applyViewMode(where, viewMode);
}

// GET - Dashboard de ventas con KPIs
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.DASHBOARD_VIEW);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo') || 'mes'; // dia, semana, mes, año
    const vendedorId = searchParams.get('vendedorId');

    // Calcular fechas del período
    const hoy = new Date();
    let fechaInicio: Date;

    switch (periodo) {
      case 'dia':
        fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        break;
      case 'semana':
        const dia = hoy.getDay();
        fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dia);
        break;
      case 'año':
        fechaInicio = new Date(hoy.getFullYear(), 0, 1);
        break;
      default: // mes
        fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    }

    // Base where con ViewMode
    const whereBase = {
      companyId: user!.companyId,
      ...(vendedorId && { sellerId: parseInt(vendedorId) })
    };

    // Helper local para aplicar ViewMode
    const vm = <T extends Record<string, any>>(w: T) => whereVM({ ...whereBase, ...w }, viewMode);
    const vmInvoice = <T extends Record<string, any>>(w: T) => whereVM({ companyId: user!.companyId, ...w }, viewMode);
    const vmDelivery = <T extends Record<string, any>>(w: T) => whereVM({ companyId: user!.companyId, ...w }, viewMode);
    const vmPayment = <T extends Record<string, any>>(w: T) => whereVM({ companyId: user!.companyId, ...w }, viewMode);

    // KPIs de cotizaciones (con ViewMode)
    const [
      cotizacionesTotal,
      cotizacionesPendientes,
      cotizacionesConvertidas,
      cotizacionesPerdidas
    ] = await Promise.all([
      prisma.quote.count({ where: vm({ createdAt: { gte: fechaInicio } }) }),
      prisma.quote.count({ where: vm({ estado: { in: ['BORRADOR', 'ENVIADA', 'EN_NEGOCIACION'] } }) }),
      prisma.quote.count({ where: vm({ estado: 'CONVERTIDA', createdAt: { gte: fechaInicio } }) }),
      prisma.quote.count({ where: vm({ estado: 'PERDIDA', createdAt: { gte: fechaInicio } }) }),
    ]);

    const tasaConversion = cotizacionesTotal > 0
      ? ((cotizacionesConvertidas / cotizacionesTotal) * 100).toFixed(1)
      : '0';

    // KPIs de órdenes de venta (con ViewMode)
    const [
      ordenesTotal,
      ordenesConfirmadas,
      ordenesEnPreparacion,
      ventasDelPeriodo
    ] = await Promise.all([
      prisma.sale.count({ where: vm({ createdAt: { gte: fechaInicio } }) }),
      prisma.sale.count({ where: vm({ estado: 'CONFIRMADA' }) }),
      prisma.sale.count({ where: vm({ estado: 'EN_PREPARACION' }) }),
      prisma.sale.aggregate({
        where: vm({ estado: { not: 'CANCELADA' }, createdAt: { gte: fechaInicio } }),
        _sum: { total: true }
      })
    ]);

    // KPIs de facturación (con ViewMode)
    const [
      facturasEmitidas,
      facturasTotal,
      facturasPendientes,
      facturasVencidas
    ] = await Promise.all([
      prisma.salesInvoice.count({
        where: vmInvoice({ estado: 'EMITIDA', fechaEmision: { gte: fechaInicio } })
      }),
      prisma.salesInvoice.aggregate({
        where: vmInvoice({ estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA', 'COBRADA'] }, fechaEmision: { gte: fechaInicio } }),
        _sum: { total: true }
      }),
      prisma.salesInvoice.aggregate({
        where: vmInvoice({ estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] }, saldoPendiente: { gt: 0 } }),
        _sum: { saldoPendiente: true },
        _count: true
      }),
      prisma.salesInvoice.aggregate({
        where: vmInvoice({ estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] }, fechaVencimiento: { lt: hoy }, saldoPendiente: { gt: 0 } }),
        _sum: { saldoPendiente: true },
        _count: true
      })
    ]);

    // KPIs de cobranzas (con ViewMode)
    const [
      pagosDelPeriodo,
      totalCobrado
    ] = await Promise.all([
      prisma.clientPayment.count({
        where: vmPayment({ createdAt: { gte: fechaInicio } })
      }),
      prisma.clientPayment.aggregate({
        where: vmPayment({ createdAt: { gte: fechaInicio } }),
        _sum: { totalPago: true }
      })
    ]);

    // Entregas pendientes (con ViewMode)
    const entregasPendientes = await prisma.saleDelivery.count({
      where: vmDelivery({ estado: { in: ['PENDIENTE', 'PROGRAMADA', 'EN_PREPARACION'] } })
    });

    // KPIs adicionales: Productos activos, clientes activos, stock bajo
    const [
      productosActivos,
      clientesActivos,
      ventasHoy
    ] = await Promise.all([
      prisma.product.count({
        where: { companyId: user!.companyId, active: true }
      }),
      prisma.client.count({
        where: { companyId: user!.companyId, active: true }
      }),
      prisma.sale.count({
        where: vm({
          createdAt: { gte: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) },
          estado: { in: ['CONFIRMADA', 'EN_PREPARACION', 'ENTREGADA', 'FACTURADA'] }
        })
      })
    ]);

    // Calcular productos con stock bajo (operación costosa, hacerla aparte)
    const productos = await prisma.product.findMany({
      where: {
        companyId: user!.companyId,
        active: true,
        stockMinimo: { not: null }
      },
      select: { id: true, stockMinimo: true }
    });

    let productosStockBajo = 0;
    for (const prod of productos) {
      const stockActual = await prisma.productStockMovement.aggregate({
        where: { productId: prod.id },
        _sum: { cantidad: true }
      });
      const stock = Number(stockActual._sum?.cantidad || 0);
      if (prod.stockMinimo && stock < Number(prod.stockMinimo)) {
        productosStockBajo++;
      }
    }

    // Top 5 clientes por ventas del período (con ViewMode)
    const topClientes = await prisma.sale.groupBy({
      by: ['clientId'],
      where: vm({ createdAt: { gte: fechaInicio }, estado: { not: 'CANCELADA' } }),
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: 5
    });

    const clientesInfo = await prisma.client.findMany({
      where: { id: { in: topClientes.map(c => c.clientId) } },
      select: { id: true, legalName: true, name: true }
    });

    const topClientesConInfo = topClientes.map(tc => ({
      cliente: clientesInfo.find(c => c.id === tc.clientId),
      ventas: tc._count,
      total: Number(tc._sum.total || 0)
    }));

    // Top 5 vendedores (si no hay filtro de vendedor) (con ViewMode)
    let topVendedores: any[] = [];
    if (!vendedorId) {
      const vendedoresGroup = await prisma.sale.groupBy({
        by: ['sellerId'],
        where: vm({ createdAt: { gte: fechaInicio }, estado: { not: 'CANCELADA' } }),
        _sum: { total: true },
        _count: true,
        orderBy: { _sum: { total: 'desc' } },
        take: 5
      });

      const vendedoresInfo = await prisma.user.findMany({
        where: { id: { in: vendedoresGroup.map(v => v.sellerId!).filter(Boolean) as number[] } },
        select: { id: true, name: true }
      });

      topVendedores = vendedoresGroup.map(tv => ({
        vendedor: vendedoresInfo.find(v => v.id === tv.sellerId),
        ventas: tv._count,
        total: Number(tv._sum.total || 0)
      }));
    }

    // Productos más vendidos (con ViewMode via sale relation)
    const topProductos = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: vm({ createdAt: { gte: fechaInicio }, estado: { not: 'CANCELADA' } })
      },
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 5
    });

    const productosInfo = await prisma.product.findMany({
      where: { id: { in: topProductos.map(p => p.productId).filter(Boolean) as string[] } },
      select: { id: true, name: true, sku: true }
    });

    const topProductosConInfo = topProductos.map(tp => ({
      producto: productosInfo.find(p => p.id === tp.productId),
      cantidad: Number(tp._sum.cantidad || 0),
      total: Number(tp._sum.subtotal || 0)
    }));

    return NextResponse.json({
      periodo,
      fechaInicio: fechaInicio.toISOString(),
      // KPIs principales para dashboard cards
      stats: {
        productosActivos,
        cotizacionesPendientes,
        clientesActivos,
        ventasMes: Number(ventasDelPeriodo._sum?.total || 0),
      },
      alertas: {
        cotizacionesPendienteCierre: cotizacionesPendientes,
        cotizacionesPerdidas,
        productosStockBajo,
        ventasHoy,
      },
      // KPIs detallados
      cotizaciones: {
        total: cotizacionesTotal,
        pendientes: cotizacionesPendientes,
        convertidas: cotizacionesConvertidas,
        perdidas: cotizacionesPerdidas,
        tasaConversion: parseFloat(tasaConversion),
      },
      ordenes: {
        total: ordenesTotal,
        confirmadas: ordenesConfirmadas,
        enPreparacion: ordenesEnPreparacion,
        totalVentas: Number(ventasDelPeriodo._sum?.total || 0),
      },
      facturacion: {
        facturasEmitidas,
        totalFacturado: Number(facturasTotal._sum?.total || 0),
        pendienteCobro: {
          cantidad: facturasPendientes._count,
          monto: Number(facturasPendientes._sum?.saldoPendiente || 0),
        },
        vencido: {
          cantidad: facturasVencidas._count,
          monto: Number(facturasVencidas._sum?.saldoPendiente || 0),
        },
      },
      cobranzas: {
        pagosRegistrados: pagosDelPeriodo,
        totalCobrado: Number(totalCobrado._sum?.totalPago || 0),
      },
      entregas: {
        pendientes: entregasPendientes,
      },
      topClientes: topClientesConInfo,
      topVendedores,
      topProductos: topProductosConInfo,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Error al obtener dashboard' }, { status: 500 });
  }
}
