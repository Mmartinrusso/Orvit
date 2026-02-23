'use client';

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Activity, Zap, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { formatCurrencyWithDecimals, formatNumber } from './utils/metrics';
import { InfoTooltip } from './InfoTooltip';

interface EfficiencyMetricsProps {
  totalSales: number;
  totalCosts: number;
  totalUnitsSold: number;
  totalUnitsProduced: number;
  marginPercentage: number;
  costBreakdown?: {
    materials: number;
    indirect: number;
    employees: number;
  };
}

export const EfficiencyMetrics = memo(function EfficiencyMetrics({
  totalSales,
  totalCosts,
  totalUnitsSold,
  totalUnitsProduced,
  marginPercentage,
  costBreakdown
}: EfficiencyMetricsProps) {
  // Calcular métricas de eficiencia
  const costEfficiency = totalSales > 0 ? ((totalSales - totalCosts) / totalSales) * 100 : 0;
  const salesPerUnit = totalUnitsSold > 0 ? totalSales / totalUnitsSold : 0;
  const costPerUnit = totalUnitsSold > 0 ? totalCosts / totalUnitsSold : 0;
  const profitPerUnit = salesPerUnit - costPerUnit;

  // Eficiencia de producción vs ventas (qué tan bien se vende lo que se produce)
  const productionToSalesRatio = totalUnitsProduced > 0
    ? (totalUnitsSold / totalUnitsProduced) * 100
    : 0;

  // Determinar nivel de eficiencia
  const getEfficiencyLevel = (ratio: number) => {
    if (ratio >= 90) return { label: 'Excelente', color: 'text-success' };
    if (ratio >= 70) return { label: 'Bueno', color: 'text-muted-foreground' };
    if (ratio >= 50) return { label: 'Regular', color: 'text-warning-muted-foreground' };
    return { label: 'Bajo', color: 'text-destructive' };
  };

  const efficiencyLevel = getEfficiencyLevel(costEfficiency);

  // Métricas adicionales
  const metrics = [
    {
      label: 'Precio Promedio',
      value: formatCurrencyWithDecimals(salesPerUnit),
      sublabel: 'por unidad vendida',
      icon: Package
    },
    {
      label: 'Costo Promedio',
      value: formatCurrencyWithDecimals(costPerUnit),
      sublabel: 'por unidad',
      icon: AlertCircle
    },
    {
      label: 'Ganancia Unitaria',
      value: formatCurrencyWithDecimals(profitPerUnit),
      sublabel: 'por unidad',
      icon: TrendingUp,
      highlight: profitPerUnit > 0
    }
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium text-foreground">
              Eficiencia Operativa
            </CardTitle>
          </div>
          <InfoTooltip
            title="Eficiencia Operativa"
            description="Mide qué tan eficientemente se convierten los ingresos en ganancias. Incluye precio promedio, costo promedio y ganancia por unidad vendida."
            formula="Eficiencia = (Ventas - Costos) / Ventas × 100"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Indicador principal de eficiencia */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                  className="stroke-muted/30 fill-none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                  className={cn(
                    "fill-none transition-all duration-500",
                    costEfficiency >= 25 ? "stroke-success" :
                    costEfficiency >= 15 ? "stroke-muted-foreground" :
                    costEfficiency >= 0 ? "stroke-warning" :
                    "stroke-destructive"
                  )}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 - (Math.min(Math.max(costEfficiency, 0), 100) / 100) * 2 * Math.PI * 40}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-lg font-bold", efficiencyLevel.color)}>
                  {formatNumber(costEfficiency, 0)}%
                </span>
              </div>
            </div>
            <div className="flex-1">
              <p className={cn("text-sm font-semibold", efficiencyLevel.color)}>
                {efficiencyLevel.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Margen de rentabilidad
              </p>
              {totalUnitsProduced > 0 && (
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Producido: </span>
                  <span className="font-medium text-foreground">{formatNumber(totalUnitsProduced)}</span>
                  <span className="text-muted-foreground"> → Vendido: </span>
                  <span className="font-medium text-foreground">{formatNumber(totalUnitsSold)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Métricas por unidad */}
          <div className="grid grid-cols-3 gap-2">
            {metrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div
                  key={index}
                  className={cn(
                    "p-2 rounded-md text-center",
                    metric.highlight
                      ? "bg-success-muted"
                      : "bg-muted/50"
                  )}
                >
                  <p className="text-xs text-muted-foreground mb-0.5">{metric.label}</p>
                  <p className={cn(
                    "text-sm font-bold",
                    metric.highlight ? "text-success" : "text-foreground"
                  )}>
                    {metric.value}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Barra de ratio costo/venta */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Ratio Costo/Venta</span>
              <span className={cn(
                "font-semibold",
                100 - costEfficiency <= 60 ? "text-success" :
                100 - costEfficiency <= 80 ? "text-warning-muted-foreground" :
                "text-destructive"
              )}>
                {formatNumber(100 - costEfficiency, 1)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  100 - costEfficiency <= 60 ? "bg-success" :
                  100 - costEfficiency <= 80 ? "bg-warning" :
                  "bg-destructive"
                )}
                style={{ width: `${Math.min(100 - costEfficiency, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {100 - costEfficiency <= 60
                ? "Los costos están bien controlados"
                : 100 - costEfficiency <= 80
                ? "Oportunidad de reducir costos"
                : "Los costos consumen demasiada ganancia"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
