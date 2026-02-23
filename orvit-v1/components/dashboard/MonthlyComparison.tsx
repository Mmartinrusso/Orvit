'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency, formatPercentage } from './utils/metrics';

interface MonthlyComparisonProps {
  currentMonth: {
    sales: number;
    costs: number;
    margin: number;
    units: number;
  };
  previousMonth?: {
    sales: number;
    costs: number;
    margin: number;
    units: number;
  } | null;
  monthLabel?: string;
}

export function MonthlyComparison({ currentMonth, previousMonth, monthLabel }: MonthlyComparisonProps) {
  // Calcular cambios porcentuales
  const calculateChange = (current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const salesChange = calculateChange(currentMonth.sales, previousMonth?.sales);
  const costsChange = calculateChange(currentMonth.costs, previousMonth?.costs);
  const marginChange = previousMonth ? currentMonth.margin - previousMonth.margin : null;
  const unitsChange = calculateChange(currentMonth.units, previousMonth?.units);

  // Determinar si el cambio es positivo (verde) o negativo (rojo)
  // Para costos, menor es mejor, así que invertimos la lógica
  const getChangeColor = (change: number | null, invertLogic = false) => {
    if (change === null) return 'text-muted-foreground';
    if (invertLogic) {
      return change > 0 ? 'text-destructive' : change < 0 ? 'text-success' : 'text-muted-foreground';
    }
    return change > 0 ? 'text-success' : change < 0 ? 'text-destructive' : 'text-muted-foreground';
  };

  const getChangeIcon = (change: number | null) => {
    if (change === null) return <Minus className="h-3 w-3" />;
    if (change > 0) return <ArrowUpRight className="h-3 w-3" />;
    if (change < 0) return <ArrowDownRight className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const formatChange = (change: number | null, isPercentagePoints = false) => {
    if (change === null) return 'N/A';
    const sign = change > 0 ? '+' : '';
    if (isPercentagePoints) {
      return `${sign}${formatNumber(change, 1)}pp`;
    }
    return `${sign}${formatNumber(change, 1)}%`;
  };

  if (!previousMonth) {
    return null;
  }

  const metrics = [
    {
      label: 'Ventas',
      current: formatCurrency(currentMonth.sales),
      change: salesChange,
      invertLogic: false
    },
    {
      label: 'Costos',
      current: formatCurrency(currentMonth.costs),
      change: costsChange,
      invertLogic: true // Para costos, menor es mejor
    },
    {
      label: 'Margen',
      current: formatPercentage(currentMonth.margin),
      change: marginChange,
      isPercentagePoints: true,
      invertLogic: false
    },
    {
      label: 'Unidades',
      current: currentMonth.units.toLocaleString(),
      change: unitsChange,
      invertLogic: false
    }
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">vs Mes Anterior</span>
          {monthLabel && (
            <span className="text-xs text-muted-foreground">{monthLabel}</span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
              <div className="flex items-center justify-center gap-1">
                {getChangeIcon(metric.change)}
                <span className={cn(
                  "text-sm font-semibold",
                  getChangeColor(metric.change, metric.invertLogic)
                )}>
                  {formatChange(metric.change, metric.isPercentagePoints)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
