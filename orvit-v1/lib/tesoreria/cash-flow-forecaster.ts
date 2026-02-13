/**
 * Cash Flow Forecaster with ML
 *
 * Predicts future cash flows based on:
 * - Historical payment patterns
 * - Pending invoices and their expected collection dates
 * - Sales pipeline (orders, quotes)
 * - Seasonal patterns
 * - Client payment behavior
 */

import { prisma } from '@/lib/prisma';
import { subDays, addDays, differenceInDays, startOfDay, format } from 'date-fns';

export interface CashFlowPrediction {
  date: string;
  predictedInflow: number;
  predictedOutflow: number;
  predictedNet: number;
  accumulatedBalance: number;
  confidence: number;
  breakdown: {
    expectedCollections: number;
    expectedCheckDeposits: number;
    expectedPayments: number;
    expectedSalaries: number;
    otherExpected: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface CashFlowForecast {
  currentPosition: number;
  predictions: CashFlowPrediction[];
  alerts: CashFlowAlert[];
  summary: {
    totalPredictedInflow: number;
    totalPredictedOutflow: number;
    minimumBalance: number;
    minimumBalanceDate: string;
    averageDailyNet: number;
  };
}

export interface ForecastAssumptions {
  /** Porcentaje de cobranza esperada (0-100). Default: 100 */
  cobranzaPct: number;
  /** Días de retraso promedio a aplicar sobre fecha esperada de cobro. Default: 0 */
  diasRetraso: number;
  /** Margen de seguridad: porcentaje a descontar del saldo proyectado (0-50). Default: 0 */
  margenSeguridad: number;
}

export const DEFAULT_ASSUMPTIONS: ForecastAssumptions = {
  cobranzaPct: 100,
  diasRetraso: 0,
  margenSeguridad: 0,
};

export interface CashFlowAlert {
  type: 'liquidity_warning' | 'negative_balance' | 'concentration_risk' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  date?: string;
  amount?: number;
  recommendation: string;
}

interface ClientPaymentPattern {
  clientId: string;
  avgDaysToPayment: number;
  paymentProbability: number;
  stdDeviation: number;
}

/**
 * Generate cash flow forecast for the next N days
 */
export async function generateCashFlowForecast(
  companyId: number,
  days: number = 30,
  assumptions: ForecastAssumptions = DEFAULT_ASSUMPTIONS
): Promise<CashFlowForecast> {
  const now = new Date();
  const startDate = startOfDay(now);

  const cobranzaFactor = assumptions.cobranzaPct / 100;
  const margenFactor = 1 - assumptions.margenSeguridad / 100;

  // Get current treasury position
  const currentPosition = await getCurrentTreasuryPosition(companyId);

  // Get historical payment patterns by client
  const paymentPatterns = await getClientPaymentPatterns(companyId);

  // Get pending invoices with expected collection dates
  const pendingInvoices = await getPendingInvoicesWithPredictions(companyId, paymentPatterns, assumptions.diasRetraso);

  // Get pending checks to deposit
  const pendingChecks = await getPendingChecks(companyId);

  // Get historical daily patterns for seasonality
  const seasonalPatterns = await getSeasonalPatterns(companyId);

  // Calculate average daily outflow and salary cost once (do not depend on specific date)
  const [avgDailyPayments, avgSalaryCost] = await Promise.all([
    getAverageDailyPayments(companyId),
    getAverageSalaryCost(companyId),
  ]);

  // Generate daily predictions
  const predictions: CashFlowPrediction[] = [];
  let accumulatedBalance = currentPosition;

  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay();

    // Calculate expected collections for this day, applying cobranza percentage
    const expectedCollections = pendingInvoices
      .filter(inv => inv.expectedPaymentDate === dateStr)
      .reduce((sum, inv) => sum + inv.expectedAmount * inv.probability, 0) * cobranzaFactor;

    // Calculate expected check deposits
    const expectedCheckDeposits = pendingChecks
      .filter(ch => format(ch.fechaVencimiento, 'yyyy-MM-dd') === dateStr)
      .reduce((sum, ch) => sum + Number(ch.importe), 0);

    // Apply seasonal multiplier
    const seasonalFactor = seasonalPatterns[dayOfWeek] || 1.0;

    // Expected outflows (average daily outflow, pre-computed)
    const expectedPayments = avgDailyPayments;

    // Salary payments typically on specific days (1st, 15th)
    const dayOfMonth = date.getDate();
    const expectedSalaries = (dayOfMonth === 1 || dayOfMonth === 15)
      ? avgSalaryCost
      : 0;

    const predictedInflow = (expectedCollections + expectedCheckDeposits) * seasonalFactor * margenFactor;
    const predictedOutflow = expectedPayments + expectedSalaries;
    const predictedNet = predictedInflow - predictedOutflow;

    accumulatedBalance += predictedNet;

    // Calculate confidence based on distance and data quality
    const confidence = calculateConfidence(i, pendingInvoices.length, paymentPatterns.size);

    // Determine risk level based on balance
    const riskLevel = determineRiskLevel(accumulatedBalance, currentPosition);

    predictions.push({
      date: dateStr,
      predictedInflow: Math.round(predictedInflow * 100) / 100,
      predictedOutflow: Math.round(predictedOutflow * 100) / 100,
      predictedNet: Math.round(predictedNet * 100) / 100,
      accumulatedBalance: Math.round(accumulatedBalance * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      breakdown: {
        expectedCollections: Math.round(expectedCollections * 100) / 100,
        expectedCheckDeposits: Math.round(expectedCheckDeposits * 100) / 100,
        expectedPayments: Math.round(expectedPayments * 100) / 100,
        expectedSalaries: Math.round(expectedSalaries * 100) / 100,
        otherExpected: 0,
      },
      riskLevel,
    });
  }

  // Generate alerts
  const alerts = generateAlerts(predictions, currentPosition);

  // Calculate summary
  const summary = calculateSummary(predictions);

  return {
    currentPosition: Math.round(currentPosition * 100) / 100,
    predictions,
    alerts,
    summary,
  };
}

/**
 * Get current treasury position (cash + banks + receivable checks)
 */
async function getCurrentTreasuryPosition(companyId: number): Promise<number> {
  const [cashAccounts, bankAccounts, checksInPortfolio] = await Promise.all([
    prisma.cashAccount.aggregate({
      where: { companyId, isActive: true },
      _sum: { saldoActual: true },
    }),
    prisma.bankAccount.aggregate({
      where: { companyId, isActive: true },
      _sum: { saldoContable: true },
    }),
    prisma.cheque.aggregate({
      where: {
        companyId,
        origen: 'RECIBIDO',
        estado: 'CARTERA',
      },
      _sum: { importe: true },
    }),
  ]);

  return (
    Number(cashAccounts._sum.saldoActual || 0) +
    Number(bankAccounts._sum.saldoContable || 0) +
    Number(checksInPortfolio._sum.importe || 0)
  );
}

/**
 * Analyze historical payment patterns by client
 */
async function getClientPaymentPatterns(companyId: number): Promise<Map<string, ClientPaymentPattern>> {
  const patterns = new Map<string, ClientPaymentPattern>();

  // Get paid invoices with payment dates from last 12 months
  const paidInvoices = await prisma.salesInvoice.findMany({
    where: {
      companyId,
      estado: 'COBRADA',
      fechaEmision: { gte: subDays(new Date(), 365) },
    },
    select: {
      id: true,
      clientId: true,
      fechaEmision: true,
      fechaVencimiento: true,
      total: true,
      paymentAllocations: {
        select: {
          fechaAplicacion: true,
          payment: {
            select: { fechaPago: true },
          },
        },
        take: 1,
      },
    },
  });

  // Group by client and calculate patterns
  const clientData = new Map<string, number[]>();

  for (const invoice of paidInvoices) {
    if (invoice.paymentAllocations.length === 0) continue;

    const paymentDate = invoice.paymentAllocations[0].payment.fechaPago;
    const daysToPayment = differenceInDays(paymentDate, invoice.fechaEmision);

    if (!clientData.has(invoice.clientId)) {
      clientData.set(invoice.clientId, []);
    }
    clientData.get(invoice.clientId)!.push(daysToPayment);
  }

  // Calculate statistics for each client
  for (const [clientId, days] of clientData) {
    if (days.length < 2) continue;

    const avgDays = days.reduce((a, b) => a + b, 0) / days.length;
    const variance = days.reduce((sum, d) => sum + Math.pow(d - avgDays, 2), 0) / days.length;
    const stdDev = Math.sqrt(variance);

    // Payment probability based on consistency
    const probability = Math.max(0.5, 1 - (stdDev / avgDays) * 0.1);

    patterns.set(clientId, {
      clientId,
      avgDaysToPayment: Math.round(avgDays),
      paymentProbability: Math.min(0.95, probability),
      stdDeviation: Math.round(stdDev),
    });
  }

  return patterns;
}

/**
 * Get pending invoices with predicted payment dates
 */
async function getPendingInvoicesWithPredictions(
  companyId: number,
  patterns: Map<string, ClientPaymentPattern>,
  diasRetrasoExtra: number = 0
): Promise<Array<{
  invoiceId: number;
  clientId: string;
  amount: number;
  expectedPaymentDate: string;
  expectedAmount: number;
  probability: number;
}>> {
  const pendingInvoices = await prisma.salesInvoice.findMany({
    where: {
      companyId,
      estado: { in: ['EMITIDA', 'ENVIADA', 'PARCIALMENTE_COBRADA', 'VENCIDA'] },
      saldoPendiente: { gt: 0 },
    },
    select: {
      id: true,
      clientId: true,
      fechaEmision: true,
      fechaVencimiento: true,
      saldoPendiente: true,
      total: true,
    },
  });

  return pendingInvoices.map(invoice => {
    const pattern = patterns.get(invoice.clientId);
    const amount = Number(invoice.saldoPendiente);

    let expectedPaymentDate: Date;
    let probability: number;

    if (pattern) {
      // Use client's historical pattern + extra delay assumption
      expectedPaymentDate = addDays(invoice.fechaEmision, pattern.avgDaysToPayment + diasRetrasoExtra);
      probability = pattern.paymentProbability;
    } else {
      // Default: assume payment on due date + extra delay with 70% probability
      expectedPaymentDate = addDays(invoice.fechaVencimiento, diasRetrasoExtra);
      probability = 0.7;
    }

    // If expected date is in the past, assume payment within next 7 days
    if (expectedPaymentDate < new Date()) {
      expectedPaymentDate = addDays(new Date(), 7);
      probability *= 0.8; // Reduce probability for overdue
    }

    return {
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount,
      expectedPaymentDate: format(expectedPaymentDate, 'yyyy-MM-dd'),
      expectedAmount: amount,
      probability,
    };
  });
}

/**
 * Get pending checks in portfolio
 */
async function getPendingChecks(companyId: number) {
  return prisma.cheque.findMany({
    where: {
      companyId,
      origen: 'RECIBIDO',
      estado: 'CARTERA',
      fechaVencimiento: { gte: new Date() },
    },
    select: {
      id: true,
      importe: true,
      fechaVencimiento: true,
    },
  });
}

/**
 * Get seasonal patterns (day of week multipliers)
 */
async function getSeasonalPatterns(companyId: number): Promise<Record<number, number>> {
  // Analyze last 90 days of payments by day of week
  const payments = await prisma.clientPayment.findMany({
    where: {
      companyId,
      estado: 'CONFIRMADO',
      fechaPago: { gte: subDays(new Date(), 90) },
    },
    select: {
      fechaPago: true,
      totalPago: true,
    },
  });

  const dayTotals: Record<number, { total: number; count: number }> = {};

  for (let i = 0; i < 7; i++) {
    dayTotals[i] = { total: 0, count: 0 };
  }

  for (const payment of payments) {
    const dayOfWeek = payment.fechaPago.getDay();
    dayTotals[dayOfWeek].total += Number(payment.totalPago);
    dayTotals[dayOfWeek].count += 1;
  }

  // Calculate average and normalize
  const averages = Object.entries(dayTotals).map(([day, data]) => ({
    day: Number(day),
    avg: data.count > 0 ? data.total / data.count : 0,
  }));

  const overallAvg = averages.reduce((sum, d) => sum + d.avg, 0) / 7;

  const patterns: Record<number, number> = {};
  for (const { day, avg } of averages) {
    patterns[day] = overallAvg > 0 ? avg / overallAvg : 1.0;
  }

  return patterns;
}

/**
 * Get average daily payments based on last 30 days of bank outflows
 */
async function getAverageDailyPayments(companyId: number): Promise<number> {
  // Get average daily outflow from last 30 days (sum of egreso field across all movement types)
  const recentOutflows = await prisma.bankMovement.aggregate({
    where: {
      bankAccount: { companyId },
      egreso: { gt: 0 },
      fecha: { gte: subDays(new Date(), 30) },
    },
    _sum: { egreso: true },
  });

  const avgDailyOutflow = Number(recentOutflows._sum.egreso || 0) / 30;
  return avgDailyOutflow;
}

/**
 * Get average salary cost (monthly, divided by payment frequency)
 */
async function getAverageSalaryCost(companyId: number): Promise<number> {
  // Estimate based on historical bank movements with 'salary' reference
  // This is a simplified approach - in production, integrate with payroll module
  return 0; // Placeholder - implement when payroll data is available
}

/**
 * Calculate prediction confidence
 */
function calculateConfidence(daysAhead: number, invoiceCount: number, patternCount: number): number {
  // Base confidence decreases with time
  const timeDecay = Math.exp(-daysAhead / 30);

  // More data = higher confidence
  const dataFactor = Math.min(1, (invoiceCount + patternCount) / 50);

  return timeDecay * 0.7 + dataFactor * 0.3;
}

/**
 * Determine risk level based on balance
 */
function determineRiskLevel(balance: number, currentPosition: number): 'low' | 'medium' | 'high' | 'critical' {
  if (balance < 0) return 'critical';
  if (balance < currentPosition * 0.1) return 'high';
  if (balance < currentPosition * 0.3) return 'medium';
  return 'low';
}

/**
 * Generate alerts based on predictions
 */
function generateAlerts(predictions: CashFlowPrediction[], currentPosition: number): CashFlowAlert[] {
  const alerts: CashFlowAlert[] = [];

  // Check for negative balance predictions
  const negativeBalances = predictions.filter(p => p.accumulatedBalance < 0);
  if (negativeBalances.length > 0) {
    const firstNegative = negativeBalances[0];
    alerts.push({
      type: 'negative_balance',
      severity: 'critical',
      message: `Se proyecta saldo negativo de ${Math.abs(firstNegative.accumulatedBalance).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} para el ${firstNegative.date}`,
      date: firstNegative.date,
      amount: firstNegative.accumulatedBalance,
      recommendation: 'Considere acelerar cobranzas o diferir pagos para evitar descubierto',
    });
  }

  // Check for liquidity warnings (balance drops below 20% of current)
  const lowLiquidity = predictions.filter(p =>
    p.accumulatedBalance > 0 &&
    p.accumulatedBalance < currentPosition * 0.2
  );
  if (lowLiquidity.length > 0 && negativeBalances.length === 0) {
    alerts.push({
      type: 'liquidity_warning',
      severity: 'high',
      message: `Liquidez proyectada baja para ${lowLiquidity.length} días en el período`,
      recommendation: 'Monitorear de cerca y preparar líneas de crédito por precaución',
    });
  }

  // Check for unusual patterns (large single-day swings)
  const largeSwings = predictions.filter(p =>
    Math.abs(p.predictedNet) > currentPosition * 0.3
  );
  if (largeSwings.length > 0) {
    alerts.push({
      type: 'unusual_pattern',
      severity: 'medium',
      message: `Se detectaron ${largeSwings.length} días con movimientos atípicos`,
      recommendation: 'Verifique los vencimientos grandes y confirme fechas de cobro/pago',
    });
  }

  return alerts;
}

/**
 * Calculate forecast summary
 */
function calculateSummary(predictions: CashFlowPrediction[]) {
  const totalInflow = predictions.reduce((sum, p) => sum + p.predictedInflow, 0);
  const totalOutflow = predictions.reduce((sum, p) => sum + p.predictedOutflow, 0);

  let minBalance = Infinity;
  let minBalanceDate = '';

  for (const p of predictions) {
    if (p.accumulatedBalance < minBalance) {
      minBalance = p.accumulatedBalance;
      minBalanceDate = p.date;
    }
  }

  return {
    totalPredictedInflow: Math.round(totalInflow * 100) / 100,
    totalPredictedOutflow: Math.round(totalOutflow * 100) / 100,
    minimumBalance: Math.round(minBalance * 100) / 100,
    minimumBalanceDate: minBalanceDate,
    averageDailyNet: Math.round(((totalInflow - totalOutflow) / predictions.length) * 100) / 100,
  };
}
