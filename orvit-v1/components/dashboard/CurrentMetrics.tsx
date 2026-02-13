'use client';

import { useState, useEffect } from 'react';
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
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
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
          <p className="text-gray-600">No se pudieron cargar las métricas actuales</p>
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
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Costos Totales',
      value: costosTotalesCalculados,
      change: cambios.costos,
      icon: ShoppingCart,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
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
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Margen Neto',
      value: margenNetoValor,
      change: {
        amount: 0,
        percentage: margenNetoPct
      },
      icon: BarChart3,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ];

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-gray-900">
              Métricas Actuales
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
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
        <div className={`grid gap-4 ${isExpanded ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
        <TooltipProvider delayDuration={200}>
          {metricsCards.map((metric, index) => {
            const Icon = metric.icon;
            const isPositive = metric.change.percentage >= 0;
            const hasBreakdown = !!metric.breakdown;
            
            return (
              <div
                key={index}
                className={`p-4 rounded-lg border relative ${metric.bgColor} ${metric.borderColor}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`h-5 w-5 ${metric.color}`} />
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${
                      isPositive 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
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
                    <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                    {hasBreakdown && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-gray-500 hover:text-gray-700 cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent className="space-y-2">
                          <div className="text-xs uppercase tracking-wide font-semibold text-gray-500">
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
                  <p className={`text-2xl font-bold ${metric.color}`}>
                    {formatCurrency(metric.value)}
                  </p>
                  {isExpanded && (
                    <p className={`text-xs ${
                      isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
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
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Análisis de Márgenes</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Margen Bruto</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(metrics.currentMetrics.margenBruto)} ({formatPercentage(metrics.currentMetrics.margenBrutoPct)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Margen Neto</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(metrics.currentMetrics.margenNeto)} ({formatPercentage(metrics.currentMetrics.margenNetoPct)})
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Resumen del Período</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Período actual</span>
                    <span className="text-sm font-medium text-gray-900">{metrics.period.current}</span>
                  </div>
                  {metrics.period.previous && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Período anterior</span>
                      <span className="text-sm font-medium text-gray-900">{metrics.period.previous}</span>
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
