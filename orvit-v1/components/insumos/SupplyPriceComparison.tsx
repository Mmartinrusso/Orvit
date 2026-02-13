'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3, LineChart as LineChartIcon, Activity, DollarSign, Percent, ArrowUpDown } from 'lucide-react';

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

interface SupplyPriceComparisonProps {
  supplyName: string;
  unitMeasure: string;
  priceRecords: SupplyPriceRecord[];
}

export function SupplyPriceComparison({ supplyName, unitMeasure, priceRecords }: SupplyPriceComparisonProps) {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (monthYear: string) => {
    if (!monthYear) return '';
    const date = new Date(monthYear);
    return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
  };

  // Obtener meses únicos disponibles
  const availableMonths = Array.from(new Set(priceRecords.map(r => r.monthYear)))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Obtener el último precio de cada mes
  const monthlyData = availableMonths.map(month => {
    const monthRecords = priceRecords
      .filter(r => r.monthYear === month)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const latestRecord = monthRecords[0];
    return {
      month,
      monthFormatted: formatMonth(month),
      price: latestRecord.newPrice,
      recordCount: monthRecords.length,
      firstPrice: monthRecords[monthRecords.length - 1]?.newPrice || latestRecord.newPrice,
      lastPrice: latestRecord.newPrice,
      priceChange: monthRecords.length > 1 ? 
        latestRecord.newPrice - monthRecords[monthRecords.length - 1].newPrice : 0,
      percentageChange: monthRecords.length > 1 ? 
        ((latestRecord.newPrice - monthRecords[monthRecords.length - 1].newPrice) / monthRecords[monthRecords.length - 1].newPrice) * 100 : 0
    };
  });

  // Filtrar datos según meses seleccionados
  const filteredData = selectedMonths.length > 0 
    ? monthlyData.filter(d => selectedMonths.includes(d.month))
    : monthlyData;

  // Calcular estadísticas de comparación
  const calculateComparisonStats = () => {
    if (filteredData.length < 2) return null;

    const prices = filteredData.map(d => d.price);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    const totalChange = lastPrice - firstPrice;
    const totalPercentageChange = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    const volatility = Math.sqrt(
      prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length
    );

    return {
      firstPrice,
      lastPrice,
      minPrice,
      maxPrice,
      avgPrice,
      totalChange,
      totalPercentageChange,
      volatility,
      priceRange: maxPrice - minPrice,
      monthsAnalyzed: filteredData.length
    };
  };

  const stats = calculateComparisonStats();

  // Generar datos para el gráfico
  const chartData = filteredData.map((data, index) => ({
    ...data,
    index: index + 1,
    trend: index > 0 ? (data.price > filteredData[index - 1].price ? 'up' : 'down') : 'stable'
  }));

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (monthlyData.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Comparativa Mensual - {supplyName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-yellow-800">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">Se necesitan al menos 2 meses para comparar</span>
              </div>
            </div>
            <p>Este insumo tiene datos de {monthlyData.length} mes(es).</p>
            <p className="text-sm mt-2">Registra precios de más meses para ver la comparativa.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Comparativa Mensual - {supplyName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selector de meses */}
            <div>
              <label className="block text-sm font-medium mb-2">Meses a comparar:</label>
              <Select
                value={selectedMonths.length > 0 ? selectedMonths[0] : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    setSelectedMonths([]);
                  } else {
                    setSelectedMonths([value]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses ({monthlyData.length})</SelectItem>
                  {availableMonths.map(month => (
                    <SelectItem key={month} value={month}>
                      {formatMonth(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de gráfico */}
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de gráfico:</label>
              <div className="flex gap-2">
                <Button
                  variant={chartType === 'bar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('bar')}
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Barras
                </Button>
                <Button
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('line')}
                >
                  <LineChartIcon className="h-4 w-4 mr-1" />
                  Líneas
                </Button>
                <Button
                  variant={chartType === 'area' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('area')}
                >
                  <Activity className="h-4 w-4 mr-1" />
                  Área
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas de comparación */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cambio Total</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.totalChange >= 0 ? '+' : ''}{formatCurrency(stats.totalChange)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalPercentageChange >= 0 ? '+' : ''}{stats.totalPercentageChange.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Precio Promedio</CardTitle>
              <DollarSign className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(stats.avgPrice)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.monthsAnalyzed} meses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rango de Precios</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(stats.priceRange)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.minPrice)} - {formatCurrency(stats.maxPrice)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Volatilidad</CardTitle>
              <Activity className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.volatility)}
              </div>
              <p className="text-xs text-muted-foreground">
                Desviación estándar
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráfico de comparación */}
      <Card>
        <CardHeader>
          <CardTitle>Evolución de Precios por Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'bar' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="monthFormatted" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value), 'Precio']}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Bar 
                  dataKey="price" 
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            ) : chartType === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="monthFormatted" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value), 'Precio']}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            ) : (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="monthFormatted" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value), 'Precio']}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                  strokeWidth={3}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabla de comparación detallada */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis Detallado por Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Mes</th>
                  <th className="text-left p-2 font-medium">Precio</th>
                  <th className="text-left p-2 font-medium">Cambio</th>
                  <th className="text-left p-2 font-medium">%</th>
                  <th className="text-left p-2 font-medium">Tendencia</th>
                  <th className="text-left p-2 font-medium">Registros</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((data, index) => (
                  <tr key={data.month} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{data.monthFormatted}</td>
                    <td className="p-2 font-bold text-lg">{formatCurrency(data.price)}</td>
                    <td className="p-2">
                      {index > 0 && (
                        <div className="flex items-center gap-1">
                          {getTrendIcon(data.trend)}
                          <span className={`text-sm ${getTrendColor(data.trend)}`}>
                            {data.priceChange > 0 ? '+' : ''}{formatCurrency(data.priceChange)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {index > 0 && (
                        <Badge variant={data.percentageChange > 0 ? 'default' : data.percentageChange < 0 ? 'destructive' : 'secondary'}>
                          {data.percentageChange > 0 ? '+' : ''}{data.percentageChange.toFixed(1)}%
                        </Badge>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {getTrendIcon(data.trend)}
                        <span className={`text-sm ${getTrendColor(data.trend)}`}>
                          {data.trend === 'up' ? 'Sube' : data.trend === 'down' ? 'Baja' : 'Estable'}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{data.recordCount}</Badge>
                    </td>
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
