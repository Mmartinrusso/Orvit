'use client';

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { formatCurrency } from './utils/metrics';
import { InfoTooltip } from './InfoTooltip';

interface CostComponent {
  label: string;
  amount: number;
  percentage: number;
}

interface CostVariationProps {
  currentCosts: {
    total: number;
    components: CostComponent[];
  };
  previousCosts?: {
    total: number;
    components: CostComponent[];
  } | null;
}

export const CostVariation = memo(function CostVariation({ currentCosts, previousCosts }: CostVariationProps) {
  // Calcular variación total
  const totalVariation = previousCosts
    ? ((currentCosts.total - previousCosts.total) / previousCosts.total) * 100
    : null;

  const totalDifference = previousCosts
    ? currentCosts.total - previousCosts.total
    : null;

  // Calcular variación por componente
  const componentVariations = currentCosts.components.map(current => {
    const previous = previousCosts?.components.find(p => p.label === current.label);
    const variation = previous && previous.amount > 0
      ? ((current.amount - previous.amount) / previous.amount) * 100
      : null;
    const difference = previous ? current.amount - previous.amount : null;

    return {
      ...current,
      previousAmount: previous?.amount || 0,
      variation,
      difference
    };
  });

  // Encontrar el componente con mayor incremento y mayor reducción
  const sortedByVariation = [...componentVariations]
    .filter(c => c.variation !== null)
    .sort((a, b) => (b.variation || 0) - (a.variation || 0));

  const biggestIncrease = sortedByVariation.find(c => (c.variation || 0) > 0);
  const biggestDecrease = sortedByVariation.reverse().find(c => (c.variation || 0) < 0);

  const getVariationIcon = (variation: number | null) => {
    if (variation === null) return <Minus className="h-3 w-3 text-gray-400" />;
    if (variation > 0) return <TrendingUp className="h-3 w-3 text-red-500" />;
    if (variation < 0) return <TrendingDown className="h-3 w-3 text-green-500" />;
    return <Minus className="h-3 w-3 text-gray-400" />;
  };

  const getVariationColor = (variation: number | null) => {
    if (variation === null) return 'text-gray-500';
    // Para costos: incremento es malo (rojo), reducción es buena (verde)
    if (variation > 5) return 'text-red-600 dark:text-red-400';
    if (variation > 0) return 'text-amber-600 dark:text-amber-400';
    if (variation < -5) return 'text-green-600 dark:text-green-400';
    if (variation < 0) return 'text-green-600 dark:text-green-400';
    return 'text-gray-500';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium text-foreground">
              Variación de Costos
            </CardTitle>
          </div>
          <InfoTooltip
            title="Variación de Costos"
            description="Compara los costos del mes actual con el mes anterior, mostrando incrementos y reducciones por categoría."
            formula="Variación % = (Actual - Anterior) / Anterior × 100"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Variación total */}
          <div className={cn(
            "p-3 rounded-lg border",
            totalVariation === null ? "bg-muted/50 border-border" :
            totalVariation > 5 ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50" :
            totalVariation > 0 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50" :
            totalVariation < -5 ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50" :
            "bg-muted/50 border-border"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Costo Total vs Mes Anterior</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(currentCosts.total)}</p>
              </div>
              {totalVariation !== null ? (
                <div className="text-right">
                  <div className={cn("flex items-center gap-1 justify-end", getVariationColor(totalVariation))}>
                    {getVariationIcon(totalVariation)}
                    <span className="text-lg font-bold">
                      {totalVariation > 0 ? '+' : ''}{totalVariation.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {totalDifference && totalDifference > 0 ? '+' : ''}{totalDifference ? formatCurrency(totalDifference) : 'N/A'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos previos</p>
              )}
            </div>
          </div>

          {/* Desglose por componente */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Por Categoría</p>
            {componentVariations.map((component, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{component.label}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(component.amount)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {component.variation !== null ? (
                    <>
                      {getVariationIcon(component.variation)}
                      <span className={cn("text-xs font-semibold", getVariationColor(component.variation))}>
                        {component.variation > 0 ? '+' : ''}{component.variation.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Alertas de mayor cambio */}
          {(biggestIncrease || biggestDecrease) && previousCosts && (
            <div className="pt-3 border-t border-border space-y-2">
              {biggestIncrease && (biggestIncrease.variation || 0) > 5 && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-red-50 dark:bg-red-950/30">
                  <TrendingUp className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-400">
                    <strong>{biggestIncrease.label}</strong> subió {biggestIncrease.variation?.toFixed(1)}%
                  </p>
                </div>
              )}
              {biggestDecrease && (biggestDecrease.variation || 0) < -5 && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-green-50 dark:bg-green-950/30">
                  <TrendingDown className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-green-700 dark:text-green-400">
                    <strong>{biggestDecrease.label}</strong> bajó {Math.abs(biggestDecrease.variation || 0).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {!previousCosts && (
            <p className="text-xs text-center text-muted-foreground py-2">
              Selecciona un mes con datos anteriores para ver la variación
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
