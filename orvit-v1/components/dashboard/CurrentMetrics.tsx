'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  BarChart3,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, formatPercentage } from './utils/metrics';
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics'; // ✨ OPTIMIZADO

interface CurrentMetricsProps {
  companyId: string;
  selectedMonth?: string;
}

interface MetricsData {
  currentMetrics: {
    ventas: number;
    costos: number;
    sueldos: number;
    indirectos?: number;
    compras?: number;
    materiales?: number;
    margenBruto: number;
    margenNeto: number;
    margenBrutoPct: number;
    margenNetoPct: number;
  };
  changes: {
    ventas: { amount: number; percentage: number };
    costos: { amount: number; percentage: number };
    sueldos: { amount: number; percentage: number };
  };
  period: {
    current: string;
    previous: string | null;
  };
}

export function CurrentMetrics({ companyId, selectedMonth }: CurrentMetricsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // ✨ OPTIMIZADO: Usar React Query hook para evitar fetches duplicados
  const { data: metrics, isLoading } = useDashboardMetrics(companyId, selectedMonth || '');

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <p className="text-muted-foreground">No se pudieron cargar las métricas actuales</p>
        </CardContent>
      </Card>
    );
  }

  const costBreakdown = metrics.metrics?.costBreakdown || {};
  const ventasActuales =
    metrics.currentMetrics?.ventas ?? metrics.metrics?.totalSales ?? 0;
  const costosTotalesCalculados =
    metrics.currentMetrics?.costos ??
    metrics.metrics?.totalCosts ??
    ((costBreakdown.materials || 0) +
      (costBreakdown.indirects || 0) +
      (costBreakdown.employees || 0) +
      (costBreakdown.purchases || 0));
  const sueldosTotales =
    metrics.currentMetrics?.sueldos ?? costBreakdown.employees ?? 0;
  const indirectosTotales =
    metrics.currentMetrics?.indirectos ?? costBreakdown.indirects ?? 0;
  const comprasTotales =
    metrics.currentMetrics?.compras ?? costBreakdown.purchases ?? 0;
  const materialesTotales =
    metrics.currentMetrics?.materiales ?? costBreakdown.materials ?? 0;

  const margenBrutoValor =
    metrics.currentMetrics?.margenBruto ??
    (ventasActuales -
      (materialesTotales + indirectosTotales + sueldosTotales + comprasTotales));
  const margenNetoValor =
    metrics.currentMetrics?.margenNeto ??
    ventasActuales - costosTotalesCalculados;

  const margenBrutoPct =
    metrics.currentMetrics?.margenBrutoPct ??
    (ventasActuales > 0 ? (margenBrutoValor / ventasActuales) * 100 : 0);
  const margenNetoPct =
    metrics.currentMetrics?.margenNetoPct ??
    (ventasActuales > 0 ? (margenNetoValor / ventasActuales) * 100 : 0);

  const cambios = metrics.changes ?? {
    ventas: { amount: 0, percentage: 0 },
    costos: { amount: 0, percentage: 0 },
    sueldos: { amount: 0, percentage: 0 }
  };

  const periodInfo = metrics.period ?? {
    current: metrics.monthSummary?.month ?? '',
    previous: null
  };

  const metricsCards = [
    {
      title: 'Ventas Totales',
      value: ventasActuales,
      change: cambios.ventas,
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success-muted',
      borderColor: 'border-success-muted'
    },
    {
      title: 'Costos Totales',
      value: costosTotalesCalculados,
      change: cambios.costos,
      icon: ShoppingCart,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30',
      breakdown: {
        materiales: materialesTotales,
        indirectos: indirectosTotales,
        compras: comprasTotales,
        sueldos: sueldosTotales
      }
    },
    {
      title: 'Sueldos',
      value: sueldosTotales,
      change: cambios.sueldos,
      icon: Users,
      color: 'text-info-muted-foreground',
      bgColor: 'bg-info-muted',
      borderColor: 'border-info-muted'
    },
    {
      title: 'Margen Neto',
      value: margenNetoValor,
      change: {
        amount: 0,
        percentage: margenNetoPct
      },
      icon: BarChart3,
      color: 'text-info-muted-foreground',
      bgColor: 'bg-info-muted',
      borderColor: 'border-info-muted'
    }
  ];

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-foreground">
              Métricas Actuales
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {metrics.period.current} {metrics.period.previous && `vs ${metrics.period.previous}`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Contraer
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Expandir
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className={cn('grid gap-4', isExpanded ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-4')}>
        <TooltipProvider delayDuration={200}>
          {metricsCards.map((metric, index) => {
            const Icon = metric.icon;
            const isPositive = metric.change.percentage >= 0;
            const hasBreakdown = !!metric.breakdown;
            
            return (
              <div
                key={index}
                className={cn('p-4 rounded-lg border relative', metric.bgColor, metric.borderColor)}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={cn('h-5 w-5', metric.color)} />
                  <Badge 
                    variant="secondary" 
                    className={cn('text-xs', isPositive ? 'bg-success-muted text-success border-success-muted' : 'bg-destructive/10 text-destructive border-destructive/30')}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {formatPercentage(Math.abs(metric.change.percentage))}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
                    {hasBreakdown && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent className="space-y-2">
                          <div className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                            Composición de costos
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span>Materiales</span>
                              <span className="font-medium">
                                {formatCurrency(
                                  metric.breakdown?.materiales ??
                                    metric.breakdown?.materials ??
                                    0
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Sueldos</span>
                              <span className="font-medium">
                                {formatCurrency(metric.breakdown?.sueldos ?? 0)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Indirectos</span>
                              <span className="font-medium">
                                {formatCurrency(metric.breakdown?.indirectos ?? 0)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Compras</span>
                              <span className="font-medium">
                                {formatCurrency(metric.breakdown?.compras ?? 0)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 border-t pt-1">
                              <span>Total</span>
                              <span className="font-semibold">
                                {formatCurrency(
                                  (metric.breakdown?.materiales ??
                                    metric.breakdown?.materials ??
                                    0) +
                                    (metric.breakdown?.sueldos ?? 0) +
                                    (metric.breakdown?.indirectos ?? 0) +
                                    (metric.breakdown?.compras ?? 0)
                                )}
                              </span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className={cn('text-2xl font-bold', metric.color)}>
                    {formatCurrency(metric.value)}
                  </p>
                  {isExpanded && (
                    <p className={cn('text-xs', isPositive ? 'text-success' : 'text-destructive')}>
                      {isPositive ? '+' : ''}{formatCurrency(metric.change.amount)} vs anterior
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </TooltipProvider>
        </div>

        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Análisis de Márgenes</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Margen Bruto</span>
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(metrics.currentMetrics.margenBruto)} ({formatPercentage(metrics.currentMetrics.margenBrutoPct)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Margen Neto</span>
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(metrics.currentMetrics.margenNeto)} ({formatPercentage(metrics.currentMetrics.margenNetoPct)})
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Resumen del Período</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Período actual</span>
                    <span className="text-sm font-medium text-foreground">{metrics.period.current}</span>
                  </div>
                  {metrics.period.previous && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Período anterior</span>
                      <span className="text-sm font-medium text-foreground">{metrics.period.previous}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
