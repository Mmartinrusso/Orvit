'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MonthSelectorCompactProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  companyId: string;
}

interface MonthData {
  month: string;
  hasSales: boolean;
  hasCosts: boolean;
  hasProduction: boolean;
}

export function MonthSelectorCompact({
  selectedMonth,
  onMonthChange,
  companyId
}: MonthSelectorCompactProps) {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [monthData, setMonthData] = useState<MonthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchingRef = useRef(false);

  const fetchAvailableMonths = useCallback(async () => {
    if (fetchingRef.current) return;

    try {
      fetchingRef.current = true;
      setIsLoading(true);
      const response = await fetch(`/api/dashboard/available-months?companyId=${companyId}`);

      if (response.ok) {
        const months = await response.json();
        setAvailableMonths(months);

        const monthDataPromises = months.map(async (month: string) => {
          try {
            const metricsResponse = await fetch(`/api/dashboard/metrics?companyId=${companyId}&month=${month}`, {
              cache: 'force-cache'
            });
            if (metricsResponse.ok) {
              const metrics = await metricsResponse.json();
              const breakdown = metrics.metrics?.costBreakdown || {};
              const totalCostsCalculated = metrics.metrics?.totalCosts ||
                (breakdown.indirects || 0) + (breakdown.employees || 0) + (breakdown.materials || 0);

              return {
                month,
                hasSales: (metrics.metrics?.totalSales || 0) > 0,
                hasCosts: totalCostsCalculated > 0,
                hasProduction: (metrics.metrics?.totalUnitsSold || 0) > 0,
              };
            }
          } catch (error) {
            // Silenciar errores individuales
          }
          return { month, hasSales: false, hasCosts: false, hasProduction: false };
        });

        const monthDataResults = await Promise.all(monthDataPromises);
        setMonthData(monthDataResults);

        if (months.length > 0 && !months.includes(selectedMonth)) {
          const preferredMonth = months.includes('2025-08') ? '2025-08' : months[0];
          onMonthChange(preferredMonth);
        }
      } else {
        const fallbackMonths = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          fallbackMonths.push(date.toISOString().slice(0, 7));
        }
        setAvailableMonths(fallbackMonths);
      }
    } catch (error) {
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

  const formatMonthShort = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={goToPreviousMonth}
        disabled={currentIndex >= availableMonths.length - 1}
        className="h-6 w-6"
      >
        <ChevronLeft className="h-3 w-3" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 gap-1.5 px-2 min-w-[110px]">
            <Calendar className="h-3 w-3" />
            <span className="text-xs font-medium capitalize">{formatMonthShort(selectedMonth)}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="max-h-[300px] overflow-y-auto">
          {availableMonths.map((month, index) => {
            const monthInfo = monthData.find(data => data.month === month);
            const isSelected = month === selectedMonth;

            return (
              <DropdownMenuItem
                key={month}
                onClick={() => {
                  setCurrentIndex(index);
                  onMonthChange(month);
                }}
                className={cn(
                  "flex items-center justify-between gap-3 cursor-pointer",
                  isSelected && "bg-accent"
                )}
              >
                <span className={cn(
                  "capitalize",
                  isSelected && "font-medium"
                )}>
                  {formatMonthName(month)}
                </span>
                <div className="flex gap-1">
                  {monthInfo?.hasSales && (
                    <div className="w-2 h-2 bg-success rounded-full" title="Ventas" />
                  )}
                  {monthInfo?.hasCosts && (
                    <div className="w-2 h-2 bg-destructive rounded-full" title="Costos" />
                  )}
                  {monthInfo?.hasProduction && (
                    <div className="w-2 h-2 bg-info rounded-full" title="Producción" />
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        onClick={goToNextMonth}
        disabled={currentIndex <= 0}
        className="h-6 w-6"
      >
        <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  );
}
