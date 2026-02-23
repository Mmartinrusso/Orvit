'use client';

import { formatNumber } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  ExternalLink,
  RefreshCw,
  Info,
  FileText,
  Percent,
  ShoppingCart,
  SlidersHorizontal,
  BarChart3,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
  LineChart, Line,
  AreaChart, Area,
} from 'recharts';
import { SemiGauge } from './SemiGauge';

interface SalesViewV2Props {
  companyId: string;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
  userColors?: UserColorPreferences;
}

const formatCurrency = (value: number): string =>
  value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatPercent = (value: number): string => formatNumber(value, 1) + '%';

function Sparkline({ data, color, height = 40 }: { data: { value: number }[]; color: string; height?: number }) {
  if (data.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">
        —
      </div>
    );
  }
  const gradId = `sg-sales-${color.replace('#', '')}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SalesViewV2({
  companyId,
  selectedMonth,
  onMonthChange,
  userColors = DEFAULT_COLORS as UserColorPreferences,
}: SalesViewV2Props) {
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);
  const [marginTarget, setMarginTarget] = useState(30);
  const [config, setConfig] = useState({
    soloFacturasCobradas: false,
    incluirConfirmadas: true,
    incluirCOGSSinReceta: true,
    agruparCliente: false,
  });

  // ── Vista personalizada ───────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'resumen' | 'analitico' | 'completo'>(() => {
    if (typeof window === 'undefined') return 'analitico';
    return (localStorage.getItem('costos-view-ventas') as 'resumen' | 'analitico' | 'completo') ?? 'analitico';
  });
  const showAnalytics = viewMode !== 'resumen';
  const showConfig = viewMode === 'completo';
  const handleViewMode = (m: 'resumen' | 'analitico' | 'completo') => {
    setViewMode(m);
    localStorage.setItem('costos-view-ventas', m);
  };

  const handleMonthChange = (month: string) => {
    setCurrentMonth(month);
    onMonthChange?.(month);
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    };
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['costos-sales-v2', companyId, currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/costos/sales?month=${currentMonth}`);
      if (!response.ok) throw new Error('Error fetching sales data');
      return response.json();
    },
    enabled: !!companyId && !!currentMonth,
  });

  const { data: historyData } = useQuery({
    queryKey: ['costos-history-sales', companyId],
    queryFn: async () => {
      const r = await fetch(`/api/costos/v2/history?feature=sales&months=12`);
      if (!r.ok) throw new Error('Error fetching history');
      return r.json();
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  // Datos derivados — TODOS antes de early returns
  const hasData = data?.hasData;
  const salesData = data?.summary ?? { totalRevenue: 0, totalCost: 0, grossMargin: 0, marginPercent: 0, invoiceCount: 0 };
  const byClient: any[] = Array.isArray(data?.byClient) ? data.byClient : [];
  const byProduct: any[] = Array.isArray(data?.byProduct) ? data.byProduct : [];
  const marginPercent = salesData.marginPercent || 0;
  const isPositiveMargin = marginPercent >= 0;

  const ticketPromedio = salesData.invoiceCount > 0
    ? (salesData.totalRevenue || 0) / salesData.invoiceCount
    : 0;

  const sortedByClient = useMemo(
    () => [...byClient].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 10),
    [byClient]
  );
  const sortedByProduct = useMemo(
    () => [...byProduct].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 10),
    [byProduct]
  );

  const PIE_COLOR_KEYS: Array<keyof UserColorPreferences> = ['chart1', 'chart2', 'chart3', 'chart5', 'chart4', 'chart6'];
  const donutData = useMemo(() => {
    const sorted = [...byClient].sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0));
    const top5 = sorted.slice(0, 5);
    const otrosRev = sorted.slice(5).reduce((s: number, x: any) => s + (x.revenue || 0), 0);
    return [
      ...top5.map((c: any, i: number) => ({
        name: (c.clientName || '—').slice(0, 22),
        value: c.revenue || 0,
        color: userColors[PIE_COLOR_KEYS[i % PIE_COLOR_KEYS.length]] as string,
      })),
      ...(otrosRev > 0 ? [{ name: 'Otros', value: otrosRev, color: userColors.chart6 }] : []),
    ].filter(d => d.value > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byClient, userColors]);

  const salesBarData = useMemo(
    () =>
      [...byProduct]
        .sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0))
        .slice(0, 6)
        .map((p: any) => ({
          name: (p.productName || `Prod #${p.productId}`).slice(0, 16),
          ingreso: p.revenue || 0,
          cogs: p.cost || 0,
        })),
    [byProduct]
  );

  // Distribución por cliente (horizontal bars)
  const distributionData = useMemo(
    () =>
      sortedByClient.slice(0, 6).map((c, i) => {
        const clientMargin = c.revenue > 0 && c.cost !== undefined
          ? ((c.revenue - c.cost) / c.revenue) * 100
          : null;
        return {
          label: (c.clientName || `Cliente #${c.clientId}`).slice(0, 28),
          value: c.revenue || 0,
          color: userColors[PIE_COLOR_KEYS[i % PIE_COLOR_KEYS.length]] as string,
          pct: salesData.totalRevenue > 0 ? ((c.revenue || 0) / salesData.totalRevenue) * 100 : 0,
          marginPct: clientMargin,
        };
      }),
    [sortedByClient, salesData.totalRevenue, userColors]
  );

  // Gauges
  const gaugeData = useMemo(() => {
    const topClient = sortedByClient[0];
    const topClientPct = salesData.totalRevenue > 0 && topClient
      ? ((topClient.revenue || 0) / salesData.totalRevenue) * 100
      : 0;
    const cogsPct = salesData.totalRevenue > 0
      ? ((salesData.totalCost || 0) / salesData.totalRevenue) * 100
      : 0;
    return {
      marginPct: marginPercent,
      topClientPct,
      cogsPct,
      ticketPromedio,
    };
  }, [marginPercent, sortedByClient, salesData, ticketPromedio]);

  // Historia
  const historyMonths: any[] = historyData?.months ?? [];

  const evolutionData = useMemo(
    () =>
      historyMonths.map(m => ({
        month: m.month ? m.month.slice(5) : '',
        revenue: m.revenue ?? 0,
        cost: m.cost ?? 0,
        grossMargin: m.grossMargin ?? 0,
      })),
    [historyMonths]
  );

  const trendMetrics = useMemo(() => {
    if (historyMonths.length < 2) return null;
    const prev = historyMonths[historyMonths.length - 2];
    const curr = historyMonths[historyMonths.length - 1];
    const delta = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : 0);
    return {
      revenue: { value: curr.revenue ?? 0, delta: delta(curr.revenue ?? 0, prev.revenue ?? 0), history: historyMonths.map(m => ({ value: m.revenue ?? 0 })) },
      cost: { value: curr.cost ?? 0, delta: delta(curr.cost ?? 0, prev.cost ?? 0), history: historyMonths.map(m => ({ value: m.cost ?? 0 })) },
      margin: { value: curr.grossMargin ?? 0, delta: delta(curr.grossMargin ?? 0, prev.grossMargin ?? 0), history: historyMonths.map(m => ({ value: m.grossMargin ?? 0 })) },
      marginPct: { value: curr.marginPercent ?? 0, delta: delta(curr.marginPercent ?? 0, prev.marginPercent ?? 0), history: historyMonths.map(m => ({ value: m.marginPercent ?? 0 })) },
      ticket: { value: curr.avgTicket ?? 0, delta: delta(curr.avgTicket ?? 0, prev.avgTicket ?? 0), history: historyMonths.map(m => ({ value: m.avgTicket ?? 0 })) },
    };
  }, [historyMonths]);

  if (isLoading) {
    return <SalesSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            Error al cargar datos de ventas.{' '}
            <Button variant="link" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Ventas V2
              <Badge variant="secondary" className="ml-2 text-xs">Automático</Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Datos importados automáticamente desde facturas confirmadas
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={currentMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/ventas">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ir a Ventas
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Gestionar ventas en el módulo dedicado</TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              {(['resumen', 'analitico', 'completo'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleViewMode(m)}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === m ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {m === 'resumen' ? 'Resumen' : m === 'analitico' ? 'Analítico' : 'Completo'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Receipt className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin datos de ventas</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  No hay facturas confirmadas para el período {currentMonth}.
                  Los ingresos se importan automáticamente cuando se confirman las facturas.
                </p>
                <Link href="/ventas/facturas">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Ver Facturas
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Ingresos</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.kpiPositive }}>
                        ${formatCurrency(salesData.totalRevenue || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {salesData.invoiceCount || 0} facturas
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.kpiPositive}15` }}
                    >
                      <DollarSign className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">COGS</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.kpiNegative }}>
                        ${formatCurrency(salesData.totalCost || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Costo de ventas</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.kpiNegative}15` }}
                    >
                      <Package className="h-5 w-5" style={{ color: userColors.kpiNegative }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card style={{
                borderColor: isPositiveMargin ? `${userColors.kpiPositive}40` : `${userColors.kpiNegative}40`,
                backgroundColor: isPositiveMargin ? `${userColors.kpiPositive}08` : `${userColors.kpiNegative}08`
              }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Margen Bruto</p>
                      <p className="text-2xl font-bold" style={{ color: isPositiveMargin ? userColors.kpiPositive : userColors.kpiNegative }}>
                        ${formatCurrency(salesData.grossMargin || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatPercent(marginPercent)} del ingreso
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: isPositiveMargin ? `${userColors.kpiPositive}15` : `${userColors.kpiNegative}15` }}
                    >
                      {isPositiveMargin
                        ? <TrendingUp className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
                        : <TrendingDown className="h-5 w-5" style={{ color: userColors.kpiNegative }} />
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">% Margen</p>
                      <p className="text-2xl font-bold" style={{ color: isPositiveMargin ? userColors.kpiPositive : userColors.kpiNegative }}>
                        {formatPercent(marginPercent)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Rentabilidad bruta</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart1}15` }}
                    >
                      <Percent className="h-5 w-5" style={{ color: userColors.chart1 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Ticket Prom.</p>
                      <p className="text-2xl font-bold">
                        ${formatCurrency(ticketPromedio)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Por factura</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart6}15` }}
                    >
                      <ShoppingCart className="h-5 w-5" style={{ color: userColors.chart6 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribución por Cliente */}
            {showAnalytics && distributionData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" style={{ color: userColors.chart1 }} />
                    Distribución por Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6">
                    <div className="flex-1 space-y-3">
                      {distributionData.map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-right w-36 shrink-0 truncate">{item.label}</span>
                          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                            />
                          </div>
                          <span className="text-xs font-medium w-24 text-right shrink-0">
                            ${formatCurrency(item.value)}
                          </span>
                          {item.marginPct !== null && (
                            <span
                              className="text-xs w-14 text-right shrink-0"
                              style={{ color: item.marginPct >= marginTarget ? userColors.kpiPositive : userColors.kpiNegative }}
                            >
                              {formatPercent(item.marginPct)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <Card className="shrink-0 w-36 text-center self-start">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Total Ingresos</p>
                        <p className="text-lg font-bold mt-1" style={{ color: userColors.kpiPositive }}>
                          ${formatCurrency(salesData.totalRevenue || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {byClient.length} clientes
                        </p>
                        <p className="text-xs mt-1" style={{ color: isPositiveMargin ? userColors.kpiPositive : userColors.kpiNegative }}>
                          {formatPercent(marginPercent)} margen
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts: Donut + Bar */}
            {(donutData.length > 0 || salesBarData.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {donutData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" style={{ color: userColors.chart1 }} />
                        Ingresos por Cliente
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={donutData}
                            innerRadius={65}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {donutData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <div className="bg-background border rounded-lg p-2 shadow-md text-xs">
                                  <p className="font-medium mb-1">{payload[0].name}</p>
                                  <p style={{ color: payload[0].payload.color }}>
                                    ${formatCurrency(Number(payload[0].value))}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                {salesBarData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" style={{ color: userColors.chart3 }} />
                        Ingreso vs COGS por Producto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={salesBarData}
                          margin={{ left: 0, right: 8, top: 4, bottom: 24 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                          <YAxis
                            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 11 }}
                          />
                          <RechartsTooltip
                            content={({ active, payload, label }: any) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <div className="bg-background border rounded-lg p-2 shadow-md text-xs">
                                  <p className="font-medium mb-1">{label}</p>
                                  {payload.map((p: any, i: number) => (
                                    <p key={i} style={{ color: p.fill }}>
                                      {p.name}: ${formatCurrency(Number(p.value))}
                                    </p>
                                  ))}
                                </div>
                              );
                            }}
                          />
                          <Legend />
                          <Bar dataKey="ingreso" fill={userColors.kpiPositive} radius={[4, 4, 0, 0]} name="Ingreso" />
                          <Bar dataKey="cogs" fill={userColors.kpiNegative} radius={[4, 4, 0, 0]} name="COGS" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Evolución 12 meses */}
            {showAnalytics && evolutionData.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" style={{ color: userColors.kpiPositive }} />
                    Evolución 12 Meses — Ingresos, COGS y Margen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={evolutionData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis
                        tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 11 }}
                        width={55}
                      />
                      <RechartsTooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-background border rounded-lg p-2 shadow-md text-xs">
                              <p className="font-medium mb-1">{label}</p>
                              {payload.map((p: any) => (
                                <p key={p.dataKey} style={{ color: p.stroke }}>
                                  {p.name}: ${formatCurrency(Number(p.value))}
                                </p>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Line dataKey="revenue" stroke={userColors.kpiPositive} strokeWidth={2} dot={false} name="Ingresos" />
                      <Line dataKey="cost" stroke={userColors.kpiNegative} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="COGS" />
                      <Line dataKey="grossMargin" stroke={userColors.chart1} strokeWidth={1.5} dot={false} strokeDasharray="2 2" name="Margen" />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Indicadores (Gauges) */}
            {showAnalytics && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm">Indicadores</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Meta margen:</span>
                    <select
                      value={marginTarget}
                      onChange={e => setMarginTarget(Number(e.target.value))}
                      className="border rounded px-2 py-0.5 text-xs bg-background"
                    >
                      {[15, 20, 25, 30, 35, 40, 50].map(v => (
                        <option key={v} value={v}>{v}%</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <SemiGauge
                    pct={gaugeData.marginPct}
                    label="Margen Bruto %"
                    meta={`>${marginTarget}%`}
                    color={gaugeData.marginPct >= marginTarget ? userColors.kpiPositive : userColors.kpiNegative}
                  />
                  <SemiGauge
                    pct={gaugeData.topClientPct}
                    label="Concentración Top Cliente"
                    meta="<50%"
                    color={gaugeData.topClientPct <= 50 ? userColors.kpiPositive : userColors.kpiNegative}
                  />
                  <SemiGauge
                    pct={gaugeData.cogsPct}
                    label="COGS / Ingresos"
                    meta="<70%"
                    color={gaugeData.cogsPct <= 70 ? userColors.kpiPositive : userColors.kpiNegative}
                  />
                  <SemiGauge
                    pct={50}
                    label="Ticket Promedio"
                    color={userColors.chart6}
                    displayValue={`$${formatCurrency(gaugeData.ticketPromedio)}`}
                  />
                </div>
              </CardContent>
            </Card>
            )}

            {/* Tendencias Strip */}
            {showAnalytics && trendMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Ingresos', metric: trendMetrics.revenue, color: userColors.kpiPositive, formatted: `$${formatCurrency(trendMetrics.revenue.value)}`, positiveIsGood: true },
                  { label: 'COGS', metric: trendMetrics.cost, color: userColors.kpiNegative, formatted: `$${formatCurrency(trendMetrics.cost.value)}`, positiveIsGood: false },
                  { label: 'Margen Bruto', metric: trendMetrics.margin, color: userColors.chart1, formatted: `$${formatCurrency(trendMetrics.margin.value)}`, positiveIsGood: true },
                  { label: '% Margen', metric: trendMetrics.marginPct, color: userColors.chart2, formatted: `${formatNumber(trendMetrics.marginPct.value, 1)}%`, positiveIsGood: true },
                  { label: 'Ticket Prom.', metric: trendMetrics.ticket, color: userColors.chart6, formatted: `$${formatCurrency(trendMetrics.ticket.value)}`, positiveIsGood: true },
                ].map(t => {
                  const isPositiveDelta = t.metric.delta >= 0;
                  const deltaColor = t.positiveIsGood
                    ? (isPositiveDelta ? userColors.kpiPositive : userColors.kpiNegative)
                    : (isPositiveDelta ? userColors.kpiNegative : userColors.kpiPositive);
                  return (
                    <Card key={t.label}>
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">{t.label}</p>
                        <Sparkline data={t.metric.history} color={t.color} />
                        <p className="text-base font-bold mt-1">{t.formatted}</p>
                        <p className="text-xs flex items-center gap-1" style={{ color: deltaColor }}>
                          {isPositiveDelta
                            ? <TrendingUp className="h-3 w-3" />
                            : <TrendingDown className="h-3 w-3" />}
                          {isPositiveDelta ? '+' : ''}{formatNumber(t.metric.delta, 1)}%
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Configuración */}
            {showConfig && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Configuración de Importación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    { key: 'soloFacturasCobradas', label: 'Solo cobradas', desc: 'Estado COBRADA' },
                    { key: 'incluirConfirmadas', label: 'Incluir confirmadas', desc: 'Estado EMITIDA' },
                    { key: 'incluirCOGSSinReceta', label: 'COGS sin receta', desc: 'Precio de costo del item' },
                    { key: 'agruparCliente', label: 'Agrupar por cliente', desc: 'Vista consolidada' },
                  ].map(opt => (
                    <div
                      key={opt.key}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                      <Switch
                        checked={config[opt.key as keyof typeof config]}
                        onCheckedChange={v => setConfig(c => ({ ...c, [opt.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Por Cliente */}
            {showAnalytics && sortedByClient.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart1}15` }}
                    >
                      <Users className="h-3 w-3" style={{ color: userColors.chart1 }} />
                    </div>
                    Ventas por Cliente
                    <Badge variant="secondary" className="text-xs">{byClient.length} clientes · top 10</Badge>
                  </CardTitle>
                  <CardDescription>
                    Ranking por ingreso del período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Facturas</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Margen</TableHead>
                        <TableHead className="w-32">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedByClient.map((clientData: any, idx: number) => {
                        const pct = salesData.totalRevenue > 0
                          ? ((clientData.revenue || 0) / salesData.totalRevenue) * 100
                          : 0;
                        const clientMargin = clientData.revenue > 0 && clientData.cost !== undefined
                          ? ((clientData.revenue - clientData.cost) / clientData.revenue) * 100
                          : null;
                        return (
                          <TableRow key={clientData.clientId}>
                            <TableCell className="text-xs font-bold text-muted-foreground w-6">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {clientData.clientName || `Cliente #${clientData.clientId}`}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {clientData.invoiceCount || 0}
                            </TableCell>
                            <TableCell className="text-right font-bold" style={{ color: userColors.kpiPositive }}>
                              ${formatCurrency(clientData.revenue || 0)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {clientMargin !== null ? (
                                <span style={{ color: clientMargin >= 0 ? userColors.kpiPositive : userColors.kpiNegative }}>
                                  {formatPercent(clientMargin)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: userColors.chart1, width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-10 text-right">
                                  {formatNumber(pct, 1)}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Por Producto */}
            {showAnalytics && sortedByProduct.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart3}15` }}
                    >
                      <Package className="h-3 w-3" style={{ color: userColors.chart3 }} />
                    </div>
                    Ventas por Producto
                    <Badge variant="secondary" className="text-xs">{byProduct.length} productos · top 10</Badge>
                  </CardTitle>
                  <CardDescription>
                    Top productos vendidos en el período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Ingreso</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="text-right">Margen %</TableHead>
                        <TableHead className="w-32">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedByProduct.map((productData: any, idx: number) => {
                        const margin = (productData.revenue || 0) - (productData.cost || 0);
                        const marginPct = productData.revenue > 0 ? (margin / productData.revenue) * 100 : 0;
                        const pct = salesData.totalRevenue > 0
                          ? ((productData.revenue || 0) / salesData.totalRevenue) * 100
                          : 0;
                        return (
                          <TableRow key={productData.productId ?? idx}>
                            <TableCell className="text-xs font-bold text-muted-foreground w-6">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {productData.productName || `Producto #${productData.productId}`}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {productData.quantity || 0}
                            </TableCell>
                            <TableCell className="text-right font-bold" style={{ color: userColors.kpiPositive }}>
                              ${formatCurrency(productData.revenue || 0)}
                            </TableCell>
                            <TableCell className="text-right" style={{ color: userColors.kpiNegative }}>
                              ${formatCurrency(productData.cost || 0)}
                            </TableCell>
                            <TableCell className="text-right font-medium" style={{ color: margin >= 0 ? userColors.kpiPositive : userColors.kpiNegative }}>
                              {formatPercent(marginPct)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: userColors.chart3, width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-10 text-right">
                                  {formatNumber(pct, 1)}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Info Banner */}
            <Card style={{ backgroundColor: `${userColors.chart2}08`, borderColor: `${userColors.chart2}30` }}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 mt-0.5" style={{ color: userColors.chart2 }} />
                  <div className="text-sm">
                    <p className="font-medium mb-1" style={{ color: userColors.chart2 }}>
                      Datos V2 — Importación Automática
                    </p>
                    <p className="text-muted-foreground">
                      Los ingresos y márgenes se calculan desde las facturas CONFIRMADAS o PAGADAS.
                      El COGS (Costo de Ventas) se calcula con fallback: precio de costo del item,
                      último costo de stock, o costo manual del producto. Para gestionar ventas, usá el módulo dedicado.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function SalesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-16 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    </div>
  );
}
