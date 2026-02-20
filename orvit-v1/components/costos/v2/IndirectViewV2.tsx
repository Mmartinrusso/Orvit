'use client';

import { useState, useMemo } from 'react';
import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
  Building2,
  ChevronDown,
  DollarSign,
  Layers,
  FolderOpen,
  ExternalLink,
  RefreshCw,
  Info,
  FileText,
  Zap,
  Droplets,
  Wifi,
  Shield,
  ShoppingCart,
  Truck,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Star,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface IndirectViewV2Props {
  companyId: string;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
  userColors?: UserColorPreferences;
}

const formatCurrency = (value: number): string =>
  value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatPercent = (value: number): string => value.toFixed(1) + '%';

const CATEGORY_LABELS: Record<string, string> = {
  IMP_SERV: 'Impuestos y Servicios',
  SOCIAL: 'Cargas Sociales',
  VEHICLES: 'Vehículos',
  MKT: 'Marketing',
  OTHER: 'Otros',
  UTILITIES: 'Servicios Públicos',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  UTILITIES: <Zap className="h-4 w-4" />,
  IMP_SERV: <FileText className="h-4 w-4" />,
  SOCIAL: <Shield className="h-4 w-4" />,
  MKT: <Wifi className="h-4 w-4" />,
  VEHICLES: <Droplets className="h-4 w-4" />,
  OTHER: <Building2 className="h-4 w-4" />,
};

const CHART_COLOR_KEYS: Array<keyof UserColorPreferences> = [
  'chart4', 'chart1', 'chart2', 'chart3', 'chart5', 'chart6',
];

function Sparkline({ data, color, height = 40 }: { data: { value: number }[]; color: string; height?: number }) {
  if (data.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">
        —
      </div>
    );
  }
  const gradId = `sg-ind-${color.replace('#', '')}`;
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

export function IndirectViewV2({
  companyId,
  selectedMonth,
  userColors = DEFAULT_COLORS as UserColorPreferences,
}: IndirectViewV2Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState({
    soloImputadas: true,
    incluirPendientes: false,
    agruparCategoria: false,
    mostrarSubconceptos: true,
  });

  // ── Vista personalizada ───────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'resumen' | 'analitico' | 'completo'>(() => {
    if (typeof window === 'undefined') return 'analitico';
    return (localStorage.getItem('costos-view-indirectos') as 'resumen' | 'analitico' | 'completo') ?? 'analitico';
  });
  const showAnalytics = viewMode !== 'resumen';
  const showConfig = viewMode === 'completo';
  const handleViewMode = (m: 'resumen' | 'analitico' | 'completo') => {
    setViewMode(m);
    localStorage.setItem('costos-view-indirectos', m);
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['costos-indirect-v2', companyId, selectedMonth],
    queryFn: async () => {
      const response = await fetch(`/api/costos/indirect?month=${selectedMonth}`);
      if (!response.ok) throw new Error('Error fetching indirect data');
      return response.json();
    },
    enabled: !!companyId && !!selectedMonth,
  });

  const { data: historyData } = useQuery({
    queryKey: ['costos-history-indirect', companyId],
    queryFn: async () => {
      const r = await fetch(`/api/costos/v2/history?feature=indirect&months=12`);
      if (!r.ok) throw new Error('Error fetching history');
      return r.json();
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  const summary = data?.summary ?? { total: 0, itemCount: 0, categoryCount: 0 };
  const byCategory: Record<string, { total: number; count: number }> = data?.byCategory ?? {};
  const details: any[] = data?.details ?? [];
  const hasData = data?.hasData;

  const byProveedor = useMemo(() => {
    const map = new Map<string, { nombre: string; count: number; total: number }>();
    for (const item of details) {
      const key = item.proveedorNombre || item.label || 'Sin proveedor';
      const prev = map.get(key) ?? { nombre: key, count: 0, total: 0 };
      map.set(key, { ...prev, count: prev.count + 1, total: prev.total + (item.amount || 0) });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [details]);

  const topCategory = useMemo(() => {
    let top = { key: '', label: 'N/A', total: 0 };
    for (const [key, val] of Object.entries(byCategory)) {
      if (val.total > top.total) {
        top = { key, label: CATEGORY_LABELS[key] || key, total: val.total };
      }
    }
    return top;
  }, [byCategory]);

  const sortedCategories = useMemo(
    () =>
      Object.entries(byCategory)
        .map(([key, val]) => ({ key, ...val }))
        .sort((a, b) => b.total - a.total),
    [byCategory]
  );

  const donutData = useMemo(
    () =>
      sortedCategories
        .map(({ key, total }, i) => ({
          name: CATEGORY_LABELS[key] || key,
          value: total,
          color: userColors[CHART_COLOR_KEYS[i % CHART_COLOR_KEYS.length]] as string,
        }))
        .filter(d => d.value > 0),
    [sortedCategories, userColors]
  );

  const barData = useMemo(
    () =>
      byProveedor.slice(0, 8).map(p => ({
        name: p.nombre.length > 20 ? p.nombre.slice(0, 20) + '…' : p.nombre,
        total: p.total,
      })),
    [byProveedor]
  );

  const distributionData = useMemo(
    () =>
      sortedCategories.slice(0, 6).map(({ key, total, count }, i) => ({
        label: CATEGORY_LABELS[key] || key,
        value: total,
        count: count ?? 0,
        color: userColors[CHART_COLOR_KEYS[i % CHART_COLOR_KEYS.length]] as string,
        pct: summary.total > 0 ? (total / summary.total) * 100 : 0,
      })),
    [sortedCategories, summary.total, userColors]
  );

  const gaugeData = useMemo(() => {
    const topCatPct = summary.total > 0 ? (topCategory.total / summary.total) * 100 : 0;
    const divPct = Math.min(100, (summary.categoryCount / 6) * 100);
    const detailsWithConceptos = details.filter(d => d.conceptos?.length > 0).length;
    const conceptosPct = details.length > 0 ? (detailsWithConceptos / details.length) * 100 : 0;
    const avgPerFact = summary.itemCount > 0 ? summary.total / summary.itemCount : 0;
    return { topCatPct, divPct, conceptosPct, avgPerFact };
  }, [topCategory.total, summary, details]);

  const historyMonths: any[] = historyData?.months ?? [];

  const evolutionData = useMemo(
    () =>
      historyMonths.map(m => ({
        month: m.month ? m.month.slice(5) : '',
        total: m.total ?? 0,
      })),
    [historyMonths]
  );

  const trendMetrics = useMemo(() => {
    if (historyMonths.length < 2) return null;
    const prev = historyMonths[historyMonths.length - 2];
    const curr = historyMonths[historyMonths.length - 1];
    const delta = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : 0);
    return {
      total: { value: curr.total ?? 0, delta: delta(curr.total ?? 0, prev.total ?? 0), history: historyMonths.map(m => ({ value: m.total ?? 0 })) },
      items: { value: curr.itemCount ?? 0, delta: delta(curr.itemCount ?? 0, prev.itemCount ?? 0), history: historyMonths.map(m => ({ value: m.itemCount ?? 0 })) },
      categories: { value: curr.categoryCount ?? 0, delta: delta(curr.categoryCount ?? 0, prev.categoryCount ?? 0), history: historyMonths.map(m => ({ value: m.categoryCount ?? 0 })) },
      avgPerItem: { value: curr.avgPerItem ?? 0, delta: delta(curr.avgPerItem ?? 0, prev.avgPerItem ?? 0), history: historyMonths.map(m => ({ value: m.avgPerItem ?? 0 })) },
    };
  }, [historyMonths]);

  if (isLoading) return <IndirectSkeleton />;

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            Error al cargar datos de costos indirectos.{' '}
            <Button variant="link" onClick={() => refetch()}>Reintentar</Button>
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
              <Building2 className="h-5 w-5" />
              Costos Indirectos V2
              <Badge variant="secondary" className="ml-2 text-xs flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                Desde Compras
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Facturas de Compras marcadas como costo indirecto — imputadas al mes seleccionado
            </p>
          </div>

          <div className="flex items-center gap-3">
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
              <TooltipContent>Cargar facturas como costos indirectos</TooltipContent>
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
                <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Sin costos indirectos en este mes</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  No hay facturas de Compras marcadas como costo indirecto para{' '}
                  {selectedMonth}. Al cargar una factura en Compras, activá el toggle{' '}
                  <strong>¿Es costo indirecto?</strong> y elegí la categoría.
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Indirectos</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart4 }}>
                        ${formatCurrency(summary.total)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Período {selectedMonth}</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart4}15` }}
                    >
                      <DollarSign className="h-5 w-5" style={{ color: userColors.chart4 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Facturas</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart1 }}>
                        {summary.itemCount}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Comprobantes indirectos</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart1}15` }}
                    >
                      <Layers className="h-5 w-5" style={{ color: userColors.chart1 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Categorías</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart2 }}>
                        {summary.categoryCount}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Tipos de costos</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart2}15` }}
                    >
                      <FolderOpen className="h-5 w-5" style={{ color: userColors.chart2 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Promedio/Factura</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart3 }}>
                        ${formatCurrency(summary.itemCount > 0 ? summary.total / summary.itemCount : 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Por comprobante</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart3}15` }}
                    >
                      <TrendingUp className="h-5 w-5" style={{ color: userColors.chart3 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card style={{ borderColor: `${userColors.chart4}40`, backgroundColor: `${userColors.chart4}05` }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Mayor Categoría</p>
                      <p className="text-base font-bold truncate" style={{ color: userColors.chart4 }}>
                        {topCategory.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ${formatCurrency(topCategory.total)} —{' '}
                        {formatPercent(summary.total > 0 ? (topCategory.total / summary.total) * 100 : 0)}
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 ml-2"
                      style={{ backgroundColor: `${userColors.chart4}15` }}
                    >
                      <Star className="h-5 w-5" style={{ color: userColors.chart4 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribución Detallada */}
            {showAnalytics && distributionData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" style={{ color: userColors.chart4 }} />
                    Distribución por Categoría
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
                          <span className="text-xs text-muted-foreground w-12 text-right shrink-0">
                            {item.pct.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <Card className="shrink-0 w-36 text-center self-start">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Total Indirectos</p>
                        <p className="text-lg font-bold mt-1" style={{ color: userColors.chart4 }}>
                          ${formatCurrency(summary.total)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {summary.categoryCount} categorías
                        </p>
                        <p className="text-xs text-muted-foreground">{summary.itemCount} facturas</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Barra apilada */}
            {sortedCategories.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" style={{ color: userColors.chart4 }} />
                    Proporción por Categoría
                  </CardTitle>
                  <CardDescription>Cada tipo de costo sobre el total del período</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex h-4 w-full rounded-full overflow-hidden gap-px">
                    {sortedCategories.map(({ key, total }, i) => {
                      const pct = summary.total > 0 ? (total / summary.total) * 100 : 0;
                      const colorKey = CHART_COLOR_KEYS[i % CHART_COLOR_KEYS.length];
                      const color = userColors[colorKey] as string;
                      return (
                        <Tooltip key={key}>
                          <TooltipTrigger asChild>
                            <div
                              className="h-full cursor-default transition-opacity hover:opacity-80"
                              style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? 4 : 0 }}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {CATEGORY_LABELS[key] || key}: ${formatCurrency(total)} ({formatPercent(pct)})
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>

                  <div className="space-y-3">
                    {sortedCategories.map(({ key, total, count }, i) => {
                      const pct = summary.total > 0 ? (total / summary.total) * 100 : 0;
                      const colorKey = CHART_COLOR_KEYS[i % CHART_COLOR_KEYS.length];
                      const color = userColors[colorKey] as string;
                      const icon = CATEGORY_ICONS[key] || CATEGORY_ICONS['OTHER'];

                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-muted-foreground">{icon}</span>
                              <span className="font-medium">{CATEGORY_LABELS[key] || key}</span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {count ?? 0} fact.
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold" style={{ color }}>
                                ${formatCurrency(total)}
                              </span>
                              <span className="text-muted-foreground w-12 text-right">
                                {formatPercent(pct)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts: Donut + Bar */}
            {(donutData.length > 0 || barData.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {donutData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" style={{ color: userColors.chart4 }} />
                        Distribución por Categoría
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
                {barData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Truck className="h-4 w-4" style={{ color: userColors.chart4 }} />
                        Top Proveedores por Monto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={barData}
                          layout="vertical"
                          margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                          <XAxis
                            type="number"
                            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                          <RechartsTooltip
                            content={({ active, payload, label }: any) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <div className="bg-background border rounded-lg p-2 shadow-md text-xs">
                                  <p className="font-medium mb-1">{label}</p>
                                  <p style={{ color: userColors.chart4 }}>
                                    ${formatCurrency(Number(payload[0].value))}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="total" fill={userColors.chart4} radius={[0, 4, 4, 0]} name="Total" />
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
                    <TrendingUp className="h-4 w-4" style={{ color: userColors.chart4 }} />
                    Evolución 12 Meses — Costos Indirectos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
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
                              <p style={{ color: userColors.chart4 }}>
                                ${formatCurrency(Number(payload[0].value))}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Line
                        dataKey="total"
                        stroke={userColors.chart4}
                        strokeWidth={2}
                        dot={false}
                        name="Total Indirectos"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Indicadores (Gauges) */}
            {showAnalytics && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Indicadores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <SemiGauge
                    pct={gaugeData.topCatPct}
                    label="Concentración Cat. Mayor"
                    meta="<50%"
                    color={gaugeData.topCatPct > 50 ? userColors.kpiNegative : userColors.kpiPositive}
                  />
                  <SemiGauge
                    pct={gaugeData.divPct}
                    label="Diversidad Categorías"
                    meta=">66%"
                    color={gaugeData.divPct >= 66 ? userColors.chart1 : userColors.chart4}
                  />
                  <SemiGauge
                    pct={gaugeData.conceptosPct}
                    label="Con Conceptos Cargados"
                    color={userColors.chart2}
                  />
                  <SemiGauge
                    pct={50}
                    label="Promedio / Factura"
                    color={userColors.chart3}
                    displayValue={`$${formatCurrency(gaugeData.avgPerFact)}`}
                  />
                </div>
              </CardContent>
            </Card>
            )}

            {/* Tendencias Strip */}
            {showAnalytics && trendMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Total Indirectos',
                    metric: trendMetrics.total,
                    color: userColors.chart4,
                    formatted: `$${formatCurrency(trendMetrics.total.value)}`,
                    costMetric: true,
                  },
                  {
                    label: 'Facturas',
                    metric: trendMetrics.items,
                    color: userColors.chart1,
                    formatted: String(trendMetrics.items.value),
                    costMetric: true,
                  },
                  {
                    label: 'Categorías Activas',
                    metric: trendMetrics.categories,
                    color: userColors.chart2,
                    formatted: String(trendMetrics.categories.value),
                    costMetric: false,
                  },
                  {
                    label: 'Prom. / Factura',
                    metric: trendMetrics.avgPerItem,
                    color: userColors.chart3,
                    formatted: `$${formatCurrency(trendMetrics.avgPerItem.value)}`,
                    costMetric: true,
                  },
                ].map(t => {
                  const isPositiveDelta = t.metric.delta >= 0;
                  const deltaColor = t.costMetric
                    ? (isPositiveDelta ? userColors.kpiNegative : userColors.kpiPositive)
                    : (isPositiveDelta ? userColors.kpiPositive : userColors.kpiNegative);
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
                          {isPositiveDelta ? '+' : ''}{t.metric.delta.toFixed(1)}% vs mes anterior
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
                    { key: 'soloImputadas', label: 'Solo imputadas', desc: 'Al período seleccionado' },
                    { key: 'incluirPendientes', label: 'Incluir pendientes', desc: 'Facturas sin aprobar' },
                    { key: 'agruparCategoria', label: 'Agrupar categorías', desc: 'Vista consolidada' },
                    { key: 'mostrarSubconceptos', label: 'Sub-conceptos', desc: 'Desglose de conceptos' },
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

            {/* Por Proveedor */}
            {showAnalytics && byProveedor.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4" style={{ color: userColors.chart4 }} />
                    Costos por Proveedor
                  </CardTitle>
                  <CardDescription>
                    Proveedores ordenados por monto total de gastos indirectos
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
                      {byProveedor.map((prov, idx) => {
                        const pct = summary.total > 0 ? (prov.total / summary.total) * 100 : 0;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{prov.nombre}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {prov.count}
                            </TableCell>
                            <TableCell className="text-right font-bold" style={{ color: userColors.chart4 }}>
                              ${formatCurrency(prov.total)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${pct}%`, backgroundColor: userColors.chart4 }}
                                  />
                                </div>
                                <span className="text-muted-foreground text-xs w-10 text-right">
                                  {formatPercent(pct)}
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

            {/* Detalle de Facturas (expandibles) */}
            {showAnalytics && details.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Facturas Indirectas</CardTitle>
                  <CardDescription>
                    {details.length} comprobantes — clic para ver conceptos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>N° Factura</TableHead>
                        <TableHead>Fecha Imp.</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details
                        .sort((a: any, b: any) => b.amount - a.amount)
                        .flatMap((item: any, index: number) => {
                          const hasConceptos = item.conceptos?.length > 0;
                          const isExpanded = expandedRows.has(String(item.id ?? index));
                          const rowKey = String(item.id ?? index);
                          const pct = summary.total > 0 ? (item.amount / summary.total) * 100 : 0;

                          const mainRow = (
                            <TableRow
                              key={rowKey}
                              className={cn(hasConceptos && 'cursor-pointer hover:bg-muted/40')}
                              onClick={hasConceptos ? () => toggleRow(rowKey) : undefined}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-1">
                                  {hasConceptos && (
                                    <ChevronDown
                                      className={cn(
                                        'h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0',
                                        isExpanded && 'rotate-180'
                                      )}
                                    />
                                  )}
                                  <span>{item.label || item.proveedorNombre || '—'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {item.facturaNumero || '—'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {item.fechaImputacion
                                  ? new Date(item.fechaImputacion + 'T00:00:00').toLocaleDateString('es-AR')
                                  : '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {CATEGORY_LABELS[item.category] || item.category || 'General'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold" style={{ color: userColors.chart4 }}>
                                ${formatCurrency(item.amount || 0)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${pct}%`, backgroundColor: userColors.chart4 }}
                                    />
                                  </div>
                                  <span className="text-muted-foreground text-xs w-9 text-right">
                                    {formatPercent(pct)}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );

                          const conceptoRows =
                            hasConceptos && isExpanded
                              ? item.conceptos.map((concepto: any) => (
                                  <TableRow key={`concepto-${concepto.id}`} className="bg-muted/30">
                                    <TableCell className="pl-8 text-sm text-muted-foreground" colSpan={3}>
                                      <span className="italic">{concepto.descripcion || '—'}</span>
                                    </TableCell>
                                    <TableCell />
                                    <TableCell className="text-right text-sm text-muted-foreground">
                                      {concepto.monto > 0 ? `$${formatCurrency(concepto.monto)}` : '—'}
                                    </TableCell>
                                    <TableCell />
                                  </TableRow>
                                ))
                              : [];

                          return [mainRow, ...conceptoRows];
                        })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Info Banner */}
            <Card style={{ backgroundColor: `${userColors.chart4}08`, borderColor: `${userColors.chart4}30` }}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 mt-0.5" style={{ color: userColors.chart4 }} />
                  <div className="text-sm">
                    <p className="font-medium mb-1" style={{ color: userColors.chart4 }}>
                      Costos Indirectos — Cargados desde Compras
                    </p>
                    <p className="text-muted-foreground">
                      Estas facturas fueron marcadas como <strong>costo indirecto</strong> al cargarlas
                      en el módulo de Compras. Para agregar nuevos costos indirectos, ingresá a Compras,
                      cargá la factura del proveedor y activá el toggle <em>¿Es costo indirecto?</em>{' '}
                      eligiendo la categoría correspondiente.
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

function IndirectSkeleton() {
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
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    </div>
  );
}
