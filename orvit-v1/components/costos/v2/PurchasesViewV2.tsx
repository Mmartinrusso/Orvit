'use client';

import { useMemo, useState } from 'react';
import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
  ShoppingCart,
  DollarSign,
  Package,
  Truck,
  ExternalLink,
  RefreshCw,
  Info,
  Building2,
  FileText,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { SemiGauge } from './SemiGauge';
import { cn } from '@/lib/utils';

interface PurchasesViewV2Props {
  companyId: string;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
  userColors?: UserColorPreferences;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const PurchasesTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg p-2 shadow-md text-xs">
      <p className="font-medium mb-1">{payload[0]?.payload?.month ?? payload[0]?.name ?? payload[0]?.payload?.name}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.color || p.stroke }}>
          {p.name}: ${formatCurrency(Number(p.value))}
        </p>
      ))}
    </div>
  );
};

// Mini sparkline sin ejes para la tira de tendencias
const Sparkline = ({ data, color }: { data: { value: number }[]; color: string }) => (
  <ResponsiveContainer width="100%" height={36}>
    <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
      <defs>
        <linearGradient id={`grad-p-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area
        dataKey="value"
        stroke={color}
        strokeWidth={1.5}
        fill={`url(#grad-p-${color.replace('#', '')})`}
        dot={false}
        isAnimationActive={false}
      />
    </AreaChart>
  </ResponsiveContainer>
);

export function PurchasesViewV2({ companyId, selectedMonth, userColors = DEFAULT_COLORS as UserColorPreferences }: PurchasesViewV2Props) {
  // ── Datos del mes actual ──────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['costos-purchases-v2', companyId, selectedMonth],
    queryFn: async () => {
      const response = await fetch(`/api/costos/purchases?month=${selectedMonth}`);
      if (!response.ok) throw new Error('Error fetching purchases data');
      return response.json();
    },
    enabled: !!companyId && !!selectedMonth,
  });

  // ── Historia 12 meses ────────────────────────────────────────────────
  const { data: historyData } = useQuery({
    queryKey: ['costos-purchases-history', companyId],
    queryFn: async () => {
      const r = await fetch(`/api/costos/v2/history?feature=purchases&months=12`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  // ── Config local ─────────────────────────────────────────────────────
  const [config, setConfig] = useState({
    soloFacturasPagadas: false,
    incluirNC: true,
    agruparProveedor: true,
    mostrarDesglose: true,
  });

  // ── Vista personalizada ──────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'resumen' | 'analitico' | 'completo'>(() => {
    if (typeof window === 'undefined') return 'analitico';
    return (localStorage.getItem('costos-view-compras') as 'resumen' | 'analitico' | 'completo') ?? 'analitico';
  });
  const showAnalytics = viewMode !== 'resumen';
  const showConfig = viewMode === 'completo';
  const handleViewMode = (m: 'resumen' | 'analitico' | 'completo') => {
    setViewMode(m);
    localStorage.setItem('costos-view-compras', m);
  };

  // ── Derivados del mes actual ─────────────────────────────────────────
  const summary = data?.summary;
  const bySupplier: any[] = data?.bySupplier ?? [];
  const details: any[] = data?.details ?? [];
  const hasData = summary && summary.totalPurchases > 0;
  const historyMonths: any[] = historyData?.months ?? [];

  const PIE_COLORS = [
    userColors.chart1, userColors.chart2, userColors.chart3,
    userColors.chart5, userColors.chart6,
  ];

  // Donut (top 4 + Otros)
  const donutData = useMemo(() => {
    const sorted = [...bySupplier].sort((a, b) => (b.total || 0) - (a.total || 0));
    const top4 = sorted.slice(0, 4);
    const otrosTotal = sorted.slice(4).reduce((s: number, x: any) => s + (x.total || 0), 0);
    return [
      ...top4.map((s: any) => ({
        name: (s.supplierName || '—').slice(0, 22),
        value: s.total || 0,
      })),
      ...(otrosTotal > 0 ? [{ name: 'Otros', value: otrosTotal }] : []),
    ].filter(d => d.value > 0);
  }, [bySupplier]);

  // Bar horizontal top 8
  const barData = useMemo(
    () => [...bySupplier]
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 8)
      .map((s: any) => ({
        name: (s.supplierName || '—').slice(0, 20),
        total: s.total || 0,
      })),
    [bySupplier]
  );

  // Distribución top 6 con barras
  const distributionData = useMemo(() => {
    return [...bySupplier]
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 6);
  }, [bySupplier]);

  // Datos de gauges
  const gaugeData = useMemo(() => {
    const total = summary?.totalPurchases || 0;
    const sorted = [...bySupplier].sort((a, b) => (b.total || 0) - (a.total || 0));
    const top1 = sorted[0]?.total || 0;
    const top3Total = sorted.slice(0, 3).reduce((s: number, x: any) => s + (x.total || 0), 0);
    const supplierCount = summary?.supplierCount || 0;
    const receiptCount = summary?.receiptCount || 0;
    const avgFact = supplierCount > 0 ? receiptCount / supplierCount : 0;
    const avgTicket = receiptCount > 0 ? total / receiptCount : 0;
    return {
      top1Pct: total > 0 ? (top1 / total) * 100 : 0,
      top3Pct: total > 0 ? (top3Total / total) * 100 : 0,
      avgFact,
      avgFactPct: Math.min(100, (avgFact / 5) * 100),
      avgTicket,
      avgTicketPct: 50, // decorativo
    };
  }, [bySupplier, summary]);

  // Tendencias desde historia
  const trendMetrics = useMemo(() => {
    if (historyMonths.length < 2) return null;
    const curr = historyMonths[historyMonths.length - 1];
    const prev = historyMonths[historyMonths.length - 2];
    const delta = (field: string) => {
      if (!prev?.[field] || prev[field] === 0) return 0;
      return ((curr[field] - prev[field]) / prev[field]) * 100;
    };
    return {
      total: { value: curr.total, delta: delta('total'), history: historyMonths.map((m: any) => ({ value: m.total })) },
      receiptCount: { value: curr.receiptCount, delta: delta('receiptCount'), history: historyMonths.map((m: any) => ({ value: m.receiptCount })) },
      supplierCount: { value: curr.supplierCount, delta: delta('supplierCount'), history: historyMonths.map((m: any) => ({ value: m.supplierCount })) },
      avgTicket: { value: curr.avgTicket, delta: delta('avgTicket'), history: historyMonths.map((m: any) => ({ value: m.avgTicket })) },
    };
  }, [historyMonths]);

  // Evolución para LineChart
  const evolutionData = useMemo(
    () => historyMonths.map((m: any) => ({
      month: m.month?.slice(5, 7) + '/' + m.month?.slice(2, 4),
      total: m.total,
      receiptCount: m.receiptCount,
    })),
    [historyMonths]
  );

  if (isLoading) {
    return <PurchasesSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            Error al cargar datos de compras.{' '}
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
              <ShoppingCart className="h-5 w-5" />
              Compras V2
              <Badge variant="secondary" className="ml-2 text-xs">Automático</Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Facturas de compras imputadas al período — excluye costos indirectos
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              {(['resumen', 'analitico', 'completo'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleViewMode(m)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-md transition-all',
                    viewMode === m
                      ? 'bg-background shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {m === 'resumen' ? 'Resumen' : m === 'analitico' ? 'Analítico' : 'Completo'}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/administracion/compras/comprobantes">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ir a Compras
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Gestionar compras en el módulo dedicado</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin datos de compras</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  No hay facturas de compras imputadas en el período {selectedMonth}.
                </p>
                <Link href="/administracion/compras/comprobantes">
                  <Button>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Ir a Compras
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Compras</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart1 }}>
                        ${formatCurrency(summary.totalPurchases || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Período {selectedMonth}</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart1}15` }}
                    >
                      <DollarSign className="h-5 w-5" style={{ color: userColors.chart1 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Facturas</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart2 }}>
                        {summary.receiptCount || 0}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Comprobantes del mes</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart2}15` }}
                    >
                      <FileText className="h-5 w-5" style={{ color: userColors.chart2 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Proveedores</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart3 }}>
                        {summary.supplierCount || 0}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Distintos</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart3}15` }}
                    >
                      <Truck className="h-5 w-5" style={{ color: userColors.chart3 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Promedio/Factura</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart4 }}>
                        ${formatCurrency(
                          summary.receiptCount > 0
                            ? summary.totalPurchases / summary.receiptCount
                            : 0
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Por comprobante</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart4}15` }}
                    >
                      <Building2 className="h-5 w-5" style={{ color: userColors.chart4 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            {bySupplier.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Donut: Concentración de proveedores */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${userColors.chart1}15` }}
                      >
                        <Package className="h-3 w-3" style={{ color: userColors.chart1 }} />
                      </div>
                      Concentración por Proveedor (top 4)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                        >
                          {donutData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<PurchasesTooltip />} />
                        <Legend iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Bar horizontal: Top 8 proveedores */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${userColors.chart1}15` }}
                      >
                        <Truck className="h-3 w-3" style={{ color: userColors.chart1 }} />
                      </div>
                      Ranking Proveedores — Top 8
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={barData}
                        layout="vertical"
                        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis
                          type="number"
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                          fontSize={11}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          fontSize={10}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <RechartsTooltip content={<PurchasesTooltip />} />
                        <Bar
                          dataKey="total"
                          name="Total"
                          fill={userColors.chart1}
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ─── DISTRIBUCIÓN POR PROVEEDOR ────────────────────────────── */}
            {showAnalytics && distributionData.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart2}15` }}
                    >
                      <Building2 className="h-3 w-3" style={{ color: userColors.chart2 }} />
                    </div>
                    Distribución por Proveedor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 items-start">
                    {/* Barras */}
                    <div className="flex-1 space-y-3">
                      {distributionData.map((supplier: any, i: number) => {
                        const pct = summary.totalPurchases > 0
                          ? (supplier.total / summary.totalPurchases) * 100
                          : 0;
                        const color = PIE_COLORS[i % PIE_COLORS.length];
                        return (
                          <div key={supplier.supplierId} className="flex items-center gap-3">
                            <span
                              className="text-xs text-right shrink-0 truncate"
                              style={{ width: 120 }}
                              title={supplier.supplierName}
                            >
                              {(supplier.supplierName || '—').slice(0, 18)}
                            </span>
                            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: color }}
                              />
                            </div>
                            <span className="text-xs font-medium shrink-0 text-right w-20">
                              ${formatCurrency(supplier.total)}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Card lateral */}
                    <Card className="shrink-0 text-center min-w-[110px]" style={{ borderColor: `${userColors.chart1}30` }}>
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-bold mt-1" style={{ color: userColors.chart1 }}>
                          ${formatCurrency(summary.totalPurchases)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {summary.supplierCount} prov.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── EVOLUCIÓN 12 MESES ─────────────────────────────────────── */}
            {showAnalytics && evolutionData.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart1}15` }}
                    >
                      <TrendingUp className="h-3 w-3" style={{ color: userColors.chart1 }} />
                    </div>
                    Evolución de Compras
                    <span className="text-xs text-muted-foreground font-normal">— últimos 12 meses</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={evolutionData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} fontSize={11} width={52} />
                      <RechartsTooltip content={<PurchasesTooltip />} />
                      <Line
                        dataKey="total"
                        name="Total Compras"
                        stroke={userColors.chart1}
                        strokeWidth={2}
                        dot={{ r: 3, fill: userColors.chart1 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {showAnalytics && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${userColors.chart3}15` }}
                  >
                    <Package className="h-3 w-3" style={{ color: userColors.chart3 }} />
                  </div>
                  Indicadores de Concentración
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2">
                  <SemiGauge
                    pct={gaugeData.top1Pct}
                    label="Concentración Top 1"
                    meta="<50%"
                    color={gaugeData.top1Pct > 50 ? userColors.kpiNegative : userColors.kpiPositive}
                  />
                  <SemiGauge
                    pct={gaugeData.top3Pct}
                    label="Concentración Top 3"
                    meta="<80%"
                    color={gaugeData.top3Pct > 80 ? userColors.kpiNegative : userColors.chart2}
                  />
                  <SemiGauge
                    pct={gaugeData.avgFactPct}
                    label="Facturas/Proveedor"
                    color={userColors.chart3}
                    displayValue={gaugeData.avgFact.toFixed(1)}
                  />
                  <SemiGauge
                    pct={gaugeData.avgTicketPct}
                    label="Ticket Promedio"
                    color={userColors.chart4}
                    displayValue={`$${formatCurrency(gaugeData.avgTicket)}`}
                  />
                </div>
              </CardContent>
            </Card>

            )}
            {/* ─── TENDENCIAS (SPARKLINES) ─────────────────────────────────── */}
            {showAnalytics && trendMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'total', label: 'Total Compras', formatted: `$${formatCurrency(trendMetrics.total.value)}`, color: userColors.chart1, history: trendMetrics.total.history, delta: trendMetrics.total.delta },
                  { key: 'receiptCount', label: 'Facturas', formatted: trendMetrics.receiptCount.value.toFixed(0), color: userColors.chart2, history: trendMetrics.receiptCount.history, delta: trendMetrics.receiptCount.delta },
                  { key: 'supplierCount', label: 'Proveedores', formatted: trendMetrics.supplierCount.value.toFixed(0), color: userColors.chart3, history: trendMetrics.supplierCount.history, delta: trendMetrics.supplierCount.delta },
                  { key: 'avgTicket', label: 'Ticket Prom.', formatted: `$${formatCurrency(trendMetrics.avgTicket.value)}`, color: userColors.chart4, history: trendMetrics.avgTicket.history, delta: trendMetrics.avgTicket.delta },
                ].map(t => (
                  <Card key={t.key}>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">{t.label}</p>
                      <Sparkline data={t.history} color={t.color} />
                      <p className="text-base font-bold mt-1">{t.formatted}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {t.delta >= 0
                          ? <TrendingUp className="h-3 w-3" style={{ color: userColors.kpiPositive }} />
                          : <TrendingDown className="h-3 w-3" style={{ color: userColors.kpiNegative }} />
                        }
                        <p
                          className="text-xs"
                          style={{ color: t.delta >= 0 ? userColors.kpiPositive : userColors.kpiNegative }}
                        >
                          {t.delta >= 0 ? '+' : ''}{t.delta.toFixed(1)}% vs anterior
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Por Proveedor — tabla */}
            {showAnalytics && bySupplier.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Compras por Proveedor</CardTitle>
                  <CardDescription>
                    Desglose de compras por proveedor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right">Facturas</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right w-32">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...bySupplier]
                        .sort((a, b) => (b.total || 0) - (a.total || 0))
                        .map((supplier: any) => {
                          const pct = summary.totalPurchases > 0
                            ? ((supplier.total || 0) / summary.totalPurchases) * 100
                            : 0;
                          return (
                            <TableRow key={supplier.supplierId}>
                              <TableCell className="font-medium">
                                {supplier.supplierName || `Proveedor #${supplier.supplierId}`}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {supplier.receiptCount || 0}
                              </TableCell>
                              <TableCell className="text-right font-bold" style={{ color: userColors.chart1 }}>
                                ${formatCurrency(supplier.total || 0)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${pct}%`, backgroundColor: userColors.chart1 }}
                                    />
                                  </div>
                                  <span className="text-muted-foreground text-xs w-10 text-right">
                                    {pct.toFixed(1)}%
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

            {/* Detalle de Facturas */}
            {showAnalytics && details.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalle de Facturas</CardTitle>
                  <CardDescription>
                    Mostrando {Math.min(20, details.length)} de {details.length} comprobantes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>N° Factura</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details
                        .sort((a: any, b: any) => b.neto - a.neto)
                        .slice(0, 20)
                        .map((item: any) => (
                          <TableRow key={item.receiptId}>
                            <TableCell className="font-medium">
                              {item.supplierName || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.receiptNumber || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.tipo || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.estado || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold" style={{ color: userColors.chart1 }}>
                              ${formatCurrency(item.neto || 0)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {summary.totalPurchases > 0
                                ? ((item.neto / summary.totalPurchases) * 100).toFixed(1) + '%'
                                : '0%'}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {showConfig && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  Configuración de Importación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'soloFacturasPagadas', label: 'Solo pagadas', description: 'Estado = pagado' },
                    { key: 'incluirNC', label: 'Incluir NC', description: 'Notas de crédito' },
                    { key: 'agruparProveedor', label: 'Agrupar proveedor', description: 'Vista consolidada' },
                    { key: 'mostrarDesglose', label: 'Ver detalle', description: 'Tabla de facturas' },
                  ].map(opt => (
                    <div
                      key={opt.key}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-transparent"
                    >
                      <div className="min-w-0 mr-2">
                        <p className="text-sm font-medium truncate">{opt.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{opt.description}</p>
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
            {/* Info Banner */}
            <Card style={{ backgroundColor: `${userColors.chart1}08`, borderColor: `${userColors.chart1}30` }}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 mt-0.5" style={{ color: userColors.chart1 }} />
                  <div className="text-sm">
                    <p className="font-medium mb-1" style={{ color: userColors.chart1 }}>
                      Datos V2 — Importación Automática desde Compras
                    </p>
                    <p className="text-muted-foreground">
                      Los costos de compras se calculan desde las facturas imputadas al período,
                      excluyendo las marcadas como costo indirecto (que aparecen en la pestaña Indirectos).
                      Para gestionar compras, usá el módulo dedicado.
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

function PurchasesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><Skeleton className="h-[260px]" /></CardContent></Card>
        <Card><CardContent className="p-4"><Skeleton className="h-[260px]" /></CardContent></Card>
      </div>
      <Card><CardContent className="p-4"><Skeleton className="h-[120px]" /></CardContent></Card>
      <Card><CardContent className="p-4"><Skeleton className="h-[200px]" /></CardContent></Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><CardContent className="p-3"><Skeleton className="h-[80px]" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
