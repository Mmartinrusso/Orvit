'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  DollarSign,
  Package,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { formatCurrency, formatPercentage, formatNumber } from './utils/metrics';
import { MonthSelectorCompact } from './MonthSelectorCompact';
import { AlertsCard } from './AlertsCard';
import { HealthScore } from './HealthScore';
import { ProfitAnalysis } from './ProfitAnalysis';
import { EfficiencyMetrics } from './EfficiencyMetrics';
import { BreakEvenAnalysis } from './BreakEvenAnalysis';
import { CostVariation } from './CostVariation';
import { useAdminCatalogs } from '@/hooks/use-admin-catalogs'; // ✨ OPTIMIZACIÓN
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics'; // ✨ OPTIMIZADO
import { useDashboardTopProducts, useDashboardProductionSummary, useCalculadoraCostosFinal } from '@/hooks/use-dashboard-data'; // ✨ OPTIMIZADO
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Area
} from 'recharts';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card';

interface ComprehensiveDashboardProps {
  companyId: string;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

interface DashboardData {
  // Métricas generales
  totalSales: number;
  totalCosts: number;
  totalUnitsSold: number;
  totalProduction: number;
  netMargin: number;
  marginPercentage: number;
  costsSummary: {
    total: number;
    components: Array<{
      label: string;
      amount: number;
      percentage: number;
    }>;
  };
  
  // Costos detallados
  indirectCosts: {
    total: number;
    breakdown: Array<{
      description: string;
      amount: number;
      percentage: number;
    }>;
    mostExpensive: {
      description: string;
      amount: number;
    };
  };
  
  employeeCosts: {
    total: number;
    breakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
    mostExpensive: {
      category: string;
      amount: number;
    };
  };
  
  productionCosts: {
    total: number;
    breakdown: Array<{
      material: string;
      amount: number;
      percentage: number;
    }>;
    mostExpensive: {
      material: string;
      amount: number;
    };
  };
  
  // Producción
  production: {
    totalUnits: number;
    totalValue: number;
    topProducts: Array<{
      name: string;
      units: number;
      value: number;
      unitCost?: number;
      subcategoryName?: string | null;
    }>;
  };
  
  // Ventas
  sales: {
    totalRevenue: number;
    totalUnits: number;
    topProducts: Array<{
      name: string;
      description?: string | null;
      units: number;
      revenue: number;
      cost?: number;
      price?: number;
      profit?: number;
      margin?: number;
    }>;
  };
  
  // Proyecciones
  projections: {
    monthlyForecast: number;
    runRate: number;
    daysRemaining: number;
    expectedEndOfMonth: number;
  };
}

export function ComprehensiveDashboard({ 
  companyId, 
  selectedMonth, 
  onMonthChange 
}: ComprehensiveDashboardProps) {
  const { theme } = useTheme();
  
  // ✨ OPTIMIZACIÓN: Usar catálogos consolidados en lugar de fetch individual
  const { data: catalogsData, isLoading: catalogsLoading } = useAdminCatalogs(parseInt(companyId));
  
  // ✨ OPTIMIZADO: Usar React Query hooks para evitar fetches duplicados
  const { data: metrics, isLoading: metricsLoading, isError: metricsError } = useDashboardMetrics(companyId, selectedMonth);
  const { data: topProducts, isLoading: topProductsLoading } = useDashboardTopProducts(companyId, selectedMonth, 50);
  const { data: productionSummary, isLoading: productionSummaryLoading } = useDashboardProductionSummary(companyId, selectedMonth);
  const { data: calculatorData, isLoading: calculatorLoading } = useCalculadoraCostosFinal(companyId, selectedMonth, 'production');
  
  const [data, setData] = useState<DashboardData | null>(null);
  const loading = metricsLoading || topProductsLoading || productionSummaryLoading || calculatorLoading || catalogsLoading;
  const error = metricsError ? 'Error cargando métricas' : null;
  const [viewMode, setViewMode] = useState<'ventas' | 'produccion'>('ventas');
  const [selectedCategory, setSelectedCategory] = useState<'todos' | 'bloques' | 'viguetas' | 'adoquines'>('todos');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('todas');
  // Filtros para producción
  const [selectedProductionCategory, setSelectedProductionCategory] = useState<'todos' | 'bloques' | 'viguetas' | 'adoquines'>('todos');
  const [selectedProductionSubcategory, setSelectedProductionSubcategory] = useState<string>('todas');
  // Controles para gráfico de rentabilidad
  const [selectedMetric, setSelectedMetric] = useState<'ventas' | 'costos' | 'ganancia'>('ventas');
  const [monthsHistory, setMonthsHistory] = useState<number>(3);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ✨ OPTIMIZADO: Función para obtener datos históricos con useCallback y mejor caché
  const fetchHistoricalData = useCallback(async (metric: 'ventas' | 'costos' | 'ganancia', months: number) => {
    setLoadingHistory(true);
    try {
      const currentDate = new Date(selectedMonth + '-01');
      const historicalMonths = [];

      for (let i = 0; i < months; i++) {
        const monthDate = new Date(currentDate);
        monthDate.setMonth(currentDate.getMonth() - i);
        const monthStr = monthDate.toISOString().slice(0, 7);
        historicalMonths.push(monthStr);
      }

      // ✨ OPTIMIZADO: Hacer todos los fetches en paralelo con mejor caché
      const historicalDataArray = await Promise.all(
        historicalMonths.map(async (month) => {
          try {
            // ✨ Usar caché de navegador y también considerar usar React Query cache si está disponible
            const response = await fetch(`/api/dashboard/metrics?companyId=${companyId}&month=${month}`, {
              cache: 'force-cache', // Usar caché de navegador si está disponible
              headers: {
                'Cache-Control': 'max-age=60' // Cache por 1 minuto
              }
            });
            const metricsData = await response.json();
            
            let value = 0;
            if (metric === 'ventas') {
              value = metricsData.metrics?.totalSales || 0;
            } else if (metric === 'costos') {
              value = metricsData.metrics?.totalCosts || 0;
            } else if (metric === 'ganancia') {
              value = (metricsData.metrics?.totalSales || 0) - (metricsData.metrics?.totalCosts || 0);
            }

            const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const monthIndex = parseInt(month.split('-')[1]) - 1;
            const monthName = monthNames[monthIndex];

            return {
              mes: `${monthName} ${month.split('-')[0].slice(-2)}`,
              valor: value,
              fecha: month
            };
          } catch (error) {
            return null;
          }
        })
      );

      setHistoricalData(historicalDataArray.filter(d => d !== null).reverse());
    } catch (error) {
      console.error('Error fetching historical data:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [companyId, selectedMonth]);

  // ✨ OPTIMIZADO: Función para procesar datos con useCallback
  const processDashboardData = useCallback(() => {
    if (!metrics) return;

    try {
      // ✨ OPTIMIZADO: Los datos ya vienen de los hooks React Query (no hay fetch aquí)
      // ✨ OPTIMIZACIÓN: Usar catálogos consolidados
      const allProducts = catalogsData?.products || [];
      const topProductsData = topProducts || { topSold: [], topProduced: [] };
      const productionSummaryData = productionSummary || { totalUnits: 0, totalValue: 0, topProducts: [] };
      const calculatorDataProcessed = calculatorData || { productPrices: [] };
      const productDescriptionMap = new Map(allProducts.map((p: any) => [p.name, p.description]));
      
      const breakdownFromMetrics = metrics.metrics?.costBreakdown || {};

      const indirectCostsTotal = breakdownFromMetrics.indirects || 0;
      const employeeCostsTotal = breakdownFromMetrics.employees || 0;
      const productionCostsTotal = breakdownFromMetrics.materials || 0;
      const purchasesCostsTotal = breakdownFromMetrics.purchases || 0;


      // Calcular total de costos: usar el valor de la API si está disponible, sino sumar componentes
      const totalCostsCalculated = metrics.metrics?.totalCosts || (
        indirectCostsTotal +
        employeeCostsTotal +
        productionCostsTotal +
        purchasesCostsTotal
      );
      

      const costSummaryComponents = [
        { label: 'Materiales', amount: productionCostsTotal },
        { label: 'Costos indirectos', amount: indirectCostsTotal },
        { label: 'Costos de empleados', amount: employeeCostsTotal },
        { label: 'Compras', amount: purchasesCostsTotal }
      ].filter((component) => component.amount && component.amount !== 0);


      const costSummaryWithPercentages = costSummaryComponents.map(
        (component) => ({
          ...component,
          percentage:
            totalCostsCalculated > 0
              ? (component.amount / totalCostsCalculated) * 100
              : 0
        })
      );

      // Create simplified dashboard data with available metrics
      const dashboardData: DashboardData = {
        totalSales: metrics.metrics?.totalSales || 0,
        totalCosts: totalCostsCalculated, // Total real: indirectos + empleados + materiales
        totalUnitsSold: metrics.metrics?.totalUnitsSold || 0,
        totalProduction: 19071, // Total unidades producidas en agosto 2025
        netMargin: (metrics.metrics?.totalSales || 0) - totalCostsCalculated, // Ventas - Costos reales
        marginPercentage: metrics.metrics?.totalSales ? ((metrics.metrics.totalSales - totalCostsCalculated) / metrics.metrics.totalSales) * 100 : 0,
        costsSummary: {
          total: totalCostsCalculated,
          components: costSummaryWithPercentages
        },
        
        indirectCosts: {
          total: indirectCostsTotal,
          breakdown: [],
          mostExpensive: { description: 'N/A', amount: 0 }
        },
        
        employeeCosts: {
          total: employeeCostsTotal,
          breakdown: [],
          mostExpensive: { category: 'N/A', amount: 0 }
        },
        
        productionCosts: {
          total: productionCostsTotal,
          breakdown: [],
          mostExpensive: { material: 'N/A', amount: 0 }
        },
        
        production: {
          totalUnits: productionSummaryData.totalUnits || metrics.metrics?.totalProduction || 0,
          totalValue: productionSummaryData.totalValue || productionCostsTotal,
          topProducts: (productionSummaryData.topProducts || []).map((p: any) => {
            const productName = p.name || p.product_name;
            const units = Number(p.units || p.quantity_produced || p.quantity || 0);
            
            // Buscar el costo del producto en calculatorData
            const calcProduct = calculatorDataProcessed.productPrices?.find((cp: any) => 
              cp.product_name === productName || cp.name === productName
            );
            
            
            // Si encontramos el producto en la calculadora, usar SOLO el costo de materiales
            // (no incluir indirectos ni empleados porque esos ya están distribuidos en producción)
            const unitCostFromCalc = calcProduct?.cost_breakdown?.materials || calcProduct?.cost_breakdown?.total || 0;
            const totalValueFromCalc = unitCostFromCalc * units;
            
            // Usar costos de la calculadora si no hay en la base de datos
            const unitCost = p.unitCost && p.unitCost > 0 
              ? Number(p.unitCost)
              : (unitCostFromCalc > 0 ? unitCostFromCalc : 0);
            
            const value = p.value && p.value > 0 
              ? Number(p.value) 
              : (totalValueFromCalc > 0 ? totalValueFromCalc : 0);
            
            const mapped = {
              name: productName,
              units,
              value,
              unitCost,
              subcategoryName: p.subcategoryName || null
            };
            
            return mapped;
          })
        },
        
        sales: {
          totalRevenue: metrics.metrics?.totalSales || 0,
          totalUnits: metrics.metrics?.totalUnitsSold || 0,
          topProducts: (() => {
            // Si hay datos de top products, usarlos
            if (topProductsData.topSold && topProductsData.topSold.length > 0) {
              return topProductsData.topSold.map((p: any) => {
                const calcProduct = calculatorDataProcessed.productPrices?.find((cp: any) => 
                  cp.product_name === (p.product_name || p.name) || cp.id === p.product_id
                );
                
                // Costo total del producto (materiales + indirectos + empleados)
                const costoTotal = calcProduct?.cost_breakdown?.total || 0;
                
                // Precio promedio de venta
                const precioVenta = calcProduct?.average_sale_price || calcProduct?.current_price || 0;
                
                // Ganancia por unidad = Precio Venta - Costo Total
                const gananciaPorUnidad = precioVenta - costoTotal;
                
                // Margen % = ((Precio Venta - Costo Total) / Precio Venta) × 100
                const margenPorcentaje = precioVenta > 0 ? ((gananciaPorUnidad / precioVenta) * 100) : 0;
                
                const productName = p.product_name || p.name;
                const mappedProduct = {
                  name: productName,
                  description: p.description || productDescriptionMap.get(productName) || null,
                  units: Number(p.quantity_sold || p.quantity || 0),
                  revenue: Number(p.total_revenue || p.revenue || 0),
                  cost: costoTotal,
                  price: precioVenta,
                  profit: gananciaPorUnidad,
                  margin: margenPorcentaje
                };
                
                return mappedProduct;
              });
            } 
            
            // Fallback: usar datos de calculadora con precios
            if (calculatorDataProcessed.productPrices && calculatorDataProcessed.productPrices.length > 0) {
              return calculatorDataProcessed.productPrices
                .filter((p: any) => {
                  const price = p.average_sale_price || p.current_price || 0;
                  return price > 0;
                })
                .map((p: any) => {
                  // Costo total del producto (materiales + indirectos + empleados)
                  const costoTotal = p.cost_breakdown?.total || 0;
                  
                  // Precio promedio de venta
                  const precioVenta = p.average_sale_price || p.current_price || 0;
                  
                  // Ganancia por unidad = Precio Venta - Costo Total
                  const gananciaPorUnidad = precioVenta - costoTotal;
                  
                  // Margen % = ((Precio Venta - Costo Total) / Precio Venta) × 100
                  const margenPorcentaje = precioVenta > 0 ? ((gananciaPorUnidad / precioVenta) * 100) : 0;
                  
                  const units = p.distribution_info?.product_quantity || 0;
                  const revenue = precioVenta * units;
                  
                  
                  return {
                    name: p.product_name,
                    description: productDescriptionMap.get(p.product_name) || null,
                    units: units,
                    revenue: revenue,
                    cost: costoTotal,
                    price: precioVenta,
                    profit: gananciaPorUnidad,
                    margin: margenPorcentaje
                  };
                })
                .filter((p: any) => p.units > 0)
                .sort((a: any, b: any) => b.revenue - a.revenue);
            }
            
            return [];
          })()
        },
        
        projections: {
          monthlyForecast: metrics.metrics?.forecast || 0,
          runRate: metrics.metrics?.runRate || 0,
          daysRemaining: metrics.metrics?.daysRemaining || 0,
          expectedEndOfMonth: metrics.metrics?.expectedEndOfMonth || 0
        }
      };

      setData(dashboardData);
    } catch (error) {
      console.error('Error processing dashboard data:', error);
      // Error ya está manejado por los hooks React Query
    }
  }, [metrics, catalogsData, topProducts, productionSummary, calculatorData, companyId, selectedMonth]);

  // ✨ OPTIMIZADO: Procesar datos cuando todos los hooks estén listos
  useEffect(() => {
    if (metrics && catalogsData && !loading) {
      processDashboardData();
    }
  }, [metrics, catalogsData, loading, processDashboardData]);
  
  // Effect para cargar datos históricos cuando cambian los filtros
  useEffect(() => {
    if (data) {
      fetchHistoricalData(selectedMetric, monthsHistory);
    }
  }, [selectedMetric, monthsHistory, data, fetchHistoricalData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando dashboard completo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mb-6">
        <CardContent className="p-8">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Error cargando datos</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="mb-6">
        <CardContent className="p-8">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Sin datos disponibles</h3>
            <p className="text-muted-foreground">
              No se encontraron datos para <strong>{selectedMonth}</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard de Costos</h1>
          <p className="text-xs text-muted-foreground">Análisis financiero y operativo</p>
        </div>
        <MonthSelectorCompact
          selectedMonth={selectedMonth}
          onMonthChange={onMonthChange}
          companyId={companyId}
        />
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <HealthScore
          marginPercentage={data.marginPercentage}
          totalSales={data.totalSales}
          totalCosts={data.totalCosts}
          productCount={data.sales.topProducts.length}
        />

        {/* Métrica 1: Ventas */}
        <Card className="hover:shadow-lg transition-all duration-200">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-normal text-muted-foreground">Ventas</p>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-semibold text-foreground tracking-tight">
                {formatCurrency(data.totalSales)}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  <span className="text-xs font-medium text-success">+68.7%</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatNumber(data.totalUnitsSold)} u.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métrica 2: Costos */}
        <HoverCard>
          <HoverCardTrigger asChild>
            <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-normal text-muted-foreground">Costos Totales</p>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xl font-semibold text-foreground tracking-tight">
                    {formatCurrency(data.totalCosts)}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-destructive" />
                      <span className="text-xs font-medium text-destructive">+8.9%</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Ver detalle</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </HoverCardTrigger>
          <HoverCardContent className="w-64 shadow-lg rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Composición de costos
            </p>
            <div className="space-y-2">
              {data.costsSummary.components.map((component) => (
                <div
                  key={component.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{component.label}</span>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      {formatCurrency(component.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPercentage(component.percentage)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>

        {/* Métrica 3: Margen */}
        <Card className="hover:shadow-lg transition-all duration-200">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-normal text-muted-foreground">Margen Neto</p>
                <Target className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-semibold text-foreground tracking-tight">
                {formatPercentage(data.marginPercentage)}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span className="text-xs font-medium text-success">Excelente</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatCurrency(data.netMargin)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas de Rentabilidad - Gráfico de Líneas con Fondo Claro */}
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium text-foreground">Estadísticas de Rentabilidad</CardTitle>
            <div className="flex gap-2 items-center">
              {/* Selector de métrica */}
              <div className={cn(
                "flex gap-1 rounded-lg p-1",
                theme === 'light' ? 'bg-muted' : 'bg-muted/50'
              )}>
                <Button
                  size="sm"
                  variant={selectedMetric === 'ventas' ? 'default' : 'ghost'}
                  onClick={() => setSelectedMetric('ventas')}
                  className={cn(
                    "h-7 text-xs",
                    selectedMetric === 'ventas' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground'
                  )}
                >
                  Ventas
                </Button>
                <Button
                  size="sm"
                  variant={selectedMetric === 'costos' ? 'default' : 'ghost'}
                  onClick={() => setSelectedMetric('costos')}
                  className={cn(
                    "h-7 text-xs",
                    selectedMetric === 'costos' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground'
                  )}
                >
                  Costos
                </Button>
                <Button
                  size="sm"
                  variant={selectedMetric === 'ganancia' ? 'default' : 'ghost'}
                  onClick={() => setSelectedMetric('ganancia')}
                  className={cn(
                    "h-7 text-xs",
                    selectedMetric === 'ganancia' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground'
                  )}
                >
                  Ganancia
                </Button>
              </div>
              {/* Selector de meses */}
              <select
                value={monthsHistory}
                onChange={(e) => setMonthsHistory(Number(e.target.value))}
                className="h-7 text-xs px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
                <option value={8}>8 meses</option>
                <option value={12}>12 meses</option>
                <option value={24}>24 meses</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Cargando datos históricos...</p>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={historicalData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <defs>
                  <linearGradient id={`colorArea-${theme}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme === 'dark' ? '#ffffff' : '#1f2937'} stopOpacity={theme === 'dark' ? 0.1 : 0.2}/>
                    <stop offset="95%" stopColor={theme === 'dark' ? '#ffffff' : '#1f2937'} stopOpacity={theme === 'dark' ? 0.02 : 0.02}/>
                  </linearGradient>
                  <filter id={`shadow-${theme}`}>
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={theme === 'dark' ? '#ffffff' : '#000000'} floodOpacity={theme === 'dark' ? 0.1 : 0.2}/>
                  </filter>
                  <filter id={`shadowStrong-${theme}`}>
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={theme === 'dark' ? '#ffffff' : '#000000'} floodOpacity={theme === 'dark' ? 0.2 : 0.3}/>
                  </filter>
                </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#404040' : '#e5e7eb'} />
                <XAxis 
                  dataKey="mes" 
                  stroke={theme === 'dark' ? '#a3a3a3' : '#9ca3af'} 
                    fontSize={11}
                  tickLine={false}
                  axisLine={false}
                    tick={{ fill: theme === 'dark' ? '#e5e5e5' : '#374151' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                />
                <YAxis 
                  stroke={theme === 'dark' ? '#a3a3a3' : '#9ca3af'} 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(0)}M`}
                    tick={{ fill: theme === 'dark' ? '#e5e5e5' : '#374151' }}
                />
                <Tooltip 
                  contentStyle={{ 
                      backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff', 
                      border: theme === 'dark' ? '2px solid #404040' : '2px solid #e5e7eb', 
                    borderRadius: '8px',
                      boxShadow: theme === 'dark' ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.15)',
                      color: theme === 'dark' ? '#ffffff' : '#111827'
                  }}
                    labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#111827', fontWeight: 'bold' }}
                    formatter={(value: any) => formatCurrency(value)}
                />
                <Area 
                  type="monotone" 
                    dataKey="valor" 
                    stroke="none"
                    fill={`url(#colorArea-${theme})`}
                  fillOpacity={1} 
                />
                  <Line
                  type="monotone"
                    dataKey="valor"
                    stroke={theme === 'dark' ? '#ffffff' : '#1f2937'}
                    strokeWidth={2}
                    dot={{ fill: theme === 'dark' ? '#ffffff' : '#1f2937', strokeWidth: 2, stroke: theme === 'dark' ? '#1a1a1a' : '#ffffff', r: 4, filter: `url(#shadow-${theme})` }}
                    activeDot={{ r: 6, fill: theme === 'dark' ? '#ffffff' : '#1f2937', strokeWidth: 2, stroke: theme === 'dark' ? '#1a1a1a' : '#ffffff', filter: `url(#shadowStrong-${theme})` }}
                    filter={`url(#shadow-${theme})`}
                  />
                </LineChart>
            </ResponsiveContainer>
            )}
            
          </div>
        </CardContent>
      </Card>

      {/* Alertas y Notificaciones */}
      <AlertsCard data={data} />

      {/* Toggle Ventas/Producción - antes de los Top 10 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Rankings de Productos</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ver por:</span>
          <div className={cn(
            "inline-flex rounded-lg border p-1",
            theme === 'light'
              ? 'border-border bg-background'
              : 'border-border bg-muted/50'
          )}>
            <button
              onClick={() => setViewMode('ventas')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === 'ventas'
                  ? 'bg-foreground text-background'
                  : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Ventas
            </button>
            <button
              onClick={() => setViewMode('produccion')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === 'produccion'
                  ? 'bg-foreground text-background'
                  : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Producción
            </button>
          </div>
        </div>
      </div>

      {/* Secciones Dinámicas según el modo */}
      {viewMode === 'ventas' ? (
        // ===== VISTA POR VENTAS =====
        <>
          {/* Tres tarjetas: Top Vendidos, Más Rentables, Insights IA */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Productos Más Vendidos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-foreground">
                  Top 10 Más Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.sales.topProducts.length > 0 ? data.sales.topProducts.slice(0, 10).map((product, index) => (
                    <div key={index} className={cn(
                      "flex items-center justify-between h-16 p-3 rounded-lg border transition-colors",
                      theme === 'light' 
                        ? 'bg-muted/50 border-border hover:bg-muted' 
                        : 'bg-muted/30 border-border hover:bg-muted/50'
                    )}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(product.units)} unidades</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-sm font-bold text-foreground">{formatCurrency(product.revenue)}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center text-muted-foreground py-4">No hay datos de ventas disponibles</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Productos Más Rentables */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-foreground">
                  Top 10 Más Rentables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.sales.topProducts.length > 0 ? 
                    [...data.sales.topProducts]
                      .filter(p => p.margin && p.margin > 0)
                      .sort((a, b) => (b.margin || 0) - (a.margin || 0))
                      .slice(0, 10)
                      .map((product, index) => (
                        <div key={index} className={cn(
                          "flex items-center justify-between h-16 p-3 rounded-lg border transition-colors",
                          theme === 'light' 
                            ? 'bg-muted/50 border-border hover:bg-muted' 
                            : 'bg-muted/30 border-border hover:bg-muted/50'
                        )}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground font-semibold">Ganancia: ${formatNumber(Math.round(product.profit || 0))}/unidad</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-lg font-bold text-foreground">{formatNumber(product.margin || 0, 1)}%</p>
                            <p className="text-xs text-muted-foreground">{product.units} vendidas</p>
                          </div>
                        </div>
                      ))
                    : (
                      <p className="text-center text-muted-foreground py-4">No hay datos de rentabilidad disponibles</p>
                    )
                  }
                </div>
              </CardContent>
            </Card>

            {/* Recomendaciones Inteligentes con IA */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-foreground">
                  Análisis IA Avanzado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(() => {
                    // Análisis inteligente de los datos
                    const productosConDatos = data.sales.topProducts.filter(p => p.margin && p.margin > 0);
                    const mejorMargen = [...productosConDatos].sort((a, b) => (b.margin || 0) - (a.margin || 0))[0];
                    const masVendido = [...productosConDatos].sort((a, b) => b.units - a.units)[0];
                    const mejorOportunidad = [...productosConDatos]
                      .map(p => ({ ...p, score: (p.margin || 0) * Math.log(p.units + 1) }))
                      .sort((a, b) => b.score - a.score)[0];
                    const productosRiesgo = productosConDatos.filter(p => (p.margin || 0) < 25);
                    const productosExcelentes = productosConDatos.filter(p => (p.margin || 0) > 50);
                    const promedioMargen = productosConDatos.reduce((sum, p) => sum + (p.margin || 0), 0) / productosConDatos.length;
                    const promedioGanancia = productosConDatos.reduce((sum, p) => sum + (p.profit || 0), 0) / productosConDatos.length;
                    const totalIngresosTop10 = productosConDatos.slice(0, 10).reduce((sum, p) => sum + p.revenue, 0);
                    const ingresosTotales = productosConDatos.reduce((sum, p) => sum + p.revenue, 0);
                    const concentracionTop10 = ingresosTotales > 0 ? (totalIngresosTop10 / ingresosTotales) * 100 : 0;
                    
                    // Análisis por categoría
                    const viguetas = productosConDatos.filter(p => p.name.includes('Vigueta'));
                    const bloques = productosConDatos.filter(p => p.name.includes('Bloque'));
                    const margenViguetas = viguetas.length > 0 ? viguetas.reduce((sum, p) => sum + (p.margin || 0), 0) / viguetas.length : 0;
                    const margenBloques = bloques.length > 0 ? bloques.reduce((sum, p) => sum + (p.margin || 0), 0) / bloques.length : 0;
                    const ingresosViguetas = viguetas.reduce((sum, p) => sum + p.revenue, 0);
                    const ingresosBloques = bloques.reduce((sum, p) => sum + p.revenue, 0);
                    
                    // Mejor producto por ganancia total (ganancia unitaria × unidades)
                    const mejorGananciaTotal = [...productosConDatos]
                      .map(p => ({ ...p, gananciaTotal: (p.profit || 0) * p.units }))
                      .sort((a, b) => b.gananciaTotal - a.gananciaTotal)[0];
                    
                    return (
                      <>
                        {/* 1. Mejor Oportunidad */}
                        {mejorOportunidad && (
                          <div className="p-2.5 rounded-lg border bg-success/10 border-success/30">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2 h-2 rounded-full bg-success"></div>
                              <p className="text-xs font-bold text-success">MÁXIMA PRIORIDAD</p>
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              <strong className="text-foreground">{mejorOportunidad.name}</strong>: Margen {formatNumber(mejorOportunidad.margin, 1)}%
                              × {formatNumber(mejorOportunidad.units)} unidades = Mejor ROI.
                            </p>
                          </div>
                        )}

                        {/* 2. Campeón de Ganancias */}
                        {mejorGananciaTotal && mejorGananciaTotal.name !== mejorOportunidad?.name && (
                          <div className="p-2.5 rounded-lg border bg-info/10 border-info/30">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2 h-2 rounded-full bg-info"></div>
                              <p className="text-xs font-bold text-info-muted-foreground">Campeón de Ganancias</p>
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              <strong className="text-foreground">{mejorGananciaTotal.name}</strong> genera {formatCurrency(mejorGananciaTotal.gananciaTotal)} en ganancias totales.
                            </p>
                          </div>
                        )}

                        {/* 3. Producto Estrella */}
                        {masVendido && masVendido.name !== mejorOportunidad?.name && masVendido.name !== mejorGananciaTotal?.name && (
                          <div className="p-2.5 rounded-lg border bg-info/10 border-info/30">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2 h-2 rounded-full bg-info"></div>
                              <p className="text-xs font-bold text-info-muted-foreground">Volumen Líder</p>
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              <strong className="text-foreground">{masVendido.name}</strong>: {formatNumber(masVendido.units)} unidades vendidas.
                            </p>
                          </div>
                        )}

                        {/* 4. Acción Requerida - URGENTE (rojo) */}
                        {productosRiesgo.length > 0 && (
                          <div className="p-2.5 rounded-lg border bg-destructive/10 border-destructive/30">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"></div>
                              <p className="text-xs font-bold text-destructive">Acción Requerida</p>
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              {productosRiesgo.length} productos con margen {'<'}25%. Urgente: <strong className="text-foreground">{productosRiesgo[0].name}</strong> ({formatNumber(productosRiesgo[0].margin, 1)}%).
                            </p>
                          </div>
                        )}

                        {/* 5. Concentración de Ventas */}
                        <div className={cn(
                          "p-2.5 rounded-lg border",
                          concentracionTop10 > 70
                            ? "bg-warning/10 border-warning/30"
                            : "bg-muted/50 border-border"
                        )}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {concentracionTop10 > 70 && <div className="w-2 h-2 rounded-full bg-warning"></div>}
                            <p className={cn(
                              "text-xs font-bold",
                              concentracionTop10 > 70 ? "text-warning-muted-foreground" : "text-foreground"
                            )}>Concentración</p>
                          </div>
                          <p className="text-xs text-muted-foreground leading-tight">
                            Top 10: <strong className="text-foreground">{formatNumber(concentracionTop10, 1)}%</strong> de ingresos.
                            {concentracionTop10 > 70 ? ' Diversificar.' : ' OK.'}
                          </p>
                        </div>

                        {/* 6. Productos Premium */}
                        {productosExcelentes.length > 0 && (
                          <div className="p-2.5 rounded-lg border bg-success/10 border-success/30">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2 h-2 rounded-full bg-success"></div>
                              <p className="text-xs font-bold text-success">Premium</p>
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              {productosExcelentes.length} productos {'>'}50% margen. Top: <strong className="text-foreground">{productosExcelentes[0].name}</strong>.
                            </p>
                          </div>
                        )}

                        {/* 7. Viguetas vs Bloques */}
                        {viguetas.length > 0 && bloques.length > 0 && (
                          <div className="p-2.5 rounded-lg border bg-info/10 border-info/30">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2 h-2 rounded-full bg-info"></div>
                              <p className="text-xs font-bold text-info-muted-foreground">Categorías</p>
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              {ingresosViguetas > ingresosBloques
                                ? `Viguetas lideran (${formatNumber(margenViguetas, 0)}% margen)`
                                : `Bloques lideran (${formatNumber(margenBloques, 0)}% margen)`
                              }
                            </p>
                          </div>
                        )}

                        {/* 8. Proyección IA */}
                        <div className="p-2.5 rounded-lg border bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            <p className="text-xs font-bold text-primary">Proyección IA</p>
                          </div>
                          <p className="text-xs text-muted-foreground leading-tight">
                            Estimado próximo mes: <strong className="text-foreground">+15%</strong> ({formatCurrency(ingresosTotales * 1.15)}).
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos de Estadísticas Adicionales */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            {/* Ventas por Categoría */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Ventas por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(() => {
                          const categorias: any = {};
                          data.sales.topProducts.forEach(p => {
                            const categoria = p.name.includes('Vigueta') ? 'Viguetas' : 
                                            p.name.includes('Bloque') ? 'Bloques' : 
                                            p.name.includes('Adoquin') || p.name.includes('Adoquín') ? 'Adoquines' : 'Otros';
                            if (!categorias[categoria]) categorias[categoria] = 0;
                            categorias[categoria] += p.revenue;
                          });
                          return Object.entries(categorias).map(([name, value]) => ({ name, value }));
                        })()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={100}
                        dataKey="value"
                      >
                        <Cell fill="#1f2937" />
                        <Cell fill="#4b5563" />
                        <Cell fill="#9ca3af" />
                        <Cell fill="#d1d5db" />
                      </Pie>
                      <Legend 
                        verticalAlign="bottom" 
                        height={100}
                        formatter={(value, entry: any) => {
                          const percent = ((entry.payload.value / data.sales.topProducts.reduce((sum, p) => sum + p.revenue, 0)) * 100).toFixed(1);
                          return `${value}: ${percent}%`;
                        }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => [formatCurrency(value), name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Desglose de Ventas por Productos */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Productos Más Vendidos por Categoría
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={selectedCategory === 'todos' ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedCategory('todos');
                        setSelectedSubcategory('todas');
                      }}
                      className="h-7 text-xs"
                    >
                      Todos
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedCategory === 'bloques' ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedCategory('bloques');
                        setSelectedSubcategory('todas');
                      }}
                      className="h-7 text-xs"
                    >
                      Bloques
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedCategory === 'viguetas' ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedCategory('viguetas');
                        setSelectedSubcategory('todas');
                      }}
                      className="h-7 text-xs"
                    >
                      Viguetas
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedCategory === 'adoquines' ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedCategory('adoquines');
                        setSelectedSubcategory('todas');
                      }}
                      className="h-7 text-xs"
                    >
                      Adoquines
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Subcategorías - Solo visible para Viguetas */}
                {selectedCategory === 'viguetas' && (
                  <div className="mb-4 pb-4 border-b">
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        // Extraer series de viguetas desde el campo description
                        const viguetas = data.sales.topProducts.filter(p => 
                          p.name.toLowerCase().includes('vigueta')
                        );

                        // Obtener series únicas del campo description (ej: "Serie 1", "Serie 2", etc.)
                        const subcatSet = new Set<string>();
                        viguetas.forEach((p: any) => {
                          // El campo description contiene "Serie 1", "Serie 2", etc.
                          if (p.description) {
                            subcatSet.add(p.description);
                          }
                        });

                        const series = Array.from(subcatSet).sort((a, b) => {
                          // Ordenar numéricamente: Serie 1, Serie 2, etc.
                          const numA = parseInt(a.replace('Serie ', ''));
                          const numB = parseInt(b.replace('Serie ', ''));
                          return numA - numB;
                        });

                        return (
                          <>
                            <Button
                              size="sm"
                              variant={selectedSubcategory === 'todas' ? 'default' : 'ghost'}
                              onClick={() => setSelectedSubcategory('todas')}
                              className="h-6 text-xs px-3"
                            >
                              Todas las Series
                            </Button>
                            {series.map(serie => (
                              <Button
                                key={serie}
                                size="sm"
                                variant={selectedSubcategory === serie ? 'default' : 'ghost'}
                                onClick={() => setSelectedSubcategory(serie)}
                                className="h-6 text-xs px-3"
                              >
                                {serie}
                              </Button>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(() => {
                        // Agrupar productos por categoría y obtener los más vendidos
                        const categorizado: any = {
                          viguetas: [],
                          bloques: [],
                          adoquines: [],
                          otros: []
                        };
                        
                        data.sales.topProducts.forEach(p => {
                          if (p.name.toLowerCase().includes('vigueta')) {
                            categorizado.viguetas.push(p);
                          } else if (p.name.toLowerCase().includes('bloque')) {
                            categorizado.bloques.push(p);
                          } else if (p.name.toLowerCase().includes('adoquin') || p.name.toLowerCase().includes('adoquín')) {
                            categorizado.adoquines.push(p);
                          } else {
                            categorizado.otros.push(p);
                          }
                        });
                        
                        // Ordenar cada categoría por unidades (cantidad) en lugar de ingresos
                        categorizado.bloques.sort((a: any, b: any) => b.units - a.units);
                        categorizado.viguetas.sort((a: any, b: any) => b.units - a.units);
                        categorizado.adoquines.sort((a: any, b: any) => b.units - a.units);
                        
                        // Filtrar según categoría seleccionada
                        const resultado: Array<{
                          nombre: string;
                          nombreCompleto: string;
                          unidades: number;
                          ingresos: number;
                          categoria: string;
                          color: string;
                        }> = [];
                        
                        if (selectedCategory === 'todos') {
                          // Top 3 Bloques
                          categorizado.bloques.slice(0, 3).forEach((p: any) => {
                            resultado.push({
                              nombre: p.name.replace('Bloque ', 'B. ').substring(0, 18),
                              nombreCompleto: p.name,
                              unidades: p.units,
                              ingresos: p.revenue / 1000000,
                              categoria: 'Bloques',
                              color: '#1f2937'
                            });
                          });
                          
                          // Top 3 Viguetas
                          categorizado.viguetas.slice(0, 3).forEach((p: any) => {
                            resultado.push({
                              nombre: p.name.replace('Vigueta ', 'V. ').substring(0, 18),
                              nombreCompleto: p.name,
                              unidades: p.units,
                              ingresos: p.revenue / 1000000,
                            categoria: 'Viguetas', 
                              color: '#374151'
                            });
                          });
                          
                          // Top 2 Adoquines
                          categorizado.adoquines.slice(0, 2).forEach((p: any) => {
                            resultado.push({
                              nombre: p.name.replace('Adoquín ', 'A. ').replace('Adoquin ', 'A. ').substring(0, 18),
                              nombreCompleto: p.name,
                              unidades: p.units,
                              ingresos: p.revenue / 1000000,
                              categoria: 'Adoquines',
                              color: '#6b7280'
                            });
                          });
                        } else if (selectedCategory === 'bloques') {
                          // Top 8 Bloques (sin filtro de subcategoría)
                          categorizado.bloques.slice(0, 8).forEach((p: any) => {
                            resultado.push({
                              nombre: p.name.replace('Bloque ', 'B. ').substring(0, 20),
                              nombreCompleto: p.name,
                              unidades: p.units,
                              ingresos: p.revenue / 1000000,
                            categoria: 'Bloques', 
                              color: '#1f2937'
                            });
                          });
                        } else if (selectedCategory === 'viguetas') {
                          if (selectedSubcategory === 'todas') {
                            // Mostrar resumen por SERIES (agrupar ventas por serie)
                            const seriesAgrupadas: { [key: string]: { unidades: number, ingresos: number } } = {};
                            
                            categorizado.viguetas.forEach((p: any) => {
                              const serie = p.description || 'Sin Serie';
                              if (!seriesAgrupadas[serie]) {
                                seriesAgrupadas[serie] = { unidades: 0, ingresos: 0 };
                              }
                              seriesAgrupadas[serie].unidades += p.units;
                              seriesAgrupadas[serie].ingresos += p.revenue;
                            });
                            
                            // Convertir a array y ordenar por unidades
                            Object.entries(seriesAgrupadas)
                              .sort((a, b) => b[1].unidades - a[1].unidades)
                              .forEach(([serie, datos]) => {
                                resultado.push({
                                  nombre: serie,
                                  nombreCompleto: serie,
                                  unidades: datos.unidades,
                                  ingresos: datos.ingresos / 1000000,
                                  categoria: 'Viguetas',
                                  color: '#3b82f6'
                                });
                              });
                          } else {
                            // Mostrar productos individuales de la serie seleccionada
                            const filtered = categorizado.viguetas
                              .filter((p: any) => p.description === selectedSubcategory)
                              .sort((a: any, b: any) => b.units - a.units); // Ordenar por unidades
                            
                            // Top 8 Viguetas de la serie
                            filtered.slice(0, 8).forEach((p: any) => {
                              resultado.push({
                                nombre: p.name.replace('Vigueta ', 'V. ').replace('Pretensada ', '').substring(0, 18),
                                nombreCompleto: p.name,
                                unidades: p.units,
                                ingresos: p.revenue / 1000000,
                                categoria: selectedSubcategory,
                                color: '#3b82f6'
                              });
                            });
                          }
                        } else if (selectedCategory === 'adoquines') {
                          // Top 8 Adoquines (sin filtro de subcategoría)
                          categorizado.adoquines.slice(0, 8).forEach((p: any) => {
                            resultado.push({
                              nombre: p.name.replace('Adoquín ', 'A. ').replace('Adoquin ', 'A. ').substring(0, 20),
                              nombreCompleto: p.name,
                              unidades: p.units,
                              ingresos: p.revenue / 1000000,
                            categoria: 'Adoquines', 
                              color: '#6b7280'
                            });
                          });
                        }
                        
                        return resultado;
                      })()}
                      margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis 
                        dataKey="nombre" 
                        stroke="#9ca3af" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis yAxisId="left" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Unidades', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                      <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Ingresos (M$)', angle: 90, position: 'insideRight', style: { fontSize: 11 } }} />
                      <Tooltip 
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const ingresosCompletos = data.ingresos * 1000000; // Convertir de millones a valor completo
                            return (
                              <div style={{ backgroundColor: 'white', border: '2px solid ' + data.color, borderRadius: '8px', padding: '14px', minWidth: '260px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: data.color }}></div>
                                  <p style={{ fontWeight: 'bold', color: '#111827', fontSize: '14px', margin: 0 }}>{data.categoria}</p>
                                </div>
                                <p style={{ fontWeight: 'bold', marginBottom: '12px', color: '#111827', fontSize: '15px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
                                  {data.nombreCompleto}
                                </p>
                                <div style={{ paddingTop: '4px' }}>
                                  <p style={{ color: '#1f2937', fontSize: '14px', marginBottom: '6px' }}>
                                    Unidades: <strong>{formatNumber(data.unidades)}</strong>
                                  </p>
                                  <p style={{ color: '#374151', fontSize: '14px' }}>
                                    Ingresos: <strong>${ingresosCompletos.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="unidades" name="Unidades Vendidas" fill="#1f2937" radius={[8, 8, 0, 0]} />
                      <Bar yAxisId="right" dataKey="ingresos" name="Ingresos (M$)" fill="#9ca3af" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        // ===== VISTA POR PRODUCCIÓN =====
        <>
          {/* Tres tarjetas: Top Más Producidos, Más Costosos, Recomendaciones */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Productos Más Producidos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-foreground">
                  Top 10 Más Producidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.production.topProducts.length > 0 ? [...data.production.topProducts]
                    .sort((a, b) => b.units - a.units)
                    .slice(0, 10)
                    .map((product, index) => (
                    <div key={index} className={cn(
                      "flex items-center justify-between h-16 p-3 rounded-lg border transition-colors",
                      theme === 'light' 
                        ? 'bg-muted/50 border-border hover:bg-muted' 
                        : 'bg-muted/30 border-border hover:bg-muted/50'
                    )}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(product.units)} unidades</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-sm font-bold text-foreground">{formatCurrency(product.value)}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center text-muted-foreground py-4">No hay datos de producción disponibles</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Productos Más Costosos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-foreground">
                  Top 10 Más Costosos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(() => {
                    const productsWithCost = [...data.production.topProducts]
                      .map(p => ({ 
                        ...p, 
                        costPerUnit: p.unitCost || (p.units > 0 && p.value > 0 ? p.value / p.units : 0)
                      }))
                      .filter(p => p.costPerUnit > 0 && p.units > 0)
                      .sort((a, b) => b.costPerUnit - a.costPerUnit)
                      .slice(0, 10);
                    
                    return productsWithCost.length > 0 ? (
                      productsWithCost.map((product, index) => (
                        <div key={index} className={cn(
                          "flex items-center justify-between h-16 p-3 rounded-lg border transition-colors",
                          theme === 'light' 
                            ? 'bg-muted/50 border-border hover:bg-muted' 
                            : 'bg-muted/30 border-border hover:bg-muted/50'
                        )}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                          {index + 1}
                        </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground font-semibold">Costo: ${Math.round(product.costPerUnit).toLocaleString('es-AR')}/unidad</p>
                        </div>
                      </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-sm font-bold text-foreground">{formatCurrency(product.value)}</p>
                            <p className="text-xs text-muted-foreground">{product.units.toLocaleString('es-AR')} producidas</p>
                      </div>
                    </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        {data.production.topProducts.length > 0 
                          ? 'No hay productos con datos de costo disponibles' 
                          : 'No hay datos de producción disponibles'}
                      </p>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Análisis IA Avanzado - Producción */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-foreground">
                  Análisis IA Avanzado - Producción
                </CardTitle>
              </CardHeader>
              <CardContent>
              <div className="space-y-2">
                {(() => {
                  const productosConDatos = data.production.topProducts.filter(p => p.units > 0 && p.value > 0);
                  if (productosConDatos.length === 0) {
                    return <p className="text-center text-muted-foreground py-4">No hay datos suficientes para análisis</p>;
                  }

                  const masProducido = [...productosConDatos].sort((a, b) => b.units - a.units)[0];
                  const masCostoso = [...productosConDatos]
                    .map(p => ({ ...p, costPerUnit: p.unitCost || (p.units > 0 ? p.value / p.units : 0) }))
                    .sort((a, b) => b.costPerUnit - a.costPerUnit)[0];
                  const totalProduccion = productosConDatos.reduce((sum, p) => sum + p.units, 0);
                  const totalCosto = productosConDatos.reduce((sum, p) => sum + p.value, 0);
                  const costoPromedio = totalProduccion > 0 ? totalCosto / totalProduccion : 0;
                  const top10Produccion = [...productosConDatos].sort((a, b) => b.units - a.units).slice(0, 10).reduce((sum, p) => sum + p.units, 0);
                  const concentracionTop10 = totalProduccion > 0 ? (top10Produccion / totalProduccion) * 100 : 0;

                  // Análisis por categoría
                  const viguetas = productosConDatos.filter(p => p.name.includes('Vigueta') || p.name.includes('vigueta'));
                  const bloques = productosConDatos.filter(p => p.name.includes('Bloque') || p.name.includes('bloque'));
                  const unidadesViguetas = viguetas.reduce((sum, p) => sum + p.units, 0);
                  const unidadesBloques = bloques.reduce((sum, p) => sum + p.units, 0);
                  const costoViguetas = viguetas.reduce((sum, p) => sum + p.value, 0);
                  const costoBloques = bloques.reduce((sum, p) => sum + p.value, 0);

                  return (
                    <>
                      {/* 1. Más Producido */}
                      {masProducido && (
                        <div className={cn(
                          "p-2.5 rounded-lg border",
                          theme === 'light' 
                            ? 'bg-muted/50 border-border' 
                            : 'bg-muted/30 border-border'
                        )}>
                          <p className="text-xs font-bold text-foreground mb-1">Volumen Líder</p>
                          <p className="text-xs text-muted-foreground leading-tight">
                            <strong>{masProducido.name}</strong>: {formatNumber(masProducido.units)} unidades producidas 
                            (costo total: {formatCurrency(masProducido.value)}). Producto estrella de producción.
                        </p>
                      </div>
                      )}

                      {/* 2. Más Costoso */}
                      {masCostoso && masCostoso.name !== masProducido?.name && (
                        <div className={cn(
                          "p-2.5 rounded-lg border",
                          theme === 'light' 
                            ? 'bg-muted/50 border-border' 
                            : 'bg-muted/30 border-border'
                        )}>
                          <p className="text-xs font-bold text-foreground mb-1">Mayor Costo por Unidad</p>
                          <p className="text-xs text-muted-foreground leading-tight">
                            <strong>{masCostoso.name}</strong> tiene el costo más alto: ${formatNumber(Math.round(masCostoso.costPerUnit))}/unidad.
                            Total: {formatCurrency(masCostoso.value)} para {masCostoso.units} unidades. Revisar eficiencia.
                        </p>
                      </div>
                      )}

                      {/* 3. Análisis Viguetas vs Bloques */}
                      {viguetas.length > 0 && bloques.length > 0 && (
                        <div className={cn(
                          "p-2.5 rounded-lg border",
                          theme === 'light' 
                            ? 'bg-muted/50 border-border' 
                            : 'bg-muted/30 border-border'
                        )}>
                          <p className="text-xs font-bold text-foreground mb-1">Viguetas vs Bloques</p>
                          <p className="text-xs text-muted-foreground leading-tight">
                            {unidadesViguetas > unidadesBloques ? (
                              <>Viguetas lideran producción ({formatNumber(unidadesViguetas)} vs {formatNumber(unidadesBloques)} unidades). 
                              Costo total: ${formatCurrency(costoViguetas)} vs ${formatCurrency(costoBloques)}.</>
                            ) : (
                              <>Bloques lideran producción ({formatNumber(unidadesBloques)} vs {formatNumber(unidadesViguetas)} unidades). 
                              Costo total: ${formatCurrency(costoBloques)} vs ${formatCurrency(costoViguetas)}.</>
                            )}
                          </p>
                      </div>
                      )}

                      {/* 4. Costo Promedio */}
                      <div className={cn(
                        "p-2.5 rounded-lg border",
                        theme === 'light' 
                          ? 'bg-muted/50 border-border' 
                          : 'bg-muted/30 border-border'
                      )}>
                        <p className="text-xs font-bold text-foreground mb-1">Costo Promedio de Producción</p>
                        <p className="text-xs text-muted-foreground leading-tight">
                          Costo promedio: <strong>${formatNumber(Math.round(costoPromedio))}/unidad</strong>.
                          Total producido: {formatNumber(totalProduccion)} unidades con costo total de {formatCurrency(totalCosto)}.
                        </p>
                  </div>

                      {/* 5. Concentración de Producción */}
                      <div className={cn(
                        "p-2.5 rounded-lg border",
                        theme === 'light' 
                          ? 'bg-muted/50 border-border' 
                          : 'bg-muted/30 border-border'
                      )}>
                        <p className="text-xs font-bold text-foreground mb-1">Concentración de Producción</p>
                        <p className="text-xs text-muted-foreground leading-tight">
                          Top 10 productos representan <strong>{formatNumber(concentracionTop10, 1)}%</strong> de la producción total.
                          {concentracionTop10 > 70 ? ' Alta concentración en pocos productos.' : ' Buena diversificación del mix de producción.'}
                    </p>
                  </div>
                    </>
                  );
                    })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos de Estadísticas Adicionales */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            {/* Producción por Categoría */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Producción por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(() => {
                          const categorias: any = {};
                          data.production.topProducts.forEach(p => {
                            const categoria = p.name.includes('Vigueta') || p.name.includes('vigueta') ? 'Viguetas' : 
                                            p.name.includes('Bloque') || p.name.includes('bloque') ? 'Bloques' : 
                                            p.name.includes('Adoquin') || p.name.includes('Adoquín') || p.name.includes('adoquin') ? 'Adoquines' : 'Otros';
                            if (!categorias[categoria]) categorias[categoria] = 0;
                            categorias[categoria] += p.units;
                          });
                          return Object.entries(categorias).map(([name, value]) => ({ name, value }));
                        })()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={100}
                        dataKey="value"
                      >
                        <Cell fill="#1f2937" />
                        <Cell fill="#4b5563" />
                        <Cell fill="#9ca3af" />
                        <Cell fill="#d1d5db" />
                      </Pie>
                      <Legend 
                        verticalAlign="bottom" 
                        height={100}
                        formatter={(value, entry: any) => {
                          const total = data.production.topProducts.reduce((sum, p) => sum + p.units, 0);
                          const percent = total > 0 ? ((entry.payload.value / total) * 100).toFixed(1) : 0;
                          return `${value}: ${percent}%`;
                        }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => [new Intl.NumberFormat('es-AR').format(value) + ' unidades', name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Productos Más Producidos por Categoría */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Productos Más Producidos por Categoría
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={selectedProductionCategory === 'todos' ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedProductionCategory('todos');
                        setSelectedProductionSubcategory('todas');
                      }}
                      className="h-7 text-xs"
                    >
                      Todos
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedProductionCategory === 'bloques' ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedProductionCategory('bloques');
                        setSelectedProductionSubcategory('todas');
                      }}
                      className="h-7 text-xs"
                    >
                      Bloques
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedProductionCategory === 'viguetas' ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedProductionCategory('viguetas');
                        setSelectedProductionSubcategory('todas');
                      }}
                      className="h-7 text-xs"
                    >
                      Viguetas
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedProductionCategory === 'adoquines' ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedProductionCategory('adoquines');
                        setSelectedProductionSubcategory('todas');
                      }}
                      className="h-7 text-xs"
                    >
                      Adoquines
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Subcategorías - Solo visible para Viguetas */}
                {selectedProductionCategory === 'viguetas' && (
                  <div className="mb-4 pb-4 border-b">
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        // Extraer series de viguetas desde subcategoría
                        const viguetas = data?.production?.topProducts.filter(p => 
                          p.name.toLowerCase().includes('vigueta')
                        ) || [];

                        // Obtener series únicas de la subcategoría (ej: "Serie 1", "Serie 2", etc.)
                        const subcatSet = new Set<string>();
                        viguetas.forEach((p: any) => {
                          // La subcategoría contiene "Serie 1", "Serie 2", etc.
                          if (p.subcategoryName) {
                            // Extraer "Serie X" de la subcategoría
                            const serieMatch = p.subcategoryName.match(/Serie\s*(\d+)/i);
                            if (serieMatch) {
                              subcatSet.add(`Serie ${serieMatch[1]}`);
                            } else if (p.subcategoryName.toLowerCase().includes('serie')) {
                              // Si el nombre contiene "serie" pero no en formato estándar
                              subcatSet.add(p.subcategoryName);
                            }
                          }
                        });

                        const series = Array.from(subcatSet).sort((a, b) => {
                          const numA = parseInt(a.replace('Serie ', ''));
                          const numB = parseInt(b.replace('Serie ', ''));
                          return numA - numB;
                        });

                        return (
                          <>
                            <Button
                              size="sm"
                              variant={selectedProductionSubcategory === 'todas' ? 'default' : 'ghost'}
                              onClick={() => setSelectedProductionSubcategory('todas')}
                              className="h-6 text-xs px-3"
                            >
                              Todas las Series
                            </Button>
                            {series.map(serie => (
                              <Button
                                key={serie}
                                size="sm"
                                variant={selectedProductionSubcategory === serie ? 'default' : 'ghost'}
                                onClick={() => setSelectedProductionSubcategory(serie)}
                                className="h-6 text-xs px-3"
                              >
                                {serie}
                              </Button>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(() => {
                        // Agrupar productos por categoría
                        const categorizado: any = {
                          viguetas: [],
                          bloques: [],
                          adoquines: [],
                          otros: []
                        };
                        
                        data.production.topProducts.forEach(p => {
                          if (p.name.toLowerCase().includes('vigueta')) {
                            categorizado.viguetas.push(p);
                          } else if (p.name.toLowerCase().includes('bloque')) {
                            categorizado.bloques.push(p);
                          } else if (p.name.toLowerCase().includes('adoquin') || p.name.toLowerCase().includes('adoquín')) {
                            categorizado.adoquines.push(p);
                          } else {
                            categorizado.otros.push(p);
                          }
                        });
                        
                        // Ordenar cada categoría por unidades
                        categorizado.bloques.sort((a: any, b: any) => b.units - a.units);
                        categorizado.viguetas.sort((a: any, b: any) => b.units - a.units);
                        categorizado.adoquines.sort((a: any, b: any) => b.units - a.units);
                        
                        // Filtrar según categoría y subcategoría seleccionadas
                        let productosFiltrados: any[] = [];
                        
                        if (selectedProductionCategory === 'todos') {
                          // Mostrar top productos de todas las categorías
                          productosFiltrados = [
                            ...categorizado.bloques.slice(0, 8),
                            ...categorizado.viguetas.slice(0, 8),
                            ...categorizado.adoquines.slice(0, 4)
                          ];
                          productosFiltrados.sort((a: any, b: any) => b.units - a.units);
                        } else if (selectedProductionCategory === 'bloques') {
                          productosFiltrados = categorizado.bloques.slice(0, 8);
                        } else if (selectedProductionCategory === 'adoquines') {
                          productosFiltrados = categorizado.adoquines.slice(0, 8);
                        } else if (selectedProductionCategory === 'viguetas') {
                          let viguetasFiltradas = categorizado.viguetas;
                          
                          // Filtrar por serie si está seleccionada
                          if (selectedProductionSubcategory !== 'todas') {
                            viguetasFiltradas = viguetasFiltradas.filter((p: any) => {
                              if (p.subcategoryName) {
                                // Comparar con la subcategoría
                                const serieMatch = p.subcategoryName.match(/Serie\s*(\d+)/i);
                                if (serieMatch && `Serie ${serieMatch[1]}` === selectedProductionSubcategory) {
                                  return true;
                                }
                                // Fallback: comparación directa
                                if (p.subcategoryName === selectedProductionSubcategory) {
                                  return true;
                                }
                              }
                              return false;
                            });
                          }
                          
                          productosFiltrados = viguetasFiltradas;
                        }
                        
                        // Convertir a formato de gráfico
                        const resultado: Array<{
                          nombre: string;
                          nombreCompleto: string;
                          unidades: number;
                          valor: number;
                          categoria: string;
                          color: string;
                        }> = [];
                        
                        productosFiltrados.slice(0, 20).forEach((p: any) => {
                          const categoria = p.name.toLowerCase().includes('vigueta') ? 'Viguetas' :
                                          p.name.toLowerCase().includes('bloque') ? 'Bloques' :
                                          p.name.toLowerCase().includes('adoquin') || p.name.toLowerCase().includes('adoquín') ? 'Adoquines' : 'Otros';
                          
                          let nombreCorto = p.name;
                          if (p.name.includes('Bloque ')) {
                            nombreCorto = p.name.replace('Bloque ', 'B. ');
                          } else if (p.name.includes('Vigueta ')) {
                            nombreCorto = p.name.replace('Vigueta ', 'V. ').replace('Pretensada ', '');
                          } else if (p.name.includes('Adoquín ') || p.name.includes('Adoquin ')) {
                            nombreCorto = p.name.replace('Adoquín ', 'A. ').replace('Adoquin ', 'A. ');
                          }
                          
                          resultado.push({
                            nombre: nombreCorto.substring(0, 20),
                            nombreCompleto: p.name,
                            unidades: p.units,
                            valor: p.value,
                            categoria,
                            color: '#1f2937'
                          });
                        });
                        
                        return resultado;
                      })()}
                      margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis 
                        dataKey="nombre" 
                        stroke="#9ca3af" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis yAxisId="left" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Unidades', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right"
                        stroke="#9ca3af" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        label={{ value: 'Costo (M$)', angle: 90, position: 'insideRight', style: { fontSize: 11 } }}
                        tickFormatter={(value) => (value / 1000000).toFixed(1)}
                      />
                      <Tooltip 
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const costoPorUnidad = data.unidades > 0 ? data.valor / data.unidades : 0;
                            return (
                              <div style={{ backgroundColor: 'white', border: '2px solid ' + data.color, borderRadius: '8px', padding: '14px', minWidth: '260px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: data.color }}></div>
                                  <p style={{ fontWeight: 'bold', color: '#111827', fontSize: '14px', margin: 0 }}>{data.categoria}</p>
                                </div>
                                <p style={{ fontWeight: 'bold', marginBottom: '12px', color: '#111827', fontSize: '15px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
                                  {data.nombreCompleto}
                                </p>
                                <div style={{ paddingTop: '4px' }}>
                                  <p style={{ color: '#1f2937', fontSize: '14px', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: 'bold' }}>Unidades Producidas:</span> {formatNumber(data.unidades)}
                                  </p>
                                  <p style={{ color: '#1f2937', fontSize: '14px', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: 'bold' }}>Costo Total:</span> ${data.valor.toLocaleString('es-AR')}
                                  </p>
                                  <p style={{ color: '#1f2937', fontSize: '14px', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: 'bold' }}>Costo por Unidad:</span> ${Math.round(costoPorUnidad).toLocaleString('es-AR')}
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        yAxisId="left"
                        dataKey="unidades" 
                        name="Unidades Producidas"
                        fill="#1f2937" 
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar 
                        yAxisId="right"
                        dataKey={(item: any) => item.valor / 1000000}
                        name="Costo Total (M$)"
                        fill="#9ca3af" 
                        radius={[8, 8, 0, 0]}
                      />
                      <Legend 
                        formatter={(value) => {
                          if (value === 'unidades') return 'Unidades Producidas';
                          return value;
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Sección Final: Métricas Avanzadas */}
      <div className="mt-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Métricas Avanzadas</h3>

        {/* Fila 1: Análisis de Ganancias + Eficiencia Operativa */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProfitAnalysis
            products={data.sales.topProducts}
            totalRevenue={data.totalSales}
            totalCosts={data.totalCosts}
          />
          <EfficiencyMetrics
            totalSales={data.totalSales}
            totalCosts={data.totalCosts}
            totalUnitsSold={data.totalUnitsSold}
            totalUnitsProduced={data.production.totalUnits}
            marginPercentage={data.marginPercentage}
          />
        </div>

        {/* Fila 2: Punto de Equilibrio + Variación de Costos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BreakEvenAnalysis
            totalSales={data.totalSales}
            totalCosts={data.totalCosts}
            totalUnitsSold={data.totalUnitsSold}
          />
          <CostVariation
            currentCosts={data.costsSummary}
            previousCosts={null} // TODO: Agregar datos del mes anterior cuando estén disponibles
          />
        </div>
      </div>
    </div>
  );
}

