/**
 * GET /api/ventas/pagos/analytics
 *
 * Returns comprehensive analytics for collections:
 * - KPIs (total collected, pending, efficiency)
 * - Trends over time
 * - Distribution by payment method
 * - Top clients
 * - Aging analysis
 * - DSO (Days Sales Outstanding)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PAGOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // month, quarter, year
    const trendMonths = parseInt(searchParams.get('trendMonths') || '12');

    // Calculate date range based on period
    const now = new Date();
    const endDate = now;
    let startDate: Date;

    switch (period) {
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Base where clause
    const baseWhere = applyViewMode({ companyId }, viewMode);

    // =========================================================================
    // 1. KPIS - Current Period
    // =========================================================================

    const payments = await prisma.clientPayment.findMany({
      where: {
        ...baseWhere,
        estado: { notIn: ['ANULADO'] },
        fechaPago: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        totalPago: true,
        fechaPago: true,
        efectivo: true,
        transferencia: true,
        chequesTerceros: true,
        chequesPropios: true,
        tarjetaCredito: true,
        tarjetaDebito: true,
        otrosMedios: true,
        estado: true,
        createdAt: true,
      },
    });

    const totalCobrado = payments.reduce((sum, p) => sum + parseFloat(p.totalPago.toString()), 0);
    const cantidadPagos = payments.length;
    const promedioCobranza = cantidadPagos > 0 ? totalCobrado / cantidadPagos : 0;

    // Calculate average collection time (days from creation to payment)
    const collectionTimes = payments
      .filter((p) => p.estado === 'CONFIRMADO')
      .map((p) => {
        const createdDate = new Date(p.createdAt);
        const paymentDate = new Date(p.fechaPago);
        return (paymentDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      });

    const promedioTiempoCobranza =
      collectionTimes.length > 0
        ? collectionTimes.reduce((sum, days) => sum + days, 0) / collectionTimes.length
        : 0;

    // Pending invoices
    const pendingInvoices = await prisma.salesInvoice.findMany({
      where: {
        ...baseWhere,
        estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
        saldoPendiente: { gt: 0 },
      },
      select: {
        saldoPendiente: true,
        fechaVencimiento: true,
      },
    });

    const totalPendiente = pendingInvoices.reduce(
      (sum, inv) => sum + parseFloat(inv.saldoPendiente.toString()),
      0
    );

    const facturasVencidas = pendingInvoices.filter(
      (inv) => new Date(inv.fechaVencimiento) < now
    );
    const montoVencido = facturasVencidas.reduce(
      (sum, inv) => sum + parseFloat(inv.saldoPendiente.toString()),
      0
    );

    // Collection efficiency
    const invoicesThisPeriod = await prisma.salesInvoice.findMany({
      where: {
        ...baseWhere,
        fechaEmision: { gte: startDate, lte: endDate },
        estado: { notIn: ['ANULADA'] },
      },
      select: {
        total: true,
        totalCobrado: true,
      },
    });

    const totalFacturado = invoicesThisPeriod.reduce(
      (sum, inv) => sum + parseFloat(inv.total.toString()),
      0
    );
    const totalCobradoDelPeriodo = invoicesThisPeriod.reduce(
      (sum, inv) => sum + parseFloat((inv.totalCobrado || 0).toString()),
      0
    );

    const eficienciaCobranza =
      totalFacturado > 0 ? (totalCobradoDelPeriodo / totalFacturado) * 100 : 0;

    // =========================================================================
    // 2. TRENDS - Last N Months
    // =========================================================================

    const trendsStartDate = new Date();
    trendsStartDate.setMonth(trendsStartDate.getMonth() - trendMonths);

    const trendPayments = await prisma.clientPayment.findMany({
      where: {
        ...baseWhere,
        fechaPago: { gte: trendsStartDate },
        estado: { notIn: ['ANULADO'] },
      },
      select: {
        fechaPago: true,
        totalPago: true,
      },
    });

    // Group by month
    const trendsByMonth: Record<string, { cobrado: number; cantidad: number }> = {};

    for (let i = 0; i < trendMonths; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      trendsByMonth[key] = { cobrado: 0, cantidad: 0 };
    }

    trendPayments.forEach((payment) => {
      const date = new Date(payment.fechaPago);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (trendsByMonth[key]) {
        trendsByMonth[key].cobrado += parseFloat(payment.totalPago.toString());
        trendsByMonth[key].cantidad += 1;
      }
    });

    const trends = Object.entries(trendsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, data]) => {
        const [year, month] = mes.split('-');
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
          'es-AR',
          { month: 'short', year: '2-digit' }
        );
        return {
          mes: monthName,
          cobrado: data.cobrado,
          cantidad: data.cantidad,
        };
      });

    // =========================================================================
    // 3. BY PAYMENT METHOD
    // =========================================================================

    const porMedio = {
      efectivo: 0,
      transferencia: 0,
      chequesTerceros: 0,
      chequesPropios: 0,
      tarjetaCredito: 0,
      tarjetaDebito: 0,
      otrosMedios: 0,
    };

    payments.forEach((p) => {
      porMedio.efectivo += parseFloat((p.efectivo || 0).toString());
      porMedio.transferencia += parseFloat((p.transferencia || 0).toString());
      porMedio.chequesTerceros += parseFloat((p.chequesTerceros || 0).toString());
      porMedio.chequesPropios += parseFloat((p.chequesPropios || 0).toString());
      porMedio.tarjetaCredito += parseFloat((p.tarjetaCredito || 0).toString());
      porMedio.tarjetaDebito += parseFloat((p.tarjetaDebito || 0).toString());
      porMedio.otrosMedios += parseFloat((p.otrosMedios || 0).toString());
    });

    // =========================================================================
    // 4. TOP CLIENTS
    // =========================================================================

    const clientPayments = await prisma.clientPayment.groupBy({
      by: ['clientId'],
      where: {
        ...baseWhere,
        estado: { notIn: ['ANULADO'] },
        fechaPago: { gte: startDate, lte: endDate },
      },
      _sum: {
        totalPago: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          totalPago: 'desc',
        },
      },
      take: 10,
    });

    const clientIds = clientPayments.map((cp) => cp.clientId);
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, legalName: true, name: true },
    });

    const clientMap = new Map(clients.map((c) => [c.id, c]));

    const topClients = clientPayments.map((cp) => {
      const client = clientMap.get(cp.clientId);
      return {
        clientName: client?.legalName || client?.name || 'Sin nombre',
        totalCobrado: parseFloat((cp._sum.totalPago || 0).toString()),
        cantidadPagos: cp._count.id,
      };
    });

    // =========================================================================
    // 5. AGING ANALYSIS
    // =========================================================================

    const aging = {
      vigente: 0, // No vencidas
      vencido1_30: 0,
      vencido31_60: 0,
      vencido61_90: 0,
      vencido90Plus: 0,
    };

    pendingInvoices.forEach((inv) => {
      const saldo = parseFloat(inv.saldoPendiente.toString());
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(inv.fechaVencimiento).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysOverdue < 0) {
        aging.vigente += saldo;
      } else if (daysOverdue <= 30) {
        aging.vencido1_30 += saldo;
      } else if (daysOverdue <= 60) {
        aging.vencido31_60 += saldo;
      } else if (daysOverdue <= 90) {
        aging.vencido61_90 += saldo;
      } else {
        aging.vencido90Plus += saldo;
      }
    });

    // =========================================================================
    // 6. DSO (Days Sales Outstanding)
    // =========================================================================

    // DSO = (Accounts Receivable / Total Credit Sales) × Number of Days
    const last90Days = new Date();
    last90Days.setDate(last90Days.getDate() - 90);

    const salesLast90Days = await prisma.salesInvoice.findMany({
      where: {
        ...baseWhere,
        fechaEmision: { gte: last90Days },
        estado: { notIn: ['ANULADA'] },
      },
      select: {
        total: true,
      },
    });

    const totalCreditSales = salesLast90Days.reduce(
      (sum, inv) => sum + parseFloat(inv.total.toString()),
      0
    );

    const dso = totalCreditSales > 0 ? (totalPendiente / totalCreditSales) * 90 : 0;

    // =========================================================================
    // 7. BY STATUS
    // =========================================================================

    const byStatus = await prisma.clientPayment.groupBy({
      by: ['estado'],
      where: {
        ...baseWhere,
        fechaPago: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: { totalPago: true },
    });

    const formattedByStatus = byStatus.map((group) => ({
      estado: group.estado,
      count: group._count.id,
      monto: parseFloat((group._sum.totalPago || 0).toString()),
    }));

    // =========================================================================
    // RESPONSE
    // =========================================================================

    return NextResponse.json({
      // KPIs
      totalCobrado,
      cantidadPagos,
      promedioCobranza,
      promedioTiempoCobranza: Math.round(promedioTiempoCobranza),
      totalPendiente,
      montoVencido,
      facturasVencidas: facturasVencidas.length,
      eficienciaCobranza: Math.round(eficienciaCobranza * 10) / 10,
      dso: Math.round(dso * 10) / 10,

      // Charts
      trends,
      porMedio,
      topClients,
      aging,
      byStatus: formattedByStatus,

      // Metadata
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  } catch (error) {
    console.error('[PAYMENTS-ANALYTICS] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener analíticas de cobranzas' },
      { status: 500 }
    );
  }
}
