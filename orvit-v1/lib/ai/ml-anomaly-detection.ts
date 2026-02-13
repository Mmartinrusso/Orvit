/**
 * Machine Learning Anomaly Detection Service
 *
 * Implements Isolation Forest algorithm for detecting:
 * - Fraudulent transactions
 * - Unusual purchase patterns
 * - Price manipulation attempts
 * - Inventory discrepancies
 * - Payment anomalies
 */

export interface TransactionFeatures {
  // Transaction details
  amount: number;
  timestamp: Date;
  clientId: number;
  productId?: number;
  quantity?: number;
  unitPrice?: number;

  // Contextual features
  hourOfDay: number; // 0-23
  dayOfWeek: number; // 0-6
  isWeekend: boolean;
  isHoliday: boolean;

  // Historical context
  avgTransactionAmount: number; // Customer's historical avg
  maxTransactionAmount: number; // Customer's historical max
  transactionCount: number; // Customer's total transactions
  daysSinceLastTransaction: number;

  // Behavioral features
  deviceType?: string;
  ipCountry?: string;
  paymentMethod?: string;
  shippingAddressChange: boolean;
  rushOrder: boolean;
}

export interface AnomalyScore {
  score: number; // 0-100 (higher = more anomalous)
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100
  reasons: Array<{
    feature: string;
    deviation: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  recommendedAction: 'approve' | 'review' | 'block' | 'verify';
  alerts: string[];
}

export interface InventoryAnomaly {
  productId: number;
  productName: string;
  expectedQuantity: number;
  actualQuantity: number;
  discrepancy: number;
  discrepancyPercent: number;
  anomalyScore: number;
  possibleCauses: string[];
  recommendedInvestigation: string;
}

/**
 * Simple Isolation Tree Node
 */
interface IsolationNode {
  splitFeature?: string;
  splitValue?: number;
  left?: IsolationNode;
  right?: IsolationNode;
  size: number; // Number of samples in this node
}

/**
 * Calculate average path length in a binary tree of size n
 * Used for normalizing isolation scores
 */
function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
}

/**
 * Build isolation tree (simplified version)
 * @param features Feature vector
 * @param depth Current depth
 * @param maxDepth Maximum depth
 */
function buildIsolationTree(
  features: number[],
  depth: number = 0,
  maxDepth: number = 8
): IsolationNode {
  // Base case: reached max depth or only one sample
  if (depth >= maxDepth || features.length === 0) {
    return { size: features.length };
  }

  // Randomly select feature to split on (simulated)
  const featureIndex = Math.floor(Math.random() * features.length);
  const splitValue = features[featureIndex];

  return {
    splitFeature: `feature_${featureIndex}`,
    splitValue,
    size: features.length,
    left: { size: Math.floor(features.length / 2) },
    right: { size: Math.ceil(features.length / 2) },
  };
}

/**
 * Calculate path length for a sample in isolation tree
 */
function pathLength(sample: number[], node: IsolationNode, currentDepth: number = 0): number {
  // Leaf node
  if (!node.splitFeature) {
    return currentDepth + averagePathLength(node.size);
  }

  // Traverse tree (simplified logic)
  const sampleValue = sample[0] || 0;
  if (sampleValue < (node.splitValue || 0)) {
    return node.left ? pathLength(sample, node.left, currentDepth + 1) : currentDepth + 1;
  } else {
    return node.right ? pathLength(sample, node.right, currentDepth + 1) : currentDepth + 1;
  }
}

/**
 * Normalize features to 0-1 range
 */
function normalizeTransactionFeatures(features: TransactionFeatures): number[] {
  return [
    // Amount relative to customer history
    features.avgTransactionAmount > 0 ? features.amount / features.avgTransactionAmount : 1,

    // Time-based features
    features.hourOfDay / 24,
    features.dayOfWeek / 7,
    features.isWeekend ? 1 : 0,
    features.isHoliday ? 1 : 0,

    // Behavioral
    Math.min(1, features.daysSinceLastTransaction / 365),
    features.shippingAddressChange ? 1 : 0,
    features.rushOrder ? 1 : 0,

    // Historical context
    features.transactionCount > 0 ? Math.min(1, 1 / features.transactionCount) : 1,
    features.maxTransactionAmount > 0 ? features.amount / features.maxTransactionAmount : 1,
  ];
}

/**
 * Isolation Forest Anomaly Detection (simplified)
 */
function isolationForestScore(normalizedFeatures: number[]): number {
  const numTrees = 10;
  const maxDepth = 8;
  let totalPathLength = 0;

  // Build multiple trees and average path lengths
  for (let i = 0; i < numTrees; i++) {
    const tree = buildIsolationTree(normalizedFeatures, 0, maxDepth);
    const pathLen = pathLength(normalizedFeatures, tree);
    totalPathLength += pathLen;
  }

  const avgPathLength = totalPathLength / numTrees;

  // Anomaly score: shorter path = more anomalous
  // Normalize to 0-1 scale
  const expectedAvgPath = averagePathLength(100); // Assuming sample size of 100
  const anomalyScore = Math.pow(2, -avgPathLength / expectedAvgPath);

  return anomalyScore * 100; // Convert to 0-100 scale
}

/**
 * Rule-based anomaly detection (complement to isolation forest)
 */
function ruleBasedAnomalyDetection(features: TransactionFeatures): {
  score: number;
  reasons: Array<{ feature: string; deviation: string; impact: 'high' | 'medium' | 'low' }>;
} {
  let score = 0;
  const reasons: Array<{ feature: string; deviation: string; impact: 'high' | 'medium' | 'low' }> = [];

  // Rule 1: Unusually large transaction
  if (features.amount > features.maxTransactionAmount * 2) {
    score += 30;
    reasons.push({
      feature: 'Transaction Amount',
      deviation: `${((features.amount / features.maxTransactionAmount) * 100).toFixed(0)}% mayor que máximo histórico`,
      impact: 'high',
    });
  } else if (features.amount > features.avgTransactionAmount * 3) {
    score += 20;
    reasons.push({
      feature: 'Transaction Amount',
      deviation: `${((features.amount / features.avgTransactionAmount) * 100).toFixed(0)}% mayor que promedio`,
      impact: 'medium',
    });
  }

  // Rule 2: Unusual time
  if (features.hourOfDay < 6 || features.hourOfDay > 22) {
    score += 15;
    reasons.push({
      feature: 'Transaction Time',
      deviation: `Transacción a las ${features.hourOfDay}:00 (fuera de horario normal)`,
      impact: 'medium',
    });
  }

  // Rule 3: Holiday transaction
  if (features.isHoliday) {
    score += 10;
    reasons.push({
      feature: 'Holiday Transaction',
      deviation: 'Transacción en día feriado',
      impact: 'low',
    });
  }

  // Rule 4: First-time buyer with large order
  if (features.transactionCount === 0 && features.amount > 50000) {
    score += 40;
    reasons.push({
      feature: 'New Customer',
      deviation: 'Primera compra con monto muy elevado',
      impact: 'high',
    });
  }

  // Rule 5: Address change with rush order
  if (features.shippingAddressChange && features.rushOrder) {
    score += 25;
    reasons.push({
      feature: 'Shipping Behavior',
      deviation: 'Cambio de dirección + pedido urgente',
      impact: 'high',
    });
  }

  // Rule 6: Rapid repeat transaction
  if (features.daysSinceLastTransaction < 1) {
    score += 15;
    reasons.push({
      feature: 'Purchase Frequency',
      deviation: 'Múltiples transacciones en menos de 24 horas',
      impact: 'medium',
    });
  }

  // Rule 7: Price manipulation check (if unit price available)
  if (features.unitPrice && features.productId) {
    // This would compare to typical product price
    // Simplified: assume avgPrice is provided in context
    // score += comparison logic
  }

  // Rule 8: Quantity anomaly
  if (features.quantity && features.quantity > 1000) {
    score += 20;
    reasons.push({
      feature: 'Order Quantity',
      deviation: `Cantidad inusualmente alta: ${features.quantity} unidades`,
      impact: 'medium',
    });
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * Determine severity level
 */
function determineSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Recommend action based on score and severity
 */
function recommendAction(score: number, severity: string): 'approve' | 'review' | 'block' | 'verify' {
  if (severity === 'critical') return 'block';
  if (severity === 'high') return 'verify';
  if (severity === 'medium') return 'review';
  return 'approve';
}

/**
 * Generate alerts
 */
function generateAlerts(features: TransactionFeatures, score: number): string[] {
  const alerts: string[] = [];

  if (score >= 80) {
    alerts.push('🚨 FRAUDE POTENCIAL - Bloquear transacción inmediatamente');
  }

  if (features.amount > features.maxTransactionAmount * 3) {
    alerts.push('⚠️ Monto extremadamente inusual para este cliente');
  }

  if (features.shippingAddressChange && features.amount > 10000) {
    alerts.push('⚠️ Cambio de dirección en transacción de alto valor');
  }

  if (features.transactionCount === 0 && features.amount > 20000) {
    alerts.push('⚠️ Cliente nuevo con transacción de alto riesgo');
  }

  if (features.rushOrder && features.amount > 50000) {
    alerts.push('⚠️ Pedido urgente de alto valor - verificar identidad');
  }

  if (features.hourOfDay >= 0 && features.hourOfDay < 5) {
    alerts.push('⚠️ Transacción en horario inusual (madrugada)');
  }

  return alerts;
}

/**
 * Main Anomaly Detection Function
 */
export async function detectTransactionAnomaly(features: TransactionFeatures): Promise<AnomalyScore> {
  // Normalize features
  const normalizedFeatures = normalizeTransactionFeatures(features);

  // Get isolation forest score
  const isolationScore = isolationForestScore(normalizedFeatures);

  // Get rule-based score
  const { score: ruleScore, reasons: ruleReasons } = ruleBasedAnomalyDetection(features);

  // Combine scores (weighted average)
  const combinedScore = isolationScore * 0.4 + ruleScore * 0.6;

  // Determine if anomaly (threshold at 50)
  const isAnomaly = combinedScore >= 50;

  // Determine severity
  const severity = determineSeverity(combinedScore);

  // Calculate confidence (based on agreement between methods)
  const scoreDifference = Math.abs(isolationScore - ruleScore);
  const confidence = Math.max(0, 100 - scoreDifference);

  // Recommend action
  const recommendedAction = recommendAction(combinedScore, severity);

  // Generate alerts
  const alerts = generateAlerts(features, combinedScore);

  return {
    score: Math.round(combinedScore),
    isAnomaly,
    severity,
    confidence: Math.round(confidence),
    reasons: ruleReasons,
    recommendedAction,
    alerts,
  };
}

/**
 * Detect Inventory Anomalies
 */
export async function detectInventoryAnomaly(
  productId: number,
  productName: string,
  expectedQuantity: number,
  actualQuantity: number,
  salesHistory: number[],
  purchaseHistory: number[]
): Promise<InventoryAnomaly> {
  const discrepancy = actualQuantity - expectedQuantity;
  const discrepancyPercent = expectedQuantity !== 0 ? (discrepancy / expectedQuantity) * 100 : 0;

  // Calculate anomaly score based on discrepancy magnitude
  let anomalyScore = Math.min(100, Math.abs(discrepancyPercent));

  // Adjust score based on historical variance
  const salesVariance = calculateVariance(salesHistory);
  const purchaseVariance = calculateVariance(purchaseHistory);
  const avgVariance = (salesVariance + purchaseVariance) / 2;

  if (avgVariance > 0) {
    const normalizedDiscrepancy = Math.abs(discrepancy) / Math.sqrt(avgVariance);
    anomalyScore = Math.min(100, normalizedDiscrepancy * 10);
  }

  // Identify possible causes
  const possibleCauses: string[] = [];

  if (discrepancy < 0) {
    possibleCauses.push('Faltante de inventario');
    if (Math.abs(discrepancyPercent) > 20) {
      possibleCauses.push('Posible robo o pérdida');
    }
    possibleCauses.push('Ventas no registradas');
    possibleCauses.push('Error en conteo físico');
    possibleCauses.push('Productos dañados no reportados');
  } else {
    possibleCauses.push('Exceso de inventario');
    possibleCauses.push('Compras duplicadas no registradas');
    possibleCauses.push('Devoluciones no procesadas');
    possibleCauses.push('Error en sistema de registro');
  }

  // Recommendation
  let recommendedInvestigation = '';
  if (anomalyScore >= 80) {
    recommendedInvestigation = 'Auditoría inmediata requerida - discrepancia crítica';
  } else if (anomalyScore >= 50) {
    recommendedInvestigation = 'Revisión prioritaria - verificar registros de últimos 30 días';
  } else if (anomalyScore >= 30) {
    recommendedInvestigation = 'Revisión estándar - puede ser variación normal';
  } else {
    recommendedInvestigation = 'Monitoreo continuo - discrepancia menor';
  }

  return {
    productId,
    productName,
    expectedQuantity,
    actualQuantity,
    discrepancy,
    discrepancyPercent,
    anomalyScore: Math.round(anomalyScore),
    possibleCauses,
    recommendedInvestigation,
  };
}

/**
 * Calculate variance of array
 */
function calculateVariance(data: number[]): number {
  if (data.length === 0) return 0;
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / data.length;
  return variance;
}

/**
 * Batch Anomaly Detection for Multiple Transactions
 */
export async function batchAnomalyDetection(
  transactions: TransactionFeatures[]
): Promise<{
  results: Array<{ transaction: TransactionFeatures; anomaly: AnomalyScore }>;
  summary: {
    totalTransactions: number;
    anomaliesDetected: number;
    criticalAnomalies: number;
    totalBlockedAmount: number;
    totalReviewAmount: number;
  };
}> {
  const results = [];
  let totalBlockedAmount = 0;
  let totalReviewAmount = 0;

  for (const transaction of transactions) {
    const anomaly = await detectTransactionAnomaly(transaction);
    results.push({ transaction, anomaly });

    if (anomaly.recommendedAction === 'block') {
      totalBlockedAmount += transaction.amount;
    } else if (anomaly.recommendedAction === 'review' || anomaly.recommendedAction === 'verify') {
      totalReviewAmount += transaction.amount;
    }
  }

  const anomaliesDetected = results.filter(r => r.anomaly.isAnomaly).length;
  const criticalAnomalies = results.filter(r => r.anomaly.severity === 'critical').length;

  // Sort by score (highest first)
  results.sort((a, b) => b.anomaly.score - a.anomaly.score);

  return {
    results,
    summary: {
      totalTransactions: transactions.length,
      anomaliesDetected,
      criticalAnomalies,
      totalBlockedAmount,
      totalReviewAmount,
    },
  };
}

/**
 * Price Manipulation Detection
 */
export async function detectPriceManipulation(
  productId: number,
  newPrice: number,
  historicalPrices: number[],
  marketPrices?: number[]
): Promise<{
  isAnomaly: boolean;
  score: number;
  reasons: string[];
  recommendation: string;
}> {
  const reasons: string[] = [];
  let score = 0;

  if (historicalPrices.length === 0) {
    return {
      isAnomaly: false,
      score: 0,
      reasons: ['Insufficient historical data'],
      recommendation: 'Approve - no historical baseline',
    };
  }

  const avgPrice = historicalPrices.reduce((sum, p) => sum + p, 0) / historicalPrices.length;
  const maxPrice = Math.max(...historicalPrices);
  const minPrice = Math.min(...historicalPrices);
  const stdDev = Math.sqrt(calculateVariance(historicalPrices));

  // Check deviation from average
  const deviation = ((newPrice - avgPrice) / avgPrice) * 100;

  if (Math.abs(deviation) > 50) {
    score += 40;
    reasons.push(`Precio ${deviation > 0 ? 'aumentó' : 'disminuyó'} ${Math.abs(deviation).toFixed(0)}% vs promedio`);
  } else if (Math.abs(deviation) > 30) {
    score += 25;
    reasons.push(`Desviación significativa del promedio: ${Math.abs(deviation).toFixed(0)}%`);
  }

  // Check if outside historical range
  if (newPrice > maxPrice * 1.2) {
    score += 30;
    reasons.push(`Precio excede máximo histórico por ${(((newPrice - maxPrice) / maxPrice) * 100).toFixed(0)}%`);
  } else if (newPrice < minPrice * 0.8) {
    score += 30;
    reasons.push(`Precio inferior al mínimo histórico por ${(((minPrice - newPrice) / minPrice) * 100).toFixed(0)}%`);
  }

  // Statistical outlier detection (3-sigma rule)
  const zScore = Math.abs((newPrice - avgPrice) / stdDev);
  if (zScore > 3) {
    score += 30;
    reasons.push(`Outlier estadístico (z-score: ${zScore.toFixed(2)})`);
  }

  // Compare to market prices if available
  if (marketPrices && marketPrices.length > 0) {
    const avgMarketPrice = marketPrices.reduce((sum, p) => sum + p, 0) / marketPrices.length;
    const marketDeviation = ((newPrice - avgMarketPrice) / avgMarketPrice) * 100;

    if (Math.abs(marketDeviation) > 40) {
      score += 20;
      reasons.push(`${Math.abs(marketDeviation).toFixed(0)}% ${marketDeviation > 0 ? 'mayor' : 'menor'} que promedio de mercado`);
    }
  }

  const isAnomaly = score >= 50;
  let recommendation = '';

  if (score >= 80) {
    recommendation = 'Block - requiere aprobación gerencial';
  } else if (score >= 50) {
    recommendation = 'Review - verificar justificación del cambio';
  } else {
    recommendation = 'Approve - dentro de rango aceptable';
  }

  return {
    isAnomaly,
    score: Math.min(100, score),
    reasons,
    recommendation,
  };
}

/**
 * Payment Pattern Anomaly Detection
 */
export async function detectPaymentAnomaly(
  clientId: number,
  paymentAmount: number,
  paymentMethod: string,
  historicalPayments: Array<{ amount: number; method: string; timestamp: Date }>
): Promise<{
  isAnomaly: boolean;
  score: number;
  confidence: number;
  reasons: string[];
  recommendedAction: 'approve' | 'verify_identity' | 'request_additional_auth' | 'block';
}> {
  const reasons: string[] = [];
  let score = 0;

  // Amount-based anomalies
  const amounts = historicalPayments.map(p => p.amount);
  const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / (amounts.length || 1);
  const maxAmount = Math.max(...amounts, 0);

  if (paymentAmount > maxAmount * 2) {
    score += 30;
    reasons.push(`Monto ${((paymentAmount / maxAmount) * 100).toFixed(0)}% mayor que máximo histórico`);
  }

  // Method-based anomalies
  const methodCounts = historicalPayments.reduce((acc, p) => {
    acc[p.method] = (acc[p.method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const usualMethod = Object.keys(methodCounts).reduce((a, b) => (methodCounts[a] > methodCounts[b] ? a : b), '');

  if (paymentMethod !== usualMethod && paymentAmount > avgAmount * 1.5) {
    score += 25;
    reasons.push(`Método de pago inusual (${paymentMethod}) para monto elevado`);
  }

  // Frequency anomaly
  const recentPayments = historicalPayments.filter(
    p => Date.now() - p.timestamp.getTime() < 24 * 60 * 60 * 1000
  );

  if (recentPayments.length >= 3) {
    score += 20;
    reasons.push(`${recentPayments.length} pagos en últimas 24 horas`);
  }

  const confidence = historicalPayments.length >= 5 ? 85 : 60;
  const isAnomaly = score >= 40;

  let recommendedAction: 'approve' | 'verify_identity' | 'request_additional_auth' | 'block';
  if (score >= 70) {
    recommendedAction = 'block';
  } else if (score >= 50) {
    recommendedAction = 'verify_identity';
  } else if (score >= 30) {
    recommendedAction = 'request_additional_auth';
  } else {
    recommendedAction = 'approve';
  }

  return {
    isAnomaly,
    score: Math.min(100, score),
    confidence,
    reasons,
    recommendedAction,
  };
}
