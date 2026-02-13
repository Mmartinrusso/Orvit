import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET - Analytics and statistics for quotes (cotizaciones)
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
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
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
    const baseWhere: Prisma.QuoteWhereInput = applyViewMode(
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

    // Fetch all quotes in period
    const cotizaciones = await prisma.quote.findMany({
      where: baseWhere,
      include: {
        client: {
          select: { id: true, legalName: true, name: true }
        },
        seller: {
          select: { id: true, name: true }
        },
        sale: {
          select: { id: true, numero: true, estado: true }
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
    const totalCotizaciones = cotizaciones.length;
    const totalCotizado = cotizaciones.reduce((sum, c) => sum + Number(c.total), 0);
    const averageQuoteValue = totalCotizaciones > 0 ? totalCotizado / totalCotizaciones : 0;

    // Distribution by status
    const porEstado = cotizaciones.reduce((acc, cotizacion) => {
      acc[cotizacion.estado] = (acc[cotizacion.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalBorrador = porEstado['BORRADOR'] || 0;
    const totalEnviada = porEstado['ENVIADA'] || 0;
    const totalEnNegociacion = porEstado['EN_NEGOCIACION'] || 0;
    const totalAceptada = porEstado['ACEPTADA'] || 0;
    const totalRechazada = porEstado['RECHAZADA'] || 0;
    const totalVencida = porEstado['VENCIDA'] || 0;
    const totalConvertida = porEstado['CONVERTIDA'] || 0;

    // Revenue by status
    const facturacionPorEstado = cotizaciones.reduce((acc, cotizacion) => {
      const estado = cotizacion.estado;
      acc[estado] = (acc[estado] || 0) + Number(cotizacion.total);
      return acc;
    }, {} as Record<string, number>);

    // Distribution by currency
    const porMoneda = cotizaciones.reduce((acc, cotizacion) => {
      acc[cotizacion.moneda] = (acc[cotizacion.moneda] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const facturacionPorMoneda = cotizaciones.reduce((acc, cotizacion) => {
      acc[cotizacion.moneda] = (acc[cotizacion.moneda] || 0) + Number(cotizacion.total);
      return acc;
    }, {} as Record<string, number>);

    // Conversion analysis
    const cotizacionesConvertidas = cotizaciones.filter(c => c.estado === 'CONVERTIDA' || c.sale);
    const tasaConversion = totalCotizaciones > 0
      ? (cotizacionesConvertidas.length / totalCotizaciones) * 100
      : 0;

    const montoConvertido = cotizacionesConvertidas.reduce((sum, c) => sum + Number(c.total), 0);
    const tasaConversionMonto = totalCotizado > 0
      ? (montoConvertido / totalCotizado) * 100
      : 0;

    // Top clients by quote count and value
    const clientesMap = new Map<string, { count: number; total: number; name: string; convertidas: number }>();
    cotizaciones.forEach(cotizacion => {
      const clientId = cotizacion.clientId;
      const clientName = cotizacion.client.legalName || cotizacion.client.name;
      const existing = clientesMap.get(clientId) || {
        count: 0,
        total: 0,
        name: clientName,
        convertidas: 0
      };
      existing.count += 1;
      existing.total += Number(cotizacion.total);
      if (cotizacion.estado === 'CONVERTIDA' || cotizacion.sale) {
        existing.convertidas += 1;
      }
      clientesMap.set(clientId, existing);
    });

    const topClientesPorCotizaciones = Array.from(clientesMap.entries())
      .map(([id, data]) => ({
        clientId: id,
        clientName: data.name,
        cotizaciones: data.count,
        total: data.total,
        convertidas: data.convertidas,
        tasaConversion: data.count > 0 ? (data.convertidas / data.count) * 100 : 0
      }))
      .sort((a, b) => b.cotizaciones - a.cotizaciones)
      .slice(0, 10);

    const topClientesPorMonto = Array.from(clientesMap.entries())
      .map(([id, data]) => ({
        clientId: id,
        clientName: data.name,
        cotizaciones: data.count,
        total: data.total,
        convertidas: data.convertidas,
        tasaConversion: data.count > 0 ? (data.convertidas / data.count) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Top sellers
    const vendedoresMap = new Map<number, { count: number; total: number; name: string; convertidas: number }>();
    cotizaciones.forEach(cotizacion => {
      if (cotizacion.sellerId && cotizacion.seller) {
        const existing = vendedoresMap.get(cotizacion.sellerId) || {
          count: 0,
          total: 0,
          name: cotizacion.seller.name,
          convertidas: 0
        };
        existing.count += 1;
        existing.total += Number(cotizacion.total);
        if (cotizacion.estado === 'CONVERTIDA' || cotizacion.sale) {
          existing.convertidas += 1;
        }
        vendedoresMap.set(cotizacion.sellerId, existing);
      }
    });

    const topVendedores = Array.from(vendedoresMap.entries())
      .map(([id, data]) => ({
        vendedorId: id,
        vendedorName: data.name,
        cotizaciones: data.count,
        total: data.total,
        convertidas: data.convertidas,
        tasaConversion: data.count > 0 ? (data.convertidas / data.count) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Validity analysis
    const cotizacionesVigentes = cotizaciones.filter(c => {
      if (!c.fechaValidez || c.estado === 'VENCIDA') return false;
      return new Date(c.fechaValidez) >= new Date();
    });

    const cotizacionesPorVencer = cotizaciones.filter(c => {
      if (!c.fechaValidez || c.estado === 'VENCIDA') return false;
      const daysToExpire = Math.ceil((new Date(c.fechaValidez).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysToExpire > 0 && daysToExpire <= 7;
    });

    // Time series analysis (by month)
    const cotizacionesPorMes = cotizaciones.reduce((acc, cotizacion) => {
      const month = cotizacion.fechaEmision.toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { count: 0, total: 0, convertidas: 0 };
      }
      acc[month].count += 1;
      acc[month].total += Number(cotizacion.total);
      if (cotizacion.estado === 'CONVERTIDA' || cotizacion.sale) {
        acc[month].convertidas += 1;
      }
      return acc;
    }, {} as Record<string, { count: number; total: number; convertidas: number }>);

    const seriesMensuales = Object.entries(cotizacionesPorMes)
      .map(([month, data]) => ({
        mes: month,
        cotizaciones: data.count,
        monto: data.total,
        convertidas: data.convertidas,
        tasaConversion: data.count > 0 ? (data.convertidas / data.count) * 100 : 0
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    // Item-level analytics (if requested)
    let productosMasCotizados: any[] | undefined;
    if (includeItems) {
      const productosMap = new Map<string, {
        quantity: number;
        value: number;
        name: string;
        sku: string;
        timesQuoted: number;
      }>();

      cotizaciones.forEach(cotizacion => {
        if (cotizacion.items) {
          (cotizacion.items as any[]).forEach((item: any) => {
            const productId = item.productId;
            const productName = item.product?.name || item.descripcion;
            const productSku = item.product?.sku || '';

            const existing = productosMap.get(productId) || {
              quantity: 0,
              value: 0,
              name: productName,
              sku: productSku,
              timesQuoted: 0
            };

            existing.quantity += Number(item.cantidad);
            existing.value += Number(item.subtotal);
            existing.timesQuoted += 1;
            productosMap.set(productId, existing);
          });
        }
      });

      productosMasCotizados = Array.from(productosMap.entries())
        .map(([id, data]) => ({
          productId: id,
          productName: data.name,
          sku: data.sku,
          cantidadCotizada: data.quantity,
          valorTotal: data.value,
          vecesCotizado: data.timesQuoted
        }))
        .sort((a, b) => b.valorTotal - a.valorTotal)
        .slice(0, 20);
    }

    // Conversion funnel
    const conversionFunnel = {
      borrador: totalBorrador,
      enviada: totalEnviada,
      enNegociacion: totalEnNegociacion,
      aceptada: totalAceptada,
      convertida: totalConvertida,
      rechazada: totalRechazada,
      vencida: totalVencida,
      tasaEnvio: totalCotizaciones > 0 ? ((totalEnviada + totalEnNegociacion + totalAceptada + totalConvertida) / totalCotizaciones) * 100 : 0,
      tasaAceptacion: (totalEnviada + totalEnNegociacion) > 0 ? ((totalAceptada + totalConvertida) / (totalEnviada + totalEnNegociacion + totalAceptada + totalConvertida + totalRechazada)) * 100 : 0,
      tasaConversion: totalCotizaciones > 0 ? (totalConvertida / totalCotizaciones) * 100 : 0,
      tasaRechazo: totalCotizaciones > 0 ? (totalRechazada / totalCotizaciones) * 100 : 0,
      tasaVencimiento: totalCotizaciones > 0 ? (totalVencida / totalCotizaciones) * 100 : 0,
    };

    // Pending quotes analysis
    const cotizacionesPendientes = cotizaciones.filter(c =>
      !['CONVERTIDA', 'RECHAZADA', 'VENCIDA'].includes(c.estado)
    );

    const totalPendiente = cotizacionesPendientes.reduce((sum, c) => sum + Number(c.total), 0);

    const cotizacionesPendientesPorEstado = cotizacionesPendientes.reduce((acc, cotizacion) => {
      acc[cotizacion.estado] = (acc[cotizacion.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Alerts and warnings
    const alertas: any[] = [];

    // Quotes about to expire
    if (cotizacionesPorVencer.length > 0) {
      alertas.push({
        tipo: 'COTIZACIONES_POR_VENCER',
        severidad: 'MEDIA',
        mensaje: `${cotizacionesPorVencer.length} cotizaciones vencen en los próximos 7 días`,
        count: cotizacionesPorVencer.length
      });
    }

    // Quotes in ENVIADA for > 14 days without response
    const cotizacionesSinRespuesta = cotizaciones.filter(c => {
      if (c.estado !== 'ENVIADA') return false;
      const daysSinceSent = Math.ceil((Date.now() - new Date(c.fechaEmision).getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceSent > 14;
    });

    if (cotizacionesSinRespuesta.length > 0) {
      alertas.push({
        tipo: 'SIN_RESPUESTA',
        severidad: 'MEDIA',
        mensaje: `${cotizacionesSinRespuesta.length} cotizaciones enviadas hace más de 14 días sin respuesta`,
        count: cotizacionesSinRespuesta.length
      });
    }

    // Low conversion rate alert
    if (tasaConversion < 20 && totalCotizaciones > 10) {
      alertas.push({
        tipo: 'CONVERSION_BAJA',
        severidad: 'ALTA',
        mensaje: `Tasa de conversión baja: ${tasaConversion.toFixed(1)}%`,
        tasa: tasaConversion
      });
    }

    // High rejection rate alert
    if (conversionFunnel.tasaRechazo > 30 && totalCotizaciones > 10) {
      alertas.push({
        tipo: 'RECHAZO_ALTO',
        severidad: 'ALTA',
        mensaje: `Tasa de rechazo alta: ${conversionFunnel.tasaRechazo.toFixed(1)}%`,
        tasa: conversionFunnel.tasaRechazo
      });
    }

    // High expiration rate alert
    if (conversionFunnel.tasaVencimiento > 25 && totalCotizaciones > 10) {
      alertas.push({
        tipo: 'VENCIMIENTO_ALTO',
        severidad: 'MEDIA',
        mensaje: `Tasa de vencimiento alta: ${conversionFunnel.tasaVencimiento.toFixed(1)}%`,
        tasa: conversionFunnel.tasaVencimiento
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
        totalCotizaciones,
        totalCotizado,
        promedioCotizacion: averageQuoteValue,
        porEstado,
        facturacionPorEstado,
      },
      conversion: {
        cotizacionesConvertidas: cotizacionesConvertidas.length,
        montoConvertido,
        tasaConversionNumero: tasaConversion,
        tasaConversionMonto,
      },
      distribucion: {
        porMoneda,
        facturacionPorMoneda,
      },
      topClientes: {
        porCotizaciones: topClientesPorCotizaciones,
        porMonto: topClientesPorMonto,
      },
      topVendedores,
      vigencia: {
        vigentes: cotizacionesVigentes.length,
        porVencer: cotizacionesPorVencer.length,
        vencidas: totalVencida,
      },
      metricas: {
        conversion: conversionFunnel,
      },
      tendencias: {
        seriesMensuales,
      },
      pendientes: {
        totalPendientes: cotizacionesPendientes.length,
        montoPendiente: totalPendiente,
        porEstado: cotizacionesPendientesPorEstado,
      },
      alertas,
    };

    // Add item analytics if requested
    if (includeItems && productosMasCotizados) {
      response.productos = {
        masCotizados: productosMasCotizados,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting quotes analytics:', error);
    return NextResponse.json(
      { error: 'Error al obtener analytics' },
      { status: 500 }
    );
  }
}
