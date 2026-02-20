'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Calculator,
  LogIn,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useBusinessMetrics, useBusinessMetricsSummary } from '@/hooks/use-business-metrics';

// Colores por defecto (inline para evitar dependencia de contexto de colores)
const COLORS = {
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

// ── Helpers ────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}min`;
  const hours = ms / 3_600_000;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;

  switch (period) {
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate: start.toISOString(), endDate: end };
}

function getGroupByForPeriod(period: string): 'hour' | 'day' | 'week' | 'month' {
  switch (period) {
    case '7d': return 'day';
    case '30d': return 'day';
    case '90d': return 'week';
    default: return 'day';
  }
}

// ── Components ─────────────────────────────────────────────────────

function KPICard({
  title,
  value,
  change,
  icon: Icon,
  color,
  formatter,
}: {
  title: string;
  value: number;
  change: number;
  icon: React.ElementType;
  color: string;
  formatter?: (v: number) => string;
}) {
  const displayValue = formatter ? formatter(value) : value.toLocaleString('es-AR');
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-2xl font-bold">{displayValue}</p>
            <div className="flex items-center gap-1 mt-1">
              {isNeutral ? (
                <Minus className="h-3 w-3" style={{ color: COLORS.kpiNeutral }} />
              ) : isPositive ? (
                <TrendingUp className="h-3 w-3" style={{ color: COLORS.kpiPositive }} />
              ) : (
                <TrendingDown className="h-3 w-3" style={{ color: COLORS.kpiNegative }} />
              )}
              <span
                className="text-xs font-medium"
                style={{
                  color: isNeutral
                    ? COLORS.kpiNeutral
                    : isPositive
                    ? COLORS.kpiPositive
                    : COLORS.kpiNegative,
                }}
              >
                {change > 0 ? '+' : ''}{change}%
              </span>
              <span className="text-xs text-muted-foreground">vs período anterior</span>
            </div>
          </div>
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function BusinessMetricsPage() {
  const [period, setPeriod] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('work_orders_created');

  const { startDate, endDate } = useMemo(() => getDateRange(period), [period]);
  const groupBy = getGroupByForPeriod(period);

  const { data: summary, isLoading: summaryLoading } = useBusinessMetricsSummary();

  const { data: chartData, isLoading: chartLoading } = useBusinessMetrics({
    startDate,
    endDate,
    groupBy,
  });

  // Preparar datos para LineChart (filtrado por métrica seleccionada)
  const lineChartData = useMemo(() => {
    if (!chartData?.data) return [];
    return chartData.data
      .filter(d => d.name === selectedMetric)
      .map(d => ({
        period: new Date(d.period).toLocaleDateString('es-AR', {
          day: '2-digit',
          month: 'short',
        }),
        valor: selectedMetric === 'resolution_time' ? d.avg : d.sum,
        count: d.count,
      }));
  }, [chartData, selectedMetric]);

  // Preparar datos para BarChart (distribución por métrica)
  const barChartData = useMemo(() => {
    if (!chartData?.data) return [];

    const totals = new Map<string, number>();
    chartData.data.forEach(d => {
      const current = totals.get(d.name) || 0;
      totals.set(d.name, current + d.sum);
    });

    const labels: Record<string, string> = {
      work_orders_created: 'OTs Creadas',
      work_orders_completed: 'OTs Completadas',
      resolution_time: 'T. Resolución',
      costs_calculated: 'Costos Calc.',
      successful_logins: 'Logins OK',
      failed_logins: 'Logins Fallidos',
    };

    return Array.from(totals.entries()).map(([name, total]) => ({
      name: labels[name] || name,
      total: Math.round(total),
    }));
  }, [chartData]);

  // Datos recientes (tabla)
  const recentData = useMemo(() => {
    if (!chartData?.data) return [];
    return chartData.data
      .slice(-20)
      .reverse();
  }, [chartData]);

  const metricOptions = [
    { value: 'work_orders_created', label: 'OTs Creadas' },
    { value: 'work_orders_completed', label: 'OTs Completadas' },
    { value: 'resolution_time', label: 'Tiempo de Resolución' },
    { value: 'costs_calculated', label: 'Costos Calculados' },
    { value: 'successful_logins', label: 'Logins Exitosos' },
    { value: 'failed_logins', label: 'Logins Fallidos' },
  ];

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <BarChart3 className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Métricas de Negocio</h1>
          <p className="text-muted-foreground">
            Tracking de métricas operativas y KPIs
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="90d">Últimos 90 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="OTs Creadas"
          value={summary?.work_orders_created.current ?? 0}
          change={summary?.work_orders_created.change ?? 0}
          icon={ClipboardList}
          color={COLORS.chart1}
        />
        <KPICard
          title="OTs Completadas"
          value={summary?.work_orders_completed.current ?? 0}
          change={summary?.work_orders_completed.change ?? 0}
          icon={CheckCircle2}
          color={COLORS.chart5}
        />
        <KPICard
          title="T. Resolución Prom."
          value={summary?.resolution_time.current ?? 0}
          change={summary?.resolution_time.change ?? 0}
          icon={Clock}
          color={COLORS.chart4}
          formatter={formatDuration}
        />
        <KPICard
          title="Costos Calculados"
          value={summary?.costs_calculated.current ?? 0}
          change={summary?.costs_calculated.change ?? 0}
          icon={Calculator}
          color={COLORS.chart2}
        />
        <KPICard
          title="Logins Exitosos"
          value={summary?.successful_logins.current ?? 0}
          change={summary?.successful_logins.change ?? 0}
          icon={LogIn}
          color={COLORS.chart6}
        />
        <KPICard
          title="Logins Fallidos"
          value={summary?.failed_logins.current ?? 0}
          change={summary?.failed_logins.change ?? 0}
          icon={ShieldAlert}
          color={COLORS.kpiNegative}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Line Chart - Tendencia temporal */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm">Tendencia temporal</CardTitle>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="h-[260px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Cargando gráfico...</p>
              </div>
            ) : lineChartData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Sin datos para este período</p>
              </div>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
                    <XAxis
                      dataKey="period"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={v =>
                        selectedMetric === 'resolution_time'
                          ? formatDuration(v)
                          : v.toLocaleString()
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: number) => [
                        selectedMetric === 'resolution_time'
                          ? formatDuration(value)
                          : value.toLocaleString('es-AR'),
                        metricOptions.find(o => o.value === selectedMetric)?.label,
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke={COLORS.chart1}
                      strokeWidth={2}
                      dot={{ fill: COLORS.chart1, r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - Distribución por tipo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribución por métrica</CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="h-[260px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Cargando gráfico...</p>
              </div>
            ) : barChartData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Sin datos</p>
              </div>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} layout="vertical">
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.35} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      width={100}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: number) => [value.toLocaleString('es-AR'), 'Total']}
                    />
                    <Bar dataKey="total" fill={COLORS.chart2} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de métricas recientes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Datos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentData.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Aún no hay métricas registradas. Se irán acumulando a medida que se usen las funcionalidades del sistema.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground uppercase">Período</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground uppercase">Métrica</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase">Total</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase">Promedio</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase">Min</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase">Max</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase">Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {recentData.map((row, i) => {
                    const isTime = row.name === 'resolution_time';
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-3">
                          {new Date(row.period).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-xs">
                            {row.name}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {isTime ? formatDuration(row.sum) : row.sum.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {isTime ? formatDuration(row.avg) : row.avg.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {isTime ? formatDuration(row.min) : row.min.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {isTime ? formatDuration(row.max) : row.max.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{row.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
