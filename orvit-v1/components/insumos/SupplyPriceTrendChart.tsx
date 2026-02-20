'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, BarChart3 } from 'lucide-react';

interface SupplyPriceRecord {
  id: number;
  supplyId: number;
  changeType: string;
  oldPrice?: number;
  newPrice: number;
  oldFreightCost?: number;
  newFreightCost?: number;
  monthYear: string;
  notes: string;
  createdAt: string;
  supplyName: string;
  unitMeasure: string;
  supplierName: string;
}

interface SupplyPriceTrendChartProps {
  supplyName: string;
  unitMeasure: string;
  priceRecords: SupplyPriceRecord[];
}

export function SupplyPriceTrendChart({ supplyName, unitMeasure, priceRecords }: SupplyPriceTrendChartProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatMonth = (monthYear: string) => {
    if (!monthYear) return '';
    const date = new Date(monthYear);
    return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
  };

  // Procesar datos para el gráfico
  const processedData = priceRecords
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((record, index) => {
      const price = record.newPrice;
      const previousRecord = index > 0 ? priceRecords[index - 1] : null;
      const oldPrice = previousRecord ? previousRecord.newPrice : record.oldPrice || price;
      
      const priceChange = price - oldPrice;
      const percentageChange = oldPrice > 0 ? (priceChange / oldPrice) * 100 : 0;
      
      return {
        index: index + 1,
        month: formatMonth(record.monthYear),
        price: price,
        oldPrice: oldPrice,
        priceChange: priceChange,
        percentageChange: percentageChange,
        changeType: record.changeType,
        notes: record.notes,
        createdAt: record.createdAt,
        date: formatDate(record.createdAt)
      };
    });

  // Calcular estadísticas separadas
  const prices = processedData.map(d => d.price);
  const averagePrice = prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  
  // Calcular estadísticas del flete
  const freightPrices = priceRecords.map(r => r.newFreightCost || 0);
  const averageFreight = freightPrices.length > 0 ? freightPrices.reduce((sum, freight) => sum + freight, 0) / freightPrices.length : 0;
  const maxFreight = freightPrices.length > 0 ? Math.max(...freightPrices) : 0;
  const minFreight = freightPrices.length > 0 ? Math.min(...freightPrices) : 0;
  
  // Calcular tendencia general
  let trend = 'stable';
  let trendPercentage = 0;
  if (processedData.length >= 2) {
    const firstPrice = processedData[0].price;
    const lastPrice = processedData[processedData.length - 1].price;
    trendPercentage = ((lastPrice - firstPrice) / firstPrice) * 100;
    trend = trendPercentage > 0 ? 'up' : trendPercentage < 0 ? 'down' : 'stable';
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  if (processedData.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-info-muted-foreground" />
            Tendencia de Precios - {supplyName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="bg-warning-muted border border-warning-muted rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-warning-muted-foreground">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Se necesitan al menos 2 precios para calcular tendencias</span>
              </div>
            </div>
            <p>Este insumo tiene {processedData.length} precio(s) registrado(s).</p>
            <p className="text-sm mt-2">Registra más precios para ver el análisis de tendencias.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precio Actual</CardTitle>
            {getTrendIcon()}
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', getTrendColor())}>
              {formatCurrency(processedData[processedData.length - 1].price)}
            </div>
            <p className="text-xs text-muted-foreground">
              {processedData[processedData.length - 1].date}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tendencia</CardTitle>
            <TrendingUp className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', getTrendColor())}>
              {trendPercentage > 0 ? '+' : ''}{trendPercentage.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {trend === 'up' ? 'Aumento' : trend === 'down' ? 'Disminución' : 'Estable'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precio Máximo</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(maxPrice)}
            </div>
            <p className="text-xs text-muted-foreground">
              {unitMeasure}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precio Mínimo</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(minPrice)}
            </div>
            <p className="text-xs text-muted-foreground">
              {unitMeasure}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Línea */}
        <Card>
          <CardHeader>
            <CardTitle>Evolución de Precios</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="index" 
                  tickFormatter={(value) => `#${value}`}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  labelFormatter={(value) => `Registro #${value}`}
                  formatter={(value: any, name: string) => [
                    formatCurrency(value),
                    name === 'price' ? 'Precio' : name
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Barras */}
        <Card>
          <CardHeader>
            <CardTitle>Cambios por Período</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="index" 
                  tickFormatter={(value) => `#${value}`}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  labelFormatter={(value) => `Registro #${value}`}
                  formatter={(value: any, name: string) => [
                    formatCurrency(value),
                    name === 'price' ? 'Precio' : name
                  ]}
                />
                <Bar 
                  dataKey="price" 
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Detalles */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Cambios - Secuencia de Precios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">#</th>
                  <th className="text-left p-2 font-medium">Mes</th>
                  <th className="text-left p-2 font-medium">Precio</th>
                  <th className="text-left p-2 font-medium">Cambio</th>
                  <th className="text-left p-2 font-medium">%</th>
                  <th className="text-left p-2 font-medium">Tipo</th>
                  <th className="text-left p-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {processedData.map((record, index) => (
                  <tr key={index} className="border-b hover:bg-accent">
                    <td className="p-2 font-mono text-sm">{record.index}</td>
                    <td className="p-2 text-sm">{record.month}</td>
                    <td className="p-2 font-medium">
                      {formatCurrency(record.price)}
                    </td>
                    <td className="p-2">
                      {index > 0 && (
                        <div className="flex items-center gap-1">
                          {record.priceChange > 0 ? (
                            <TrendingUp className="h-3 w-3 text-success" />
                          ) : record.priceChange < 0 ? (
                            <TrendingDown className="h-3 w-3 text-destructive" />
                          ) : (
                            <Minus className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className={cn('text-sm',
                            record.priceChange > 0 ? 'text-success' :
                            record.priceChange < 0 ? 'text-destructive' : 'text-muted-foreground'
                          )}>
                            {record.priceChange > 0 ? '+' : ''}{formatCurrency(record.priceChange)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {index > 0 && (
                        <Badge variant={record.percentageChange > 0 ? 'default' : record.percentageChange < 0 ? 'destructive' : 'secondary'}>
                          {record.percentageChange > 0 ? '+' : ''}{record.percentageChange.toFixed(1)}%
                        </Badge>
                      )}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">
                        {record.changeType === 'precio_actualizado' || record.changeType === 'precio_actualizado_masivo' ? 'Actualizado' : 'Nuevo'}
                      </Badge>
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">{record.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
