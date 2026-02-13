/**
 * Machine Learning Price Optimization Service
 *
 * Implements gradient descent and elasticity analysis for:
 * - Dynamic pricing based on demand
 * - Competitive pricing analysis
 * - Margin optimization
 * - Promotional pricing recommendations
 * - Price elasticity of demand calculation
 */

export interface PriceHistoryPoint {
  fecha: Date;
  precio: number;
  cantidadVendida: number;
  costoUnitario: number;
  competitorPrice?: number;
}

export interface PriceOptimizationResult {
  currentPrice: number;
  optimizedPrice: number;
  priceChange: number;
  priceChangePercent: number;
  expectedRevenue: number;
  expectedProfit: number;
  expectedVolume: number;
  confidence: number;
  elasticity: {
    value: number;
    interpretation: 'inelastic' | 'unit_elastic' | 'elastic' | 'highly_elastic';
    description: string;
  };
  recommendations: Array<{
    scenario: string;
    price: number;
    expectedRevenue: number;
    expectedProfit: number;
    expectedVolume: number;
    reasoning: string;
  }>;
  warnings: string[];
}

export interface CompetitivePriceAnalysis {
  productId: number;
  productName: string;
  currentPrice: number;
  avgCompetitorPrice: number;
  minCompetitorPrice: number;
  maxCompetitorPrice: number;
  pricePosition: 'lowest' | 'below_average' | 'average' | 'above_average' | 'highest';
  marketShare: number;
  recommendedAction: 'lower' | 'maintain' | 'raise';
  recommendedPrice: number;
}

/**
 * Calculate Price Elasticity of Demand
 * Using midpoint method: E = (ΔQ/Q_avg) / (ΔP/P_avg)
 */
function calculateElasticity(history: PriceHistoryPoint[]): number {
  if (history.length < 2) return -1;

  let totalElasticity = 0;
  let count = 0;

  for (let i = 1; i < history.length; i++) {
    const p1 = history[i - 1].precio;
    const p2 = history[i].precio;
    const q1 = history[i - 1].cantidadVendida;
    const q2 = history[i].cantidadVendida;

    if (p1 === p2 || q1 === 0 || q2 === 0) continue;

    const priceChange = (p2 - p1) / ((p1 + p2) / 2);
    const quantityChange = (q2 - q1) / ((q1 + q2) / 2);

    if (Math.abs(priceChange) > 0.001) {
      const elasticity = quantityChange / priceChange;
      totalElasticity += elasticity;
      count++;
    }
  }

  return count > 0 ? totalElasticity / count : -1;
}

/**
 * Interpret elasticity value
 */
function interpretElasticity(elasticity: number): {
  interpretation: 'inelastic' | 'unit_elastic' | 'elastic' | 'highly_elastic';
  description: string;
} {
  const absElasticity = Math.abs(elasticity);

  if (absElasticity < 0.5) {
    return {
      interpretation: 'inelastic',
      description: 'La demanda es insensible al precio. Puede aumentar precios sin perder ventas.',
    };
  } else if (absElasticity < 1) {
    return {
      interpretation: 'unit_elastic',
      description: 'La demanda responde proporcionalmente al precio. Balance entre precio y volumen.',
    };
  } else if (absElasticity < 2) {
    return {
      interpretation: 'elastic',
      description: 'La demanda es sensible al precio. Reducir precio puede aumentar ingresos.',
    };
  } else {
    return {
      interpretation: 'highly_elastic',
      description: 'La demanda es muy sensible al precio. Reducción de precio genera gran aumento en ventas.',
    };
  }
}

/**
 * Demand Function: Q = a - b*P (linear approximation)
 * Estimate parameters a and b using least squares regression
 */
function estimateDemandFunction(history: PriceHistoryPoint[]): { a: number; b: number; r2: number } {
  const n = history.length;
  const prices = history.map(h => h.precio);
  const quantities = history.map(h => h.cantidadVendida);

  const meanP = prices.reduce((sum, p) => sum + p, 0) / n;
  const meanQ = quantities.reduce((sum, q) => sum + q, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (prices[i] - meanP) * (quantities[i] - meanQ);
    denominator += (prices[i] - meanP) ** 2;
  }

  const b = -Math.abs(numerator / denominator); // Negative slope (inverse relationship)
  const a = meanQ - b * meanP;

  // Calculate R-squared
  const predictions = prices.map(p => a + b * p);
  const ssRes = quantities.reduce((sum, q, i) => sum + (q - predictions[i]) ** 2, 0);
  const ssTot = quantities.reduce((sum, q) => sum + (q - meanQ) ** 2, 0);
  const r2 = Math.max(0, 1 - ssRes / ssTot);

  return { a, b, r2 };
}

/**
 * Revenue Function: R = P * Q = P * (a - b*P) = aP - bP²
 * Profit Function: π = R - C = P*(a - b*P) - c*(a - b*P)
 * Where c is unit cost
 */
function optimizePrice(
  demandParams: { a: number; b: number },
  currentPrice: number,
  avgCost: number,
  minMargin: number = 0.15
): { price: number; revenue: number; profit: number; quantity: number } {
  const { a, b } = demandParams;

  // Optimal price for revenue maximization: P* = a / (2b)
  const revenueOptimalPrice = a / (2 * Math.abs(b));

  // Optimal price for profit maximization: P* = (a + bc) / (2b)
  // Derivative of profit: dπ/dP = a - 2bP + bc = 0
  const profitOptimalPrice = (a + Math.abs(b) * avgCost) / (2 * Math.abs(b));

  // Apply minimum margin constraint
  const minPrice = avgCost * (1 + minMargin);
  const optimalPrice = Math.max(minPrice, profitOptimalPrice);

  // Calculate expected outcomes
  const quantity = Math.max(0, a + b * optimalPrice);
  const revenue = optimalPrice * quantity;
  const profit = (optimalPrice - avgCost) * quantity;

  return {
    price: optimalPrice,
    revenue,
    profit,
    quantity,
  };
}

/**
 * Gradient Descent Price Optimization
 * Iteratively adjust price to maximize objective function
 */
function gradientDescentOptimization(
  history: PriceHistoryPoint[],
  objective: 'revenue' | 'profit' = 'profit',
  learningRate: number = 0.01,
  iterations: number = 1000
): number {
  const demandParams = estimateDemandFunction(history);
  const { a, b } = demandParams;

  const avgCost = history.reduce((sum, h) => sum + h.costoUnitario, 0) / history.length;
  let price = history[history.length - 1].precio; // Start with current price

  for (let i = 0; i < iterations; i++) {
    const quantity = a + b * price;

    let gradient;
    if (objective === 'revenue') {
      // dR/dP = a + 2bP
      gradient = a + 2 * b * price;
    } else {
      // dπ/dP = a - 2bP + bc
      gradient = a + 2 * b * price + b * avgCost;
    }

    // Update price
    const newPrice = price + learningRate * gradient;

    // Check convergence
    if (Math.abs(newPrice - price) < 0.01) break;

    price = newPrice;

    // Ensure price doesn't go below cost
    if (price < avgCost * 1.1) price = avgCost * 1.1;
  }

  return price;
}

/**
 * Generate price scenarios
 */
function generateScenarios(
  currentPrice: number,
  demandParams: { a: number; b: number },
  avgCost: number
): Array<{
  scenario: string;
  price: number;
  expectedRevenue: number;
  expectedProfit: number;
  expectedVolume: number;
  reasoning: string;
}> {
  const { a, b } = demandParams;
  const scenarios = [];

  // Current baseline
  const currentQty = Math.max(0, a + b * currentPrice);
  scenarios.push({
    scenario: 'Precio Actual',
    price: currentPrice,
    expectedRevenue: currentPrice * currentQty,
    expectedProfit: (currentPrice - avgCost) * currentQty,
    expectedVolume: currentQty,
    reasoning: 'Manteniendo precio actual sin cambios',
  });

  // Revenue maximization
  const revenuePrice = a / (2 * Math.abs(b));
  const revenueQty = Math.max(0, a + b * revenuePrice);
  if (revenuePrice >= avgCost * 1.15) {
    scenarios.push({
      scenario: 'Maximizar Ingresos',
      price: revenuePrice,
      expectedRevenue: revenuePrice * revenueQty,
      expectedProfit: (revenuePrice - avgCost) * revenueQty,
      expectedVolume: revenueQty,
      reasoning: 'Precio óptimo para maximizar ingresos totales',
    });
  }

  // Profit maximization
  const profitPrice = (a + Math.abs(b) * avgCost) / (2 * Math.abs(b));
  const profitQty = Math.max(0, a + b * profitPrice);
  if (profitPrice >= avgCost * 1.15) {
    scenarios.push({
      scenario: 'Maximizar Rentabilidad',
      price: profitPrice,
      expectedRevenue: profitPrice * profitQty,
      expectedProfit: (profitPrice - avgCost) * profitQty,
      expectedVolume: profitQty,
      reasoning: 'Precio óptimo para maximizar ganancia neta',
    });
  }

  // Volume maximization (penetration)
  const volumePrice = avgCost * 1.2; // 20% margin
  const volumeQty = Math.max(0, a + b * volumePrice);
  scenarios.push({
    scenario: 'Maximizar Volumen',
    price: volumePrice,
    expectedRevenue: volumePrice * volumeQty,
    expectedProfit: (volumePrice - avgCost) * volumeQty,
    expectedVolume: volumeQty,
    reasoning: 'Precio bajo para penetración de mercado y alto volumen',
  });

  // Premium pricing
  const premiumPrice = currentPrice * 1.15;
  const premiumQty = Math.max(0, a + b * premiumPrice);
  scenarios.push({
    scenario: 'Precio Premium',
    price: premiumPrice,
    expectedRevenue: premiumPrice * premiumQty,
    expectedProfit: (premiumPrice - avgCost) * premiumQty,
    expectedVolume: premiumQty,
    reasoning: 'Precio 15% superior para posicionamiento premium',
  });

  return scenarios.filter(s => s.expectedVolume > 0);
}

/**
 * Main Price Optimization Function
 */
export async function optimizePricing(
  productId: number,
  history: PriceHistoryPoint[],
  objective: 'revenue' | 'profit' | 'volume' = 'profit',
  minMarginPercent: number = 15
): Promise<PriceOptimizationResult> {
  if (history.length < 3) {
    throw new Error('Insufficient historical data. Minimum 3 data points required.');
  }

  // Sort by date
  const sortedHistory = [...history].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  const currentPrice = sortedHistory[sortedHistory.length - 1].precio;
  const avgCost = sortedHistory.reduce((sum, h) => sum + h.costoUnitario, 0) / sortedHistory.length;
  const minMargin = minMarginPercent / 100;

  // Calculate elasticity
  const elasticity = calculateElasticity(sortedHistory);
  const elasticityInfo = interpretElasticity(elasticity);

  // Estimate demand function
  const demandParams = estimateDemandFunction(sortedHistory);

  // Optimize price
  let optimizedPrice: number;
  if (objective === 'volume') {
    optimizedPrice = avgCost * (1 + minMargin);
  } else {
    const optimized = optimizePrice(demandParams, currentPrice, avgCost, minMargin);
    optimizedPrice = optimized.price;
  }

  // Calculate expected outcomes at optimized price
  const expectedVolume = Math.max(0, demandParams.a + demandParams.b * optimizedPrice);
  const expectedRevenue = optimizedPrice * expectedVolume;
  const expectedProfit = (optimizedPrice - avgCost) * expectedVolume;

  // Calculate changes
  const priceChange = optimizedPrice - currentPrice;
  const priceChangePercent = (priceChange / currentPrice) * 100;

  // Generate scenarios
  const recommendations = generateScenarios(currentPrice, demandParams, avgCost);

  // Sort scenarios by objective
  if (objective === 'revenue') {
    recommendations.sort((a, b) => b.expectedRevenue - a.expectedRevenue);
  } else if (objective === 'profit') {
    recommendations.sort((a, b) => b.expectedProfit - a.expectedProfit);
  } else {
    recommendations.sort((a, b) => b.expectedVolume - a.expectedVolume);
  }

  // Generate warnings
  const warnings: string[] = [];

  if (priceChangePercent > 20) {
    warnings.push('⚠️ Cambio de precio significativo (>20%) puede impactar percepción de marca');
  }

  if (priceChangePercent < -30) {
    warnings.push('⚠️ Reducción de precio muy agresiva puede indicar problemas de calidad a clientes');
  }

  if (demandParams.r2 < 0.5) {
    warnings.push('⚠️ Baja confiabilidad del modelo (R² < 0.5). Considerar más datos históricos');
  }

  if (Math.abs(elasticity) < 0.3) {
    warnings.push('⚠️ Elasticidad muy baja - verificar datos o considerar otros factores');
  }

  if (optimizedPrice < avgCost * 1.1) {
    warnings.push('🚨 Precio óptimo cercano al costo - verificar estructura de costos');
  }

  return {
    currentPrice,
    optimizedPrice,
    priceChange,
    priceChangePercent,
    expectedRevenue,
    expectedProfit,
    expectedVolume,
    confidence: demandParams.r2 * 100,
    elasticity: {
      value: elasticity,
      interpretation: elasticityInfo.interpretation,
      description: elasticityInfo.description,
    },
    recommendations,
    warnings,
  };
}

/**
 * Competitive Price Analysis
 */
export async function analyzeCompetitivePricing(
  productId: number,
  productName: string,
  currentPrice: number,
  competitorPrices: number[],
  currentMarketShare: number,
  history: PriceHistoryPoint[]
): Promise<CompetitivePriceAnalysis> {
  if (competitorPrices.length === 0) {
    throw new Error('No competitor prices provided');
  }

  const avgCompetitorPrice = competitorPrices.reduce((sum, p) => sum + p, 0) / competitorPrices.length;
  const minCompetitorPrice = Math.min(...competitorPrices);
  const maxCompetitorPrice = Math.max(...competitorPrices);

  // Determine price position
  let pricePosition: 'lowest' | 'below_average' | 'average' | 'above_average' | 'highest';
  if (currentPrice < minCompetitorPrice) {
    pricePosition = 'lowest';
  } else if (currentPrice > maxCompetitorPrice) {
    pricePosition = 'highest';
  } else if (currentPrice < avgCompetitorPrice * 0.95) {
    pricePosition = 'below_average';
  } else if (currentPrice > avgCompetitorPrice * 1.05) {
    pricePosition = 'above_average';
  } else {
    pricePosition = 'average';
  }

  // Determine recommended action
  let recommendedAction: 'lower' | 'maintain' | 'raise';
  let recommendedPrice = currentPrice;

  if (history.length >= 3) {
    const elasticity = calculateElasticity(history);

    if (pricePosition === 'highest' && currentMarketShare < 0.15) {
      recommendedAction = 'lower';
      recommendedPrice = avgCompetitorPrice * 0.98; // Slightly below average
    } else if (pricePosition === 'lowest' && currentMarketShare > 0.3) {
      recommendedAction = 'raise';
      recommendedPrice = avgCompetitorPrice; // Match average
    } else if (Math.abs(elasticity) < 0.5 && pricePosition !== 'highest') {
      recommendedAction = 'raise';
      recommendedPrice = Math.min(currentPrice * 1.1, avgCompetitorPrice);
    } else {
      recommendedAction = 'maintain';
      recommendedPrice = currentPrice;
    }
  } else {
    // Default to matching average
    if (Math.abs(currentPrice - avgCompetitorPrice) / avgCompetitorPrice > 0.1) {
      recommendedAction = currentPrice > avgCompetitorPrice ? 'lower' : 'raise';
      recommendedPrice = avgCompetitorPrice;
    } else {
      recommendedAction = 'maintain';
    }
  }

  return {
    productId,
    productName,
    currentPrice,
    avgCompetitorPrice,
    minCompetitorPrice,
    maxCompetitorPrice,
    pricePosition,
    marketShare: currentMarketShare,
    recommendedAction,
    recommendedPrice,
  };
}

/**
 * Dynamic Pricing for Promotions
 */
export async function calculatePromotionalPrice(
  currentPrice: number,
  targetVolumeIncrease: number,
  elasticity: number,
  minMarginPercent: number,
  avgCost: number
): Promise<{
  promotionalPrice: number;
  discount: number;
  discountPercent: number;
  expectedVolumeIncrease: number;
  expectedRevenueChange: number;
  profitable: boolean;
}> {
  // Calculate required price change to achieve target volume increase
  // From elasticity: E = (ΔQ/Q) / (ΔP/P)
  // So: ΔP/P = (ΔQ/Q) / E
  const absElasticity = Math.abs(elasticity);
  const requiredPriceChange = (targetVolumeIncrease / 100) / absElasticity;

  const promotionalPrice = currentPrice * (1 - requiredPriceChange);
  const minPrice = avgCost * (1 + minMarginPercent / 100);

  // Ensure minimum margin
  const finalPrice = Math.max(promotionalPrice, minPrice);
  const actualDiscount = currentPrice - finalPrice;
  const actualDiscountPercent = (actualDiscount / currentPrice) * 100;

  // Calculate actual expected volume increase
  const actualPriceChange = (finalPrice - currentPrice) / currentPrice;
  const expectedVolumeIncrease = actualPriceChange * absElasticity * 100;

  // Check profitability
  const profitable = finalPrice > avgCost * 1.05; // At least 5% margin

  return {
    promotionalPrice: finalPrice,
    discount: actualDiscount,
    discountPercent: actualDiscountPercent,
    expectedVolumeIncrease,
    expectedRevenueChange: 0, // Placeholder - would need base volume
    profitable,
  };
}
