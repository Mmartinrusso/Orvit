/**
 * Machine Learning Customer Churn Prediction Service
 *
 * Implements Random Forest-inspired algorithm for predicting
 * customer churn probability based on:
 * - Purchase frequency decline
 * - Engagement metrics
 * - Support interactions
 * - Payment behavior
 * - Product usage patterns
 */

export interface ChurnFeatures {
  // Purchase behavior
  daysSinceLastPurchase: number;
  avgDaysBetweenPurchases: number;
  purchaseFrequencyTrend: 'increasing' | 'stable' | 'decreasing';
  totalLifetimeValue: number;
  last3MonthsRevenue: number;
  last6MonthsRevenue: number;

  // Engagement
  loginFrequencyLast30Days: number;
  quoteRequestsLast30Days: number;
  emailOpenRate: number; // 0-1
  supportTicketsLast60Days: number;
  complaintCount: number;

  // Relationship metrics
  customerAgeMonths: number;
  contractStatus: 'active' | 'expiring_soon' | 'expired' | 'none';
  paymentIssuesCount: number;
  cancelledOrdersCount: number;
  returnRate: number; // 0-1

  // Product usage
  productDiversityScore: number; // Number of different product categories purchased
  lastPurchaseProductCategory: string;
  avgOrderValue: number;
}

export interface ChurnPrediction {
  churnProbability: number; // 0-100%
  churnRisk: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  confidence: number; // 0-100%
  keyRiskFactors: Array<{
    factor: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
    value: string;
    recommendation: string;
  }>;
  retentionScore: number; // 0-100 (inverse of churn)
  recommendedActions: Array<{
    priority: 'urgent' | 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
    cost: 'high' | 'medium' | 'low';
  }>;
  estimatedLifetimeValueAtRisk: number;
}

export interface ChurnSegment {
  segmentName: string;
  customerCount: number;
  avgChurnProbability: number;
  totalValueAtRisk: number;
  commonFactors: string[];
  retentionStrategy: string;
}

/**
 * Decision Tree Node for Random Forest
 */
interface DecisionNode {
  feature: string;
  threshold: number;
  leftChild?: DecisionNode;
  rightChild?: DecisionNode;
  prediction?: number; // Leaf node prediction
}

/**
 * Build a simple decision tree (one tree of the "forest")
 */
function buildDecisionTree(
  features: ChurnFeatures,
  treeId: number
): number {
  // Tree 1: Purchase behavior focus
  if (treeId === 0) {
    if (features.daysSinceLastPurchase > 90) {
      if (features.purchaseFrequencyTrend === 'decreasing') {
        return 0.85; // High churn
      }
      return 0.60;
    } else if (features.daysSinceLastPurchase > 60) {
      if (features.last3MonthsRevenue < features.last6MonthsRevenue * 0.3) {
        return 0.70;
      }
      return 0.40;
    } else {
      if (features.purchaseFrequencyTrend === 'increasing') {
        return 0.10;
      }
      return 0.25;
    }
  }

  // Tree 2: Engagement focus
  if (treeId === 1) {
    if (features.loginFrequencyLast30Days === 0) {
      if (features.emailOpenRate < 0.1) {
        return 0.90; // Very high churn
      }
      return 0.65;
    } else if (features.loginFrequencyLast30Days < 2) {
      if (features.complaintCount > 2) {
        return 0.75;
      }
      return 0.45;
    } else {
      if (features.quoteRequestsLast30Days > 0) {
        return 0.15;
      }
      return 0.30;
    }
  }

  // Tree 3: Relationship quality focus
  if (treeId === 2) {
    if (features.contractStatus === 'expired') {
      return 0.95;
    }
    if (features.contractStatus === 'expiring_soon') {
      if (features.customerAgeMonths < 12) {
        return 0.70;
      }
      return 0.55;
    }
    if (features.paymentIssuesCount > 3) {
      return 0.80;
    }
    if (features.cancelledOrdersCount > 2) {
      return 0.65;
    }
    if (features.customerAgeMonths > 24 && features.paymentIssuesCount === 0) {
      return 0.10;
    }
    return 0.35;
  }

  // Tree 4: Product satisfaction focus
  if (treeId === 3) {
    if (features.returnRate > 0.3) {
      return 0.80;
    }
    if (features.supportTicketsLast60Days > 5) {
      if (features.complaintCount > 1) {
        return 0.75;
      }
      return 0.50;
    }
    if (features.productDiversityScore < 2) {
      return 0.45;
    }
    if (features.productDiversityScore > 5) {
      return 0.15;
    }
    return 0.30;
  }

  // Tree 5: Value and trend focus
  if (treeId === 4) {
    const recentVsHistoric = features.last3MonthsRevenue / (features.last6MonthsRevenue || 1);

    if (recentVsHistoric < 0.3) {
      return 0.85;
    }
    if (recentVsHistoric < 0.6) {
      if (features.avgOrderValue < features.totalLifetimeValue / (features.customerAgeMonths || 1) * 0.5) {
        return 0.70;
      }
      return 0.50;
    }
    if (recentVsHistoric > 1.2) {
      return 0.10; // Growing customer
    }
    return 0.30;
  }

  return 0.40; // Default
}

/**
 * Random Forest Prediction (ensemble of decision trees)
 */
function randomForestPredict(features: ChurnFeatures): { probability: number; confidence: number } {
  const numTrees = 5;
  const predictions: number[] = [];

  for (let i = 0; i < numTrees; i++) {
    predictions.push(buildDecisionTree(features, i));
  }

  // Average predictions
  const avgProbability = predictions.reduce((sum, p) => sum + p, 0) / numTrees;

  // Calculate confidence based on variance
  const variance =
    predictions.reduce((sum, p) => sum + (p - avgProbability) ** 2, 0) / numTrees;
  const stdDev = Math.sqrt(variance);

  // High variance = low confidence
  const confidence = Math.max(0, Math.min(100, (1 - stdDev * 2) * 100));

  return {
    probability: avgProbability * 100, // Convert to percentage
    confidence,
  };
}

/**
 * Classify churn risk level
 */
function classifyChurnRisk(probability: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
  if (probability < 15) return 'very_low';
  if (probability < 30) return 'low';
  if (probability < 50) return 'medium';
  if (probability < 70) return 'high';
  return 'very_high';
}

/**
 * Identify key risk factors
 */
function identifyRiskFactors(features: ChurnFeatures): Array<{
  factor: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
  value: string;
  recommendation: string;
}> {
  const factors: Array<{
    factor: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
    value: string;
    recommendation: string;
  }> = [];

  // Critical factors
  if (features.contractStatus === 'expired') {
    factors.push({
      factor: 'Contrato Vencido',
      impact: 'critical',
      value: 'Contrato expirado',
      recommendation: 'Contactar urgentemente para renovación',
    });
  }

  if (features.daysSinceLastPurchase > 120) {
    factors.push({
      factor: 'Inactividad Prolongada',
      impact: 'critical',
      value: `${features.daysSinceLastPurchase} días sin compras`,
      recommendation: 'Campaña de reactivación con oferta especial',
    });
  }

  // High impact factors
  if (features.purchaseFrequencyTrend === 'decreasing') {
    factors.push({
      factor: 'Frecuencia de Compra Decreciente',
      impact: 'high',
      value: 'Tendencia negativa',
      recommendation: 'Investigar causa de reducción en compras',
    });
  }

  if (features.loginFrequencyLast30Days === 0 && features.emailOpenRate < 0.2) {
    factors.push({
      factor: 'Desenganche Total',
      impact: 'critical',
      value: 'Sin interacción en 30 días',
      recommendation: 'Llamada personal del account manager',
    });
  }

  if (features.complaintCount > 2) {
    factors.push({
      factor: 'Múltiples Quejas',
      impact: 'high',
      value: `${features.complaintCount} quejas registradas`,
      recommendation: 'Revisión de servicio y reunión de disculpa',
    });
  }

  if (features.returnRate > 0.25) {
    factors.push({
      factor: 'Alta Tasa de Devoluciones',
      impact: 'high',
      value: `${(features.returnRate * 100).toFixed(0)}% de devoluciones`,
      recommendation: 'Revisar calidad de productos y expectativas',
    });
  }

  if (features.paymentIssuesCount > 2) {
    factors.push({
      factor: 'Problemas de Pago',
      impact: 'high',
      value: `${features.paymentIssuesCount} incidentes`,
      recommendation: 'Ofrecer opciones de pago flexibles',
    });
  }

  // Medium impact factors
  if (features.contractStatus === 'expiring_soon') {
    factors.push({
      factor: 'Contrato Por Vencer',
      impact: 'medium',
      value: 'Próximo a expiración',
      recommendation: 'Iniciar proceso de renovación proactiva',
    });
  }

  const revenueDecline = 1 - features.last3MonthsRevenue / (features.last6MonthsRevenue || 1);
  if (revenueDecline > 0.4) {
    factors.push({
      factor: 'Caída en Ingresos',
      impact: 'medium',
      value: `${(revenueDecline * 100).toFixed(0)}% reducción`,
      recommendation: 'Ofrecer productos complementarios o descuentos',
    });
  }

  if (features.productDiversityScore < 2) {
    factors.push({
      factor: 'Baja Diversidad de Productos',
      impact: 'medium',
      value: `Solo ${features.productDiversityScore} categorías`,
      recommendation: 'Cross-selling de productos relacionados',
    });
  }

  if (features.cancelledOrdersCount > 1) {
    factors.push({
      factor: 'Órdenes Canceladas',
      impact: 'medium',
      value: `${features.cancelledOrdersCount} cancelaciones`,
      recommendation: 'Investigar razones de cancelación',
    });
  }

  // Sort by impact
  const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  factors.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return factors.slice(0, 5); // Top 5 factors
}

/**
 * Generate retention action recommendations
 */
function generateRetentionActions(
  features: ChurnFeatures,
  churnProbability: number,
  riskFactors: Array<{ factor: string; impact: string }>
): Array<{
  priority: 'urgent' | 'high' | 'medium' | 'low';
  action: string;
  expectedImpact: string;
  cost: 'high' | 'medium' | 'low';
}> {
  const actions: Array<{
    priority: 'urgent' | 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
    cost: 'high' | 'medium' | 'low';
  }> = [];

  if (churnProbability > 70) {
    actions.push({
      priority: 'urgent',
      action: 'Llamada ejecutiva urgente',
      expectedImpact: 'Puede reducir churn en 30-40%',
      cost: 'medium',
    });

    actions.push({
      priority: 'urgent',
      action: 'Oferta especial de retención (15-20% descuento)',
      expectedImpact: 'Puede reducir churn en 20-30%',
      cost: 'high',
    });
  }

  if (features.daysSinceLastPurchase > 90) {
    actions.push({
      priority: churnProbability > 50 ? 'urgent' : 'high',
      action: 'Campaña de reactivación con productos relevantes',
      expectedImpact: 'Puede recuperar 15-25% de clientes inactivos',
      cost: 'low',
    });
  }

  if (features.loginFrequencyLast30Days < 2) {
    actions.push({
      priority: 'high',
      action: 'Email personalizado con recursos útiles',
      expectedImpact: 'Puede aumentar engagement en 20%',
      cost: 'low',
    });
  }

  if (features.complaintCount > 1) {
    actions.push({
      priority: 'high',
      action: 'Reunión de seguimiento post-queja',
      expectedImpact: 'Puede mejorar satisfacción en 40%',
      cost: 'medium',
    });
  }

  if (features.contractStatus === 'expiring_soon') {
    actions.push({
      priority: 'high',
      action: 'Renovación anticipada con beneficios adicionales',
      expectedImpact: 'Puede asegurar retención en 60-70%',
      cost: 'medium',
    });
  }

  if (features.productDiversityScore < 3) {
    actions.push({
      priority: 'medium',
      action: 'Demostración de productos complementarios',
      expectedImpact: 'Puede aumentar LTV en 25-35%',
      cost: 'low',
    });
  }

  if (features.avgOrderValue < features.totalLifetimeValue / (features.customerAgeMonths || 1)) {
    actions.push({
      priority: 'medium',
      action: 'Programa de fidelización con rewards',
      expectedImpact: 'Puede aumentar frecuencia de compra en 30%',
      cost: 'medium',
    });
  }

  if (features.emailOpenRate < 0.3) {
    actions.push({
      priority: 'medium',
      action: 'Optimizar comunicaciones (personalización, frecuencia)',
      expectedImpact: 'Puede aumentar engagement en 15%',
      cost: 'low',
    });
  }

  // General actions
  actions.push({
    priority: 'low',
    action: 'Encuesta de satisfacción y feedback',
    expectedImpact: 'Puede identificar issues antes de churn',
    cost: 'low',
  });

  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return actions.slice(0, 6); // Top 6 actions
}

/**
 * Main Churn Prediction Function
 */
export async function predictChurn(
  clientId: number,
  features: ChurnFeatures
): Promise<ChurnPrediction> {
  // Get prediction from Random Forest
  const { probability, confidence } = randomForestPredict(features);

  // Classify risk level
  const churnRisk = classifyChurnRisk(probability);

  // Calculate retention score (inverse of churn)
  const retentionScore = Math.max(0, 100 - probability);

  // Identify key risk factors
  const keyRiskFactors = identifyRiskFactors(features);

  // Generate recommended actions
  const recommendedActions = generateRetentionActions(features, probability, keyRiskFactors);

  // Estimate lifetime value at risk
  const estimatedLifetimeValueAtRisk = features.totalLifetimeValue;

  return {
    churnProbability: probability,
    churnRisk,
    confidence,
    keyRiskFactors,
    retentionScore,
    recommendedActions,
    estimatedLifetimeValueAtRisk,
  };
}

/**
 * Batch Churn Analysis for Customer Portfolio
 */
export async function analyzeChurnPortfolio(
  customers: Array<{ clientId: number; nombre: string; features: ChurnFeatures }>
): Promise<{
  predictions: Array<{ clientId: number; nombre: string; prediction: ChurnPrediction }>;
  summary: {
    totalCustomers: number;
    highRiskCount: number;
    totalValueAtRisk: number;
    avgChurnProbability: number;
  };
  segments: ChurnSegment[];
}> {
  const predictions = [];

  for (const customer of customers) {
    const prediction = await predictChurn(customer.clientId, customer.features);
    predictions.push({
      clientId: customer.clientId,
      nombre: customer.nombre,
      prediction,
    });
  }

  // Sort by churn probability (highest first)
  predictions.sort((a, b) => b.prediction.churnProbability - a.prediction.churnProbability);

  // Calculate summary
  const highRiskCount = predictions.filter(
    p => p.prediction.churnRisk === 'high' || p.prediction.churnRisk === 'very_high'
  ).length;

  const totalValueAtRisk = predictions
    .filter(p => p.prediction.churnProbability > 50)
    .reduce((sum, p) => sum + p.prediction.estimatedLifetimeValueAtRisk, 0);

  const avgChurnProbability =
    predictions.reduce((sum, p) => sum + p.prediction.churnProbability, 0) / predictions.length;

  // Create segments
  const segments: ChurnSegment[] = [
    {
      segmentName: 'Alto Riesgo - Inactivos',
      customerCount: predictions.filter(
        p => p.prediction.churnProbability > 70 && customers.find(c => c.clientId === p.clientId)!.features.daysSinceLastPurchase > 90
      ).length,
      avgChurnProbability: 0,
      totalValueAtRisk: 0,
      commonFactors: ['Inactividad prolongada', 'Sin engagement'],
      retentionStrategy: 'Campaña de reactivación urgente con oferta especial',
    },
    {
      segmentName: 'Riesgo Medio - Desenganchados',
      customerCount: predictions.filter(
        p =>
          p.prediction.churnProbability > 40 &&
          p.prediction.churnProbability <= 70 &&
          customers.find(c => c.clientId === p.clientId)!.features.loginFrequencyLast30Days < 3
      ).length,
      avgChurnProbability: 0,
      totalValueAtRisk: 0,
      commonFactors: ['Bajo engagement', 'Frecuencia de compra decreciente'],
      retentionStrategy: 'Comunicaciones personalizadas y contenido relevante',
    },
    {
      segmentName: 'Riesgo Medio - Insatisfechos',
      customerCount: predictions.filter(
        p =>
          p.prediction.churnProbability > 40 &&
          customers.find(c => c.clientId === p.clientId)!.features.complaintCount > 0
      ).length,
      avgChurnProbability: 0,
      totalValueAtRisk: 0,
      commonFactors: ['Quejas', 'Problemas de calidad/servicio'],
      retentionStrategy: 'Seguimiento personal y mejora de servicio',
    },
  ];

  // Calculate segment metrics
  for (const segment of segments) {
    const segmentCustomers = predictions.filter(p => {
      if (segment.segmentName.includes('Inactivos')) {
        return (
          p.prediction.churnProbability > 70 &&
          customers.find(c => c.clientId === p.clientId)!.features.daysSinceLastPurchase > 90
        );
      } else if (segment.segmentName.includes('Desenganchados')) {
        return (
          p.prediction.churnProbability > 40 &&
          p.prediction.churnProbability <= 70 &&
          customers.find(c => c.clientId === p.clientId)!.features.loginFrequencyLast30Days < 3
        );
      } else {
        return (
          p.prediction.churnProbability > 40 &&
          customers.find(c => c.clientId === p.clientId)!.features.complaintCount > 0
        );
      }
    });

    segment.avgChurnProbability =
      segmentCustomers.reduce((sum, p) => sum + p.prediction.churnProbability, 0) / (segmentCustomers.length || 1);
    segment.totalValueAtRisk = segmentCustomers.reduce((sum, p) => sum + p.prediction.estimatedLifetimeValueAtRisk, 0);
  }

  return {
    predictions,
    summary: {
      totalCustomers: predictions.length,
      highRiskCount,
      totalValueAtRisk,
      avgChurnProbability,
    },
    segments: segments.filter(s => s.customerCount > 0),
  };
}
