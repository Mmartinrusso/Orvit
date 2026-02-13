import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET - Analytics and statistics for sales orders
 *
 * Query params:
 * - fechaDesde: ISO date string (default: 90 days ago)
 * - fechaHasta: ISO date string (default: today)
 * - clienteId: Filter by client
 * - vendedorId: Filter by seller
 * - includeItems: Include item-level analytics (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const fechaDesde = searchParams.get('fechaDesde')
      ? new Date(searchParams.get('fechaDesde')!)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    const fechaHasta = searchParams.get('fechaHasta')
      ? new Date(searchParams.get('fechaHasta')!)
      : new Date();
    const clienteId = searchParams.get('clienteId');
    const vendedorId = searchParams.get('vendedorId');
    const includeItems = searchParams.get('includeItems') === 'true';

    // Build base filter
    const baseWhere: Prisma.SaleWhereInput = applyViewMode(
      {
        companyId,
        fechaEmision: {
          gte: fechaDesde,
          lte: fechaHasta,
        },
        ...(clienteId && { clientId }),
        ...(vendedorId && { sellerId: parseInt(vendedorId) }),
      },
      viewMode
    );

    // Fetch all orders in period
    const ordenes = await prisma.sale.findMany({
      where: baseWhere,
      include: {
        client: {
          select: { id: true, legalName: true, name: true }
        },
        seller: {
          select: { id: true, name: true }
        },
        items: includeItems ? {
          include: {
            product: {
              select: { id: true, name: true, sku: true }
            }
          }
        } : false,
      }
    });

    // Calculate summary statistics
    const totalOrdenes = ordenes.length;
    const totalFacturado = ordenes.reduce((sum, o) => sum + Number(o.total), 0);
    const averageOrderValue = totalOrdenes > 0 ? totalFacturado / totalOrdenes : 0;

    // Distribution by status
    const porEstado = ordenes.reduce((acc, orden) => {
      acc[orden.estado] = (acc[orden.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalBorrador = porEstado['BORRADOR'] || 0;
    const totalConfirmada = porEstado['CONFIRMADA'] || 0;
    const totalEnPreparacion = porEstado['EN_PREPARACION'] || 0;
    const totalPreparada = porEstado['PREPARADA'] || 0;
    const totalEnTransito = porEstado['EN_TRANSITO'] || 0;
    const totalEntregada = porEstado['ENTREGADA'] || 0;
    const totalFacturada = porEstado['FACTURADA'] || 0;
    const totalCancelada = porEstado['CANCELADA'] || 0;

    // Revenue by status
    const facturacionPorEstado = ordenes.reduce((acc, orden) => {
      const estado = orden.estado;
      acc[estado] = (acc[estado] || 0) + Number(orden.total);
      return acc;
    }, {} as Record<string, number>);

    // Distribution by currency
    const porMoneda = ordenes.reduce((acc, orden) => {
      acc[orden.moneda] = (acc[orden.moneda] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const facturacionPorMoneda = ordenes.reduce((acc, orden) => {
      acc[orden.moneda] = (acc[orden.moneda] || 0) + Number(orden.total);
      return acc;
    }, {} as Record<string, number>);

    // Top clients by order count and revenue
    const clientesMap = new Map<string, { count: number; total: number; name: string }>();
    ordenes.forEach(orden => {
      const clientId = orden.clientId;
      const clientName = orden.client.legalName || orden.client.name;
      const existing = clientesMap.get(clientId) || { count: 0, total: 0, name: clientName };
      existing.count += 1;
      existing.total += Number(orden.total);
      clientesMap.set(clientId, existing);
    });

    const topClientesPorPedidos = Array.from(clientesMap.entries())
      .map(([id, data]) => ({ clientId: id, clientName: data.name, pedidos: data.count, total: data.total }))
      .sort((a, b) => b.pedidos - a.pedidos)
      .slice(0, 10);

    const topClientesPorFacturacion = Array.from(clientesMap.entries())
      .map(([id, data]) => ({ clientId: id, clientName: data.name, pedidos: data.count, total: data.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Top sellers
    const vendedoresMap = new Map<number, { count: number; total: number; name: string }>();
    ordenes.forEach(orden => {
      if (orden.sellerId && orden.seller) {
        const existing = vendedoresMap.get(orden.sellerId) || {
          count: 0,
          total: 0,
          name: orden.seller.name
        };
        existing.count += 1;
        existing.total += Number(orden.total);
        vendedoresMap.set(orden.sellerId, existing);
      }
    });

    const topVendedores = Array.from(vendedoresMap.entries())
      .map(([id, data]) => ({
        vendedorId: id,
        vendedorName: data.name,
        pedidos: data.count,
        total: data.total
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Fulfillment metrics
    const ordenesConFechaEntrega = ordenes.filter(o =>
      o.fechaEntregaEstimada && o.fechaEntregaReal
    );

    let avgDaysToDeliver = 0;
    let onTimeDeliveryCount = 0;
    let lateDeliveryCount = 0;

    if (ordenesConFechaEntrega.length > 0) {
      let totalDays = 0;
      ordenesConFechaEntrega.forEach(orden => {
        const estimada = new Date(orden.fechaEntregaEstimada!);
        const real = new Date(orden.fechaEntregaReal!);
        const diffDays = Math.ceil((real.getTime() - estimada.getTime()) / (1000 * 60 * 60 * 24));
        totalDays += diffDays;

        if (diffDays <= 0) {
          onTimeDeliveryCount++;
        } else {
          lateDeliveryCount++;
        }
      });
      avgDaysToDeliver = totalDays / ordenesConFechaEntrega.length;
    }

    const onTimeDeliveryRate = ordenesConFechaEntrega.length > 0
      ? (onTimeDeliveryCount / ordenesConFechaEntrega.length) * 100
      : 0;

    // Time series analysis (by month)
    const ordenesPorMes = ordenes.reduce((acc, orden) => {
      const month = orden.fechaEmision.toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { count: 0, total: 0 };
      }
      acc[month].count += 1;
      acc[month].total += Number(orden.total);
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    const seriesMensuales = Object.entries(ordenesPorMes)
      .map(([month, data]) => ({
        mes: month,
        pedidos: data.count,
        facturacion: data.total
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    // Item-level analytics (if requested)
    let productosMasVendidos: any[] | undefined;
    if (includeItems) {
      const productosMap = new Map<string, { quantity: number; revenue: number; name: string; sku: string }>();

      ordenes.forEach(orden => {
        if (orden.items) {
          (orden.items as any[]).forEach((item: any) => {
            const productId = item.productId;
            const productName = item.product?.name || item.descripcion;
            const productSku = item.product?.sku || '';

            const existing = productosMap.get(productId) || {
              quantity: 0,
              revenue: 0,
              name: productName,
              sku: productSku
            };

            existing.quantity += Number(item.cantidad);
            existing.revenue += Number(item.subtotal);
            productosMap.set(productId, existing);
          });
        }
      });

      productosMasVendidos = Array.from(productosMap.entries())
        .map(([id, data]) => ({
          productId: id,
          productName: data.name,
          sku: data.sku,
          cantidadVendida: data.quantity,
          facturacion: data.revenue
        }))
        .sort((a, b) => b.facturacion - a.facturacion)
        .slice(0, 20);
    }

    // Conversion funnel
    const conversionFunnel = {
      borrador: totalBorrador,
      confirmada: totalConfirmada,
      enPreparacion: totalEnPreparacion,
      preparada: totalPreparada,
      enTransito: totalEnTransito,
      entregada: totalEntregada,
      facturada: totalFacturada,
      cancelada: totalCancelada,
      tasaConfirmacion: totalOrdenes > 0 ? (totalConfirmada / totalOrdenes) * 100 : 0,
      tasaEntrega: totalConfirmada > 0 ? (totalEntregada / totalConfirmada) * 100 : 0,
      tasaFacturacion: totalEntregada > 0 ? (totalFacturada / totalEntregada) * 100 : 0,
      tasaCancelacion: totalOrdenes > 0 ? (totalCancelada / totalOrdenes) * 100 : 0,
    };

    // Pending orders analysis
    const ordenesPendientes = ordenes.filter(o =>
      !['ENTREGADA', 'FACTURADA', 'CANCELADA'].includes(o.estado)
    );

    const totalPendiente = ordenesPendientes.reduce((sum, o) => sum + Number(o.total), 0);

    const ordenesPendientesPorEstado = ordenesPendientes.reduce((acc, orden) => {
      acc[orden.estado] = (acc[orden.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Alerts and warnings
    const alertas: any[] = [];

    // Orders stuck in CONFIRMADA for > 7 days
    const ordenesAtascadas = ordenes.filter(o => {
      if (o.estado !== 'CONFIRMADA') return false;
      const daysSinceConfirmed = o.fechaConfirmacion
        ? Math.ceil((Date.now() - new Date(o.fechaConfirmacion).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return daysSinceConfirmed > 7;
    });

    if (ordenesAtascadas.length > 0) {
      alertas.push({
        tipo: 'ORDENES_ATASCADAS',
        severidad: 'MEDIA',
        mensaje: `${ordenesAtascadas.length} órdenes confirmadas hace más de 7 días sin avanzar`,
        count: ordenesAtascadas.length
      });
    }

    // Orders with overdue delivery
    const ordenesRetrasadas = ordenes.filter(o => {
      if (!o.fechaEntregaEstimada || o.estado === 'ENTREGADA' || o.estado === 'CANCELADA') {
        return false;
      }
      return new Date(o.fechaEntregaEstimada) < new Date();
    });

    if (ordenesRetrasadas.length > 0) {
      alertas.push({
        tipo: 'ENTREGAS_RETRASADAS',
        severidad: 'ALTA',
        mensaje: `${ordenesRetrasadas.length} órdenes con fecha de entrega vencida`,
        count: ordenesRetrasadas.length
      });
    }

    // Low conversion rate alert
    if (conversionFunnel.tasaConfirmacion < 50 && totalOrdenes > 10) {
      alertas.push({
        tipo: 'CONVERSION_BAJA',
        severidad: 'MEDIA',
        mensaje: `Tasa de confirmación baja: ${conversionFunnel.tasaConfirmacion.toFixed(1)}%`,
        tasa: conversionFunnel.tasaConfirmacion
      });
    }

    // High cancellation rate alert
    if (conversionFunnel.tasaCancelacion > 20 && totalOrdenes > 10) {
      alertas.push({
        tipo: 'CANCELACION_ALTA',
        severidad: 'ALTA',
        mensaje: `Tasa de cancelación alta: ${conversionFunnel.tasaCancelacion.toFixed(1)}%`,
        tasa: conversionFunnel.tasaCancelacion
      });
    }

    // Build response
    const response: any = {
      periodo: {
        desde: fechaDesde.toISOString(),
        hasta: fechaHasta.toISOString(),
        dias: Math.ceil((fechaHasta.getTime() - fechaDesde.getTime()) / (1000 * 60 * 60 * 24))
      },
      resumen: {
        totalOrdenes,
        totalFacturado,
        promedioOrden: averageOrderValue,
        porEstado,
        facturacionPorEstado,
      },
      distribucion: {
        porMoneda,
        facturacionPorMoneda,
      },
      topClientes: {
        porPedidos: topClientesPorPedidos,
        porFacturacion: topClientesPorFacturacion,
      },
      topVendedores,
      metricas: {
        cumplimiento: {
          ordenesEntregadas: totalEntregada,
          ordenesConFechas: ordenesConFechaEntrega.length,
          promedioRetrasoEntrega: avgDaysToDeliver,
          tasaCumplimientoTiempo: onTimeDeliveryRate,
          entregasATiempo: onTimeDeliveryCount,
          entregasTardias: lateDeliveryCount,
        },
        conversion: conversionFunnel,
      },
      tendencias: {
        seriesMensuales,
      },
      pendientes: {
        totalPendientes: ordenesPendientes.length,
        montoPendiente: totalPendiente,
        porEstado: ordenesPendientesPorEstado,
      },
      alertas,
    };

    // Add item analytics if requested
    if (includeItems && productosMasVendidos) {
      response.productos = {
        masVendidos: productosMasVendidos,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting orders analytics:', error);
    return NextResponse.json(
      { error: 'Error al obtener analytics' },
      { status: 500 }
    );
  }
}
