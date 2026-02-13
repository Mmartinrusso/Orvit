/**
 * Machine Learning Credit Risk Scoring Service
 *
 * Implements logistic regression and decision tree algorithms
 * for customer credit risk assessment based on:
 * - Payment history
 * - Outstanding balances
 * - Credit limit utilization
 * - Transaction patterns
 * - Historical disputes/chargebacks
 */

export interface CreditFeatures {
  // Payment behavior
  avgPaymentDays: number; // Average days to pay invoices
  latePaymentRate: number; // % of late payments
  missedPaymentCount: number; // Number of missed payments

  // Financial metrics
  totalDebt: number; // Current outstanding balance
  creditLimit: number; // Assigned credit limit
  utilizationRate: number; // Debt/Limit ratio
  avgMonthlySpend: number; // Average monthly purchases

  // Historical patterns
  customerAgeMonths: number; // Months since first purchase
  totalInvoices: number; // Total invoices issued
  paidInvoices: number; // Successfully paid invoices
  disputeCount: number; // Number of disputes raised
  chargebackCount: number; // Number of chargebacks

  // Recent behavior
  recentPurchaseTrend: 'increasing' | 'stable' | 'decreasing';
  last3MonthsPaymentRate: number; // Payment success rate last 3 months
}

export interface CreditScore {
  score: number; // 0-1000
  rating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D';
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  defaultProbability: number; // 0-100%
  recommendedCreditLimit: number;
  warnings: string[];
  strengths: string[];
  riskFactors: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
  }>;
}

export interface CreditDecision {
  approved: boolean;
  requestedAmount: number;
  approvedAmount: number;
  reason: string;
  conditions?: string[];
  reviewDate?: Date;
}

/**
 * Normalize features to 0-1 range
 */
function normalizeFeatures(features: CreditFeatures): number[] {
  return [
    // Payment behavior (lower is better)
    Math.max(0, 1 - features.avgPaymentDays / 90), // 0-90 days scale
    Math.max(0, 1 - features.latePaymentRate), // 0-1
    Math.max(0, 1 - features.missedPaymentCount / 10), // 0-10 scale

    // Financial health (varies)
    Math.max(0, 1 - features.utilizationRate), // Lower utilization is better
    Math.min(1, features.avgMonthlySpend / 100000), // Normalize to 100k

    // Experience (higher is better)
    Math.min(1, features.customerAgeMonths / 36), // 0-36 months
    Math.min(1, features.paidInvoices / features.totalInvoices || 0), // Payment success rate

    // Disputes (lower is better)
    Math.max(0, 1 - features.disputeCount / 5),
    Math.max(0, 1 - features.chargebackCount / 3),

    // Recent behavior
    features.recentPurchaseTrend === 'increasing' ? 1 : features.recentPurchaseTrend === 'stable' ? 0.7 : 0.3,
    features.last3MonthsPaymentRate,
  ];
}

/**
 * Sigmoid activation function
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Logistic Regression Model for Default Probability
 * Pre-trained weights based on typical B2B credit patterns
 */
function logisticRegressionScore(normalizedFeatures: number[]): number {
  // Weights optimized for B2B credit risk (simulated training)
  const weights = [
    0.15,  // Payment days
    0.20,  // Late payment rate
    0.18,  // Missed payments
    0.12,  // Utilization rate
    0.05,  // Monthly spend
    0.08,  // Customer age
    0.15,  // Payment success rate
    0.03,  // Disputes
    0.02,  // Chargebacks
    0.01,  // Purchase trend
    0.10,  // Recent payment rate
  ];

  const bias = -2.5; // Intercept term

  // Calculate linear combination
  let z = bias;
  for (let i = 0; i < normalizedFeatures.length; i++) {
    z += weights[i] * normalizedFeatures[i];
  }

  // Apply sigmoid to get probability
  const probability = sigmoid(z);

  // Convert to score (0-1000)
  return Math.round((1 - probability) * 1000);
}

/**
 * Decision Tree Model for Risk Classification
 */
function decisionTreeClassify(features: CreditFeatures): {
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  confidence: number;
} {
  // Tree structure based on domain knowledge

  // Critical red flags
  if (features.missedPaymentCount >= 3 || features.chargebackCount >= 2) {
    return { riskLevel: 'very_high', confidence: 0.95 };
  }

  // High risk indicators
  if (features.latePaymentRate > 0.5 || features.utilizationRate > 0.9) {
    if (features.last3MonthsPaymentRate < 0.7) {
      return { riskLevel: 'high', confidence: 0.85 };
    }
    return { riskLevel: 'high', confidence: 0.75 };
  }

  // Medium risk
  if (features.avgPaymentDays > 60 || features.utilizationRate > 0.7) {
    if (features.customerAgeMonths < 6) {
      return { riskLevel: 'medium', confidence: 0.8 };
    }
    if (features.disputeCount > 2) {
      return { riskLevel: 'medium', confidence: 0.75 };
    }
    return { riskLevel: 'medium', confidence: 0.7 };
  }

  // Low risk
  if (features.latePaymentRate < 0.2 && features.avgPaymentDays < 45) {
    if (features.customerAgeMonths > 12 && features.disputeCount === 0) {
      return { riskLevel: 'very_low', confidence: 0.9 };
    }
    return { riskLevel: 'low', confidence: 0.8 };
  }

  // Default to low-medium risk
  return { riskLevel: 'low', confidence: 0.65 };
}

/**
 * Convert score to credit rating
 */
function scoreToRating(score: number): 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D' {
  if (score >= 900) return 'AAA';
  if (score >= 850) return 'AA';
  if (score >= 800) return 'A';
  if (score >= 700) return 'BBB';
  if (score >= 600) return 'BB';
  if (score >= 500) return 'B';
  if (score >= 400) return 'CCC';
  if (score >= 300) return 'CC';
  if (score >= 200) return 'C';
  return 'D';
}

/**
 * Analyze risk factors
 */
function analyzeRiskFactors(features: CreditFeatures): Array<{
  factor: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
}> {
  const factors: Array<{ factor: string; impact: 'high' | 'medium' | 'low'; description: string }> = [];

  if (features.missedPaymentCount > 0) {
    factors.push({
      factor: 'Pagos Omitidos',
      impact: 'high',
      description: `${features.missedPaymentCount} pagos no realizados en el historial`,
    });
  }

  if (features.latePaymentRate > 0.3) {
    factors.push({
      factor: 'Morosidad',
      impact: 'high',
      description: `${(features.latePaymentRate * 100).toFixed(0)}% de pagos atrasados`,
    });
  }

  if (features.utilizationRate > 0.8) {
    factors.push({
      factor: 'Alto Uso de Crédito',
      impact: 'medium',
      description: `Utilización del ${(features.utilizationRate * 100).toFixed(0)}% del límite`,
    });
  }

  if (features.avgPaymentDays > 60) {
    factors.push({
      factor: 'Plazo de Pago Largo',
      impact: 'medium',
      description: `Promedio de ${features.avgPaymentDays} días para pagar`,
    });
  }

  if (features.disputeCount > 1) {
    factors.push({
      factor: 'Disputas Frecuentes',
      impact: 'medium',
      description: `${features.disputeCount} disputas registradas`,
    });
  }

  if (features.customerAgeMonths < 6) {
    factors.push({
      factor: 'Cliente Nuevo',
      impact: 'low',
      description: `Solo ${features.customerAgeMonths} meses de historial`,
    });
  }

  if (features.chargebackCount > 0) {
    factors.push({
      factor: 'Contracargos',
      impact: 'high',
      description: `${features.chargebackCount} contracargos realizados`,
    });
  }

  return factors;
}

/**
 * Identify customer strengths
 */
function identifyStrengths(features: CreditFeatures): string[] {
  const strengths: string[] = [];

  if (features.latePaymentRate < 0.1) {
    strengths.push('Excelente historial de pagos puntuales');
  }

  if (features.customerAgeMonths > 24) {
    strengths.push(`Cliente establecido con ${features.customerAgeMonths} meses de relación`);
  }

  if (features.utilizationRate < 0.5) {
    strengths.push('Uso conservador del crédito disponible');
  }

  if (features.avgPaymentDays < 30) {
    strengths.push('Pago promedio menor a 30 días');
  }

  if (features.disputeCount === 0) {
    strengths.push('Sin disputas en el historial');
  }

  if (features.recentPurchaseTrend === 'increasing') {
    strengths.push('Tendencia creciente de compras');
  }

  if (features.last3MonthsPaymentRate > 0.95) {
    strengths.push('Desempeño excelente en últimos 3 meses');
  }

  return strengths;
}

/**
 * Calculate recommended credit limit
 */
function calculateRecommendedLimit(score: number, features: CreditFeatures): number {
  // Base limit from avg monthly spend
  let baseLimit = features.avgMonthlySpend * 2;

  // Adjust by score
  const scoreMultiplier = score / 500; // 500 score = 1x, 1000 score = 2x
  let recommendedLimit = baseLimit * scoreMultiplier;

  // Cap by current debt (don't exceed 3x current debt)
  if (features.totalDebt > 0) {
    recommendedLimit = Math.min(recommendedLimit, features.totalDebt * 3);
  }

  // Floor at 10% of current limit or $10,000
  const floor = Math.max(10000, features.creditLimit * 0.1);
  recommendedLimit = Math.max(floor, recommendedLimit);

  // Ceiling at 300% of current limit
  const ceiling = features.creditLimit * 3;
  recommendedLimit = Math.min(ceiling, recommendedLimit);

  // Round to nearest 1000
  return Math.round(recommendedLimit / 1000) * 1000;
}

/**
 * Generate credit warnings
 */
function generateWarnings(features: CreditFeatures, score: number): string[] {
  const warnings: string[] = [];

  if (score < 500) {
    warnings.push('⚠️ Puntaje crediticio bajo - revisar condiciones');
  }

  if (features.utilizationRate > 0.95) {
    warnings.push('⚠️ Límite de crédito casi agotado');
  }

  if (features.missedPaymentCount > 0) {
    warnings.push('⚠️ Historial de pagos omitidos');
  }

  if (features.last3MonthsPaymentRate < 0.8) {
    warnings.push('⚠️ Deterioro en comportamiento de pago reciente');
  }

  if (features.chargebackCount > 0) {
    warnings.push('🚨 Contracargos registrados - alto riesgo');
  }

  if (features.totalDebt > features.creditLimit) {
    warnings.push('🚨 Deuda excede límite de crédito autorizado');
  }

  return warnings;
}

/**
 * Main Credit Scoring Function
 */
export async function calculateCreditScore(features: CreditFeatures): Promise<CreditScore> {
  // Normalize features
  const normalizedFeatures = normalizeFeatures(features);

  // Calculate score using logistic regression
  const score = logisticRegressionScore(normalizedFeatures);

  // Classify risk using decision tree
  const { riskLevel } = decisionTreeClassify(features);

  // Get credit rating
  const rating = scoreToRating(score);

  // Calculate default probability (inverse of score, scaled)
  const defaultProbability = Math.max(0, Math.min(100, (1 - score / 1000) * 100));

  // Analyze risk factors and strengths
  const riskFactors = analyzeRiskFactors(features);
  const strengths = identifyStrengths(features);

  // Calculate recommended credit limit
  const recommendedCreditLimit = calculateRecommendedLimit(score, features);

  // Generate warnings
  const warnings = generateWarnings(features, score);

  return {
    score,
    rating,
    riskLevel,
    defaultProbability,
    recommendedCreditLimit,
    warnings,
    strengths,
    riskFactors,
  };
}

/**
 * Evaluate Credit Decision for Transaction/Limit Increase
 */
export async function evaluateCreditDecision(
  features: CreditFeatures,
  requestedAmount: number
): Promise<CreditDecision> {
  const creditScore = await calculateCreditScore(features);

  const newUtilization = (features.totalDebt + requestedAmount) / features.creditLimit;

  // Decision logic
  let approved = false;
  let approvedAmount = 0;
  let reason = '';
  const conditions: string[] = [];

  // Auto-reject conditions
  if (creditScore.score < 300 || features.chargebackCount >= 3) {
    return {
      approved: false,
      requestedAmount,
      approvedAmount: 0,
      reason: 'Crédito denegado: Riesgo muy alto o historial de contracargos',
    };
  }

  // High risk - manual review
  if (creditScore.riskLevel === 'very_high' || creditScore.score < 500) {
    return {
      approved: false,
      requestedAmount,
      approvedAmount: 0,
      reason: 'Requiere revisión manual por gerencia de crédito',
      reviewDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
    };
  }

  // Check utilization after transaction
  if (newUtilization > 1.0) {
    // Over limit
    const availableCredit = Math.max(0, features.creditLimit - features.totalDebt);

    if (creditScore.score >= 700 && features.latePaymentRate < 0.2) {
      // Good customer - partial approval
      approvedAmount = availableCredit * 0.9;
      approved = approvedAmount >= requestedAmount * 0.5; // At least 50% of requested

      reason = approved
        ? `Aprobado parcialmente por ${approvedAmount.toFixed(0)} (${((approvedAmount / requestedAmount) * 100).toFixed(0)}% de lo solicitado)`
        : 'Monto solicitado excede límite disponible';

      conditions.push('Pago anticipado requerido para órdenes futuras');
    } else {
      return {
        approved: false,
        requestedAmount,
        approvedAmount: 0,
        reason: 'Monto solicitado excede límite de crédito disponible',
      };
    }
  } else if (newUtilization > 0.9) {
    // High utilization but within limit
    if (creditScore.score >= 600) {
      approved = true;
      approvedAmount = requestedAmount;
      reason = 'Aprobado con condiciones';
      conditions.push('Requiere pago de facturas pendientes en 15 días');
      conditions.push('Límite temporal hasta regularizar cuenta');
    } else {
      return {
        approved: false,
        requestedAmount,
        approvedAmount: 0,
        reason: 'Utilización muy alta con score insuficiente',
      };
    }
  } else {
    // Normal approval
    approved = true;
    approvedAmount = requestedAmount;

    if (creditScore.score >= 800) {
      reason = 'Aprobado automáticamente - Cliente AAA';
    } else if (creditScore.score >= 600) {
      reason = 'Aprobado - Riesgo aceptable';
    } else {
      reason = 'Aprobado con seguimiento';
      conditions.push('Monitoreo mensual de cuenta');
    }
  }

  return {
    approved,
    requestedAmount,
    approvedAmount,
    reason,
    conditions: conditions.length > 0 ? conditions : undefined,
  };
}

/**
 * Batch Credit Evaluation for Portfolio
 */
export async function evaluateCustomerPortfolio(
  customers: Array<{ clientId: number; nombre: string; features: CreditFeatures }>
): Promise<
  Array<{
    clientId: number;
    nombre: string;
    creditScore: CreditScore;
    portfolioRisk: 'green' | 'yellow' | 'red';
  }>
> {
  const results = [];

  for (const customer of customers) {
    const creditScore = await calculateCreditScore(customer.features);

    let portfolioRisk: 'green' | 'yellow' | 'red';
    if (creditScore.riskLevel === 'very_low' || creditScore.riskLevel === 'low') {
      portfolioRisk = 'green';
    } else if (creditScore.riskLevel === 'medium') {
      portfolioRisk = 'yellow';
    } else {
      portfolioRisk = 'red';
    }

    results.push({
      clientId: customer.clientId,
      nombre: customer.nombre,
      creditScore,
      portfolioRisk,
    });
  }

  // Sort by risk (red first)
  results.sort((a, b) => {
    const riskOrder = { red: 0, yellow: 1, green: 2 };
    return riskOrder[a.portfolioRisk] - riskOrder[b.portfolioRisk];
  });

  return results;
}
