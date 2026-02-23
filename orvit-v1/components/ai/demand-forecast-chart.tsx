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
import { cn, formatNumber } from '@/lib/utils';

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
        color: 'bg-success-muted text-success border-success/30',
        icon: CheckCircle2,
      },
      MEDIUM: {
        label: 'Riesgo Medio',
        color: 'bg-warning-muted text-warning-muted-foreground border-warning/30',
        icon: AlertTriangle,
      },
      HIGH: {
        label: 'Riesgo Alto',
        color: 'bg-destructive/10 text-destructive border-destructive/30',
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
        <div className="flex items-center text-muted-foreground">
          <Minus className="w-4 h-4 mr-1" />
          <span className="text-sm">Estable ({formatNumber(change, 1)}%)</span>
        </div>
      );
    }

    if (change > 0) {
      return (
        <div className="flex items-center text-success">
          <TrendingUp className="w-4 h-4 mr-1" />
          <span className="text-sm">Creciente (+{formatNumber(change, 1)}%)</span>
        </div>
      );
    }

    return (
      <div className="flex items-center text-destructive">
        <TrendingDown className="w-4 h-4 mr-1" />
        <span className="text-sm">Decreciente ({formatNumber(change, 1)}%)</span>
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
              <p className="text-sm text-muted-foreground">Stock Actual</p>
              <p className="text-2xl font-bold">{currentStock.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Demanda Promedio</p>
              <p className="text-2xl font-bold">
                {formatNumber(summary.avgDailyDemand, 1)} <span className="text-sm font-normal text-muted-foreground">/día</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Punto de Reorden</p>
              <p className="text-2xl font-bold text-warning-muted-foreground">
                {summary.recommendedReorderPoint.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Riesgo de Quiebre</p>
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
            ? 'bg-destructive/10 border-destructive'
            : 'bg-warning-muted border-warning'
        )}>
          <div className="flex items-start">
            <AlertCircle className={cn(
              'w-5 h-5 mt-0.5 mr-3',
              summary.daysUntilStockout <= 3 ? 'text-destructive' : 'text-warning-muted-foreground'
            )} />
            <div>
              <h4 className={cn(
                'font-semibold',
                summary.daysUntilStockout <= 3 ? 'text-destructive' : 'text-warning-muted-foreground'
              )}>
                Alerta de Quiebre de Stock
              </h4>
              <p className={cn(
                'text-sm mt-1',
                summary.daysUntilStockout <= 3 ? 'text-destructive' : 'text-warning-muted-foreground'
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
                <Badge variant="outline" className="bg-info-muted text-info-muted-foreground border-border">
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
                    <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
                      <p className="font-semibold text-foreground">
                        {payload[0].payload.fullDate}
                      </p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="text-primary">
                          Demanda: <strong>{payload[0].payload.demand}</strong> unidades
                        </p>
                        <p className="text-success">
                          Stock: <strong>{payload[0].payload.stock}</strong> unidades
                        </p>
                        {showConfidence && (
                          <p className="text-muted-foreground">
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
              <span className="text-muted-foreground">Mostrar nivel de confianza</span>
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
            <div className="flex items-start p-3 bg-info-muted rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mr-3">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-info-muted-foreground">Punto de Reorden</h4>
                <p className="text-sm text-info-muted-foreground mt-1">
                  Cuando el stock baje a <strong>{summary.recommendedReorderPoint} unidades</strong>, generar orden de compra.
                </p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-muted rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mr-3">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">Cantidad Económica</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Ordenar <strong>{summary.recommendedReorderQuantity} unidades</strong> en cada reposición para optimizar costos.
                </p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-success-muted rounded-lg">
              <div className="w-8 h-8 rounded-full bg-success text-white flex items-center justify-center font-bold mr-3">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-success-muted-foreground">Demanda Total Proyectada</h4>
                <p className="text-sm text-success-muted-foreground mt-1">
                  Se espera una demanda total de <strong>{formatNumber(summary.totalForecastedDemand, 0)} unidades</strong> en
                  los próximos {forecasts.length} días ({formatNumber(summary.avgDailyDemand, 1)} por día).
                </p>
              </div>
            </div>

            {seasonality?.detected && seasonality.peakDays && (
              <div className="flex items-start p-3 bg-warning-muted rounded-lg">
                <div className="w-8 h-8 rounded-full bg-warning text-white flex items-center justify-center font-bold mr-3">
                  📊
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-warning-muted-foreground">Patrón Estacional Detectado</h4>
                  <p className="text-sm text-warning-muted-foreground mt-1">
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
