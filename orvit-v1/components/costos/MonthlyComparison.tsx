'use client';

import { formatNumber } from '@/lib/utils';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { 
  TrendingUp, TrendingDown, Minus, Calendar, BarChart3, LineChart as LineChartIcon, 
  Activity, DollarSign, Percent, ArrowUpDown, Users, Package, ShoppingCart, 
  Target, Zap, AlertTriangle, CheckCircle, XCircle, Info, 
  PieChart as PieChartIcon, Radar as RadarIcon, Layers, 
  Award, Star, Shield, Clock, Globe, Building2, 
  ChevronRight, ChevronDown, Eye, Download, Share2, Filter,
  Maximize2, Minimize2, RotateCcw, Settings, HelpCircle
} from 'lucide-react';

interface MonthlyData {
  month: string;
  sueldos: number;
  insumos: number;
  ventas: number;
  produccion: number;
  costos: number;
  total: number;
}

interface MonthlyComparisonProps {
  data: {
    sueldosEmpleados: any[];
    preciosInsumos: any[];
    ventas: any[];
    produccion: any[];
    registrosMensuales: any[];
  }[];
  selectedMonth: string;
}

export function MonthlyComparison({ data, selectedMonth }: MonthlyComparisonProps) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie' | 'radar'>('bar');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'sueldos' | 'insumos' | 'ventas' | 'produccion' | 'costos'>('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['kpis', 'trends']));
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('detailed');
  const [comparisonMode, setComparisonMode] = useState<'2months' | 'range-vs-range' | 'trend' | 'yoy' | 'index100'>('2months');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [rangeA, setRangeA] = useState<{start: string, end: string}>({start: '', end: ''});
  const [rangeB, setRangeB] = useState<{start: string, end: string}>({start: '', end: ''});
  const [baseMonth, setBaseMonth] = useState<string>('');
  const [showAdvancedKPIs, setShowAdvancedKPIs] = useState(false);
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '12m' | '24m' | 'ytd' | 'custom'>('12m');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Función para calcular métricas de crecimiento
  const calculateGrowthMetrics = (data: any[], mode: string) => {
    if (!data || data.length === 0) return null;

    const sortedData = [...data].sort((a, b) => a.month.localeCompare(b.month));
    
    switch (mode) {
      case '2months':
        return calculate2MonthsComparison(sortedData);
      case 'range-vs-range':
        return calculateRangeComparison(sortedData);
      case 'trend':
        return calculateTrendAnalysis(sortedData);
      case 'yoy':
        return calculateYoYComparison(sortedData);
      case 'index100':
        return calculateIndex100(sortedData);
      default:
        return calculate2MonthsComparison(sortedData);
    }
  };

  const calculate2MonthsComparison = (data: any[]) => {
    if (data.length < 2) return null;
    
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    
    return {
      current,
      previous,
      type: '2months',
      metrics: calculateCoreKPIs(current, previous)
    };
  };

  const calculateRangeComparison = (data: any[]) => {
    // Implementar comparación de rangos
    return {
      type: 'range-vs-range',
      rangeA: data.slice(0, 3), // Primeros 3 meses
      rangeB: data.slice(-3), // Últimos 3 meses
    };
  };

  const calculateTrendAnalysis = (data: any[]) => {
    if (data.length < 3) return null;
    
    const trendData = data.map((month, index) => {
      const previous = index > 0 ? data[index - 1] : month;
      const metrics = calculateCoreKPIs(month, previous);
      
      return {
        month: month.month,
        monthFormatted: formatMonth(month.month),
        ...month,
        metrics,
        momChange: metrics?.variacionIngresosPct || 0,
        momValue: metrics?.variacionIngresos || 0
      };
    });

    return {
      type: 'trend',
      data: trendData,
      totalMonths: data.length,
      avgGrowth: trendData.reduce((sum, d) => sum + (d.momChange || 0), 0) / trendData.length,
      volatility: calculateVolatility(trendData.map(d => d.momChange || 0))
    };
  };

  const calculateYoYComparison = (data: any[]) => {
    if (data.length < 12) return null;
    
    const current = data[data.length - 1];
    const previousYear = data[data.length - 13]; // 12 meses atrás
    
    return {
      type: 'yoy',
      current,
      previousYear,
      metrics: calculateCoreKPIs(current, previousYear)
    };
  };

  const calculateIndex100 = (data: any[]) => {
    if (data.length === 0) return null;
    
    const baseMonth = data[0]; // Primer mes como base
    const indexedData = data.map(month => {
      const baseValue = month.ventas || 0;
      const currentValue = month.ventas || 0;
      const index = baseValue > 0 ? (currentValue / baseValue) * 100 : 100;
      
      return {
        ...month,
        index,
        monthFormatted: formatMonth(month.month)
      };
    });

    return {
      type: 'index100',
      baseMonth,
      data: indexedData
    };
  };

  const calculateVolatility = (values: number[]) => {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  const getCategoryDisplayName = (categoryKey: string) => {
    const categoryNames: { [key: string]: string } = {
      'sueldos': 'Sueldos y Salarios',
      'insumos': 'Insumos y Materiales', 
      'ventas': 'Ventas e Ingresos',
      'produccion': 'Producción',
      'costos': 'Costos Indirectos'
    };
    return categoryNames[categoryKey] || categoryKey;
  };

  // Función para calcular KPIs núcleo
  const calculateCoreKPIs = (currentData: any, previousData: any) => {
    if (!currentData) return null;

    const currentMonth = currentData;
    const previousMonth = previousData || currentData; // Usar datos actuales si no hay anteriores

    // Ingresos totales (ventas)
    const ingresosTotales = Number(currentMonth.ventas) || 0;
    const ingresosAnteriores = Number(previousMonth.ventas) || 0;
    const variacionIngresos = ingresosTotales - ingresosAnteriores;
    const variacionIngresosPct = ingresosAnteriores > 0 ? (variacionIngresos / ingresosAnteriores) * 100 : 0;

    // Costos totales (directos + indirectos)
    const costosDirectos = (Number(currentMonth.insumos) || 0) + (Number(currentMonth.sueldos) || 0);
    const costosIndirectos = Number(currentMonth.costos) || 0;
    const costosTotales = costosDirectos + costosIndirectos;
    
    const costosAnteriores = ((Number(previousMonth.insumos) || 0) + (Number(previousMonth.sueldos) || 0)) + (Number(previousMonth.costos) || 0);
    const variacionCostos = costosTotales - costosAnteriores;
    const variacionCostosPct = costosAnteriores > 0 ? (variacionCostos / costosAnteriores) * 100 : 0;

    // Márgenes
    const margenBruto = ingresosTotales - costosDirectos;
    const margenBrutoPct = ingresosTotales > 0 ? (margenBruto / ingresosTotales) * 100 : 0;
    
    const margenNeto = ingresosTotales - costosTotales;
    const margenNetoPct = ingresosTotales > 0 ? (margenNeto / ingresosTotales) * 100 : 0;

    // Variación de márgenes
    const margenBrutoAnterior = (Number(previousMonth.ventas) || 0) - ((Number(previousMonth.insumos) || 0) + (Number(previousMonth.sueldos) || 0));
    const variacionMargenBruto = margenBruto - margenBrutoAnterior;
    const variacionMargenBrutoPct = margenBrutoAnterior > 0 ? (variacionMargenBruto / margenBrutoAnterior) * 100 : 0;

    const margenNetoAnterior = (Number(previousMonth.ventas) || 0) - costosAnteriores;
    const variacionMargenNeto = margenNeto - margenNetoAnterior;
    const variacionMargenNetoPct = margenNetoAnterior > 0 ? (variacionMargenNeto / margenNetoAnterior) * 100 : 0;

    return {
      ingresosTotales,
      ingresosAnteriores,
      variacionIngresos,
      variacionIngresosPct,
      costosTotales,
      costosAnteriores,
      variacionCostos,
      variacionCostosPct,
      margenBruto,
      margenBrutoPct,
      margenNeto,
      margenNetoPct,
      variacionMargenBruto,
      variacionMargenBrutoPct,
      variacionMargenNeto,
      variacionMargenNetoPct,
      costosDirectos,
      costosIndirectos
    };
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Calcular total del mes
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      
      return (
        <div className="bg-card p-4 border border-border rounded-lg shadow-lg min-w-[300px]">
          <p className="font-semibold text-[#333333] mb-3 text-center text-lg">{label}</p>
          
          {/* Total del mes */}
          <div className="mb-4 p-3 bg-[#333333] text-white rounded-lg text-center">
            <p className="text-sm font-medium">Total del Mes</p>
            <p className="text-xl font-bold">{formatCurrency(total)}</p>
          </div>
          
          {/* Desglose por categoría */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-2">Desglose por Categoría</p>
            {payload.map((entry: any, index: number) => {
              const percentage = ((entry.value / total) * 100).toFixed(1);
              return (
                <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <span className="text-sm font-medium text-[#333333]">
                      {getCategoryDisplayName(entry.dataKey)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#333333]">
                      {formatCurrency(entry.value)}
                    </p>
                    <p className="text-xs text-[#666666]">
                      {percentage}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const formatMonth = (month: string) => {
    if (!month) return '';
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
  };

  // Procesar datos para comparación mensual
  const monthlyData = data.map(monthData => {
    const sueldos = monthData.sueldosEmpleados.reduce((sum, s) => sum + parseFloat(s.total_cost || 0), 0);
    const insumos = monthData.preciosInsumos.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const ventas = monthData.ventas.reduce((sum, v) => sum + parseFloat(v.total_amount || 0), 0);
    const produccion = monthData.produccion.reduce((sum, p) => sum + parseFloat(p.quantity || 0), 0);
    const costos = monthData.registrosMensuales.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    const total = sueldos + insumos + ventas + produccion + costos;

    return {
      month: monthData.month || selectedMonth,
      sueldos,
      insumos,
      ventas,
      produccion,
      costos,
      total
    };
  });

  // Filtrar datos según categoría seleccionada
  const filteredData = monthlyData.map(month => {
    if (selectedCategory === 'all') {
      return month;
    } else {
      return {
        ...month,
        [selectedCategory]: month[selectedCategory as keyof MonthlyData]
      };
    }
  });

  // Calcular estadísticas de comparación
  const calculateStats = () => {
    if (monthlyData.length < 2) return null;

    const totals = monthlyData.map(m => m.total);
    const firstTotal = totals[0];
    const lastTotal = totals[totals.length - 1];
    const minTotal = Math.min(...totals);
    const maxTotal = Math.max(...totals);
    const avgTotal = totals.reduce((sum, total) => sum + total, 0) / totals.length;
    
    const totalChange = lastTotal - firstTotal;
    const totalPercentageChange = ((lastTotal - firstTotal) / firstTotal) * 100;
    
    const volatility = Math.sqrt(
      totals.reduce((sum, total) => sum + Math.pow(total - avgTotal, 2), 0) / totals.length
    );

    // Calcular estadísticas por categoría
    const categoryStats = {
      sueldos: {
        total: monthlyData.reduce((sum, m) => sum + m.sueldos, 0),
        avg: monthlyData.reduce((sum, m) => sum + m.sueldos, 0) / monthlyData.length,
        change: monthlyData[monthlyData.length - 1]?.sueldos - monthlyData[0]?.sueldos || 0
      },
      insumos: {
        total: monthlyData.reduce((sum, m) => sum + m.insumos, 0),
        avg: monthlyData.reduce((sum, m) => sum + m.insumos, 0) / monthlyData.length,
        change: monthlyData[monthlyData.length - 1]?.insumos - monthlyData[0]?.insumos || 0
      },
      ventas: {
        total: monthlyData.reduce((sum, m) => sum + m.ventas, 0),
        avg: monthlyData.reduce((sum, m) => sum + m.ventas, 0) / monthlyData.length,
        change: monthlyData[monthlyData.length - 1]?.ventas - monthlyData[0]?.ventas || 0
      },
      produccion: {
        total: monthlyData.reduce((sum, m) => sum + m.produccion, 0),
        avg: monthlyData.reduce((sum, m) => sum + m.produccion, 0) / monthlyData.length,
        change: monthlyData[monthlyData.length - 1]?.produccion - monthlyData[0]?.produccion || 0
      },
      costos: {
        total: monthlyData.reduce((sum, m) => sum + m.costos, 0),
        avg: monthlyData.reduce((sum, m) => sum + m.costos, 0) / monthlyData.length,
        change: monthlyData[monthlyData.length - 1]?.costos - monthlyData[0]?.costos || 0
      }
    };

    return {
      firstTotal,
      lastTotal,
      minTotal,
      maxTotal,
      avgTotal,
      totalChange,
      totalPercentageChange,
      volatility,
      priceRange: maxTotal - minTotal,
      monthsAnalyzed: monthlyData.length,
      categoryStats
    };
  };

  const stats = calculateStats();

  // Generar datos para el gráfico
  const chartData = filteredData.map((data, index) => ({
    ...data,
    monthFormatted: formatMonth(data.month),
    index: index + 1
  }));

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sueldos':
        return <Users className="h-4 w-4" />;
      case 'insumos':
        return <Package className="h-4 w-4" />;
      case 'ventas':
        return <ShoppingCart className="h-4 w-4" />;
      case 'produccion':
        return <Package className="h-4 w-4" />;
      case 'costos':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'sueldos':
        return 'text-warning-muted-foreground';
      case 'insumos':
        return 'text-info-muted-foreground';
      case 'ventas':
        return 'text-success';
      case 'produccion':
        return 'text-warning-muted-foreground';
      case 'costos':
        return 'text-info-muted-foreground';
      default:
        return 'text-info-muted-foreground';
    }
  };

  // Función para alternar secciones expandidas
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Colores profesionales para las categorías
  const categoryColors = {
    sueldos: { primary: '#3B82F6', secondary: '#DBEAFE', gradient: 'from-blue-500 to-blue-600' },
    insumos: { primary: '#10B981', secondary: '#D1FAE5', gradient: 'from-emerald-500 to-emerald-600' },
    ventas: { primary: '#F59E0B', secondary: '#FEF3C7', gradient: 'from-amber-500 to-amber-600' },
    produccion: { primary: '#8B5CF6', secondary: '#EDE9FE', gradient: 'from-violet-500 to-violet-600' },
    costos: { primary: '#EF4444', secondary: '#FEE2E2', gradient: 'from-red-500 to-red-600' }
  };

  if (monthlyData.length < 2) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Card className="w-full max-w-2xl border-0 shadow-2xl bg-gradient-to-br from-muted to-muted">
          <CardContent className="p-12 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Calendar className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-4">Análisis Comparativo Insuficiente</h3>
            <p className="text-lg text-muted-foreground mb-6">
              Se requieren al menos <span className="font-semibold text-info-muted-foreground">2 meses</span> de datos para generar comparativas significativas.
            </p>
            <div className="bg-info-muted border border-info-muted rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center gap-3 text-info-muted-foreground mb-2">
                <Info className="h-5 w-5" />
                <span className="font-semibold">Estado Actual</span>
              </div>
              <p className="text-info-muted-foreground">
                Datos disponibles: <span className="font-bold">{monthlyData.length} mes(es)</span>
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Selecciona diferentes períodos en el modal de comparativas para ver análisis detallados.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Profesional */}
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          <div className="bg-[#333333] p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Análisis Comparativo Ejecutivo</h1>
                <p className="text-muted-foreground text-lg">
                  Dashboard de rendimiento financiero y operacional
                </p>
                <div className="flex items-center gap-4 mt-4">
                  <Badge variant="secondary" className="bg-background/10 text-white border-background/20">
                    <Calendar className="h-4 w-4 mr-2" />
                    {stats?.monthsAnalyzed} meses analizados
                  </Badge>
                  <Badge variant="secondary" className="bg-background/10 text-white border-background/20">
                    <Clock className="h-4 w-4 mr-2" />
                    Actualizado hace 5 min
                  </Badge>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" className="bg-background/10 border-background/20 text-white hover:bg-background/20">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
                <Button variant="outline" size="sm" className="bg-background/10 border-background/20 text-white hover:bg-background/20">
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartir
                </Button>
                <Button variant="outline" size="sm" className="bg-background/10 border-background/20 text-white hover:bg-background/20">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Controles Avanzados */}
          <div className="p-6 border-b border-border">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[#333333] mb-3">Categoría de Análisis</label>
                <Select value={selectedCategory} onValueChange={(value: any) => setSelectedCategory(value)}>
                  <SelectTrigger className="h-12 border-2 border-border focus:border-info">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    <SelectItem value="sueldos">Sueldos y Salarios</SelectItem>
                    <SelectItem value="insumos">Insumos y Materiales</SelectItem>
                    <SelectItem value="ventas">Ventas y Ingresos</SelectItem>
                    <SelectItem value="produccion">Producción</SelectItem>
                    <SelectItem value="costos">Costos Indirectos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#333333] mb-3">Visualización</label>
                <div className="grid grid-cols-5 gap-2">
                  <Button
                    variant={chartType === 'bar' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('bar')}
                    className="h-10"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={chartType === 'line' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('line')}
                    className="h-10"
                  >
                    <LineChartIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={chartType === 'area' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('area')}
                    className="h-10"
                  >
                    <Activity className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={chartType === 'pie' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('pie')}
                    className="h-10"
                  >
                    <PieChartIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={chartType === 'radar' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('radar')}
                    className="h-10"
                  >
                    <RadarIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#333333] mb-3">Modo de Comparación</label>
                <Select value={comparisonMode} onValueChange={(value: any) => setComparisonMode(value)}>
                  <SelectTrigger className="h-12 border-2 border-border focus:border-info">
                    <SelectValue placeholder="Seleccionar modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2months">2 Meses (Before/After)</SelectItem>
                    <SelectItem value="range-vs-range">Rango vs Rango</SelectItem>
                    <SelectItem value="trend">Tendencia Multi-Mes</SelectItem>
                    <SelectItem value="yoy">Año vs Año (YoY)</SelectItem>
                    <SelectItem value="index100">Índice = 100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#333333] mb-3">Rango de Tiempo</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={timeRange === '3m' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange('3m')}
                    className="h-10"
                  >
                    3M
                  </Button>
                  <Button
                    variant={timeRange === '6m' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange('6m')}
                    className="h-10"
                  >
                    6M
                  </Button>
                  <Button
                    variant={timeRange === '12m' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange('12m')}
                    className="h-10"
                  >
                    12M
                  </Button>
                  <Button
                    variant={timeRange === '24m' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange('24m')}
                    className="h-10"
                  >
                    24M
                  </Button>
                  <Button
                    variant={timeRange === 'ytd' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange('ytd')}
                    className="h-10"
                  >
                    YTD
                  </Button>
                  <Button
                    variant={timeRange === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange('custom')}
                    className="h-10"
                  >
                    Custom
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#333333] mb-3">Vista</label>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'compact' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('compact')}
                    className="flex-1 h-10"
                  >
                    <Minimize2 className="h-4 w-4 mr-2" />
                    Compacta
                  </Button>
                  <Button
                    variant={viewMode === 'detailed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('detailed')}
                    className="flex-1 h-10"
                  >
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Detallada
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs Avanzados - Multi-Mes */}
        {(() => {
          const growthMetrics = calculateGrowthMetrics(data, comparisonMode);
          
          if (!growthMetrics) return null;

          return (
            <div className="space-y-6">
              {/* Header de KPIs Avanzados */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-[#333333] mb-2">
                  {comparisonMode === '2months' && 'KPIs Núcleo - 2 Meses'}
                  {comparisonMode === 'range-vs-range' && 'KPIs - Rango vs Rango'}
                  {comparisonMode === 'trend' && 'KPIs - Tendencia Multi-Mes'}
                  {comparisonMode === 'yoy' && 'KPIs - Año vs Año'}
                  {comparisonMode === 'index100' && 'KPIs - Índice Base 100'}
                </h2>
                <p className="text-[#666666]">
                  {comparisonMode === '2months' && 'Comparación directa entre dos meses consecutivos'}
                  {comparisonMode === 'range-vs-range' && 'Comparación entre dos rangos de tiempo'}
                  {comparisonMode === 'trend' && 'Análisis de tendencia con múltiples meses'}
                  {comparisonMode === 'yoy' && 'Comparación con el mismo mes del año anterior'}
                  {comparisonMode === 'index100' && 'Análisis indexado con base 100'}
                </p>
              </div>

              {/* Renderizar KPIs según el modo */}
              {comparisonMode === '2months' && growthMetrics.metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Ingresos Totales */}
                  <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className={cn('absolute inset-0', growthMetrics.metrics.variacionIngresosPct >= 0 ? 'bg-success' : 'bg-destructive', 'opacity-5')}></div>
                    <CardContent className="p-6 relative">
                      <div className="flex items-center justify-between mb-4">
                        <div className={cn('p-3 rounded-xl', growthMetrics.metrics.variacionIngresosPct >= 0 ? 'bg-success-muted' : 'bg-destructive/10')}>
                          <DollarSign className={cn('h-6 w-6', growthMetrics.metrics.variacionIngresosPct >= 0 ? 'text-success' : 'text-destructive')} />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={cn('w-3 h-3 rounded-full', growthMetrics.metrics.variacionIngresosPct >= 5 ? 'bg-success' : growthMetrics.metrics.variacionIngresosPct >= 0 ? 'bg-warning' : 'bg-destructive')}></div>
                          <Badge variant={growthMetrics.metrics.variacionIngresosPct >= 0 ? 'default' : 'destructive'} className="text-xs">
                            {growthMetrics.metrics.variacionIngresosPct >= 0 ? '+' : ''}{formatNumber(growthMetrics.metrics.variacionIngresosPct, 1)}%
                          </Badge>
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold text-[#666666] mb-2">Ingresos Totales</h3>
                      <p className="text-3xl font-bold text-[#333333] mb-1">
                        {formatCurrency(growthMetrics.metrics.ingresosTotales)}
                      </p>
                      <p className="text-xs text-[#666666]">
                        {growthMetrics.metrics.variacionIngresos >= 0 ? '+' : ''}{formatCurrency(growthMetrics.metrics.variacionIngresos)} vs mes anterior
                      </p>
                    </CardContent>
                  </Card>

                  {/* Costos Totales */}
                  <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className={cn('absolute inset-0', growthMetrics.metrics.variacionCostosPct <= 0 ? 'bg-success' : 'bg-destructive', 'opacity-5')}></div>
                    <CardContent className="p-6 relative">
                      <div className="flex items-center justify-between mb-4">
                        <div className={cn('p-3 rounded-xl', growthMetrics.metrics.variacionCostosPct <= 0 ? 'bg-success-muted' : 'bg-destructive/10')}>
                          <TrendingDown className={cn('h-6 w-6', growthMetrics.metrics.variacionCostosPct <= 0 ? 'text-success' : 'text-destructive')} />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={cn('w-3 h-3 rounded-full', growthMetrics.metrics.variacionCostosPct <= 0 ? 'bg-success' : growthMetrics.metrics.variacionCostosPct <= 5 ? 'bg-warning' : 'bg-destructive')}></div>
                          <Badge variant={growthMetrics.metrics.variacionCostosPct <= 0 ? 'default' : 'destructive'} className="text-xs">
                            {growthMetrics.metrics.variacionCostosPct >= 0 ? '+' : ''}{formatNumber(growthMetrics.metrics.variacionCostosPct, 1)}%
                          </Badge>
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold text-[#666666] mb-2">Costos Totales</h3>
                      <p className="text-3xl font-bold text-[#333333] mb-1">
                        {formatCurrency(growthMetrics.metrics.costosTotales)}
                      </p>
                      <p className="text-xs text-[#666666]">
                        {growthMetrics.metrics.variacionCostos >= 0 ? '+' : ''}{formatCurrency(growthMetrics.metrics.variacionCostos)} vs mes anterior
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Modo Tendencia Multi-Mes */}
              {comparisonMode === 'trend' && growthMetrics.data && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <h3 className="text-sm font-semibold text-[#666666] mb-2">Promedio de Crecimiento</h3>
                      <p className="text-2xl font-bold text-[#333333]">
                        {formatNumber(growthMetrics.avgGrowth, 1)}%
                      </p>
                    </Card>
                    <Card className="p-4">
                      <h3 className="text-sm font-semibold text-[#666666] mb-2">Volatilidad</h3>
                      <p className="text-2xl font-bold text-[#333333]">
                        {formatNumber(growthMetrics.volatility, 1)}%
                      </p>
                    </Card>
                    <Card className="p-4">
                      <h3 className="text-sm font-semibold text-[#666666] mb-2">Meses Analizados</h3>
                      <p className="text-2xl font-bold text-[#333333]">
                        {growthMetrics.totalMonths}
                      </p>
                    </Card>
                  </div>
                </div>
              )}

              {/* Modo Índice Base 100 */}
              {comparisonMode === 'index100' && growthMetrics.data && (
                <div className="space-y-4">
                  <div className="text-center p-4 bg-info-muted rounded-lg">
                    <p className="text-sm text-info-muted-foreground">
                      <strong>Mes Base:</strong> {formatMonth(growthMetrics.baseMonth.month)} = 100
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <h3 className="text-sm font-semibold text-[#666666] mb-2">Índice Actual</h3>
                      <p className="text-2xl font-bold text-[#333333]">
                        {growthMetrics.data[growthMetrics.data.length - 1]?.formatNumber(index, 1) || 100}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <h3 className="text-sm font-semibold text-[#666666] mb-2">Variación Total</h3>
                      <p className="text-2xl font-bold text-[#333333]">
                        {formatNumber((growthMetrics.data[growthMetrics.data.length - 1]?.index || 100) - 100, 1)}%
                      </p>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Dashboard de Visualización */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Gráfico Principal */}
          <div className="xl:col-span-2">
            <Card className="border-0 shadow-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted to-muted border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-[#333333]">
                      {selectedCategory === 'all' ? 'Evolución Financiera Total' : `Evolución de ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}`}
                    </CardTitle>
                    <p className="text-sm text-[#666666] mt-1">
                      Análisis temporal de rendimiento y tendencias
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Detalles
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[500px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="monthFormatted" 
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 12 }}
                          stroke="#666"
                        />
                        <YAxis 
                          tickFormatter={(value) => formatCurrency(value)}
                          tick={{ fontSize: 12 }}
                          stroke="#666"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        {selectedCategory === 'all' ? (
                          <>
                            <Bar dataKey="sueldos" stackId="a" fill="#3B82F6" name="Sueldos" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="insumos" stackId="a" fill="#10B981" name="Insumos" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="ventas" stackId="a" fill="#F59E0B" name="Ventas" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="produccion" stackId="a" fill="#8B5CF6" name="Producción" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="costos" stackId="a" fill="#EF4444" name="Costos" radius={[0, 0, 4, 4]} />
                          </>
                        ) : (
                          <Bar 
                            dataKey={selectedCategory} 
                            fill={categoryColors[selectedCategory as keyof typeof categoryColors]?.primary || '#3B82F6'}
                            radius={[4, 4, 0, 0]}
                          />
                        )}
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="monthFormatted" 
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 12 }}
                          stroke="#666"
                        />
                        <YAxis 
                          tickFormatter={(value) => formatCurrency(value)}
                          tick={{ fontSize: 12 }}
                          stroke="#666"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        {selectedCategory === 'all' ? (
                          <>
                            <Line type="monotone" dataKey="sueldos" stroke="#3B82F6" strokeWidth={3} name="Sueldos" dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }} />
                            <Line type="monotone" dataKey="insumos" stroke="#10B981" strokeWidth={3} name="Insumos" dot={{ fill: '#10B981', strokeWidth: 2, r: 6 }} />
                            <Line type="monotone" dataKey="ventas" stroke="#F59E0B" strokeWidth={3} name="Ventas" dot={{ fill: '#F59E0B', strokeWidth: 2, r: 6 }} />
                            <Line type="monotone" dataKey="produccion" stroke="#8B5CF6" strokeWidth={3} name="Producción" dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 6 }} />
                            <Line type="monotone" dataKey="costos" stroke="#EF4444" strokeWidth={3} name="Costos" dot={{ fill: '#EF4444', strokeWidth: 2, r: 6 }} />
                          </>
                        ) : (
                          <Line 
                            type="monotone" 
                            dataKey={selectedCategory} 
                            stroke={categoryColors[selectedCategory as keyof typeof categoryColors]?.primary || '#3B82F6'}
                            strokeWidth={4}
                            dot={{ fill: categoryColors[selectedCategory as keyof typeof categoryColors]?.primary || '#3B82F6', strokeWidth: 2, r: 8 }}
                            activeDot={{ r: 10, stroke: categoryColors[selectedCategory as keyof typeof categoryColors]?.primary || '#3B82F6', strokeWidth: 2 }}
                          />
                        )}
                      </LineChart>
                    ) : chartType === 'area' ? (
                      <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="monthFormatted" 
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 12 }}
                          stroke="#666"
                        />
                        <YAxis 
                          tickFormatter={(value) => formatCurrency(value)}
                          tick={{ fontSize: 12 }}
                          stroke="#666"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        {selectedCategory === 'all' ? (
                          <>
                            <Area type="monotone" dataKey="sueldos" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.7} name="Sueldos" />
                            <Area type="monotone" dataKey="insumos" stackId="2" stroke="#10B981" fill="#10B981" fillOpacity={0.7} name="Insumos" />
                            <Area type="monotone" dataKey="ventas" stackId="3" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.7} name="Ventas" />
                            <Area type="monotone" dataKey="produccion" stackId="4" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.7} name="Producción" />
                            <Area type="monotone" dataKey="costos" stackId="5" stroke="#EF4444" fill="#EF4444" fillOpacity={0.7} name="Costos" />
                          </>
                        ) : (
                          <Area
                            type="monotone"
                            dataKey={selectedCategory}
                            stroke={categoryColors[selectedCategory as keyof typeof categoryColors]?.primary || '#3B82F6'}
                            fill={categoryColors[selectedCategory as keyof typeof categoryColors]?.primary || '#3B82F6'}
                            fillOpacity={0.3}
                            strokeWidth={3}
                          />
                        )}
                      </AreaChart>
                    ) : chartType === 'pie' ? (
                      <PieChart>
                        <Pie
                          data={Object.entries(stats.categoryStats).map(([key, value]) => ({
                            name: key.charAt(0).toUpperCase() + key.slice(1),
                            value: value.total,
                            color: categoryColors[key as keyof typeof categoryColors]?.primary || '#3B82F6'
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={150}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.entries(stats.categoryStats).map(([key], index) => (
                            <Cell key={`cell-${index}`} fill={categoryColors[key as keyof typeof categoryColors]?.primary || '#3B82F6'} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [formatCurrency(value), 'Total']} />
                      </PieChart>
                    ) : (
                      <RadarChart data={Object.entries(stats.categoryStats).map(([key, value]) => ({
                        category: key.charAt(0).toUpperCase() + key.slice(1),
                        total: value.total,
                        average: value.avg,
                        change: Math.abs(value.change)
                      }))}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="category" />
                        <PolarRadiusAxis />
                        <Radar name="Total" dataKey="total" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                        <Radar name="Promedio" dataKey="average" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                        <Tooltip formatter={(value: any) => [formatCurrency(value), 'Valor']} />
                      </RadarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Panel de Análisis Lateral */}
          <div className="space-y-6">
            {/* Resumen Ejecutivo */}
            <Card className="border-0 shadow-xl">
              <CardHeader className="bg-[#333333] text-white">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Resumen Ejecutivo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-success-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-success rounded-full"></div>
                      <span className="font-medium text-[#333333]">Tendencia General</span>
                    </div>
                    <Badge variant="default" className="bg-success-muted text-success">
                      {stats?.totalChange >= 0 ? 'Positiva' : 'Negativa'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#666666]">Período analizado</span>
                      <span className="font-semibold text-[#333333]">{stats?.monthsAnalyzed} meses</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#666666]">Valor inicial</span>
                      <span className="font-semibold text-[#333333]">{formatCurrency(stats?.firstTotal || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#666666]">Valor final</span>
                      <span className="font-semibold text-[#333333]">{formatCurrency(stats?.lastTotal || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#666666]">Volatilidad</span>
                      <span className="font-semibold text-[#333333]">{formatCurrency(stats?.volatility || 0)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Categorías */}
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#333333]">
                  <Star className="h-5 w-5 text-warning" />
                  Top Categorías
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {Object.entries(stats?.categoryStats || {})
                    .sort(([,a], [,b]) => b.total - a.total)
                    .slice(0, 3)
                    .map(([category, data], index) => (
                    <div key={category} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm',
                          index === 0 ? 'bg-warning' : index === 1 ? 'bg-muted-foreground' : 'bg-warning-muted-foreground'
                        )}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium capitalize text-[#333333]">{category}</p>
                          <p className="text-sm text-[#666666]">{formatCurrency(data.avg)}/mes</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-[#333333]">{formatCurrency(data.total)}</p>
                        <p className={cn('text-sm', data.change >= 0 ? 'text-success' : 'text-destructive')}>
                          {data.change >= 0 ? '+' : ''}{formatCurrency(data.change)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Análisis Detallado por Categoría */}
        {stats && (
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-muted to-muted border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-[#333333] flex items-center gap-2">
                  <Layers className="h-6 w-6 text-info-muted-foreground" />
                  Análisis Detallado por Categoría
                </CardTitle>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtrar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(stats.categoryStats).map(([category, categoryStat]) => (
                  <Card key={category} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn('p-3 rounded-xl', categoryColors[category as keyof typeof categoryColors]?.secondary || 'bg-muted')}>
                            {getCategoryIcon(category)}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg capitalize text-[#333333]">{category}</h3>
                            <p className="text-sm text-[#666666]">Análisis completo</p>
                          </div>
                        </div>
                        <Badge 
                          variant={categoryStat.change >= 0 ? 'default' : 'destructive'} 
                          className="text-xs"
                        >
                          {categoryStat.change >= 0 ? '↗' : '↘'} {formatNumber(Math.abs(categoryStat.change / categoryStat.avg * 100), 1)}%
                        </Badge>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-xs text-[#666666] mb-1">Total</p>
                            <p className="font-bold text-lg text-[#333333]">
                              {formatCurrency(categoryStat.total)}
                            </p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-xs text-[#666666] mb-1">Promedio</p>
                            <p className="font-bold text-lg text-[#333333]">
                              {formatCurrency(categoryStat.avg)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-gradient-to-r from-info-muted to-info-muted rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-[#333333]">Cambio en el período</span>
                            <span className={cn('font-bold text-lg', categoryStat.change >= 0 ? 'text-success' : 'text-destructive')}>
                              {categoryStat.change >= 0 ? '+' : ''}{formatCurrency(categoryStat.change)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 bg-background rounded-full h-2 overflow-hidden">
                              <div 
                                className={cn('h-full transition-all duration-1000', categoryStat.change >= 0 ? 'bg-success' : 'bg-destructive')}
                                style={{ 
                                  width: `${Math.min(Math.abs(categoryStat.change / categoryStat.avg * 100), 100)}%` 
                                }}
                              ></div>
                            </div>
                            <span className="text-xs text-[#666666]">
                              {formatNumber(Math.abs(categoryStat.change / categoryStat.avg * 100), 1)}%
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#666666]">Rendimiento</span>
                          <div className="flex items-center gap-1">
                            {categoryStat.change >= 0 ? (
                              <>
                                <TrendingUp className="h-4 w-4 text-success" />
                                <span className="text-success font-medium">Positivo</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="h-4 w-4 text-destructive" />
                                <span className="text-destructive font-medium">Negativo</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer con información adicional */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-muted to-muted">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-[#666666]">
                  <Shield className="h-4 w-4" />
                  <span>Datos seguros y encriptados</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#666666]">
                  <Clock className="h-4 w-4" />
                  <span>Actualizado en tiempo real</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Ayuda
                </Button>
                <Button variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
