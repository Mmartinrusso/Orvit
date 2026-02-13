'use client';

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatCurrency, formatNumber } from './utils/metrics';
import { InfoTooltip } from './InfoTooltip';

interface BreakEvenAnalysisProps {
  totalSales: number;
  totalCosts: number;
  totalUnitsSold: number;
  fixedCosts?: number; // Si no se pasa, estimamos un % de los costos totales
  variableCostPerUnit?: number;
  averagePricePerUnit?: number;
}

export const BreakEvenAnalysis = memo(function BreakEvenAnalysis({
  totalSales,
  totalCosts,
  totalUnitsSold,
  fixedCosts,
  variableCostPerUnit,
  averagePricePerUnit
}: BreakEvenAnalysisProps) {
  // Calcular métricas
  const avgPrice = averagePricePerUnit || (totalUnitsSold > 0 ? totalSales / totalUnitsSold : 0);
  const avgVariableCost = variableCostPerUnit || (totalUnitsSold > 0 ? totalCosts / totalUnitsSold : 0);

  // Estimación de costos fijos (si no se proveen, asumimos 30% del total como fijos)
  const estimatedFixedCosts = fixedCosts || totalCosts * 0.3;
  const estimatedVariableCosts = totalCosts - estimatedFixedCosts;
  const variableCostPerUnitCalc = totalUnitsSold > 0 ? estimatedVariableCosts / totalUnitsSold : 0;

  // Margen de contribución por unidad = Precio - Costo Variable
  const contributionMargin = avgPrice - variableCostPerUnitCalc;

  // Punto de equilibrio en unidades = Costos Fijos / Margen de Contribución
  const breakEvenUnits = contributionMargin > 0 ? Math.ceil(estimatedFixedCosts / contributionMargin) : 0;

  // Punto de equilibrio en ingresos = Unidades PE × Precio Promedio
  const breakEvenRevenue = breakEvenUnits * avgPrice;

  // Progreso hacia el punto de equilibrio
  const progressPercentage = breakEvenUnits > 0 ? Math.min((totalUnitsSold / breakEvenUnits) * 100, 150) : 100;
  const hasReachedBreakEven = totalUnitsSold >= breakEvenUnits;

  // Unidades por encima/debajo del equilibrio
  const unitsDifference = totalUnitsSold - breakEvenUnits;

  // Margen de seguridad = (Ventas Actuales - Ventas PE) / Ventas Actuales
  const safetyMargin = totalSales > 0 && breakEvenRevenue > 0
    ? ((totalSales - breakEvenRevenue) / totalSales) * 100
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium text-foreground">
              Punto de Equilibrio
            </CardTitle>
          </div>
          <InfoTooltip
            title="Punto de Equilibrio"
            description="Calcula cuántas unidades o ingresos necesitas para cubrir todos los costos. El margen de seguridad indica qué tan lejos estás del punto crítico."
            formula="PE = Costos Fijos / (Precio - Costo Variable)"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Indicador principal */}
          <div className={cn(
            "p-3 rounded-lg border",
            hasReachedBreakEven
              ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50"
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {hasReachedBreakEven ? (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
                <span className={cn(
                  "text-sm font-semibold",
                  hasReachedBreakEven
                    ? "text-green-700 dark:text-green-400"
                    : "text-amber-700 dark:text-amber-400"
                )}>
                  {hasReachedBreakEven ? 'Equilibrio Alcanzado' : 'Por Alcanzar'}
                </span>
              </div>
              <span className={cn(
                "text-lg font-bold",
                hasReachedBreakEven
                  ? "text-green-600 dark:text-green-400"
                  : "text-amber-600 dark:text-amber-400"
              )}>
                {progressPercentage.toFixed(0)}%
              </span>
            </div>

            {/* Barra de progreso */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  hasReachedBreakEven ? "bg-green-500" : "bg-amber-500"
                )}
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Métricas del punto de equilibrio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-0.5">PE en Unidades</p>
              <p className="text-sm font-bold text-foreground">{formatNumber(breakEvenUnits)}</p>
            </div>
            <div className="p-2.5 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-0.5">PE en Ingresos</p>
              <p className="text-sm font-bold text-foreground">{formatCurrency(breakEvenRevenue)}</p>
            </div>
          </div>

          {/* Comparación con ventas actuales */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground">Vendido vs Equilibrio</span>
              <span className={cn(
                "font-semibold",
                unitsDifference >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}>
                {unitsDifference >= 0 ? '+' : ''}{formatNumber(unitsDifference)} unidades
              </span>
            </div>

            {/* Margen de seguridad */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Margen de Seguridad</span>
              <span className={cn(
                "font-semibold",
                safetyMargin >= 20 ? "text-green-600 dark:text-green-400" :
                safetyMargin >= 10 ? "text-gray-600 dark:text-gray-400" :
                safetyMargin >= 0 ? "text-amber-600 dark:text-amber-400" :
                "text-red-600 dark:text-red-400"
              )}>
                {safetyMargin.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {safetyMargin >= 20
                ? "Buen colchón de seguridad"
                : safetyMargin >= 10
                ? "Margen aceptable"
                : safetyMargin >= 0
                ? "Margen ajustado, cuidado"
                : "Ventas por debajo del equilibrio"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
