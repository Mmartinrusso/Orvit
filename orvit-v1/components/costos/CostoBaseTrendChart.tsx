'use client';

import React from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface MonthlyRecord {
  month: string;
  amount: number;
  status: 'paid' | 'pending';
  createdAt: string;
}

interface CostoBaseTrendChartProps {
  costoName: string;
  monthlyRecords: MonthlyRecord[];
}

export function CostoBaseTrendChart({ costoName, monthlyRecords }: CostoBaseTrendChartProps) {
  // Para la tabla de secuencia: mostrar TODOS los registros ordenados por fecha de creación
  const sortedRecords = monthlyRecords
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Formatear datos para los gráficos
  const chartData = sortedRecords.map((record, index) => ({
    month: new Date(record.month + '-01').toLocaleDateString('es-AR', { 
      year: 'numeric', 
      month: 'short' 
    }),
    amount: record.amount,
    status: record.status,
    fullMonth: record.month,
    createdAt: record.createdAt,
    index: index + 1 // Número de secuencia
  }));

  // Convertir amounts a números para cálculos correctos (usar TODOS los registros para estadísticas)
  const numericAmounts = monthlyRecords.map(r => Number(r.amount));
  
  // Calcular estadísticas usando TODOS los registros
  const averageAmount = numericAmounts.length > 0 ? numericAmounts.reduce((sum, amount) => sum + amount, 0) / numericAmounts.length : 0;
  const maxAmount = numericAmounts.length > 0 ? Math.max(...numericAmounts) : 0;
  const minAmount = numericAmounts.length > 0 ? Math.min(...numericAmounts) : 0;
  
  // Calcular tendencia (último vs penúltimo) usando todos los registros
  let trend = 'stable';
  let trendPercentage = 0;
  if (sortedRecords.length >= 2) {
    const latest = Number(sortedRecords[sortedRecords.length - 1].amount);
    const previous = Number(sortedRecords[sortedRecords.length - 2].amount);
    trendPercentage = ((latest - previous) / previous) * 100;
    trend = trendPercentage > 0 ? 'up' : trendPercentage < 0 ? 'down' : 'stable';
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTooltipValue = (value: number) => formatCurrency(value);

  if (monthlyRecords.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolución de {costoName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No hay registros mensuales para mostrar
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">


      {/* Gráfico de Línea - Tendencia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolución de Cambios
            {trend !== 'stable' && (
              <span className={cn('text-sm font-normal', trend === 'up' ? 'text-success' : 'text-destructive')}>
                ({trend === 'up' ? '+' : ''}{formatNumber(trendPercentage, 1)}%)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="index" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value, name) => [formatTooltipValue(value), 'Monto']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      const data = payload[0].payload;
                      return `Registro #${data.index} - ${data.month}`;
                    }
                    return `Registro #${label}`;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: '#3B82F6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Barras - Comparación Mensual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Comparación Mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value, name) => [formatTooltipValue(value), 'Monto']}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Detalles */}
      <Card>
        <CardHeader>
          <CardTitle>Registros Mensuales - Secuencia de Cambios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Mes</th>
                  <th className="text-right p-2">Monto</th>
                  <th className="text-center p-2">Estado</th>
                  <th className="text-right p-2">Diferencia</th>
                  <th className="text-left p-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((record, index) => {
                  const previousAmount = index > 0 ? chartData[index - 1].amount : null;
                  const variation = previousAmount ? record.amount - previousAmount : 0;
                  const variationPercentage = previousAmount ? (variation / previousAmount) * 100 : 0;
                  
                  return (
                    <tr key={`${record.fullMonth}-${index}`} className="border-b hover:bg-accent">
                      <td className="p-2 font-medium text-muted-foreground">#{record.index}</td>
                      <td className="p-2 font-medium">{record.month}</td>
                      <td className="p-2 text-right font-semibold">{formatCurrency(record.amount)}</td>
                      <td className="p-2 text-center">
                        <span className={cn('px-2 py-1 rounded-full text-xs', record.status === 'paid' ? 'bg-success-muted text-success' : 'bg-warning-muted text-warning-muted-foreground')}>
                          {record.status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {previousAmount ? (
                          <div className="flex flex-col items-end">
                            <span className={cn('text-sm font-medium', variation > 0 ? 'text-success' : variation < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                              {variation > 0 ? '+' : ''}{formatCurrency(variation)}
                            </span>
                            <span className={cn('text-xs', variation > 0 ? 'text-success' : variation < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                              ({variationPercentage > 0 ? '+' : ''}{formatNumber(variationPercentage, 1)}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Primer registro</span>
                        )}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {new Date(record.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
