import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode, getDocTypeFilter } from '@/lib/view-mode';
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

// Helper: Calculate period dates
function getPeriodDates(period: string) {
  const now = new Date();
  const endDate = endOfMonth(now);
  let startDate: Date;
  let periodDays: number;

  switch (period) {
    case 'trimestre':
      startDate = startOfMonth(subMonths(now, 2));
      periodDays = 90;
      break;
    case 'semestre':
      startDate = startOfMonth(subMonths(now, 5));
      periodDays = 180;
      break;
    case 'año':
      startDate = startOfMonth(subMonths(now, 11));
      periodDays = 365;
      break;
    case 'mes':
    default:
      startDate = startOfMonth(now);
      periodDays = 30;
  }

  return { startDate, endDate, periodDays };
}

// GET: Obtener analytics de un producto
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW);
    if (error) return error;

    const productId = params.id;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'mes';
    const includeComparison = searchParams.get('includeComparison') === 'true';

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    // Verificar que el producto existe y pertenece a la empresa
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        companyId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        costPrice: true,
        salePrice: true,
        marginMin: true,
        marginMax: true,
        currentStock: true,
        minStock: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const { startDate, endDate, periodDays } = getPeriodDates(period);

    // ========================================
    // 1. VENTAS DEL PERÍODO (Sales Metrics)
    // ========================================

    // Obtener items de ventas del producto
    const saleItems = await prisma.saleItem.findMany({
      where: {
        productId,
        sale: applyViewMode({
          companyId,
          fechaEmision: { gte: startDate, lte: endDate },
          estado: { notIn: ['CANCELADA', 'BORRADOR'] },
        }, viewMode),
      },
      select: {
        cantidad: true,
        precioUnitario: true,
        subtotal: true,
        sale: {
          select: {
            id: true,
            fechaEmision: true,
            clientId: true,
          },
        },
      },
    });

    const totalQuantitySold = saleItems.reduce((sum, item) => sum + Number(item.cantidad), 0);
    const totalRevenue = saleItems.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const orderCount = new Set(saleItems.map(item => item.sale.id)).size;
    const uniqueCustomers = new Set(saleItems.map(item => item.sale.clientId)).size;
    const averageOrderQty = orderCount > 0 ? totalQuantitySold / orderCount : 0;

    // Última venta
    const lastSale = saleItems.length > 0
      ? saleItems.sort((a, b) => b.sale.fechaEmision.getTime() - a.sale.fechaEmision.getTime())[0]
      : null;
    const lastSaleDate = lastSale?.sale.fechaEmision || null;

    // Tendencia (comparar con período anterior si se solicita)
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (includeComparison && saleItems.length > 0) {
      const prevStartDate = subMonths(startDate, periodDays / 30);
      const prevEndDate = subMonths(endDate, periodDays / 30);

      const prevSaleItems = await prisma.saleItem.findMany({
        where: {
          productId,
          sale: applyViewMode({
            companyId,
            fechaEmision: { gte: prevStartDate, lte: prevEndDate },
            estado: { notIn: ['CANCELADA', 'BORRADOR'] },
          }, viewMode),
        },
        select: {
          subtotal: true,
        },
      });

      const prevRevenue = prevSaleItems.reduce((sum, item) => sum + Number(item.subtotal), 0);
      const change = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      if (change > 5) trend = 'up';
      else if (change < -5) trend = 'down';
    }

    // ========================================
    // 2. MÁRGENES (Margin Metrics)
    // ========================================

    // Margen proyectado (de product catalog)
    const costPrice = Number(product.costPrice || 0);
    const salePrice = Number(product.salePrice || 0);
    const projectedMargin = salePrice > 0 ? ((salePrice - costPrice) / salePrice) * 100 : 0;

    // Margen real (de ventas facturadas reales)
    const invoiceItems = await prisma.salesInvoiceItem.findMany({
      where: {
        productId,
        invoice: applyViewMode({
          companyId,
          fechaEmision: { gte: startDate, lte: endDate },
          estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA', 'COBRADA'] },
        }, viewMode),
      },
      select: {
        cantidad: true,
        precioUnitario: true,
        subtotal: true,
      },
    });

    let realMargin = 0;
    if (invoiceItems.length > 0) {
      const invoicedRevenue = invoiceItems.reduce((sum, item) => sum + Number(item.subtotal), 0);
      const invoicedCost = invoiceItems.reduce((sum, item) => sum + (Number(item.cantidad) * costPrice), 0);
      realMargin = invoicedRevenue > 0 ? ((invoicedRevenue - invoicedCost) / invoicedRevenue) * 100 : 0;
    }

    const difference = realMargin - projectedMargin;
    const belowMin = (product.marginMin && realMargin < Number(product.marginMin)) || false;

    // ========================================
    // 3. ROTACIÓN (Inventory Metrics)
    // ========================================

    const currentStock = Number(product.currentStock || 0);
    const turnoverRate = currentStock > 0 ? totalQuantitySold / currentStock : 0;
    const dailySales = totalQuantitySold / periodDays;
    const daysOfStockLeft = dailySales > 0 ? currentStock / dailySales : 999;

    let velocity: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
    if (turnoverRate >= 4) velocity = 'ALTA';
    else if (turnoverRate >= 1.5) velocity = 'MEDIA';

    // ========================================
    // 4. CLIENTE TOP (Top Client)
    // ========================================

    let topClient = null;
    if (saleItems.length > 0) {
      // Agrupar por cliente
      const clientSales = saleItems.reduce((acc, item) => {
        const clientId = item.sale.clientId;
        if (!acc[clientId]) {
          acc[clientId] = {
            clientId,
            quantityBought: 0,
            totalAmount: 0,
            orderCount: new Set(),
          };
        }
        acc[clientId].quantityBought += Number(item.cantidad);
        acc[clientId].totalAmount += Number(item.subtotal);
        acc[clientId].orderCount.add(item.sale.id);
        return acc;
      }, {} as Record<string, any>);

      // Encontrar el cliente con más compras
      const topClientData = Object.values(clientSales).sort((a: any, b: any) => b.totalAmount - a.totalAmount)[0] as any;

      if (topClientData) {
        const clientInfo = await prisma.client.findUnique({
          where: { id: topClientData.clientId },
          select: {
            id: true,
            name: true,
            legalName: true,
          },
        });

        if (clientInfo) {
          topClient = {
            clientId: clientInfo.id,
            name: clientInfo.legalName || clientInfo.name,
            quantityBought: topClientData.quantityBought,
            totalAmount: topClientData.totalAmount,
            orderCount: topClientData.orderCount.size,
          };
        }
      }
    }

    // ========================================
    // 5. ALERTAS (Alerts)
    // ========================================

    const alerts = {
      lowStock: currentStock <= Number(product.minStock || 0),
      lowMargin: belowMin,
      noSalesIn90Days: !lastSaleDate || differenceInDays(new Date(), lastSaleDate) > 90,
      slowTurnover: velocity === 'BAJA' && currentStock > 0,
    };

    // ========================================
    // 6. TENDENCIAS (Trends)
    // ========================================

    // Ventas por mes
    const salesByMonth: Record<string, { quantity: number; amount: number }> = {};

    saleItems.forEach(item => {
      const monthKey = format(item.sale.fechaEmision, 'yyyy-MM');
      if (!salesByMonth[monthKey]) {
        salesByMonth[monthKey] = { quantity: 0, amount: 0 };
      }
      salesByMonth[monthKey].quantity += Number(item.cantidad);
      salesByMonth[monthKey].amount += Number(item.subtotal);
    });

    const salesTrend = Object.entries(salesByMonth)
      .map(([month, data]) => ({
        month,
        quantity: data.quantity,
        amount: data.amount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Historial de margen (simplificado - usar margen real del período)
    const marginHistory = salesTrend.map(item => ({
      date: item.month,
      margin: realMargin,
      salePrice,
      cost: costPrice,
    }));

    // ========================================
    // RESPONSE
    // ========================================

    const response = {
      product: {
        id: product.id,
        name: product.name,
        code: product.code,
        costPrice,
        salePrice,
        currentStock,
        minStock: Number(product.minStock || 0),
        category: product.category,
      },
      period: {
        from: startDate,
        to: endDate,
        days: periodDays,
      },
      salesMetrics: {
        totalQuantitySold: Math.round(totalQuantitySold * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        orderCount,
        uniqueCustomers,
        averageOrderQty: Math.round(averageOrderQty * 100) / 100,
        lastSaleDate,
        trend,
      },
      marginMetrics: {
        realMargin: Math.round(realMargin * 100) / 100,
        projectedMargin: Math.round(projectedMargin * 100) / 100,
        difference: Math.round(difference * 100) / 100,
        belowMin,
      },
      inventoryMetrics: {
        turnoverRate: Math.round(turnoverRate * 100) / 100,
        daysOfStockLeft: Math.round(daysOfStockLeft),
        velocity,
      },
      topClient,
      alerts,
      trends: {
        salesByMonth: salesTrend,
        marginHistory,
      },
    };

    // Cache headers
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600'); // 5 min cache

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Error obteniendo analytics del producto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
