'use client';

/**
 * Demand Forecast Chart Component
 *
 * Visualizes demand predictions with stock projections
 */

import { useState } from 'react';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ForecastData {
  date: Date;
  predictedDemand: number;
  confidence: number;
  stockProjection: number;
  reorderRecommended: boolean;
}

interface ForecastSummary {
  avgDailyDemand: number;
  totalForecastedDemand: number;
  recommendedReorderPoint: number;
  recommendedReorderQuantity: number;
  riskOfStockout: 'LOW' | 'MEDIUM' | 'HIGH';
  daysUntilStockout: number | null;
}

interface DemandForecastChartProps {
  productCode: string;
  productName: string;
  currentStock: number;
  forecasts: ForecastData[];
  summary: ForecastSummary;
  seasonality?: {
    detected: boolean;
    pattern?: string;
    peakDays?: number[];
  };
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DemandForecastChart({
  productCode,
  productName,
  currentStock,
  forecasts,
  summary,
  seasonality,
  onRefresh,
  isLoading = false,
}: DemandForecastChartProps) {
  const [showConfidence, setShowConfidence] = useState(true);

  // Prepare chart data
  const chartData = forecasts.map((f) => ({
    date: format(f.date, 'dd/MM', { locale: es }),
    fullDate: format(f.date, 'dd MMM yyyy', { locale: es }),
    demand: f.predictedDemand,
    stock: f.stockProjection,
    confidence: Math.round(f.confidence * 100),
    reorderZone: f.reorderRecommended ? f.stockProjection : null,
  }));

  // Risk badge
  const getRiskBadge = () => {
    const riskConfig = {
      LOW: {
        label: 'Riesgo Bajo',
        color: 'bg-green-100 text-green-700 border-green-300',
        icon: CheckCircle2,
      },
      MEDIUM: {
        label: 'Riesgo Medio',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        icon: AlertTriangle,
      },
      HIGH: {
        label: 'Riesgo Alto',
        color: 'bg-red-100 text-red-700 border-red-300',
        icon: AlertCircle,
      },
    };

    const config = riskConfig[summary.riskOfStockout];
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={cn('px-3 py-1', config.color)}>
        <Icon className="w-4 h-4 mr-1.5" />
        {config.label}
      </Badge>
    );
  };

  // Trend indicator
  const getTrendIndicator = () => {
    const firstWeekAvg = forecasts.slice(0, 7).reduce((sum, f) => sum + f.predictedDemand, 0) / 7;
    const lastWeekAvg = forecasts.slice(-7).reduce((sum, f) => sum + f.predictedDemand, 0) / 7;
    const change = ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100;

    if (Math.abs(change) < 5) {
      return (
        <div className="flex items-center text-gray-600">
          <Minus className="w-4 h-4 mr-1" />
          <span className="text-sm">Estable ({change.toFixed(1)}%)</span>
        </div>
      );
    }

    if (change > 0) {
      return (
        <div className="flex items-center text-green-600">
          <TrendingUp className="w-4 h-4 mr-1" />
          <span className="text-sm">Creciente (+{change.toFixed(1)}%)</span>
        </div>
      );
    }

    return (
      <div className="flex items-center text-red-600">
        <TrendingDown className="w-4 h-4 mr-1" />
        <span className="text-sm">Decreciente ({change.toFixed(1)}%)</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                {productCode} - {productName}
              </CardTitle>
              <CardDescription className="mt-1">
                Forecast de demanda para los próximos {forecasts.length} días
              </CardDescription>
            </div>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
                Actualizar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Stock Actual</p>
              <p className="text-2xl font-bold">{currentStock.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Demanda Promedio</p>
              <p className="text-2xl font-bold">
                {summary.avgDailyDemand.toFixed(1)} <span className="text-sm font-normal text-gray-500">/día</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Punto de Reorden</p>
              <p className="text-2xl font-bold text-orange-600">
                {summary.recommendedReorderPoint.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Riesgo de Quiebre</p>
              <div className="mt-1">
                {getRiskBadge()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {summary.daysUntilStockout !== null && summary.daysUntilStockout <= 7 && (
        <div className={cn(
          'p-4 rounded-lg border-l-4',
          summary.daysUntilStockout <= 3
            ? 'bg-red-50 border-red-500'
            : 'bg-yellow-50 border-yellow-500'
        )}>
          <div className="flex items-start">
            <AlertCircle className={cn(
              'w-5 h-5 mt-0.5 mr-3',
              summary.daysUntilStockout <= 3 ? 'text-red-600' : 'text-yellow-600'
            )} />
            <div>
              <h4 className={cn(
                'font-semibold',
                summary.daysUntilStockout <= 3 ? 'text-red-900' : 'text-yellow-900'
              )}>
                ⚠️ Alerta de Quiebre de Stock
              </h4>
              <p className={cn(
                'text-sm mt-1',
                summary.daysUntilStockout <= 3 ? 'text-red-700' : 'text-yellow-700'
              )}>
                Se prevé quiebre de stock en <strong>{summary.daysUntilStockout} días</strong>.
                Se recomienda ordenar <strong>{summary.recommendedReorderQuantity} unidades</strong> urgentemente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Proyección de Demanda y Stock</CardTitle>
              <CardDescription>
                Demanda estimada vs. proyección de stock disponible
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {getTrendIndicator()}
              {seasonality?.detected && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                  📊 Patrón {seasonality.pattern}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                label={{ value: 'Unidades', angle: -90, position: 'insideLeft' }}
              />
              {showConfidence && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                  label={{ value: 'Confianza %', angle: 90, position: 'insideRight' }}
                />
              )}
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;

                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-semibold text-gray-900">
                        {payload[0].payload.fullDate}
                      </p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="text-blue-600">
                          Demanda: <strong>{payload[0].payload.demand}</strong> unidades
                        </p>
                        <p className="text-green-600">
                          Stock: <strong>{payload[0].payload.stock}</strong> unidades
                        </p>
                        {showConfidence && (
                          <p className="text-purple-600">
                            Confianza: <strong>{payload[0].payload.confidence}%</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Legend />

              {/* Reorder point line */}
              <ReferenceLine
                yAxisId="left"
                y={summary.recommendedReorderPoint}
                stroke="#f97316"
                strokeDasharray="5 5"
                label={{ value: 'Punto de Reorden', position: 'right', fill: '#f97316' }}
              />

              {/* Stock projection area */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="stock"
                fill="#10b981"
                fillOpacity={0.1}
                stroke="#10b981"
                strokeWidth={2}
                name="Stock Proyectado"
              />

              {/* Demand forecast line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="demand"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5 }}
                name="Demanda Estimada"
              />

              {/* Confidence line */}
              {showConfidence && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="confidence"
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Confianza %"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          <div className="mt-4 flex items-center justify-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showConfidence}
                onChange={(e) => setShowConfidence(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-600">Mostrar nivel de confianza</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recomendaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start p-3 bg-blue-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold mr-3">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900">Punto de Reorden</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Cuando el stock baje a <strong>{summary.recommendedReorderPoint} unidades</strong>, generar orden de compra.
                </p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-purple-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold mr-3">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-purple-900">Cantidad Económica</h4>
                <p className="text-sm text-purple-700 mt-1">
                  Ordenar <strong>{summary.recommendedReorderQuantity} unidades</strong> en cada reposición para optimizar costos.
                </p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-green-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold mr-3">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-green-900">Demanda Total Proyectada</h4>
                <p className="text-sm text-green-700 mt-1">
                  Se espera una demanda total de <strong>{summary.totalForecastedDemand.toFixed(0)} unidades</strong> en
                  los próximos {forecasts.length} días ({summary.avgDailyDemand.toFixed(1)} por día).
                </p>
              </div>
            </div>

            {seasonality?.detected && seasonality.peakDays && (
              <div className="flex items-start p-3 bg-orange-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold mr-3">
                  📊
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-900">Patrón Estacional Detectado</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    Se detectó un patrón <strong>{seasonality.pattern}</strong> con picos de demanda
                    los días: {seasonality.peakDays.map(d => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d]).join(', ')}.
                    Considerar aumentar stock en estos días.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
