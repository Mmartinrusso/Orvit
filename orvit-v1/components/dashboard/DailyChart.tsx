'use client';

import React, { useState } from 'react';
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
  console.log(`📊 DailyChart - Datos recibidos:`, data?.length || 0, 'días');

  // Si no hay datos, mostrar mensaje
  // Solo mostrar mensaje si realmente no hay datos diarios
  const hasNoData = !data || data.length === 0;
  
  if (hasNoData) {
    return (
      <Card className="mb-6">
        <CardContent className="p-8">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Sin datos diarios disponibles</h3>
            <p className="text-gray-600 mb-6">
              No se encontraron registros de actividad diaria para mostrar en el gráfico.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm">📈</span>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm text-blue-800 font-medium mb-1">Para ver datos diarios:</p>
                  <ul className="text-sm text-blue-700 space-y-1">
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
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">
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
              <span className="text-sm text-gray-600">Valor del día:</span>
              <span className="font-medium">{formatCurrency(data.value)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="text-sm text-gray-600">Acumulado MTD:</span>
              <span className="font-medium">{formatCurrency(data.cumulative)}</span>
            </div>
            {data.delta !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                <span className="text-sm text-gray-600">Δ vs ayer:</span>
                <span className={`font-medium ${data.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.delta >= 0 ? '+' : ''}{formatCurrency(data.delta)} ({formatPercentage(data.deltaPct)})
                </span>
              </div>
            )}
            {data.forecast && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                <span className="text-sm text-gray-600">Forecast EOM:</span>
                <span className="font-medium text-purple-600">{formatCurrency(data.forecast)}</span>
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
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
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
              className={`flex items-center gap-2 ${
                activeMetric === metric.value 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-200">
          <div className="text-center">
            <p className="text-xs text-gray-600">Promedio Diario</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(data.reduce((sum, day) => sum + day.value, 0) / data.length)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Mejor Día</p>
            <p className="text-sm font-semibold text-green-600">
              {formatCurrency(Math.max(...data.map(d => d.value)))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Peor Día</p>
            <p className="text-sm font-semibold text-red-600">
              {formatCurrency(Math.min(...data.map(d => d.value)))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Volatilidad</p>
            <p className="text-sm font-semibold text-gray-900">
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
