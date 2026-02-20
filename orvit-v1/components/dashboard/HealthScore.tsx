'use client';

import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface HealthScoreProps {
  marginPercentage: number;
  totalSales: number;
  totalCosts: number;
  productCount: number;
  previousMargin?: number;
}

export const HealthScore = memo(function HealthScore({
  marginPercentage,
  totalSales,
  totalCosts,
  productCount,
  previousMargin
}: HealthScoreProps) {
  // Calcular score de salud (0-100)
  const calculateHealthScore = () => {
    let score = 0;

    // Factor 1: Margen (0-40 puntos)
    if (marginPercentage >= 40) score += 40;
    else if (marginPercentage >= 30) score += 35;
    else if (marginPercentage >= 25) score += 30;
    else if (marginPercentage >= 20) score += 25;
    else if (marginPercentage >= 15) score += 20;
    else if (marginPercentage >= 10) score += 15;
    else if (marginPercentage >= 5) score += 10;
    else if (marginPercentage >= 0) score += 5;

    // Factor 2: Rentabilidad positiva (0-20 puntos)
    const netProfit = totalSales - totalCosts;
    if (netProfit > 0) {
      score += 20;
    } else if (netProfit >= -totalSales * 0.1) {
      score += 10;
    }

    // Factor 3: Diversificación de productos (0-20 puntos)
    if (productCount >= 20) score += 20;
    else if (productCount >= 15) score += 15;
    else if (productCount >= 10) score += 12;
    else if (productCount >= 5) score += 8;
    else score += 4;

    // Factor 4: Volumen de ventas (0-20 puntos)
    if (totalSales > 50000000) score += 20;
    else if (totalSales > 30000000) score += 16;
    else if (totalSales > 15000000) score += 12;
    else if (totalSales > 5000000) score += 8;
    else score += 4;

    return Math.min(100, Math.max(0, score));
  };

  const healthScore = calculateHealthScore();
  const marginChange = previousMargin ? marginPercentage - previousMargin : 0;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-success';
    if (score >= 40) return 'text-warning-muted-foreground';
    if (score >= 20) return 'text-warning-muted-foreground';
    return 'text-destructive';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bueno';
    if (score >= 40) return 'Regular';
    if (score >= 20) return 'En riesgo';
    return 'Crítico';
  };

  const getScoreRingColor = (score: number) => {
    if (score >= 80) return 'stroke-success';
    if (score >= 60) return 'stroke-success';
    if (score >= 40) return 'stroke-warning';
    if (score >= 20) return 'stroke-warning';
    return 'stroke-destructive';
  };

  const circumference = 2 * Math.PI * 40; // Radio de 40
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  return (
    <Card className="border !bg-transparent hover:shadow-lg transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Círculo de progreso */}
          <div className="relative flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                strokeWidth="8"
                className="stroke-muted/20 fill-none"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                strokeWidth="8"
                className={cn("fill-none transition-all duration-500", getScoreRingColor(healthScore))}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-xl font-bold", getScoreColor(healthScore))}>
                {healthScore}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Salud del Negocio</span>
              <InfoTooltip
                title="Salud del Negocio"
                description="Indicador compuesto que evalúa la salud financiera general del negocio en una escala de 0-100, considerando múltiples factores clave."
                formula="Score = Margen (0-40pts) + Rentabilidad (0-20pts) + Diversificación (0-20pts) + Volumen (0-20pts)"
              />
            </div>
            <p className={cn("text-lg font-semibold", getScoreColor(healthScore))}>
              {getScoreLabel(healthScore)}
            </p>
            {marginChange !== 0 && (
              <div className="flex items-center gap-1 mt-1">
                {marginChange > 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  marginChange > 0 ? "text-success" : "text-destructive"
                )}>
                  {marginChange > 0 ? '+' : ''}{marginChange.toFixed(1)}% margen
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
