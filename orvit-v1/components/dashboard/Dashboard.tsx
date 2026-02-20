'use client';

import { cn } from '@/lib/utils';
import { Header } from './Header';
import { FilterDock } from './FilterDock';
import { KpiCard } from './KpiCard';
import { TimeBrush } from './TimeBrush';
import { MainChart } from './MainChart';
import { TopMovers } from './TopMovers';
import { CategoryGrid } from './CategoryGrid';
import { InsightsPanel } from './InsightsPanel';
import { CurrentMetrics } from './CurrentMetrics';
import { CurrentMetricsMTD } from './CurrentMetricsMTD';
import { DailyChart } from './DailyChart';
import { TopProducts } from './TopProducts';
import { ExecutiveSummary } from './ExecutiveSummary';
import { ComprehensiveDashboard } from './ComprehensiveDashboard';
import { MonthSelector } from './MonthSelector';
import { useDashboardStore } from './useDashboardStore';
import { mockKpis, mockChartData, mockCategories, mockTopMovers } from './mocks/data';
import { useState, useEffect, useMemo } from 'react';

interface DashboardProps {
  data?: any[];
  selectedMonth?: string;
  companyId?: string;
  hasError?: boolean;
  onMonthChange?: (month: string) => void;
}

export function Dashboard({ data, selectedMonth: initialSelectedMonth, companyId, hasError = false, onMonthChange }: DashboardProps) {
  const { filters } = useDashboardStore();
  const [selectedRange, setSelectedRange] = useState<{start: string, end: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [internalError, setInternalError] = useState(false);
  const [showComparativeAnalysis, setShowComparativeAnalysis] = useState(false);
  const [currentSelectedMonth, setCurrentSelectedMonth] = useState(initialSelectedMonth || '2025-08');

  const handleRangeChange = (start: string, end: string) => {
    setSelectedRange({ start, end });
  };

  // Función para generar KPIs desde datos reales
  function generateKpisFromData(data: any[]) {
    if (!data || data.length === 0) return mockKpis;
    
    const currentMonth = data[data.length - 1] || {};
    const previousMonth = data[data.length - 2] || currentMonth;
    const yearAgoMonth = data.length >= 13 ? (data[data.length - 13] || {}) : null;
    
    // Verificar que currentMonth tenga las propiedades necesarias
    const currentVentas = currentMonth?.ventas || 0;
    const currentCostos = currentMonth?.costos || 0;
    const previousVentas = previousMonth?.ventas || 0;
    const previousCostos = previousMonth?.costos || 0;
    const yearAgoVentas = yearAgoMonth?.ventas || 0;
    const yearAgoCostos = yearAgoMonth?.costos || 0;
    
    return [
      {
        title: 'Ingresos Totales',
        total: currentVentas,
        avg: data.reduce((sum, d) => sum + (d?.ventas || 0), 0) / data.length,
        delta: currentVentas - previousVentas,
        deltaPct: previousVentas > 0 ? ((currentVentas - previousVentas) / previousVentas) * 100 : 0,
        momPct: previousVentas > 0 ? ((currentVentas - previousVentas) / previousVentas) * 100 : 0,
        yoyPct: data.length >= 13 && yearAgoVentas > 0 ? ((currentVentas - yearAgoVentas) / yearAgoVentas) * 100 : undefined,
        spark: data.map(d => ({ month: d?.month || '', value: d?.ventas || 0 })),
        trend: currentVentas > previousVentas ? 'up' as const : 'down' as const,
      },
      {
        title: 'Costos Totales',
        total: currentCostos,
        avg: data.reduce((sum, d) => sum + (d?.costos || 0), 0) / data.length,
        delta: currentCostos - previousCostos,
        deltaPct: previousCostos > 0 ? ((currentCostos - previousCostos) / previousCostos) * 100 : 0,
        momPct: previousCostos > 0 ? ((currentCostos - previousCostos) / previousCostos) * 100 : 0,
        yoyPct: data.length >= 13 && yearAgoCostos > 0 ? ((currentCostos - yearAgoCostos) / yearAgoCostos) * 100 : undefined,
        spark: data.map(d => ({ month: d?.month || '', value: d?.costos || 0 })),
        trend: currentCostos > previousCostos ? 'up' as const : 'down' as const,
      },
      {
        title: 'Margen Bruto',
        total: currentVentas - currentCostos,
        avg: data.reduce((sum, d) => sum + ((d?.ventas || 0) - (d?.costos || 0)), 0) / data.length,
        delta: (currentVentas - currentCostos) - (previousVentas - previousCostos),
        deltaPct: (previousVentas - previousCostos) > 0 ? 
          (((currentVentas - currentCostos) - (previousVentas - previousCostos)) / 
          (previousVentas - previousCostos)) * 100 : 0,
        momPct: (previousVentas - previousCostos) > 0 ? 
          (((currentVentas - currentCostos) - (previousVentas - previousCostos)) / 
          (previousVentas - previousCostos)) * 100 : 0,
        yoyPct: data.length >= 13 && (yearAgoVentas - yearAgoCostos) > 0 ? 
          (((currentVentas - currentCostos) - (yearAgoVentas - yearAgoCostos)) / 
          (yearAgoVentas - yearAgoCostos)) * 100 : undefined,
        spark: data.map(d => ({ month: d?.month || '', value: (d?.ventas || 0) - (d?.costos || 0) })),
        trend: (currentVentas - currentCostos) > (previousVentas - previousCostos) ? 'up' as const : 'down' as const,
      },
    ];
  }

  // Función para generar categorías desde datos reales
  function generateCategoriesFromData(data: any[]) {
    if (!data || data.length === 0) return mockCategories;
    
    const currentMonth = data[data.length - 1] || {};
    const previousMonth = data[data.length - 2] || currentMonth;
    
    const currentVentas = currentMonth?.ventas || 0;
    const currentCostos = currentMonth?.costos || 0;
    const previousVentas = previousMonth?.ventas || 0;
    const previousCostos = previousMonth?.costos || 0;
    
    return [
      {
        name: 'Ventas',
        total: currentVentas,
        avg: data.reduce((sum, d) => sum + (d?.ventas || 0), 0) / data.length,
        change: currentVentas - previousVentas,
        changePct: previousVentas > 0 ? ((currentVentas - previousVentas) / previousVentas) * 100 : 0,
        performance: currentVentas > previousVentas ? 'positivo' as const : 'negativo' as const,
        sharePct: 45.2,
        shareDeltaPct: 2.1,
        spark: data.map(d => ({ month: d?.month || '', value: d?.ventas || 0 })),
      },
      {
        name: 'Costos',
        total: currentCostos,
        avg: data.reduce((sum, d) => sum + (d?.costos || 0), 0) / data.length,
        change: currentCostos - previousCostos,
        changePct: previousCostos > 0 ? ((currentCostos - previousCostos) / previousCostos) * 100 : 0,
        performance: currentCostos < previousCostos ? 'positivo' as const : 'negativo' as const,
        sharePct: 23.8,
        shareDeltaPct: -1.2,
        spark: data.map(d => ({ month: d?.month || '', value: d?.costos || 0 })),
      },
    ];
  }

  // Función para generar movers desde datos reales
  function generateMoversFromData(data: any[]) {
    if (!data || data.length === 0) return mockTopMovers;
    
    const currentMonth = data[data.length - 1] || {};
    const previousMonth = data[data.length - 2] || currentMonth;
    
    const currentVentas = currentMonth?.ventas || 0;
    const currentCostos = currentMonth?.costos || 0;
    const previousVentas = previousMonth?.ventas || 0;
    const previousCostos = previousMonth?.costos || 0;
    
    return [
      {
        name: 'Ventas',
        delta: currentVentas - previousVentas,
        deltaPct: previousVentas > 0 ? ((currentVentas - previousVentas) / previousVentas) * 100 : 0,
        contributionPct: 32.1,
        type: 'categoria' as const,
      },
      {
        name: 'Costos',
        delta: currentCostos - previousCostos,
        deltaPct: previousCostos > 0 ? ((currentCostos - previousCostos) / previousCostos) * 100 : 0,
        contributionPct: 21.4,
        type: 'categoria' as const,
      },
    ];
  }

  // Usar datos reales si se proporcionan, sino usar mocks
  // Usar useMemo para evitar recalcular en cada render
  const { chartData, kpisData, categoriesData, moversData, hasGenerationError } = useMemo(() => {
    let chart = mockChartData;
    let kpis = mockKpis;
    let categories = mockCategories;
    let movers = mockTopMovers;
    let error = false;

  try {
    if (data && data.length > 0) {
        chart = data;
        kpis = generateKpisFromData(data);
        categories = generateCategoriesFromData(data);
        movers = generateMoversFromData(data);
      }
    } catch (err) {
      console.error('Error generating dashboard data:', err);
      error = true;
    }

    return {
      chartData: chart,
      kpisData: kpis,
      categoriesData: categories,
      moversData: movers,
      hasGenerationError: error
    };
  }, [data]);

  // Manejar errores en useEffect para evitar ciclos infinitos
  useEffect(() => {
    if (hasGenerationError) {
    setInternalError(true);
  }
  }, [hasGenerationError]);

  const filteredData = (chartData || []).filter(point => {
    if (!point || !point.month) return false;
    if (!selectedRange) return true;
    return point.month >= selectedRange.start && point.month <= selectedRange.end;
  });


  // Si hay error o no hay datos, mostrar estado de error
  if (hasError || internalError || (!data && !mockChartData)) {
    return (
      <div className="min-h-screen bg-[#06141B] text-[#CCD0CF] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-[#CCD0CF] mb-2">Error al cargar datos</h2>
          <p className="text-[#9BA8AB] mb-4">No se pudieron cargar los datos del dashboard</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-info text-white rounded-lg hover:bg-info/90 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Solo mostrar header cuando está en análisis comparativo */}
      {showComparativeAnalysis && (
        <>
          <Header
            hasAlerts={false}
            showComparativeAnalysis={showComparativeAnalysis}
            onToggleComparativeAnalysis={() => setShowComparativeAnalysis(!showComparativeAnalysis)}
          />
          <FilterDock />
        </>
      )}

      <main className="w-full">
        {/* Vista Principal */}
        {!showComparativeAnalysis && (
          <ComprehensiveDashboard
            companyId={companyId || "1"}
            selectedMonth={currentSelectedMonth}
            onMonthChange={(month) => {
              setCurrentSelectedMonth(month);
              onMonthChange?.(month);
            }}
          />
        )}

        {/* Análisis Comparativo Ejecutivo - Solo se muestra si está habilitado */}
        {showComparativeAnalysis && (
          <>
            {/* Time Brush */}
            <div className="mb-6">
              <TimeBrush 
                data={mockChartData.map(d => ({ month: d.month, value: d.ventas }))}
                onRangeChange={handleRangeChange}
              />
      </div>

        {/* KPIs Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Indicadores Clave de Rendimiento
          </h2>
          <div className={cn('grid gap-4',
            filters.viewMode === 'compact'
              ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          )}>
            {kpisData.map((kpi, index) => (
              <KpiCard 
                key={index}
                data={kpi}
                compact={filters.viewMode === 'compact'}
              />
              ))}
            </div>
      </div>

        {/* Zona Analítica */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
          {/* Gráfico Principal */}
          <div className="xl:col-span-3">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {filters.comparisonMode === '2months' && 'Comparación 2 Meses'}
                  {filters.comparisonMode === 'range-vs-range' && 'Rango vs Rango'}
                  {filters.comparisonMode === 'multi-mes' && 'Tendencia Multi-Mes'}
                  {filters.comparisonMode === 'yoy' && 'Año vs Año'}
                  {filters.comparisonMode === 'index100' && 'Índice Base 100'}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {filteredData.length} meses
                  </span>
              </div>
            </div>
            
              <MainChart 
                data={filteredData}
                comparisonMode={filters.comparisonMode}
                chartType={filters.chartType}
              />
              </div>
            </div>
            
          {/* Panel Lateral */}
          <div className="space-y-6">
            {/* Resumen Ejecutivo */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Resumen Ejecutivo
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tendencia General</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success"></div>
                    <span className="text-sm text-success">Positiva</span>
              </div>
            </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Período</span>
                  <span className="text-sm text-foreground">
                    {filteredData[0]?.monthFormatted} - {filteredData[filteredData.length - 1]?.monthFormatted}
                  </span>
          </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor Inicial</span>
                  <span className="text-sm text-foreground">
                    ${filteredData[0]?.ventas.toLocaleString() || '0'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor Final</span>
                  <span className="text-sm text-foreground">
                    ${filteredData[filteredData.length - 1]?.ventas.toLocaleString() || '0'}
                  </span>
            </div>
            
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Volatilidad</span>
                  <span className="text-sm text-foreground">12.5%</span>
          </div>
                
                {filteredData.length >= 12 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">CAGR</span>
                    <span className="text-sm text-foreground">18.2%</span>
              </div>
            )}
                </div>
              </div>

            {/* Top Movers */}
            <TopMovers 
              movers={moversData}
              title="Top Movers"
              maxItems={5}
            />
                  </div>
                </div>

        {/* Detalle por Categoría */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Análisis por Categoría
          </h2>
          <CategoryGrid 
            categories={categoriesData}
            compact={filters.viewMode === 'compact'}
          />
              </div>

            {/* Insights Automáticos */}
            <InsightsPanel 
              data={filteredData}
              movers={moversData}
            />
          </>
        )}
      </main>
    </div>
  );
}
