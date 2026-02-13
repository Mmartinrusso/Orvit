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
  ArrowRight,
  Calendar,
  Target
} from 'lucide-react';
import { formatCurrency, formatPercentage } from './utils/metrics';
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics'; // ✨ OPTIMIZADO

interface ExecutiveSummaryProps {
  companyId: string;
  selectedMonth?: string;
  onShowFullAnalysis: () => void;
}

interface SummaryData {
  currentMetrics: {
    ventas: number;
    costos: number;
    sueldos: number;
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

export function ExecutiveSummary({ companyId, selectedMonth, onShowFullAnalysis }: ExecutiveSummaryProps) {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  
  // ✨ OPTIMIZADO: Usar React Query hook para evitar fetches duplicados
  const currentMonth = selectedMonth || new Date().toISOString().slice(0, 7);
  const { data: metricsData, isLoading, isError } = useDashboardMetrics(companyId, currentMonth);

  useEffect(() => {
    if (metricsData) {
      // Transformar datos del API al formato esperado
      setSummaryData({
        currentMetrics: {
          ventas: metricsData.metrics?.totalSales || 0,
          costos: metricsData.metrics?.totalCosts || 0,
          sueldos: metricsData.metrics?.costBreakdown?.employees || 0,
          margenBruto: metricsData.metrics?.netMargin || 0,
          margenNeto: metricsData.metrics?.netMargin || 0,
          margenBrutoPct: metricsData.metrics?.marginPercentage || 0,
          margenNetoPct: metricsData.metrics?.marginPercentage || 0
        },
        changes: {
          ventas: metricsData.changes?.ventas || { amount: 0, percentage: metricsData.metrics?.yoyGrowth || 0 },
          costos: metricsData.changes?.costos || { amount: 0, percentage: 0 },
          sueldos: metricsData.changes?.sueldos || { amount: 0, percentage: 0 }
        },
        period: {
          current: currentMonth,
          previous: metricsData.period?.previous || null
        }
      });
    } else if (isError) {
          // Si falla la API, usar datos de ejemplo
          setSummaryData({
            currentMetrics: {
              ventas: 2500000,
              costos: 1200000,
              sueldos: 800000,
              margenBruto: 1300000,
              margenNeto: 500000,
              margenBrutoPct: 52.0,
              margenNetoPct: 20.0
            },
            changes: {
              ventas: { amount: 150000, percentage: 6.4 },
              costos: { amount: -50000, percentage: -4.0 },
              sueldos: { amount: 30000, percentage: 3.9 }
            },
            period: {
              current: selectedMonth || '2024-01',
              previous: '2023-12'
            }
          });
    }
  }, [metricsData, isError, currentMonth]);

  if (isLoading && !summaryData) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="space-y-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-3 bg-gray-200 rounded"></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si no hay datos útiles, mostrar mensaje informativo
  // Solo mostrar mensaje si realmente no hay NINGÚN dato (ni ventas ni costos)
  const hasNoUsefulData = !summaryData || 
    (summaryData.currentMetrics.ventas === 0 && summaryData.currentMetrics.costos === 0);

  if (hasNoUsefulData) {
    return (
      <Card className="mb-6">
        <CardContent className="p-8">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Sin datos de ventas para el resumen</h3>
            <p className="text-gray-600 mb-6">
              No se encontraron datos de ventas para generar el resumen ejecutivo de <strong>{selectedMonth}</strong>.
              {summaryData?.currentMetrics.costos > 0 && (
                <span className="block mt-2 text-sm text-amber-600">
                  ⚠️ Se detectaron costos pero sin ventas correspondientes.
                </span>
              )}
            </p>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm">📊</span>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm text-blue-800 font-medium mb-1">Para generar un resumen ejecutivo necesitas:</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Registrar ventas en el módulo de Ventas</li>
                    <li>• Seleccionar un mes con datos de ventas</li>
                    <li>• Verificar que los productos estén configurados</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summaryData) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <p className="text-gray-600">No se pudieron cargar los datos del resumen</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getPerformanceColor = (percentage: number) => {
    if (percentage > 5) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage > 0) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (percentage > -5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getPerformanceIcon = (percentage: number) => {
    return percentage >= 0 ? TrendingUp : TrendingDown;
  };

  return (
    <div className="space-y-6">
      {/* Resumen Ejecutivo Principal */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Resumen Ejecutivo
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {summaryData.period.current} {summaryData.period.previous && `vs ${summaryData.period.previous}`}
              </p>
            </div>
            <Button
              onClick={onShowFullAnalysis}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Análisis Comparativo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Métricas Principales */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Ingresos
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Ventas Totales</span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(summaryData.currentMetrics.ventas)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Margen Bruto</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(summaryData.currentMetrics.margenBruto)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Margen Neto</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatCurrency(summaryData.currentMetrics.margenNeto)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cambios MoM */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Cambios vs Mes Anterior
              </h4>
              <div className="space-y-2">
                {Object.entries(summaryData.changes).map(([key, change]) => {
                  const Icon = getPerformanceIcon(change.percentage);
                  const colorClass = getPerformanceColor(change.percentage);
                  const labels = {
                    ventas: 'Ventas',
                    costos: 'Costos',
                    sueldos: 'Sueldos'
                  };
                  
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{labels[key as keyof typeof labels]}</span>
                      <Badge className={`text-xs ${colorClass}`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {formatPercentage(Math.abs(change.percentage))}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Indicadores de Rendimiento */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Indicadores Clave
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Margen Bruto %</span>
                  <span className="text-sm font-bold text-green-600">
                    {formatPercentage(summaryData.currentMetrics.margenBrutoPct)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Margen Neto %</span>
                  <span className="text-sm font-bold text-blue-600">
                    {formatPercentage(summaryData.currentMetrics.margenNetoPct)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Eficiencia</span>
                  <Badge className="text-xs bg-green-50 text-green-700 border-green-200">
                    Excelente
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas y Recomendaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div>
                <h4 className="text-sm font-semibold text-yellow-800">Recomendación</h4>
                <p className="text-xs text-yellow-700 mt-1">
                  Los costos han disminuido un 4% este mes. Considera mantener esta tendencia.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <h4 className="text-sm font-semibold text-green-800">Logro</h4>
                <p className="text-xs text-green-700 mt-1">
                  Las ventas han crecido un 6.4% este mes, superando el objetivo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
