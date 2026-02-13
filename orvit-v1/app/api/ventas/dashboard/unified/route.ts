/**
 * Unified Ventas-Tesorería Dashboard API
 *
 * GET: Get unified dashboard data combining sales, collections, and treasury
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/view-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.DASHBOARD_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const period = parseInt(searchParams.get('period') || '30');
    const viewMode = getViewMode(request);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    const today = new Date();

    // Execute all queries in parallel for performance
    const [
      salesData,
      collectionsData,
      cashPositionData,
      dsoData,
      agingData,
      alertsData,
      forecastData,
      topClientsData,
    ] = await Promise.all([
      getSalesMetrics(user!.companyId, startDate, viewMode),
      getCollectionsMetrics(user!.companyId, startDate, viewMode),
      getCashPositionMetrics(user!.companyId),
      getDSOMetrics(user!.companyId, viewMode),
      getAgingBuckets(user!.companyId, viewMode),
      getRiskAlerts(user!.companyId),
      getCashFlowForecast(user!.companyId, 7, viewMode),
      getTopDebtors(user!.companyId, 5),
    ]);

    // Calculate key ratios
    const keyRatios = {
      currentRatio: cashPositionData.totalLiquidity > 0 && collectionsData.totalOverdue > 0
        ? (cashPositionData.totalLiquidity / collectionsData.totalOverdue).toFixed(2)
        : 'N/A',
      collectionEfficiency: collectionsData.collectedAmount > 0 && salesData.invoicedAmount > 0
        ? ((collectionsData.collectedAmount / salesData.invoicedAmount) * 100).toFixed(1)
        : '0',
      overdueRatio: collectionsData.totalPending > 0
        ? ((collectionsData.totalOverdue / collectionsData.totalPending) * 100).toFixed(1)
        : '0',
    };

    // Health score (0-100)
    const healthScore = calculateHealthScore({
      dso: dsoData.currentDSO,
      targetDso: 30,
      overdueRatio: parseFloat(keyRatios.overdueRatio) || 0,
      alertsCritical: alertsData.criticas,
      collectionEfficiency: parseFloat(keyRatios.collectionEfficiency) || 0,
    });

    return NextResponse.json({
      period: {
        days: period,
        from: startDate.toISOString(),
        to: today.toISOString(),
      },
      healthScore,
      keyRatios,
      sales: salesData,
      collections: collectionsData,
      cashPosition: cashPositionData,
      dso: dsoData,
      aging: agingData,
      alerts: alertsData,
      forecast: forecastData,
      topDebtors: topClientsData,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error getting unified dashboard:', err);
    return NextResponse.json(
      { error: 'Error al obtener datos del dashboard unificado' },
      { status: 500 }
    );
  }
}

async function getSalesMetrics(companyId: number, startDate: Date, viewMode: any) {
  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - (new Date().getDate() - startDate.getDate()));

  const [current, previous, invoices] = await Promise.all([
    prisma.sale.aggregate({
      where: applyViewMode({ companyId, createdAt: { gte: startDate } }, viewMode),
      _count: { id: true },
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: applyViewMode({
        companyId,
        createdAt: { gte: prevStartDate, lt: startDate }
      }, viewMode),
      _sum: { total: true },
    }),
    prisma.salesInvoice.aggregate({
      where: applyViewMode({ companyId, fechaEmision: { gte: startDate } }, viewMode),
      _sum: { total: true },
      _count: { id: true },
    }),
  ]);

  const currentTotal = current._sum.total?.toNumber() || 0;
  const previousTotal = previous._sum.total?.toNumber() || 0;
  const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

  return {
    ordersCount: current._count.id,
    ordersTotal: currentTotal,
    invoicesCount: invoices._count.id,
    invoicedAmount: invoices._sum.total?.toNumber() || 0,
    growth: growth.toFixed(1),
    trend: growth > 0 ? 'up' : growth < 0 ? 'down' : 'stable',
  };
}

async function getCollectionsMetrics(companyId: number, startDate: Date, viewMode: any) {
  const today = new Date();

  const [pending, overdue, collected] = await Promise.all([
    prisma.salesInvoice.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      _sum: { saldoPendiente: true },
      _count: { id: true },
    }),
    prisma.salesInvoice.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] },
        fechaVencimiento: { lt: today },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      _sum: { saldoPendiente: true },
      _count: { id: true },
    }),
    prisma.clientPayment.aggregate({
      where: applyViewMode({
        companyId,
        fechaPago: { gte: startDate },
        estado: 'CONFIRMADO',
      }, viewMode),
      _sum: { totalPago: true },
      _count: { id: true },
    }),
  ]);

  return {
    totalPending: pending._sum.saldoPendiente?.toNumber() || 0,
    pendingCount: pending._count.id,
    totalOverdue: overdue._sum.saldoPendiente?.toNumber() || 0,
    overdueCount: overdue._count.id,
    collectedAmount: collected._sum.totalPago?.toNumber() || 0,
    collectedCount: collected._count.id,
  };
}

async function getCashPositionMetrics(companyId: number) {
  const [cash, bank, checks] = await Promise.all([
    prisma.cashAccount.aggregate({
      where: { companyId, isActive: true },
      _sum: { saldoActual: true },
    }),
    prisma.bankAccount.aggregate({
      where: { companyId, isActive: true },
      _sum: { saldoActual: true },
    }),
    prisma.cheque.aggregate({
      where: { companyId, estado: 'EN_CARTERA', tipo: 'RECIBIDO' },
      _sum: { monto: true },
    }),
  ]);

  const cashTotal = cash._sum.saldoActual?.toNumber() || 0;
  const bankTotal = bank._sum.saldoActual?.toNumber() || 0;
  const checksTotal = checks._sum.monto?.toNumber() || 0;

  return {
    cash: cashTotal,
    bank: bankTotal,
    checksInHand: checksTotal,
    totalLiquidity: cashTotal + bankTotal + checksTotal,
  };
}

async function getDSOMetrics(companyId: number, viewMode: any) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [receivables, sales] = await Promise.all([
    prisma.salesInvoice.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      _sum: { saldoPendiente: true },
    }),
    prisma.salesInvoice.aggregate({
      where: applyViewMode({ companyId, fechaEmision: { gte: thirtyDaysAgo } }, viewMode),
      _sum: { total: true },
    }),
  ]);

  const totalReceivables = receivables._sum.saldoPendiente?.toNumber() || 0;
  const dailySales = (sales._sum.total?.toNumber() || 0) / 30;
  const dso = dailySales > 0 ? Math.round(totalReceivables / dailySales) : 0;

  return {
    currentDSO: dso,
    targetDSO: 30,
    status: dso <= 30 ? 'good' : dso <= 45 ? 'warning' : 'critical',
  };
}

async function getAgingBuckets(companyId: number, viewMode: any) {
  const today = new Date();

  const results = await Promise.all([
    // Current (not yet due)
    prisma.salesInvoice.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
        fechaVencimiento: { gte: today },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      _sum: { saldoPendiente: true },
    }),
    // 1-30 days
    prisma.salesInvoice.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] },
        fechaVencimiento: {
          gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          lt: today,
        },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      _sum: { saldoPendiente: true },
    }),
    // 31-60 days
    prisma.salesInvoice.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] },
        fechaVencimiento: {
          gte: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000),
          lt: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      _sum: { saldoPendiente: true },
    }),
    // 61-90 days
    prisma.salesInvoice.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] },
        fechaVencimiento: {
          gte: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
          lt: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000),
        },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      _sum: { saldoPendiente: true },
    }),
    // >90 days
    prisma.salesInvoice.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] },
        fechaVencimiento: { lt: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000) },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      _sum: { saldoPendiente: true },
    }),
  ]);

  return [
    { bucket: 'Corriente', amount: results[0]._sum.saldoPendiente?.toNumber() || 0 },
    { bucket: '1-30', amount: results[1]._sum.saldoPendiente?.toNumber() || 0 },
    { bucket: '31-60', amount: results[2]._sum.saldoPendiente?.toNumber() || 0 },
    { bucket: '61-90', amount: results[3]._sum.saldoPendiente?.toNumber() || 0 },
    { bucket: '>90', amount: results[4]._sum.saldoPendiente?.toNumber() || 0 },
  ];
}

async function getRiskAlerts(companyId: number) {
  const alerts = await prisma.$queryRaw<any[]>`
    SELECT severidad, COUNT(*)::int as count
    FROM sales_risk_alerts
    WHERE "companyId" = ${companyId} AND estado = 'ACTIVA'
    GROUP BY severidad
  `;

  return {
    total: alerts.reduce((sum, a) => sum + a.count, 0),
    criticas: alerts.find(a => a.severidad === 'CRITICA')?.count || 0,
    altas: alerts.find(a => a.severidad === 'ALTA')?.count || 0,
    medias: alerts.find(a => a.severidad === 'MEDIA')?.count || 0,
    bajas: alerts.find(a => a.severidad === 'BAJA')?.count || 0,
  };
}

async function getCashFlowForecast(companyId: number, days: number, viewMode: any) {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  const [inflows, checks] = await Promise.all([
    prisma.salesInvoice.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['EMITIDA'] },
        fechaVencimiento: { gte: today, lte: endDate },
        saldoPendiente: { gt: 0 },
      }, viewMode),
      _sum: { saldoPendiente: true },
    }),
    prisma.cheque.aggregate({
      where: {
        companyId,
        estado: 'EN_CARTERA',
        tipo: 'RECIBIDO',
        fechaDeposito: { gte: today, lte: endDate },
      },
      _sum: { monto: true },
    }),
  ]);

  return {
    days,
    expectedInflows: inflows._sum.saldoPendiente?.toNumber() || 0,
    checksToDeposit: checks._sum.monto?.toNumber() || 0,
    total: (inflows._sum.saldoPendiente?.toNumber() || 0) + (checks._sum.monto?.toNumber() || 0),
  };
}

async function getTopDebtors(companyId: number, limit: number) {
  return prisma.client.findMany({
    where: { companyId, currentBalance: { gt: 0 } },
    select: {
      id: true,
      legalName: true,
      currentBalance: true,
      creditLimit: true,
      isBlocked: true,
    },
    orderBy: { currentBalance: 'desc' },
    take: limit,
  });
}

function calculateHealthScore(params: {
  dso: number;
  targetDso: number;
  overdueRatio: number;
  alertsCritical: number;
  collectionEfficiency: number;
}): { score: number; status: 'excellent' | 'good' | 'warning' | 'critical' } {
  let score = 100;

  // DSO impact (max -30 points)
  if (params.dso > params.targetDso) {
    const dsoExcess = params.dso - params.targetDso;
    score -= Math.min(30, dsoExcess);
  }

  // Overdue ratio impact (max -25 points)
  score -= Math.min(25, params.overdueRatio * 0.5);

  // Critical alerts impact (max -25 points)
  score -= Math.min(25, params.alertsCritical * 5);

  // Collection efficiency bonus (max +10 points)
  if (params.collectionEfficiency > 80) {
    score += Math.min(10, (params.collectionEfficiency - 80) * 0.5);
  }

  score = Math.max(0, Math.min(100, score));

  const status =
    score >= 80 ? 'excellent' :
    score >= 60 ? 'good' :
    score >= 40 ? 'warning' : 'critical';

  return { score: Math.round(score), status };
}
