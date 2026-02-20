'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, 
  Line, 
  Area, 
  AreaChart, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Calendar,
  Target
} from 'lucide-react';
import { formatCurrency, formatPercentage } from './utils/metrics';

interface DailyChartProps {
  data: any[];
  selectedMetric?: 'ingresos' | 'costos' | 'margen';
  showForecast?: boolean;
  showDelta?: boolean;
}

export function DailyChart({ 
  data, 
  selectedMetric = 'ingresos', 
  showForecast = true, 
  showDelta = true 
}: DailyChartProps) {
  const [activeMetric, setActiveMetric] = useState(selectedMetric);

  // Si no hay datos, mostrar mensaje
  // Solo mostrar mensaje si realmente no hay datos diarios
  const hasNoData = !data || data.length === 0;
  
  if (hasNoData) {
    return (
      <Card className="mb-6">
        <CardContent className="p-8">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Sin datos diarios disponibles</h3>
            <p className="text-muted-foreground mb-6">
              No se encontraron registros de actividad diaria para mostrar en el gráfico.
            </p>
            <div className="bg-info-muted border border-info-muted rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-info-muted rounded-full flex items-center justify-center">
                    <span className="text-info-muted-foreground text-sm">📈</span>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm text-info-muted-foreground font-medium mb-1">Para ver datos diarios:</p>
                  <ul className="text-sm text-info-muted-foreground space-y-1">
                    <li>• Registra ventas diarias en el módulo de Ventas</li>
                    <li>• Selecciona un mes con actividad registrada</li>
                    <li>• Verifica que los datos estén correctamente cargados</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { value: 'ingresos', label: 'Ingresos', color: '#3B82F6', icon: TrendingUp },
    { value: 'costos', label: 'Costos', color: '#EF4444', icon: TrendingDown },
    { value: 'margen', label: 'Margen', color: '#10B981', icon: BarChart3 }
  ];

  const currentMetric = metrics.find(m => m.value === activeMetric) || metrics[0];
  const Icon = currentMetric.icon;

  // Calcular forecast basado en run-rate de últimos 7 días
  const last7Days = data.slice(-7);
  const avgLast7Days = last7Days.reduce((sum, day) => sum + day.value, 0) / last7Days.length;
  const remainingDays = 22 - data.length; // Asumiendo 22 días hábiles
  const forecastValue = avgLast7Days * remainingDays;

  const chartData = data.map((point, index) => ({
    ...point,
    forecast: index === data.length - 1 ? point.cumulative + forecastValue : null,
    deltaBar: point.deltaPct || 0
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card p-4 border border-border rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-2">
            {new Date(label).toLocaleDateString('es-AR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentMetric.color }}></div>
              <span className="text-sm text-muted-foreground">Valor del día:</span>
              <span className="font-medium">{formatCurrency(data.value)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
              <span className="text-sm text-muted-foreground">Acumulado MTD:</span>
              <span className="font-medium">{formatCurrency(data.cumulative)}</span>
            </div>
            {data.delta !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-info-muted-foreground"></div>
                <span className="text-sm text-muted-foreground">Δ vs ayer:</span>
                <span className={cn('font-medium', data.delta >= 0 ? 'text-success' : 'text-destructive')}>
                  {data.delta >= 0 ? '+' : ''}{formatCurrency(data.delta)} ({formatPercentage(data.deltaPct)})
                </span>
              </div>
            )}
            {data.forecast && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-info-muted-foreground"></div>
                <span className="text-sm text-muted-foreground">Forecast EOM:</span>
                <span className="font-medium text-info-muted-foreground">{formatCurrency(data.forecast)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            {React.createElement(Icon, { className: "h-5 w-5", style: { color: currentMetric.color } })}
            Análisis Diario - {currentMetric.label}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {data.length} días
            </Badge>
            {showForecast && (
              <Badge variant="outline" className="text-xs">
                <Target className="h-3 w-3 mr-1" />
                Forecast ON
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Selector de métricas */}
        <div className="flex gap-2 mb-6">
        {metrics.map((metric) => {
          const MetricIcon = metric.icon;
          return (
            <Button
              key={metric.value}
              variant={activeMetric === metric.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveMetric(metric.value)}
              className={cn('flex items-center gap-2',
                activeMetric === metric.value
                  ? 'bg-info text-white'
                  : 'bg-card border-border text-foreground hover:bg-accent'
              )}
            >
              {React.createElement(MetricIcon, { className: "h-4 w-4" })}
              {metric.label}
            </Button>
          );
        })}
        </div>

        {/* Gráfico */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                stroke="#666"
                fontSize={12}
              />
              <YAxis 
                tickFormatter={(value) => formatCurrency(value)}
                stroke="#666"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Área de acumulado MTD */}
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={currentMetric.color}
                fill={currentMetric.color}
                fillOpacity={0.1}
                strokeWidth={2}
              />
              
              {/* Línea de valor diario */}
              <Line
                type="monotone"
                dataKey="value"
                stroke={currentMetric.color}
                strokeWidth={3}
                dot={{ fill: currentMetric.color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: currentMetric.color, strokeWidth: 2 }}
              />
              
              {/* Línea de forecast */}
              {showForecast && (
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
              
              {/* Barras de %Δ */}
              {showDelta && (
                <Bar
                  dataKey="deltaBar"
                  fill="#94A3B8"
                  opacity={0.6}
                  radius={[2, 2, 0, 0]}
                />
              )}
              
              {/* Línea de referencia para hoy */}
              <ReferenceLine 
                x={data[data.length - 1]?.date} 
                stroke="#EF4444" 
                strokeDasharray="2 2"
                label={{ value: "Hoy", position: "top" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Resumen estadístico */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Promedio Diario</p>
            <p className="text-sm font-semibold text-foreground">
              {formatCurrency(data.reduce((sum, day) => sum + day.value, 0) / data.length)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Mejor Día</p>
            <p className="text-sm font-semibold text-success">
              {formatCurrency(Math.max(...data.map(d => d.value)))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Peor Día</p>
            <p className="text-sm font-semibold text-destructive">
              {formatCurrency(Math.min(...data.map(d => d.value)))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Volatilidad</p>
            <p className="text-sm font-semibold text-foreground">
              {formatPercentage(
                Math.sqrt(
                  data.reduce((sum, day) => sum + Math.pow(day.value - (data.reduce((s, d) => s + d.value, 0) / data.length), 2), 0) / data.length
                ) / (data.reduce((sum, day) => sum + day.value, 0) / data.length) * 100
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
