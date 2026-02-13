import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { startOfMonth, endOfMonth, subMonths, differenceInDays, startOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

type Period = 'mes' | 'trimestre' | 'semestre' | 'año';

interface ClientAnalytics {
  client: {
    id: string;
    legalName: string;
    name: string | null;
    email: string;
    creditLimit: number | null;
    currentBalance: number;
    isBlocked: boolean;
  };
  period: {
    from: Date;
    to: Date;
    days: number;
  };
  salesMetrics: {
    totalRevenue: number;
    invoiceCount: number;
    orderCount: number;
    averageTicket: number;
    trend: 'up' | 'down' | 'stable';
    growthRate: number;
  };
  paymentMetrics: {
    dso: number; // Days Sales Outstanding
    punctualityRate: number; // % de facturas pagadas a tiempo
    totalPaid: number;
    pendingAmount: number;
    overdueAmount: number;
  };
  creditMetrics: {
    utilizationRate: number; // % del límite utilizado
    availableCredit: number;
    nearLimit: boolean; // > 80%
    exceeded: boolean;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    productCode: string;
    quantityBought: number;
    totalAmount: number;
    orderCount: number;
  }>;
  trends: {
    salesByMonth: Array<{ month: string; amount: number; invoiceCount: number }>;
    balanceHistory: Array<{ date: string; balance: number }>;
  };
  alerts: {
    nearCreditLimit: boolean;
    exceededCreditLimit: boolean;
    hasOverdueInvoices: boolean;
    slowPayer: boolean; // DSO > 60 días
    noRecentActivity: boolean; // Sin compras en 90 días
  };
  score: number; // 0-100
}

// GET: Obtener analytics de un cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const { searchParams } = new URL(request.url);

    const { id: clientId } = await params;
    const period = (searchParams.get('period') || 'mes') as Period;
    const includeComparison = searchParams.get('includeComparison') === 'true';

    // Calcular fechas del período
    const now = new Date();
    let fechaDesde: Date;
    let fechaHasta: Date = endOfMonth(now);

    switch (period) {
      case 'mes':
        fechaDesde = startOfMonth(now);
        break;
      case 'trimestre':
        fechaDesde = startOfMonth(subMonths(now, 2));
        break;
      case 'semestre':
        fechaDesde = startOfMonth(subMonths(now, 5));
        break;
      case 'año':
        fechaDesde = startOfMonth(subMonths(now, 11));
        break;
      default:
        fechaDesde = startOfMonth(now);
    }

    const periodDays = differenceInDays(fechaHasta, fechaDesde);

    // Obtener cliente
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId },
      select: {
        id: true,
        legalName: true,
        name: true,
        email: true,
        creditLimit: true,
        currentBalance: true,
        isBlocked: true,
        createdAt: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // ===== SALES METRICS =====
    const invoices = await prisma.salesInvoice.findMany({
      where: applyViewMode(
        {
          clientId,
          companyId,
          fechaEmision: { gte: fechaDesde, lte: fechaHasta },
          estado: { notIn: ['CANCELADA', 'ANULADA'] },
        },
        viewMode
      ),
      select: {
        id: true,
        numero: true,
        fechaEmision: true,
        fechaVencimiento: true,
        total: true,
        saldoPendiente: true,
        estado: true,
      },
    });

    const sales = await prisma.sale.findMany({
      where: applyViewMode(
        {
          clientId,
          companyId,
          fechaEmision: { gte: fechaDesde, lte: fechaHasta },
          estado: { notIn: ['CANCELADA', 'BORRADOR'] },
        },
        viewMode
      ),
      select: { id: true },
    });

    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const invoiceCount = invoices.length;
    const orderCount = sales.length;
    const averageTicket = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;

    // Calcular tendencia (comparar con período anterior si requested)
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let growthRate = 0;

    if (includeComparison) {
      const prevPeriodStart = subMonths(fechaDesde, periodDays / 30);
      const prevPeriodEnd = subMonths(fechaHasta, periodDays / 30);

      const prevInvoices = await prisma.salesInvoice.findMany({
        where: applyViewMode(
          {
            clientId,
            companyId,
            fechaEmision: { gte: prevPeriodStart, lte: prevPeriodEnd },
            estado: { notIn: ['CANCELADA', 'ANULADA'] },
          },
          viewMode
        ),
        select: { total: true },
      });

      const prevRevenue = prevInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

      if (prevRevenue > 0) {
        growthRate = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
        trend = growthRate > 5 ? 'up' : growthRate < -5 ? 'down' : 'stable';
      }
    }

    // ===== PAYMENT METRICS =====
    const payments = await prisma.clientPayment.findMany({
      where: {
        clientId,
        companyId,
        fechaPago: { gte: fechaDesde, lte: fechaHasta },
        estado: 'CONFIRMADO',
      },
      select: {
        totalPago: true,
      },
    });

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.totalPago || 0), 0);
    const pendingAmount = Number(client.currentBalance || 0);

    // Calcular DSO (Days Sales Outstanding) - promedio de días que tardan en pagar
    const paidInvoices = invoices.filter((inv) => Number(inv.saldoPendiente || 0) === 0 || inv.estado === 'COBRADA');
    let dso = 0;
    let punctualityRate = 0;

    if (paidInvoices.length > 0) {
      // Get payment allocations for these invoices
      const invoicePayments = await prisma.invoicePaymentAllocation.findMany({
        where: {
          invoiceId: { in: paidInvoices.map((inv) => inv.id) },
        },
        select: {
          invoiceId: true,
          payment: {
            select: {
              clientId: true,
              companyId: true,
              estado: true,
              fechaPago: true,
            },
          },
        },
      });

      // Filter in JS to avoid nested relation filter issues
      const validPayments = invoicePayments.filter(
        (ip) => ip.payment && ip.payment.clientId === clientId && ip.payment.companyId === companyId && ip.payment.estado === 'CONFIRMADO'
      );

      const invoicePaymentDates = new Map<number, Date>();
      validPayments.forEach((ip) => {
        if (!invoicePaymentDates.has(ip.invoiceId)) {
          invoicePaymentDates.set(ip.invoiceId, ip.payment.fechaPago);
        }
      });

      let totalDays = 0;
      let paidOnTime = 0;

      paidInvoices.forEach((inv) => {
        const paymentDate = invoicePaymentDates.get(inv.id);
        if (paymentDate && inv.fechaVencimiento) {
          const daysToPayment = differenceInDays(paymentDate, inv.fechaEmision);
          totalDays += daysToPayment;

          if (paymentDate <= inv.fechaVencimiento) {
            paidOnTime++;
          }
        }
      });

      dso = paidInvoices.length > 0 ? Math.round(totalDays / paidInvoices.length) : 0;
      punctualityRate =
        paidInvoices.length > 0 ? Math.round((paidOnTime / paidInvoices.length) * 100) : 0;
    }

    // Calcular facturas vencidas
    const overdueInvoices = invoices.filter(
      (inv) =>
        inv.fechaVencimiento &&
        inv.fechaVencimiento < now &&
        Number(inv.saldoPendiente || 0) > 0
    );
    const overdueAmount = overdueInvoices.reduce(
      (sum, inv) => sum + Number(inv.saldoPendiente || 0),
      0
    );

    // ===== CREDIT METRICS =====
    const creditLimit = Number(client.creditLimit || 0);
    const utilizationRate = creditLimit > 0 ? (pendingAmount / creditLimit) * 100 : 0;
    const availableCredit = creditLimit > 0 ? Math.max(creditLimit - pendingAmount, 0) : 0;
    const nearLimit = utilizationRate >= 80 && utilizationRate < 100;
    const exceeded = utilizationRate >= 100;

    // ===== TOP PRODUCTS =====
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: applyViewMode(
          {
            clientId,
            companyId,
            fechaEmision: { gte: fechaDesde, lte: fechaHasta },
            estado: { notIn: ['CANCELADA', 'BORRADOR'] },
          },
          viewMode
        ),
      },
      select: {
        productId: true,
        cantidad: true,
        subtotal: true,
        product: {
          select: {
            name: true,
            code: true,
          },
        },
        sale: {
          select: {
            id: true,
          },
        },
      },
    });

    const productAggregation = new Map<
      string,
      { name: string; code: string; quantity: number; amount: number; orders: Set<string> }
    >();

    saleItems.forEach((item) => {
      // Skip items without product (productId is optional)
      if (!item.productId || !item.product) return;

      if (!productAggregation.has(item.productId)) {
        productAggregation.set(item.productId, {
          name: item.product.name,
          code: item.product.code || '',
          quantity: 0,
          amount: 0,
          orders: new Set(),
        });
      }
      const agg = productAggregation.get(item.productId)!;
      agg.quantity += Number(item.cantidad || 0);
      agg.amount += Number(item.subtotal || 0);
      agg.orders.add(String(item.sale.id));
    });

    const topProducts = Array.from(productAggregation.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        productCode: data.code,
        quantityBought: Math.round(data.quantity * 100) / 100,
        totalAmount: Math.round(data.amount * 100) / 100,
        orderCount: data.orders.size,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    // ===== TRENDS =====
    // Ventas por mes (últimos 12 meses)
    const last12Months = startOfMonth(subMonths(now, 11));
    const monthlyInvoices = await prisma.salesInvoice.findMany({
      where: applyViewMode(
        {
          clientId,
          companyId,
          fechaEmision: { gte: last12Months, lte: now },
          estado: { notIn: ['CANCELADA', 'ANULADA'] },
        },
        viewMode
      ),
      select: {
        fechaEmision: true,
        total: true,
      },
    });

    const salesByMonth = new Map<string, { amount: number; count: number }>();
    monthlyInvoices.forEach((inv) => {
      const monthKey = inv.fechaEmision.toISOString().substring(0, 7); // YYYY-MM
      if (!salesByMonth.has(monthKey)) {
        salesByMonth.set(monthKey, { amount: 0, count: 0 });
      }
      const month = salesByMonth.get(monthKey)!;
      month.amount += Number(inv.total || 0);
      month.count += 1;
    });

    const salesTrend = Array.from(salesByMonth.entries())
      .map(([month, data]) => ({
        month,
        amount: Math.round(data.amount * 100) / 100,
        invoiceCount: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Balance history (últimos 6 meses) - simplificado
    const balanceHistory = [
      { date: subMonths(now, 5).toISOString().substring(0, 7), balance: 0 },
      { date: subMonths(now, 4).toISOString().substring(0, 7), balance: 0 },
      { date: subMonths(now, 3).toISOString().substring(0, 7), balance: 0 },
      { date: subMonths(now, 2).toISOString().substring(0, 7), balance: 0 },
      { date: subMonths(now, 1).toISOString().substring(0, 7), balance: 0 },
      {
        date: now.toISOString().substring(0, 7),
        balance: Math.round(pendingAmount * 100) / 100,
      },
    ];

    // ===== ALERTS =====
    const daysSinceCreation = differenceInDays(now, client.createdAt);
    const recentActivityDays = 90;
    const recentInvoices = await prisma.salesInvoice.count({
      where: applyViewMode(
        {
          clientId,
          companyId,
          fechaEmision: { gte: subMonths(now, 3) },
          estado: { notIn: ['CANCELADA', 'ANULADA'] },
        },
        viewMode
      ),
    });

    const alerts = {
      nearCreditLimit: nearLimit,
      exceededCreditLimit: exceeded,
      hasOverdueInvoices: overdueAmount > 0,
      slowPayer: dso > 60,
      noRecentActivity: daysSinceCreation > recentActivityDays && recentInvoices === 0,
    };

    // ===== SCORE =====
    // Fórmula: puntualidad (40%) + volumen (30%) + antigüedad (15%) + consistencia (10%) + rentabilidad (5%)
    const punctualityScore = punctualityRate * 0.4; // Max 40 puntos

    const topClientRevenue = 100000; // TODO: Obtener del top cliente real
    const volumeScore = Math.min((totalRevenue / topClientRevenue) * 30, 30); // Max 30 puntos

    const monthsSinceCreation = daysSinceCreation / 30;
    const antiguedadScore = Math.min((monthsSinceCreation / 60) * 15, 15); // Max 15 puntos (5 años)

    const consistencyScore = salesTrend.length >= 10 ? 10 : (salesTrend.length / 10) * 10; // Max 10 puntos

    const rentabilityScore = 5; // TODO: Calcular margen real promedio

    const score = Math.round(
      punctualityScore + volumeScore + antiguedadScore + consistencyScore + rentabilityScore
    );

    // ===== RESPONSE =====
    const response: ClientAnalytics = {
      client: {
        id: client.id,
        legalName: client.legalName,
        name: client.name,
        email: client.email,
        creditLimit: Number(client.creditLimit || 0),
        currentBalance: pendingAmount,
        isBlocked: client.isBlocked,
      },
      period: {
        from: fechaDesde,
        to: fechaHasta,
        days: periodDays,
      },
      salesMetrics: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        invoiceCount,
        orderCount,
        averageTicket: Math.round(averageTicket * 100) / 100,
        trend,
        growthRate: Math.round(growthRate * 100) / 100,
      },
      paymentMetrics: {
        dso,
        punctualityRate,
        totalPaid: Math.round(totalPaid * 100) / 100,
        pendingAmount: Math.round(pendingAmount * 100) / 100,
        overdueAmount: Math.round(overdueAmount * 100) / 100,
      },
      creditMetrics: {
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        availableCredit: Math.round(availableCredit * 100) / 100,
        nearLimit,
        exceeded,
      },
      topProducts,
      trends: {
        salesByMonth: salesTrend,
        balanceHistory,
      },
      alerts,
      score,
    };

    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600'); // 5 min cache

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Error obteniendo analytics de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
