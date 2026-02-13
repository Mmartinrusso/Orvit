/**
 * Demand Forecasting Service
 *
 * Uses machine learning to predict future product demand
 * Helps optimize inventory levels and reduce stockouts
 */

import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import { addDays, subDays, format, startOfDay } from 'date-fns';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface HistoricalSalesData {
  date: Date;
  quantity: number;
  revenue: number;
}

export interface ForecastResult {
  productId: number;
  productCode: string;
  productName: string;
  currentStock: number;
  forecasts: Array<{
    date: Date;
    predictedDemand: number;
    confidence: number; // 0-1
    stockProjection: number;
    reorderRecommended: boolean;
  }>;
  summary: {
    avgDailyDemand: number;
    totalForecastedDemand: number;
    recommendedReorderPoint: number;
    recommendedReorderQuantity: number;
    riskOfStockout: 'LOW' | 'MEDIUM' | 'HIGH';
    daysUntilStockout: number | null;
  };
  seasonality?: {
    detected: boolean;
    pattern?: string; // 'weekly', 'monthly', 'seasonal'
    peakDays?: number[];
  };
}

export interface DemandForecastOptions {
  productId: number;
  forecastDays?: number;
  historicalDays?: number;
  includeSeasonality?: boolean;
  includeExternalFactors?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA COLLECTION
// ═══════════════════════════════════════════════════════════════════════════

async function getHistoricalSales(
  productId: number,
  companyId: number,
  days: number
): Promise<HistoricalSalesData[]> {
  const startDate = subDays(startOfDay(new Date()), days);

  // Get sales from completed orders
  const salesItems = await prisma.saleItem.findMany({
    where: {
      productId,
      sale: {
        companyId,
        estado: { in: ['CONFIRMADA', 'ENTREGADA', 'FACTURADA'] },
        fecha: { gte: startDate },
      },
    },
    select: {
      cantidad: true,
      subtotal: true,
      sale: {
        select: {
          fecha: true,
        },
      },
    },
    orderBy: {
      sale: {
        fecha: 'asc',
      },
    },
  });

  // Group by date
  const salesByDate = new Map<string, { quantity: number; revenue: number }>();

  for (const item of salesItems) {
    const dateKey = format(item.sale.fecha, 'yyyy-MM-dd');
    const existing = salesByDate.get(dateKey) || { quantity: 0, revenue: 0 };

    salesByDate.set(dateKey, {
      quantity: existing.quantity + Number(item.cantidad),
      revenue: existing.revenue + Number(item.subtotal),
    });
  }

  // Convert to array with all dates (including days with 0 sales)
  const historicalData: HistoricalSalesData[] = [];
  for (let i = 0; i < days; i++) {
    const date = subDays(startOfDay(new Date()), days - i);
    const dateKey = format(date, 'yyyy-MM-dd');
    const data = salesByDate.get(dateKey) || { quantity: 0, revenue: 0 };

    historicalData.push({
      date,
      quantity: data.quantity,
      revenue: data.revenue,
    });
  }

  return historicalData;
}

// ═══════════════════════════════════════════════════════════════════════════
// SEASONALITY DETECTION
// ═══════════════════════════════════════════════════════════════════════════

function detectSeasonality(historicalData: HistoricalSalesData[]) {
  if (historicalData.length < 14) {
    return { detected: false };
  }

  // Weekly pattern detection
  const dayOfWeekSales: number[] = Array(7).fill(0);
  const dayOfWeekCounts: number[] = Array(7).fill(0);

  for (const data of historicalData) {
    const dayOfWeek = data.date.getDay(); // 0 = Sunday
    dayOfWeekSales[dayOfWeek] += data.quantity;
    dayOfWeekCounts[dayOfWeek]++;
  }

  const avgSalesByDay = dayOfWeekSales.map((sum, i) =>
    dayOfWeekCounts[i] > 0 ? sum / dayOfWeekCounts[i] : 0
  );

  const overallAvg = avgSalesByDay.reduce((a, b) => a + b, 0) / avgSalesByDay.length;
  const variance = avgSalesByDay.reduce((sum, val) => sum + Math.pow(val - overallAvg, 2), 0) / avgSalesByDay.length;
  const stdDev = Math.sqrt(variance);

  // If std deviation > 30% of mean, there's weekly seasonality
  if (stdDev > overallAvg * 0.3) {
    const peakDays = avgSalesByDay
      .map((val, idx) => ({ day: idx, avg: val }))
      .filter(d => d.avg > overallAvg * 1.2)
      .map(d => d.day);

    return {
      detected: true,
      pattern: 'weekly' as const,
      peakDays,
    };
  }

  return { detected: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// ML FORECASTING (Using GPT-4 for analysis)
// ═══════════════════════════════════════════════════════════════════════════

async function generateForecastWithAI(
  historicalData: HistoricalSalesData[],
  forecastDays: number,
  seasonality: any
): Promise<Array<{ date: Date; predictedDemand: number; confidence: number }>> {
  // Prepare data summary for GPT-4
  const dataPoints = historicalData.map(d => ({
    date: format(d.date, 'yyyy-MM-dd'),
    quantity: d.quantity,
  }));

  const avgDemand = historicalData.reduce((sum, d) => sum + d.quantity, 0) / historicalData.length;
  const maxDemand = Math.max(...historicalData.map(d => d.quantity));
  const minDemand = Math.min(...historicalData.map(d => d.quantity));

  const prompt = `Eres un experto en forecasting de demanda para inventarios.

DATOS HISTÓRICOS (últimos ${historicalData.length} días):
${JSON.stringify(dataPoints, null, 2)}

ESTADÍSTICAS:
- Promedio diario: ${avgDemand.toFixed(2)} unidades
- Máximo: ${maxDemand} unidades
- Mínimo: ${minDemand} unidades
${seasonality.detected ? `- Patrón detectado: ${seasonality.pattern}` : ''}
${seasonality.peakDays ? `- Días pico: ${seasonality.peakDays.join(', ')} (0=Domingo)` : ''}

TAREA:
Genera un forecast de demanda para los próximos ${forecastDays} días.

CONSIDERACIONES:
1. Analiza la tendencia general (creciente, decreciente, estable)
2. Identifica patrones semanales si existen
3. Considera la variabilidad histórica
4. Asigna un nivel de confianza (0.0 a 1.0) basado en:
   - Consistencia de datos históricos
   - Presencia de tendencias claras
   - Cantidad de datos disponibles

FORMATO DE RESPUESTA (JSON estricto):
{
  "forecasts": [
    {
      "dayOffset": 1,
      "predictedDemand": 15,
      "confidence": 0.85,
      "reasoning": "Día laboral promedio"
    },
    ...
  ],
  "trend": "stable|increasing|decreasing",
  "confidence_overall": 0.75
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en análisis predictivo y forecasting de inventarios.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent predictions
      max_tokens: 2000,
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || '{}');

    // Generate forecasts
    const forecasts: Array<{ date: Date; predictedDemand: number; confidence: number }> = [];
    const today = startOfDay(new Date());

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = addDays(today, i);
      const aiForecast = aiResponse.forecasts?.find((f: any) => f.dayOffset === i);

      forecasts.push({
        date: forecastDate,
        predictedDemand: Math.max(0, Math.round(aiForecast?.predictedDemand || avgDemand)),
        confidence: aiForecast?.confidence || 0.5,
      });
    }

    return forecasts;

  } catch (error) {
    console.error('Error generating AI forecast:', error);

    // Fallback to simple moving average
    return generateSimpleForecast(historicalData, forecastDays);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK: SIMPLE MOVING AVERAGE
// ═══════════════════════════════════════════════════════════════════════════

function generateSimpleForecast(
  historicalData: HistoricalSalesData[],
  forecastDays: number
): Array<{ date: Date; predictedDemand: number; confidence: number }> {
  // Calculate 7-day moving average
  const windowSize = Math.min(7, historicalData.length);
  const recentData = historicalData.slice(-windowSize);
  const avgDemand = recentData.reduce((sum, d) => sum + d.quantity, 0) / recentData.length;

  const forecasts: Array<{ date: Date; predictedDemand: number; confidence: number }> = [];
  const today = startOfDay(new Date());

  for (let i = 1; i <= forecastDays; i++) {
    forecasts.push({
      date: addDays(today, i),
      predictedDemand: Math.round(avgDemand),
      confidence: 0.6, // Lower confidence for simple method
    });
  }

  return forecasts;
}

// ═══════════════════════════════════════════════════════════════════════════
// REORDER RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════

function calculateReorderRecommendations(
  currentStock: number,
  forecasts: Array<{ date: Date; predictedDemand: number; confidence: number }>,
  leadTimeDays: number = 7
) {
  let runningStock = currentStock;
  let daysUntilStockout: number | null = null;

  const forecastsWithStock = forecasts.map((f, index) => {
    runningStock -= f.predictedDemand;

    if (daysUntilStockout === null && runningStock <= 0) {
      daysUntilStockout = index + 1;
    }

    return {
      ...f,
      stockProjection: Math.max(0, runningStock),
      reorderRecommended: runningStock <= 0 || runningStock < f.predictedDemand * leadTimeDays,
    };
  });

  const totalForecastedDemand = forecasts.reduce((sum, f) => sum + f.predictedDemand, 0);
  const avgDailyDemand = totalForecastedDemand / forecasts.length;

  // Safety stock = lead time demand + buffer (30%)
  const leadTimeDemand = avgDailyDemand * leadTimeDays;
  const safetyStock = leadTimeDemand * 0.3;
  const recommendedReorderPoint = leadTimeDemand + safetyStock;

  // Economic order quantity (simplified)
  const recommendedReorderQuantity = Math.ceil(avgDailyDemand * leadTimeDays * 2);

  // Risk assessment
  let riskOfStockout: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (daysUntilStockout !== null) {
    if (daysUntilStockout <= 3) riskOfStockout = 'HIGH';
    else if (daysUntilStockout <= 7) riskOfStockout = 'MEDIUM';
  } else if (currentStock < recommendedReorderPoint) {
    riskOfStockout = 'MEDIUM';
  }

  return {
    forecastsWithStock,
    summary: {
      avgDailyDemand,
      totalForecastedDemand,
      recommendedReorderPoint: Math.ceil(recommendedReorderPoint),
      recommendedReorderQuantity,
      riskOfStockout,
      daysUntilStockout,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FORECAST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export async function generateDemandForecast(
  options: DemandForecastOptions,
  companyId: number
): Promise<ForecastResult> {
  const {
    productId,
    forecastDays = 30,
    historicalDays = 90,
    includeSeasonality = true,
  } = options;

  // Get product info
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      code: true,
      name: true,
      stockActual: true,
      leadTimeDays: true,
    },
  });

  if (!product) {
    throw new Error('Producto no encontrado');
  }

  // Get historical sales data
  const historicalData = await getHistoricalSales(productId, companyId, historicalDays);

  if (historicalData.length === 0) {
    throw new Error('No hay datos históricos suficientes para generar forecast');
  }

  // Detect seasonality
  const seasonality = includeSeasonality ? detectSeasonality(historicalData) : { detected: false };

  // Generate forecast using AI
  const aiForecasts = await generateForecastWithAI(historicalData, forecastDays, seasonality);

  // Calculate reorder recommendations
  const { forecastsWithStock, summary } = calculateReorderRecommendations(
    Number(product.stockActual || 0),
    aiForecasts,
    product.leadTimeDays || 7
  );

  return {
    productId,
    productCode: product.code,
    productName: product.name,
    currentStock: Number(product.stockActual || 0),
    forecasts: forecastsWithStock,
    summary,
    seasonality,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK FORECAST (Multiple Products)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateBulkForecast(
  productIds: number[],
  companyId: number,
  forecastDays: number = 30
): Promise<ForecastResult[]> {
  const forecasts: ForecastResult[] = [];

  for (const productId of productIds) {
    try {
      const forecast = await generateDemandForecast(
        { productId, forecastDays },
        companyId
      );
      forecasts.push(forecast);
    } catch (error: any) {
      console.error(`Error forecasting product ${productId}:`, error.message);
    }
  }

  return forecasts;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-REORDER (Based on Forecast)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateAutoReorderSuggestions(
  companyId: number
): Promise<Array<{
  product: any;
  forecast: ForecastResult;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}>> {
  // Get all active products with low stock
  const products = await prisma.product.findMany({
    where: {
      companyId,
      isActive: true,
      tipo: 'PRODUCTO_FINAL', // Only finished products
    },
    select: {
      id: true,
      code: true,
      name: true,
      stockActual: true,
      stockMinimo: true,
    },
    take: 50, // Limit to avoid API overload
  });

  const suggestions: Array<{
    product: any;
    forecast: ForecastResult;
    urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }> = [];

  for (const product of products) {
    try {
      const forecast = await generateDemandForecast(
        { productId: product.id, forecastDays: 30 },
        companyId
      );

      if (forecast.summary.riskOfStockout !== 'LOW') {
        let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

        if (forecast.summary.riskOfStockout === 'HIGH' || forecast.summary.daysUntilStockout && forecast.summary.daysUntilStockout <= 3) {
          urgency = 'CRITICAL';
        } else if (forecast.summary.riskOfStockout === 'MEDIUM' || forecast.summary.daysUntilStockout && forecast.summary.daysUntilStockout <= 7) {
          urgency = 'HIGH';
        } else if (Number(product.stockActual) < forecast.summary.recommendedReorderPoint) {
          urgency = 'MEDIUM';
        }

        suggestions.push({
          product,
          forecast,
          urgency,
        });
      }
    } catch (error: any) {
      console.error(`Error processing product ${product.code}:`, error.message);
    }
  }

  // Sort by urgency
  const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  suggestions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return suggestions;
}
