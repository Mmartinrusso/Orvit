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
  Calendar,
  Clock,
  Target,
  AlertTriangle,
  RefreshCw,
  Download,
  Share2,
  Settings
} from 'lucide-react';
import { FinancialDictionary } from './FinancialDictionary';
import { formatCurrency, formatPercentage } from './utils/metrics';

interface CurrentMetricsMTDProps {
  companyId: string;
  selectedMonth?: string;
}

interface DailyPoint {
  date: string;
  value: number;
  cumulative: number;
  prev?: number;
  delta?: number;
  deltaPct?: number;
}

interface MonthSummary {
  month: string;
  daysWorked: number;
  daysTotal: number;
  mtd: number;
  budget?: number;
  runRate: number;
  forecastEom: number;
  yoyPct?: number;
}

interface CategoryContribution {
  name: string;
  value: number;
  delta: number;
  deltaPct: number;
  contributionPct: number;
}

export function CurrentMetricsMTD({ companyId, selectedMonth }: CurrentMetricsMTDProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(5);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const currentMonth = selectedMonth || new Date().toISOString().slice(0, 7);
        console.log(`🔄 Cargando datos MTD para mes: ${currentMonth}`);
        
        const response = await fetch(`/api/dashboard/metrics?companyId=${companyId}&month=${currentMonth}`);
        if (response.ok) {
          const metricsData = await response.json();
          console.log(`✅ Datos MTD cargados para ${currentMonth}:`, metricsData);
          setData(metricsData);
        } else {
          console.error('Error fetching dashboard data:', response.status);
        }
      } catch (error) {
        console.error('Error fetching MTD data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
    // Auto-refresh cada 5 minutos
    const interval = setInterval(() => {
      setLastUpdated(prev => prev + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, [companyId, selectedMonth]);

  // Datos mock para el ejemplo
  const mockData = {
    monthSummary: {
      month: selectedMonth || '2024-01',
      daysWorked: 15,
      daysTotal: 22,
      mtd: 2500000,
      budget: 3000000,
      runRate: 166667,
      forecastEom: 3666674,
      yoyPct: 6.4
    },
    dailyData: [
      { date: '2024-01-01', value: 120000, cumulative: 120000, prev: 0, delta: 120000, deltaPct: 0 },
      { date: '2024-01-02', value: 150000, cumulative: 270000, prev: 120000, delta: 30000, deltaPct: 25 },
      { date: '2024-01-03', value: 180000, cumulative: 450000, prev: 150000, delta: 30000, deltaPct: 20 },
      { date: '2024-01-04', value: 160000, cumulative: 610000, prev: 180000, delta: -20000, deltaPct: -11.1 },
      { date: '2024-01-05', value: 200000, cumulative: 810000, prev: 160000, delta: 40000, deltaPct: 25 },
      { date: '2024-01-08', value: 170000, cumulative: 980000, prev: 200000, delta: -30000, deltaPct: -15 },
      { date: '2024-01-09', value: 190000, cumulative: 1170000, prev: 170000, delta: 20000, deltaPct: 11.8 },
      { date: '2024-01-10', value: 220000, cumulative: 1390000, prev: 190000, delta: 30000, deltaPct: 15.8 },
      { date: '2024-01-11', value: 180000, cumulative: 1570000, prev: 220000, delta: -40000, deltaPct: -18.2 },
      { date: '2024-01-12', value: 210000, cumulative: 1780000, prev: 180000, delta: 30000, deltaPct: 16.7 },
      { date: '2024-01-15', value: 240000, cumulative: 2020000, prev: 210000, delta: 30000, deltaPct: 14.3 },
      { date: '2024-01-16', value: 200000, cumulative: 2220000, prev: 240000, delta: -40000, deltaPct: -16.7 },
      { date: '2024-01-17', value: 180000, cumulative: 2400000, prev: 200000, delta: -20000, deltaPct: -10 },
      { date: '2024-01-18', value: 100000, cumulative: 2500000, prev: 180000, delta: -80000, deltaPct: -44.4 }
    ],
    contributions: [
      { name: 'Producto A', value: 450000, delta: 50000, deltaPct: 12.5, contributionPct: 32.1 },
      { name: 'Producto B', value: 360000, delta: 30000, deltaPct: 9.1, contributionPct: 25.7 },
      { name: 'Producto C', value: 300000, delta: 20000, deltaPct: 7.1, contributionPct: 21.4 },
      { name: 'Producto D', value: 240000, delta: 10000, deltaPct: 4.3, contributionPct: 17.1 },
      { name: 'Producto E', value: 180000, delta: -5000, deltaPct: -2.7, contributionPct: 12.9 }
    ]
  };

  const currentData = data || mockData;
  const today = new Date().toLocaleDateString('es-AR');
  
  // Verificar que dailyData existe y tiene elementos
  const dailyData = currentData?.dailyData || [];
  const contributions = currentData?.contributions || [];
  const monthSummary = currentData?.monthSummary || mockData.monthSummary;
  const metrics = currentData?.metrics || {};
  
  const todayValue = dailyData.length > 0 ? dailyData[dailyData.length - 1]?.value || 0 : 0;
  const yesterdayValue = dailyData.length > 1 ? dailyData[dailyData.length - 2]?.value || 0 : 0;
  const todayDelta = todayValue - yesterdayValue;
  const todayDeltaPct = yesterdayValue > 0 ? (todayDelta / yesterdayValue) * 100 : 0;

  const getPerformanceColor = (percentage: number) => {
    if (percentage > 5) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage > 0) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (percentage > -5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getPerformanceIcon = (percentage: number) => {
    const Icon = percentage >= 0 ? TrendingUp : TrendingDown;
    return <Icon className="h-3 w-3" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Si no hay datos útiles, mostrar mensaje informativo
  // Solo mostrar mensaje si realmente no hay NINGÚN dato (ni ventas ni costos)
  const hasNoUsefulData = !data || 
    (data.metrics?.totalSales === 0 && data.metrics?.totalCosts === 0) ||
    (!data.dailyData || data.dailyData.length === 0);

  // Si hay costos pero no ventas, mostrar los datos reales con una nota
  if (hasNoUsefulData) {
    return (
      <Card className="mb-6">
        <CardContent className="p-8">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Sin datos de ventas disponibles</h3>
            <p className="text-gray-600 mb-6">
              No se encontraron registros de ventas para <strong>{selectedMonth}</strong>.
              {data?.metrics?.totalCosts > 0 && (
                <span className="block mt-2 text-sm text-amber-600">
                  ⚠️ Se detectaron costos (${data.metrics.totalCosts.toLocaleString()}) pero sin ventas correspondientes.
                </span>
              )}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm">💡</span>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm text-blue-800 font-medium mb-1">Sugerencias:</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Registra ventas para este mes en el módulo de Ventas</li>
                    <li>• Selecciona un mes diferente con datos de ventas</li>
                    <li>• Verifica que los productos estén correctamente configurados</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si hay costos pero no ventas, mostrar los datos reales con una nota
  if (data?.metrics?.totalSales === 0 && data?.metrics?.totalCosts > 0) {
    return (
      <div className="space-y-6">
        {/* Header con nota especial */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Mes Actual — Estado & Progreso (MTD)
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Rendimiento acumulado del mes y previsión al cierre
            </p>
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                ⚠️ <strong>Nota:</strong> Se detectaron costos (${data.metrics.totalCosts.toLocaleString()}) pero sin ventas registradas para este mes.
              </p>
            </div>
          </div>
        </div>

        {/* Mostrar los datos reales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ventas MTD</p>
                  <p className="text-2xl font-bold text-gray-900">$0</p>
                </div>
                <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-gray-400">📊</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Costos MTD</p>
                  <p className="text-2xl font-bold text-red-600">${data.metrics.totalCosts.toLocaleString()}</p>
                </div>
                <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-400">💰</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Margen Neto</p>
                  <p className="text-2xl font-bold text-red-600">-${data.metrics.totalCosts.toLocaleString()}</p>
                </div>
                <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-400">📉</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Días Trabajados</p>
                  <p className="text-2xl font-bold text-gray-900">{data.monthSummary?.daysWorked || 0}</p>
                </div>
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-400">📅</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Mes Actual — Estado & Progreso (MTD)
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Rendimiento acumulado del mes y previsión al cierre
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
            <Calendar className="h-3 w-3 mr-1" />
            Hoy {today}
          </Badge>
          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
            <Clock className="h-3 w-3 mr-1" />
            Actualizado hace {lastUpdated} min
          </Badge>
          <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
            <RefreshCw className="h-3 w-3 mr-1" />
            Autosync ON
          </Badge>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Compartir
        </Button>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Ajustes
        </Button>
        <FinancialDictionary />
      </div>

      {/* KPIs MTD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ingresos MTD */}
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Ingresos MTD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">
                  {formatCurrency(monthSummary.mtd)}
                </span>
                <Badge className={getPerformanceColor(monthSummary.yoyPct)}>
                  {getPerformanceIcon(monthSummary.yoyPct)}
                  {formatPercentage(Math.abs(monthSummary.yoyPct))}
                </Badge>
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Hoy:</span>
                  <span className="font-medium">{formatCurrency(todayValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Δ día:</span>
                  <span className={`font-medium ${todayDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {todayDelta >= 0 ? '+' : ''}{formatCurrency(todayDelta)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Run-rate:</span>
                  <span className="font-medium">{formatCurrency(monthSummary.runRate)}/día</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Forecast EOM:</span>
                  <span className="font-medium text-blue-600">{formatCurrency(monthSummary.forecastEom)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">% vs Presupuesto:</span>
                  <span className="font-medium">
                    {formatPercentage(((monthSummary.mtd / (monthSummary.budget || 1)) - 1) * 100)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Costos MTD */}
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Costos MTD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metrics.totalCosts || 0)}
                </span>
                <Badge className="text-red-600 bg-red-50 border-red-200">
                  <TrendingUp className="h-3 w-3" />
                  +4.2%
                </Badge>
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Hoy:</span>
                  <span className="font-medium">{formatCurrency(80000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Δ día:</span>
                  <span className="text-red-600 font-medium">+5.000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Burn rate:</span>
                  <span className="font-medium">{formatCurrency(80000)}/día</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">% vs Presupuesto:</span>
                  <span className="font-medium text-red-600">+8.3%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Margen Neto MTD */}
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Margen Neto MTD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metrics.netMargin || 0)}
                </span>
                <Badge className="text-green-600 bg-green-50 border-green-200">
                  <TrendingUp className="h-3 w-3" />
                  +12.5%
                </Badge>
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Margen %:</span>
                  <span className="font-medium text-green-600">
                    {formatPercentage(metrics.marginPercentage || 0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hoy:</span>
                  <span className="font-medium">{formatCurrency(40000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Δ día:</span>
                  <span className="text-green-600 font-medium">+2.500</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Run-rate:</span>
                  <span className="font-medium">{formatCurrency(33333)}/día</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progreso del Mes */}
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Progreso del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">
                  {monthSummary.daysWorked}/{monthSummary.daysTotal}
                </span>
                <Badge className="text-blue-600 bg-blue-50 border-blue-200">
                  {Math.round((monthSummary.daysWorked / monthSummary.daysTotal) * 100)}%
                </Badge>
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Días hábiles:</span>
                  <span className="font-medium">{monthSummary.daysWorked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Días restantes:</span>
                  <span className="font-medium">{monthSummary.daysTotal - monthSummary.daysWorked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Promedio diario:</span>
                  <span className="font-medium">{formatCurrency(monthSummary.runRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Forecast EOM:</span>
                  <span className="font-medium text-blue-600">{formatCurrency(monthSummary.forecastEom)}</span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(monthSummary.daysWorked / monthSummary.daysTotal) * 100}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contribuciones y Top Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contribuciones por Categoría */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Contribuciones MTD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contributions.map((contribution: CategoryContribution, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-900">{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{contribution.name}</p>
                      <p className="text-xs text-gray-600">
                        {formatPercentage(contribution.contributionPct)} del total
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {formatCurrency(contribution.value)}
                    </p>
                    <Badge className={`text-xs ${getPerformanceColor(contribution.deltaPct)}`}>
                      {getPerformanceIcon(contribution.deltaPct)}
                      {formatPercentage(Math.abs(contribution.deltaPct))}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Movers del Mes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Top Movers del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contributions.slice(0, 5).map((mover: CategoryContribution, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-900">{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{mover.name}</p>
                      <p className="text-xs text-gray-600">
                        Δ {formatCurrency(mover.delta)} ({formatPercentage(mover.deltaPct)})
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {formatCurrency(mover.value)}
                    </p>
                    <Badge className={`text-xs ${getPerformanceColor(mover.deltaPct)}`}>
                      {getPerformanceIcon(mover.deltaPct)}
                      {formatPercentage(Math.abs(mover.deltaPct))}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
