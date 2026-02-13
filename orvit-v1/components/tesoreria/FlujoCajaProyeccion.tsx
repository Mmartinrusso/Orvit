'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldAlert,
  Activity,
  Info,
  DollarSign,
  ArrowDown,
  Target,
} from 'lucide-react';
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

const DEFAULT_COLORS = {
  chart1: '#6366f1',
  chart2: '#8b5cf6',
  chart3: '#ec4899',
  chart4: '#f59e0b',
  chart5: '#10b981',
  chart6: '#06b6d4',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};

interface Assumptions {
  cobranzaPct: number;
  diasRetraso: number;
  margenSeguridad: number;
}

const DEFAULT_ASSUMPTIONS: Assumptions = {
  cobranzaPct: 100,
  diasRetraso: 0,
  margenSeguridad: 0,
};

interface ProjectionDay {
  date: string;
  ingresos: number;
  egresos: number;
  neto: number;
  saldoProyectado: number;
  confianza: number;
  riesgo: string;
  desglose: {
    expectedCollections: number;
    expectedCheckDeposits: number;
    expectedPayments: number;
    expectedSalaries: number;
    otherExpected: number;
  };
}

interface HistoricalDay {
  date: string;
  ingresos: number;
  egresos: number;
  saldo: number;
}

interface ProjectionAlert {
  type: string;
  severity: string;
  message: string;
  date?: string;
  amount?: number;
  recommendation: string;
}

interface ProjectionResponse {
  currentPosition: number;
  assumptions: Assumptions;
  historical: HistoricalDay[];
  projections: ProjectionDay[];
  alerts: ProjectionAlert[];
  negativeDays: Array<{ date: string; balance: number; deficit: number }>;
  summary: {
    totalPredictedInflow: number;
    totalPredictedOutflow: number;
    minimumBalance: number;
    minimumBalanceDate: string;
    averageDailyNet: number;
    daysWithDeficit: number;
    maxDeficit: number;
  };
}

async function fetchProjection(assumptions: Assumptions): Promise<ProjectionResponse> {
  const res = await fetch('/api/tesoreria/flujo-caja/proyeccion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      days: 30,
      includeHistorical: true,
      historicalDays: 15,
      ...assumptions,
    }),
  });
  if (!res.ok) throw new Error('Error al obtener proyección');
  return res.json();
}

function getRiskBadge(riskLevel: string) {
  switch (riskLevel) {
    case 'critical':
      return <Badge variant="destructive">Critico</Badge>;
    case 'high':
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Alto</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Medio</Badge>;
    default:
      return <Badge className="bg-green-500 hover:bg-green-600 text-white">Bajo</Badge>;
  }
}

function getOverallRisk(projections: ProjectionDay[]): string {
  if (projections.some(p => p.saldoProyectado < 0)) return 'critical';
  if (projections.some(p => p.riesgo === 'high')) return 'high';
  if (projections.some(p => p.riesgo === 'medium')) return 'medium';
  return 'low';
}

interface ChartDataPoint {
  date: string;
  fullDate: string;
  saldoHistorico: number | null;
  saldoProyectado: number | null;
  ingresos: number | null;
  egresos: number | null;
  isProjection: boolean;
}

export default function FlujoCajaProyeccion() {
  const userColors = DEFAULT_COLORS;

  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [debouncedAssumptions, setDebouncedAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);

  // Debounce assumptions changes (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAssumptions(assumptions);
    }, 400);
    return () => clearTimeout(timer);
  }, [assumptions]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tesoreria', 'proyeccion', debouncedAssumptions],
    queryFn: () => fetchProjection(debouncedAssumptions),
  });

  const handleSliderChange = useCallback((field: keyof Assumptions, value: number[]) => {
    setAssumptions(prev => ({ ...prev, [field]: value[0] }));
  }, []);

  // Combined chart data: historical + projected
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!data) return [];

    const historicalPoints: ChartDataPoint[] = data.historical.map(h => ({
      date: h.date.slice(5), // MM-DD
      fullDate: h.date,
      saldoHistorico: h.saldo,
      saldoProyectado: null,
      ingresos: null,
      egresos: null,
      isProjection: false,
    }));

    // Bridge point: last historical saldo becomes the first projected saldo too
    if (historicalPoints.length > 0 && data.projections.length > 0) {
      const lastHistorical = historicalPoints[historicalPoints.length - 1];
      lastHistorical.saldoProyectado = data.currentPosition;
    }

    const projectionPoints: ChartDataPoint[] = data.projections.map(p => ({
      date: p.date.slice(5),
      fullDate: p.date,
      saldoHistorico: null,
      saldoProyectado: p.saldoProyectado,
      ingresos: p.ingresos,
      egresos: -p.egresos,
      isProjection: true,
    }));

    return [...historicalPoints, ...projectionPoints];
  }, [data]);

  const overallRisk = data ? getOverallRisk(data.projections) : 'low';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Activity className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Calculando proyeccion...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <p className="text-destructive text-sm">Error al cargar la proyeccion avanzada</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.chart1}15` }}
            >
              <Activity className="h-5 w-5" style={{ color: userColors.chart1 }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Proyeccion Avanzada (30 dias)</h3>
              <p className="text-xs text-muted-foreground">
                Historico + proyeccion predictiva con patrones de cobro
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Riesgo general:</span>
            {getRiskBadge(overallRisk)}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Posicion Actual</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(data.currentPosition)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium" style={{
                      color: data.summary.averageDailyNet >= 0 ? userColors.kpiPositive : userColors.kpiNegative
                    }}>
                      {data.summary.averageDailyNet >= 0 ? '+' : ''}{formatCurrency(data.summary.averageDailyNet)}
                    </span> /dia prom.
                  </p>
                </div>
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart1}15` }}
                >
                  <DollarSign className="h-4 w-4" style={{ color: userColors.chart1 }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Ingresos Proy.</p>
                  <p className="text-xl font-bold" style={{ color: userColors.kpiPositive }}>
                    {formatCurrency(data.summary.totalPredictedInflow)}
                  </p>
                </div>
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.kpiPositive}15` }}
                >
                  <TrendingUp className="h-4 w-4" style={{ color: userColors.kpiPositive }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Egresos Proy.</p>
                  <p className="text-xl font-bold" style={{ color: userColors.kpiNegative }}>
                    {formatCurrency(data.summary.totalPredictedOutflow)}
                  </p>
                </div>
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.kpiNegative}15` }}
                >
                  <TrendingDown className="h-4 w-4" style={{ color: userColors.kpiNegative }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Saldo Minimo</p>
                  <p className="text-xl font-bold" style={{
                    color: data.summary.minimumBalance < 0 ? userColors.kpiNegative : userColors.kpiNeutral
                  }}>
                    {formatCurrency(data.summary.minimumBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.summary.minimumBalanceDate.slice(5)}
                  </p>
                </div>
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${data.summary.minimumBalance < 0 ? userColors.kpiNegative : userColors.kpiNeutral}15` }}
                >
                  <ArrowDown className="h-4 w-4" style={{ color: data.summary.minimumBalance < 0 ? userColors.kpiNegative : userColors.kpiNeutral }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={data.summary.daysWithDeficit > 0 ? {
            borderColor: `${userColors.kpiNegative}50`,
            backgroundColor: `${userColors.kpiNegative}08`,
          } : {}}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Dias en Deficit</p>
                  <p className="text-xl font-bold" style={{
                    color: data.summary.daysWithDeficit > 0 ? userColors.kpiNegative : userColors.kpiPositive
                  }}>
                    {data.summary.daysWithDeficit}
                  </p>
                  {data.summary.maxDeficit > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Max: {formatCurrency(data.summary.maxDeficit)}
                    </p>
                  )}
                </div>
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${data.summary.daysWithDeficit > 0 ? userColors.kpiNegative : userColors.kpiPositive}15` }}
                >
                  <AlertTriangle className="h-4 w-4" style={{ color: data.summary.daysWithDeficit > 0 ? userColors.kpiNegative : userColors.kpiPositive }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart: Historical + Projected */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: userColors.chart1 }} />
              Saldo Historico + Proyeccion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="saldoHistGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={userColors.kpiNeutral} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={userColors.kpiNeutral} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="saldoProjGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={userColors.chart1} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={userColors.chart1} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as ChartDataPoint;
                      const isProj = d?.isProjection;
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{d?.fullDate}</p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {isProj ? 'Proyectado' : 'Historico'}
                            </Badge>
                          </div>
                          {isProj && d?.ingresos != null && (
                            <p style={{ color: userColors.kpiPositive }}>
                              Ingresos: {formatCurrency(d.ingresos)}
                            </p>
                          )}
                          {isProj && d?.egresos != null && (
                            <p style={{ color: userColors.kpiNegative }}>
                              Egresos: {formatCurrency(Math.abs(d.egresos))}
                            </p>
                          )}
                          {!isProj && d?.saldoHistorico != null && (
                            <p className="font-semibold" style={{ color: userColors.kpiNeutral }}>
                              Saldo: {formatCurrency(d.saldoHistorico)}
                            </p>
                          )}
                          {isProj && d?.saldoProyectado != null && (
                            <p className="font-semibold mt-1" style={{
                              color: d.saldoProyectado >= 0 ? userColors.chart1 : userColors.kpiNegative
                            }}>
                              Saldo Proy.: {formatCurrency(d.saldoProyectado)}
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(value: string) => <span className="text-xs">{value}</span>}
                  />
                  <ReferenceLine y={0} stroke={userColors.kpiNegative} strokeDasharray="4 4" strokeWidth={1.5} />

                  {/* Historical balance: solid line */}
                  <Line
                    type="monotone"
                    dataKey="saldoHistorico"
                    name="Saldo Historico"
                    stroke={userColors.kpiNeutral}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />

                  {/* Projected balance: area fill */}
                  <Area
                    type="monotone"
                    dataKey="saldoProyectado"
                    name="Saldo Proyectado"
                    stroke={userColors.chart1}
                    fill="url(#saldoProjGradient)"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 4, fill: userColors.chart1 }}
                    connectNulls={false}
                  />

                  {/* Projected inflow/outflow bars */}
                  <Bar
                    dataKey="ingresos"
                    name="Ingresos Proy."
                    fill={userColors.kpiPositive}
                    opacity={0.7}
                    radius={[2, 2, 0, 0]}
                    barSize={6}
                  />
                  <Bar
                    dataKey="egresos"
                    name="Egresos Proy."
                    fill={userColors.kpiNegative}
                    opacity={0.7}
                    radius={[0, 0, 2, 2]}
                    barSize={6}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Assumptions Sliders + Alerts */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Sliders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" style={{ color: userColors.chart2 }} />
                Ajustar Supuestos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cobranza % */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">% Cobranza esperada</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Porcentaje de facturas pendientes que se espera cobrar efectivamente</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{
                    color: assumptions.cobranzaPct >= 80 ? userColors.kpiPositive : userColors.chart4
                  }}>
                    {assumptions.cobranzaPct}%
                  </span>
                </div>
                <Slider
                  value={[assumptions.cobranzaPct]}
                  onValueChange={(v) => handleSliderChange('cobranzaPct', v)}
                  min={50}
                  max={100}
                  step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Dias de retraso */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">Dias de retraso promedio</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Dias adicionales de demora a aplicar sobre la fecha esperada de cobro</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{
                    color: assumptions.diasRetraso === 0 ? userColors.kpiPositive : userColors.chart4
                  }}>
                    {assumptions.diasRetraso} dias
                  </span>
                </div>
                <Slider
                  value={[assumptions.diasRetraso]}
                  onValueChange={(v) => handleSliderChange('diasRetraso', v)}
                  min={0}
                  max={30}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>30 dias</span>
                </div>
              </div>

              {/* Margen de seguridad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">Margen de seguridad</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Porcentaje a descontar de los ingresos proyectados como colchon de seguridad</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{
                    color: assumptions.margenSeguridad === 0 ? userColors.kpiNeutral : userColors.chart4
                  }}>
                    {assumptions.margenSeguridad}%
                  </span>
                </div>
                <Slider
                  value={[assumptions.margenSeguridad]}
                  onValueChange={(v) => handleSliderChange('margenSeguridad', v)}
                  min={0}
                  max={50}
                  step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>50%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card style={data.alerts.length > 0 ? {
            borderColor: `${userColors.chart4}50`,
            backgroundColor: `${userColors.chart4}08`,
          } : {}}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" style={{ color: data.alerts.length > 0 ? userColors.chart4 : userColors.kpiPositive }} />
                  Alertas
                </CardTitle>
                {data.alerts.length > 0 && (
                  <Badge style={{
                    backgroundColor: `${userColors.chart4}20`,
                    color: userColors.chart4,
                  }}>
                    {data.alerts.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {data.alerts.length === 0 ? (
                <div className="flex items-center gap-2 py-4" style={{ color: userColors.kpiPositive }}>
                  <Target className="h-4 w-4" />
                  <span className="text-sm font-medium">Sin alertas - flujo de caja saludable</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-lg"
                      style={{ backgroundColor: `${alert.severity === 'critical' ? userColors.kpiNegative : userColors.chart4}10` }}
                    >
                      <AlertTriangle
                        className="h-4 w-4 mt-0.5 flex-shrink-0"
                        style={{ color: alert.severity === 'critical' ? userColors.kpiNegative : userColors.chart4 }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{alert.recommendation}</p>
                      </div>
                      {getRiskBadge(alert.severity)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Negative Days Detail */}
        {data.negativeDays.length > 0 && (
          <Card style={{
            borderColor: `${userColors.kpiNegative}40`,
            backgroundColor: `${userColors.kpiNegative}05`,
          }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: userColors.kpiNegative }} />
                Dias con Saldo Negativo Proyectado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.negativeDays.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between p-2 rounded-lg"
                    style={{ backgroundColor: `${userColors.kpiNegative}08` }}
                  >
                    <span className="text-sm font-medium">{day.date}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold" style={{ color: userColors.kpiNegative }}>
                        {formatCurrency(day.balance)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Deficit: {formatCurrency(day.deficit)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
