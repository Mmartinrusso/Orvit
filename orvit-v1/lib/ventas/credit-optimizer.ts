/**
 * Credit Limit Optimizer
 *
 * AI-powered credit limit optimization suggestions based on:
 * - Payment history and patterns
 * - Sales volume trends
 * - Risk indicators
 * - Industry benchmarks
 */

import { Decimal } from '@prisma/client/runtime/library';

export interface ClientCreditData {
  clientId: string;
  clientName: string;
  currentCreditLimit: number;
  currentBalance: number;
  creditUtilization: number; // %
  // Payment history
  avgPaymentDays: number;
  onTimePaymentRate: number; // %
  totalInvoices: number;
  totalPaidOnTime: number;
  // Sales history
  monthlySalesAvg: number;
  salesTrend: 'growing' | 'stable' | 'declining';
  monthsAsClient: number;
  // Risk indicators
  maxOverdueDays: number;
  overdueInvoicesCount: number;
  currentOverdueAmount: number;
  // Industry
  industryAvgCreditRatio: number; // avg credit limit / monthly sales
}

export interface CreditLimitSuggestion {
  clientId: string;
  clientName: string;
  currentLimit: number;
  suggestedLimit: number;
  changePercent: number;
  changeType: 'increase' | 'decrease' | 'maintain';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string[];
  riskLevel: 'low' | 'medium' | 'high';
  urgency: 'immediate' | 'review' | 'informational';
  factors: {
    paymentHistoryScore: number;
    utilizationScore: number;
    salesTrendScore: number;
    riskScore: number;
    tenureScore: number;
  };
}

// Industry benchmark: credit limit as multiple of monthly sales
const INDUSTRY_CREDIT_RATIO = 2.5; // 2.5x monthly sales
const MIN_MONTHS_FOR_INCREASE = 3;
const MIN_INVOICES_FOR_ASSESSMENT = 5;

/**
 * Generate credit limit optimization suggestions for a list of clients
 */
export function generateCreditSuggestions(
  clients: ClientCreditData[]
): CreditLimitSuggestion[] {
  return clients
    .filter(client => client.totalInvoices >= MIN_INVOICES_FOR_ASSESSMENT)
    .map(client => analyzeCreditLimit(client))
    .filter(suggestion => suggestion !== null) as CreditLimitSuggestion[];
}

/**
 * Analyze a single client and generate credit limit suggestion
 */
function analyzeCreditLimit(client: ClientCreditData): CreditLimitSuggestion | null {
  const factors = calculateFactors(client);
  const overallScore = calculateOverallScore(factors);
  const suggestion = calculateSuggestedLimit(client, factors, overallScore);

  // Skip if change is insignificant (< 5%)
  if (Math.abs(suggestion.changePercent) < 5) {
    return null;
  }

  return suggestion;
}

/**
 * Calculate individual factor scores (0-100)
 */
function calculateFactors(client: ClientCreditData): CreditLimitSuggestion['factors'] {
  // Payment history score (0-100)
  // Based on on-time payment rate and avg payment days
  let paymentHistoryScore = client.onTimePaymentRate;
  if (client.avgPaymentDays <= 30) paymentHistoryScore = Math.min(100, paymentHistoryScore + 10);
  else if (client.avgPaymentDays > 60) paymentHistoryScore = Math.max(0, paymentHistoryScore - 20);
  else if (client.avgPaymentDays > 45) paymentHistoryScore = Math.max(0, paymentHistoryScore - 10);

  // Utilization score (0-100)
  // Optimal: 40-70%, too high indicates need for increase, too low might indicate over-allocation
  let utilizationScore = 50;
  if (client.creditUtilization >= 40 && client.creditUtilization <= 70) {
    utilizationScore = 80;
  } else if (client.creditUtilization > 90) {
    utilizationScore = 30; // May need increase but risky
  } else if (client.creditUtilization < 20) {
    utilizationScore = 40; // May be over-allocated
  } else if (client.creditUtilization > 70 && client.creditUtilization <= 90) {
    utilizationScore = 60;
  }

  // Sales trend score (0-100)
  let salesTrendScore = 50;
  if (client.salesTrend === 'growing') salesTrendScore = 80;
  else if (client.salesTrend === 'declining') salesTrendScore = 30;

  // Risk score (0-100, higher = lower risk)
  let riskScore = 100;
  if (client.currentOverdueAmount > 0) {
    riskScore -= 30;
    riskScore -= Math.min(30, (client.overdueInvoicesCount * 5));
  }
  if (client.maxOverdueDays > 90) riskScore -= 20;
  else if (client.maxOverdueDays > 60) riskScore -= 10;
  riskScore = Math.max(0, riskScore);

  // Tenure score (0-100)
  let tenureScore = Math.min(100, client.monthsAsClient * 5);
  if (client.monthsAsClient >= 24) tenureScore = 100;
  else if (client.monthsAsClient >= 12) tenureScore = 80;
  else if (client.monthsAsClient >= 6) tenureScore = 60;

  return {
    paymentHistoryScore,
    utilizationScore,
    salesTrendScore,
    riskScore,
    tenureScore,
  };
}

/**
 * Calculate overall score from factors (0-100)
 */
function calculateOverallScore(factors: CreditLimitSuggestion['factors']): number {
  // Weighted average
  const weights = {
    paymentHistoryScore: 0.30,
    riskScore: 0.25,
    utilizationScore: 0.20,
    salesTrendScore: 0.15,
    tenureScore: 0.10,
  };

  return (
    factors.paymentHistoryScore * weights.paymentHistoryScore +
    factors.riskScore * weights.riskScore +
    factors.utilizationScore * weights.utilizationScore +
    factors.salesTrendScore * weights.salesTrendScore +
    factors.tenureScore * weights.tenureScore
  );
}

/**
 * Calculate suggested credit limit based on analysis
 */
function calculateSuggestedLimit(
  client: ClientCreditData,
  factors: CreditLimitSuggestion['factors'],
  overallScore: number
): CreditLimitSuggestion {
  const reasoning: string[] = [];
  let suggestedLimit = client.currentCreditLimit;

  // Calculate ideal limit based on sales
  const idealLimit = client.monthlySalesAvg * INDUSTRY_CREDIT_RATIO;

  // Determine if increase is warranted
  if (overallScore >= 75 && client.monthsAsClient >= MIN_MONTHS_FOR_INCREASE) {
    // Strong candidate for increase
    if (client.creditUtilization > 80) {
      // High utilization + good score = increase
      suggestedLimit = Math.max(idealLimit, client.currentCreditLimit * 1.3);
      reasoning.push('Alto uso del crédito con buen historial de pagos');
    } else if (client.salesTrend === 'growing') {
      // Growing sales = increase proportionally
      suggestedLimit = Math.max(idealLimit, client.currentCreditLimit * 1.2);
      reasoning.push('Ventas en crecimiento justifican mayor límite');
    }
  } else if (overallScore >= 50 && overallScore < 75) {
    // Moderate case
    if (client.creditUtilization > 90 && factors.paymentHistoryScore >= 70) {
      // High utilization but decent payment history
      suggestedLimit = client.currentCreditLimit * 1.15;
      reasoning.push('Uso alto del crédito con historial aceptable');
    }
  } else if (overallScore < 50) {
    // Risk case - consider decrease
    if (client.currentOverdueAmount > 0) {
      suggestedLimit = Math.max(client.currentBalance, client.currentCreditLimit * 0.7);
      reasoning.push('Facturas vencidas pendientes - se recomienda reducir exposición');
    } else if (client.creditUtilization < 20 && client.monthsAsClient >= 6) {
      // Low utilization - may be over-allocated
      suggestedLimit = Math.max(client.currentBalance * 1.5, idealLimit);
      reasoning.push('Bajo uso del crédito - posible sobre-asignación');
    }
  }

  // Add reasoning based on specific factors
  if (factors.paymentHistoryScore >= 90) {
    reasoning.push('Excelente historial de pagos puntuales');
  } else if (factors.paymentHistoryScore < 60) {
    reasoning.push('Historial de pagos requiere mejora');
  }

  if (factors.riskScore < 50) {
    reasoning.push('Indicadores de riesgo elevados');
  }

  if (factors.tenureScore >= 80) {
    reasoning.push('Cliente con antigüedad significativa');
  } else if (factors.tenureScore < 40) {
    reasoning.push('Cliente relativamente nuevo - monitorear');
  }

  // Round to nice numbers
  suggestedLimit = roundToNiceNumber(suggestedLimit);

  const changePercent = ((suggestedLimit - client.currentCreditLimit) / client.currentCreditLimit) * 100;
  const changeType = changePercent > 5 ? 'increase' : changePercent < -5 ? 'decrease' : 'maintain';

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (client.totalInvoices >= 20 && client.monthsAsClient >= 12) {
    confidence = 'high';
  } else if (client.totalInvoices < 10) {
    confidence = 'low';
  }

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  if (factors.riskScore >= 80) riskLevel = 'low';
  else if (factors.riskScore < 50) riskLevel = 'high';

  // Determine urgency
  let urgency: 'immediate' | 'review' | 'informational' = 'informational';
  if (client.currentOverdueAmount > client.currentCreditLimit * 0.5) {
    urgency = 'immediate';
  } else if (Math.abs(changePercent) > 30) {
    urgency = 'review';
  }

  return {
    clientId: client.clientId,
    clientName: client.clientName,
    currentLimit: client.currentCreditLimit,
    suggestedLimit,
    changePercent: Math.round(changePercent * 10) / 10,
    changeType,
    confidence,
    reasoning,
    riskLevel,
    urgency,
    factors,
  };
}

/**
 * Round a number to a "nice" value (e.g., 100, 500, 1000, 5000, etc.)
 */
function roundToNiceNumber(value: number): number {
  if (value <= 1000) return Math.round(value / 100) * 100;
  if (value <= 5000) return Math.round(value / 500) * 500;
  if (value <= 50000) return Math.round(value / 1000) * 1000;
  if (value <= 100000) return Math.round(value / 5000) * 5000;
  return Math.round(value / 10000) * 10000;
}

/**
 * Get a summary of credit optimization opportunities
 */
export function getCreditOptimizationSummary(suggestions: CreditLimitSuggestion[]) {
  const increases = suggestions.filter(s => s.changeType === 'increase');
  const decreases = suggestions.filter(s => s.changeType === 'decrease');

  return {
    total: suggestions.length,
    increases: {
      count: increases.length,
      totalPotential: increases.reduce((sum, s) => sum + (s.suggestedLimit - s.currentLimit), 0),
      highConfidence: increases.filter(s => s.confidence === 'high').length,
    },
    decreases: {
      count: decreases.length,
      totalReduction: decreases.reduce((sum, s) => sum + (s.currentLimit - s.suggestedLimit), 0),
      highRisk: decreases.filter(s => s.riskLevel === 'high').length,
    },
    urgentActions: suggestions.filter(s => s.urgency === 'immediate').length,
  };
}
