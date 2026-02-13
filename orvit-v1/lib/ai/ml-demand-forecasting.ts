/**
 * Machine Learning Demand Forecasting Service
 *
 * Implements real ML algorithms for demand prediction:
 * - Exponential Smoothing (Holt-Winters)
 * - Linear Regression with Trend
 * - Seasonality Detection
 * - Ensemble Forecasting
 *
 * No external ML libraries required - pure TypeScript implementation
 */

export interface MLHistoricalData {
  fecha: Date;
  cantidad: number;
  valor?: number;
}

export interface MLForecastResult {
  fecha: Date;
  cantidadPrediccion: number;
  confianzaBaja: number;
  confianzaAlta: number;
  metodo: 'exponential' | 'linear' | 'ensemble';
}

export interface MLForecastAnalysis {
  forecasts: MLForecastResult[];
  accuracy: {
    mae: number;
    rmse: number;
    mape: number;
  };
  seasonality: {
    detected: boolean;
    period?: number;
    strength?: number;
  };
  trend: {
    direction: 'up' | 'down' | 'stable';
    slope: number;
    confidence: number;
  };
  recommendation: {
    stockLevel: number;
    reorderPoint: number;
    safetyStock: number;
    reasoning: string;
  };
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(data[i]);
    } else {
      const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
  }
  return result;
}

/**
 * Exponential Smoothing (Holt-Winters Method)
 * @param data Historical values
 * @param alpha Level smoothing parameter (0-1)
 * @param beta Trend smoothing parameter (0-1)
 * @param gamma Seasonal smoothing parameter (0-1)
 * @param seasonLength Length of seasonal cycle
 * @param periods Number of periods to forecast
 */
function exponentialSmoothing(
  data: number[],
  alpha: number = 0.3,
  beta: number = 0.1,
  gamma: number = 0.1,
  seasonLength: number = 12,
  periods: number = 6
): number[] {
  if (data.length < seasonLength * 2) {
    // Fallback to simple exponential smoothing if not enough data
    return simpleExponentialSmoothing(data, alpha, periods);
  }

  const n = data.length;
  const level: number[] = new Array(n);
  const trend: number[] = new Array(n);
  const seasonal: number[] = new Array(n + periods);

  // Initialize
  level[0] = data[0];
  trend[0] = (data[seasonLength] - data[0]) / seasonLength;

  // Initialize seasonal indices
  for (let i = 0; i < seasonLength; i++) {
    const sum = data.slice(i, n - seasonLength + i).reduce((a, b) => a + b, 0);
    seasonal[i] = data[i] / (sum / Math.ceil(n / seasonLength));
  }

  // Calculate level, trend, and seasonal components
  for (let i = 1; i < n; i++) {
    const seasonalIdx = i % seasonLength;
    level[i] = alpha * (data[i] / seasonal[seasonalIdx]) + (1 - alpha) * (level[i - 1] + trend[i - 1]);
    trend[i] = beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1];
    seasonal[i] = gamma * (data[i] / level[i]) + (1 - gamma) * seasonal[seasonalIdx];
  }

  // Forecast
  const forecast: number[] = [];
  for (let i = 0; i < periods; i++) {
    const seasonalIdx = (n + i) % seasonLength;
    const forecastValue = (level[n - 1] + (i + 1) * trend[n - 1]) * seasonal[seasonalIdx];
    forecast.push(Math.max(0, forecastValue));
  }

  return forecast;
}

/**
 * Simple Exponential Smoothing (fallback for small datasets)
 */
function simpleExponentialSmoothing(data: number[], alpha: number, periods: number): number[] {
  let level = data[0];
  const smoothed: number[] = [level];

  for (let i = 1; i < data.length; i++) {
    level = alpha * data[i] + (1 - alpha) * level;
    smoothed.push(level);
  }

  // Forecast (flat line)
  const forecast: number[] = [];
  for (let i = 0; i < periods; i++) {
    forecast.push(level);
  }

  return forecast;
}

/**
 * Linear Regression with Trend
 */
function linearRegression(data: number[], periods: number): number[] {
  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = data;

  // Calculate means
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (y[i] - meanY);
    denominator += (x[i] - meanX) ** 2;
  }

  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;

  // Forecast
  const forecast: number[] = [];
  for (let i = 0; i < periods; i++) {
    const futureX = n + i;
    const prediction = slope * futureX + intercept;
    forecast.push(Math.max(0, prediction));
  }

  return forecast;
}

/**
 * Detect Seasonality using Autocorrelation
 */
function detectSeasonality(data: number[]): { detected: boolean; period?: number; strength?: number } {
  if (data.length < 24) {
    return { detected: false };
  }

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / data.length;

  const maxLag = Math.min(24, Math.floor(data.length / 2));
  let maxCorr = 0;
  let bestPeriod = 0;

  for (let lag = 7; lag <= maxLag; lag++) {
    let correlation = 0;
    for (let i = 0; i < data.length - lag; i++) {
      correlation += (data[i] - mean) * (data[i + lag] - mean);
    }
    correlation = correlation / ((data.length - lag) * variance);

    if (correlation > maxCorr) {
      maxCorr = correlation;
      bestPeriod = lag;
    }
  }

  return {
    detected: maxCorr > 0.3,
    period: bestPeriod,
    strength: maxCorr,
  };
}

/**
 * Calculate Accuracy Metrics
 */
function calculateMetrics(actual: number[], predicted: number[]): { mae: number; rmse: number; mape: number } {
  const n = Math.min(actual.length, predicted.length);
  let mae = 0;
  let rmse = 0;
  let mape = 0;

  for (let i = 0; i < n; i++) {
    const error = Math.abs(actual[i] - predicted[i]);
    mae += error;
    rmse += error ** 2;
    if (actual[i] !== 0) {
      mape += Math.abs((actual[i] - predicted[i]) / actual[i]);
    }
  }

  return {
    mae: mae / n,
    rmse: Math.sqrt(rmse / n),
    mape: (mape / n) * 100,
  };
}

/**
 * Analyze Trend
 */
function analyzeTrend(data: number[]): { direction: 'up' | 'down' | 'stable'; slope: number; confidence: number } {
  if (data.length < 3) {
    return { direction: 'stable', slope: 0, confidence: 0 };
  }

  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = data;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (y[i] - meanY);
    denominator += (x[i] - meanX) ** 2;
  }

  const slope = numerator / denominator;

  // Calculate R-squared for confidence
  const predictions = x.map(xi => slope * xi + (meanY - slope * meanX));
  const ssRes = y.reduce((sum, yi, i) => sum + (yi - predictions[i]) ** 2, 0);
  const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
  const rSquared = 1 - ssRes / ssTot;

  let direction: 'up' | 'down' | 'stable';
  if (Math.abs(slope) < meanY * 0.01) {
    direction = 'stable';
  } else if (slope > 0) {
    direction = 'up';
  } else {
    direction = 'down';
  }

  return {
    direction,
    slope,
    confidence: Math.max(0, Math.min(100, rSquared * 100)),
  };
}

/**
 * Main ML Forecast Function
 */
export async function mlForecastDemand(
  productId: number,
  historicalData: MLHistoricalData[],
  forecastPeriods: number = 6
): Promise<MLForecastAnalysis> {
  if (historicalData.length < 3) {
    throw new Error('Insufficient historical data. Minimum 3 data points required.');
  }

  // Sort by date
  const sortedData = [...historicalData].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const quantities = sortedData.map(d => d.cantidad);

  // Detect seasonality
  const seasonality = detectSeasonality(quantities);

  // Generate forecasts using multiple methods
  const expForecast = exponentialSmoothing(
    quantities,
    0.3,
    0.1,
    0.1,
    seasonality.period || 12,
    forecastPeriods
  );

  const linearForecast = linearRegression(quantities, forecastPeriods);

  // Ensemble: weighted average
  const ensembleForecast = expForecast.map((exp, i) => {
    const linear = linearForecast[i];
    return seasonality.detected ? exp * 0.7 + linear * 0.3 : exp * 0.5 + linear * 0.5;
  });

  // Calculate confidence intervals (±15% for simplicity)
  const lastDate = sortedData[sortedData.length - 1].fecha;
  const forecasts: MLForecastResult[] = ensembleForecast.map((pred, i) => {
    const futureDate = new Date(lastDate);
    futureDate.setMonth(futureDate.getMonth() + i + 1);

    return {
      fecha: futureDate,
      cantidadPrediccion: Math.round(pred),
      confianzaBaja: Math.round(pred * 0.85),
      confianzaAlta: Math.round(pred * 1.15),
      metodo: 'ensemble' as const,
    };
  });

  // Calculate accuracy on historical data (backtest last 20%)
  const testSize = Math.floor(quantities.length * 0.2);
  const trainData = quantities.slice(0, quantities.length - testSize);
  const testData = quantities.slice(quantities.length - testSize);
  const testPredictions = exponentialSmoothing(trainData, 0.3, 0.1, 0.1, seasonality.period || 12, testSize);
  const accuracy = calculateMetrics(testData, testPredictions);

  // Analyze trend
  const trend = analyzeTrend(quantities);

  // Generate recommendations
  const avgDemand = ensembleForecast.reduce((a, b) => a + b, 0) / ensembleForecast.length;
  const maxDemand = Math.max(...ensembleForecast);
  const stdDev = Math.sqrt(
    ensembleForecast.reduce((sum, val) => sum + (val - avgDemand) ** 2, 0) / ensembleForecast.length
  );

  const safetyStock = Math.round(1.65 * stdDev); // 95% service level
  const reorderPoint = Math.round(avgDemand + safetyStock);
  const stockLevel = Math.round(maxDemand * 1.5 + safetyStock);

  let reasoning = `Basado en análisis de ${historicalData.length} períodos. `;
  reasoning += `Tendencia ${trend.direction === 'up' ? 'creciente' : trend.direction === 'down' ? 'decreciente' : 'estable'} `;
  reasoning += `(confianza ${trend.confidence.toFixed(0)}%). `;
  if (seasonality.detected) {
    reasoning += `Estacionalidad detectada con período ${seasonality.period}. `;
  }
  reasoning += `Demanda promedio proyectada: ${Math.round(avgDemand)} unidades/mes. `;
  reasoning += `Precisión del modelo: MAPE ${accuracy.mape.toFixed(1)}%.`;

  return {
    forecasts,
    accuracy,
    seasonality,
    trend,
    recommendation: {
      stockLevel,
      reorderPoint,
      safetyStock,
      reasoning,
    },
  };
}

/**
 * Get ML-based Stock Recommendations for multiple products
 */
export async function getMLStockRecommendations(
  products: Array<{ id: number; nombre: string; historicalData: MLHistoricalData[] }>
): Promise<Array<{ productId: number; nombre: string; analysis: MLForecastAnalysis }>> {
  const results = [];

  for (const product of products) {
    try {
      if (product.historicalData.length >= 3) {
        const analysis = await mlForecastDemand(product.id, product.historicalData);
        results.push({
          productId: product.id,
          nombre: product.nombre,
          analysis,
        });
      }
    } catch (error) {
      console.error(`Error forecasting product ${product.id}:`, error);
    }
  }

  // Sort by urgency (products with upward trend and low current stock)
  results.sort((a, b) => {
    const urgencyA = a.analysis.trend.direction === 'up' ? a.analysis.recommendation.stockLevel : 0;
    const urgencyB = b.analysis.trend.direction === 'up' ? b.analysis.recommendation.stockLevel : 0;
    return urgencyB - urgencyA;
  });

  return results;
}
