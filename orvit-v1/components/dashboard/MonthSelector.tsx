'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics'; // ✨ OPTIMIZADO

interface MonthSelectorProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  companyId: string;
}

interface MonthData {
  month: string;
  hasSales: boolean;
  hasCosts: boolean;
  hasProduction: boolean;
  totalSales?: number;
  totalCosts?: number;
  totalUnitsSold?: number;
  totalUnitsProduced?: number;
}

export function MonthSelector({ 
  selectedMonth, 
  onMonthChange, 
  companyId 
}: MonthSelectorProps) {
  const { theme } = useTheme();
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [monthData, setMonthData] = useState<MonthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // ✨ OPTIMIZADO: Flag para evitar múltiples fetches simultáneos
  const fetchingRef = useRef(false);

  // ✨ OPTIMIZADO: Definir fetchAvailableMonths ANTES de usarla en useEffect
  const fetchAvailableMonths = useCallback(async () => {
    if (fetchingRef.current) return; // Prevenir múltiples fetches simultáneos
    
    try {
      fetchingRef.current = true;
      setIsLoading(true);
      const response = await fetch(`/api/dashboard/available-months?companyId=${companyId}`);
      
      if (response.ok) {
        const months = await response.json();
        setAvailableMonths(months);
        
        // ✨ OPTIMIZADO: Hacer fetches en paralelo con mejor caché
        const monthDataPromises = months.map(async (month: string) => {
          try {
            const metricsResponse = await fetch(`/api/dashboard/metrics?companyId=${companyId}&month=${month}`, {
              cache: 'force-cache' // ✨ Intentar usar caché primero
            });
            if (metricsResponse.ok) {
              const metrics = await metricsResponse.json();
              
              const breakdown = metrics.metrics?.costBreakdown || {};
              const indirectCosts = breakdown.indirects || 0;
              const employeeCosts = breakdown.employees || 0;
              const materialCosts = breakdown.materials || 0;
              const totalCostsCalculated = metrics.metrics?.totalCosts || (indirectCosts + employeeCosts + materialCosts);
              
              return {
                month,
                hasSales: (metrics.metrics?.totalSales || 0) > 0,
                hasCosts: totalCostsCalculated > 0,
                hasProduction: (metrics.metrics?.totalUnitsSold || 0) > 0,
                totalSales: metrics.metrics?.totalSales || 0,
                totalCosts: totalCostsCalculated,
                totalUnitsSold: metrics.metrics?.totalUnitsSold || 0,
                totalUnitsProduced: metrics.metrics?.totalUnitsProduced || 0
              };
            }
          } catch (error) {
            // Silenciar errores individuales
          }
          return {
            month,
            hasSales: false,
            hasCosts: false,
            hasProduction: false,
            totalSales: 0,
            totalCosts: 0,
            totalUnitsSold: 0,
            totalUnitsProduced: 0
          };
        });

        const monthDataResults = await Promise.all(monthDataPromises);
        setMonthData(monthDataResults);
        
        // Si el mes seleccionado no está en los meses disponibles, usar 2025-08 si está disponible
        if (months.length > 0 && !months.includes(selectedMonth)) {
          const preferredMonth = months.includes('2025-08') ? '2025-08' : months[0];
          onMonthChange(preferredMonth);
        }
      } else {
        // Fallback: generar meses de los últimos 12 meses
        const fallbackMonths = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          fallbackMonths.push(date.toISOString().slice(0, 7));
        }
        setAvailableMonths(fallbackMonths);
      }
    } catch (error) {
      // Fallback: últimos 12 meses
      const fallbackMonths = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        fallbackMonths.push(date.toISOString().slice(0, 7));
      }
      setAvailableMonths(fallbackMonths);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [companyId, selectedMonth, onMonthChange]);

  useEffect(() => {
    fetchAvailableMonths();
  }, [fetchAvailableMonths]);

  useEffect(() => {
    // Find current month index
    const index = availableMonths.findIndex(month => month === selectedMonth);
    if (index !== -1) {
      setCurrentIndex(index);
    }
  }, [selectedMonth, availableMonths]);

  const goToPreviousMonth = () => {
    if (currentIndex < availableMonths.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      onMonthChange(availableMonths[newIndex]);
    }
  };

  const goToNextMonth = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      onMonthChange(availableMonths[newIndex]);
    }
  };

  const formatMonthName = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('es-AR', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
            <span className="text-muted-foreground">Cargando meses disponibles...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Selector de Mes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Navegación de meses */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              disabled={currentIndex >= availableMonths.length - 1}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">
                {formatMonthName(selectedMonth)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentIndex + 1} de {availableMonths.length} meses disponibles
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              disabled={currentIndex <= 0}
              className="flex items-center gap-2"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Lista de meses disponibles */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Meses disponibles:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {availableMonths.map((month, index) => {
                const monthInfo = monthData.find(data => data.month === month);
                const isSelected = month === selectedMonth;
                
                return (
                  <Button
                    key={month}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCurrentIndex(index);
                      onMonthChange(month);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 h-auto py-2",
                      isSelected && theme === 'dark' && "!bg-muted !text-white hover:!bg-muted/80 !border-border"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium",
                      isSelected && theme === 'dark' && "!text-white"
                    )}>
                      {formatMonthName(month)}
                    </span>
                    <div className="flex gap-1">
                      {monthInfo?.hasSales && (
                        <div className="w-2 h-2 bg-green-500 rounded-full" title="Ventas" />
                      )}
                      {monthInfo?.hasCosts && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" title="Costos" />
                      )}
                      {monthInfo?.hasProduction && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" title="Producción" />
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}