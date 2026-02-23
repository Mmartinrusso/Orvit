'use client';

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
  Factory,
  DollarSign,
  Package,
  Boxes,
  ExternalLink,
  RefreshCw,
  Info,
  FileText,
  Beaker,
  FlaskConical,
  TrendingUp,
  TrendingDown,
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
import { formatNumber } from '@/lib/utils';

interface ProductionViewV2Props {
  companyId: string;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
  userColors?: UserColorPreferences;
}

const formatCurrency = (value: number): string =>
  value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function Sparkline({ data, color, height = 40 }: { data: { value: number }[]; color: string; height?: number }) {
  if (data.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">
        —
      </div>
    );
  }
  const gradId = `sg-prod-${color.replace('#', '')}`;
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

export function ProductionViewV2({
  companyId,
  selectedMonth,
  onMonthChange,
  userColors = DEFAULT_COLORS as UserColorPreferences,
}: ProductionViewV2Props) {
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);
  const [config, setConfig] = useState({
    soloConReceta: false,
    incluirTodos: true,
    prorratearFijo: false,
    desglosarInsumos: true,
  });

  // ── Vista personalizada ───────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'resumen' | 'analitico' | 'completo'>(() => {
    if (typeof window === 'undefined') return 'analitico';
    return (localStorage.getItem('costos-view-produccion') as 'resumen' | 'analitico' | 'completo') ?? 'analitico';
  });
  const showAnalytics = viewMode !== 'resumen';
  const showConfig = viewMode === 'completo';
  const handleViewMode = (m: 'resumen' | 'analitico' | 'completo') => {
    setViewMode(m);
    localStorage.setItem('costos-view-produccion', m);
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
    queryKey: ['costos-production-v2', companyId, currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/costos/production?month=${currentMonth}`);
      if (!response.ok) throw new Error('Error fetching production data');
      return response.json();
    },
    enabled: !!companyId && !!currentMonth,
  });

  const { data: historyData } = useQuery({
    queryKey: ['costos-history-production', companyId],
    queryFn: async () => {
      const r = await fetch(`/api/costos/v2/history?feature=production&months=12`);
      if (!r.ok) throw new Error('Error fetching history');
      return r.json();
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  // Datos derivados — TODOS antes de early returns
  const hasData = data?.hasData;
  const summary = data?.summary ?? { totalProductionCost: 0, unitsProduced: 0, productCount: 0 };
  const byProduct: any[] = data?.byProduct ?? [];
  const inputsConsumed: any[] = data?.inputsConsumed ?? [];

  const totalCost = summary.totalProductionCost || 0;
  const unitCostAvg = summary.unitsProduced > 0 ? totalCost / summary.unitsProduced : 0;

  const totalInputCost = useMemo(
    () => inputsConsumed.reduce((s: number, i: any) => s + (i.totalCost || 0), 0),
    [inputsConsumed]
  );

  const sortedByProduct = useMemo(
    () => [...byProduct].sort((a, b) => (b.inputCost || 0) - (a.inputCost || 0)),
    [byProduct]
  );

  const sortedInputs = useMemo(
    () => [...inputsConsumed].sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0)).slice(0, 10),
    [inputsConsumed]
  );

  const donutData = useMemo(
    () =>
      sortedByProduct
        .slice(0, 8)
        .map((p, i) => {
          const colorKeys: Array<keyof UserColorPreferences> = ['chart2', 'chart1', 'chart3', 'chart5', 'chart4', 'chart6', 'chart2', 'chart1'];
          return {
            name: (p.productName || `Prod #${p.productId}`).slice(0, 22),
            value: p.inputCost || 0,
            color: userColors[colorKeys[i % colorKeys.length]] as string,
          };
        })
        .filter(d => d.value > 0),
    [sortedByProduct, userColors]
  );

  const inputBarData = useMemo(
    () =>
      sortedInputs.slice(0, 8).map(i => ({
        name: (i.inputName || `Insumo #${i.inputId}`).slice(0, 22),
        costo: i.totalCost || 0,
      })),
    [sortedInputs]
  );

  // Distribución horizontal bars
  const distributionData = useMemo(
    () =>
      sortedByProduct.slice(0, 6).map((p, i) => {
        const colorKeys: Array<keyof UserColorPreferences> = ['chart2', 'chart1', 'chart3', 'chart5', 'chart4', 'chart6'];
        return {
          label: (p.productName || `Producto #${p.productId}`).slice(0, 30),
          value: p.inputCost || 0,
          color: userColors[colorKeys[i % colorKeys.length]] as string,
          pct: totalCost > 0 ? ((p.inputCost || 0) / totalCost) * 100 : 0,
          hasRecipe: !!p.hasRecipe,
        };
      }),
    [sortedByProduct, totalCost, userColors]
  );

  // Gauge data
  const gaugeData = useMemo(() => {
    const productsWithRecipe = byProduct.filter(p => p.hasRecipe).length;
    const recipeCovPct = byProduct.length > 0 ? (productsWithRecipe / byProduct.length) * 100 : 0;
    const top3Cost = sortedByProduct.slice(0, 3).reduce((s, p) => s + (p.inputCost || 0), 0);
    const top3Pct = totalCost > 0 ? (top3Cost / totalCost) * 100 : 0;
    return {
      recipeCovPct,
      top3Pct,
      unitCostAvg,
      inputsCount: inputsConsumed.length,
    };
  }, [byProduct, sortedByProduct, totalCost, unitCostAvg, inputsConsumed]);

  // Historia
  const historyMonths: any[] = historyData?.months ?? [];

  const evolutionData = useMemo(
    () =>
      historyMonths.map(m => ({
        month: m.month ? m.month.slice(5) : '',
        totalCost: m.totalCost ?? 0,
        unitsProduced: m.unitsProduced ?? 0,
      })),
    [historyMonths]
  );

  const trendMetrics = useMemo(() => {
    if (historyMonths.length < 2) return null;
    const prev = historyMonths[historyMonths.length - 2];
    const curr = historyMonths[historyMonths.length - 1];
    const delta = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : 0);
    return {
      totalCost: { value: curr.totalCost ?? 0, delta: delta(curr.totalCost ?? 0, prev.totalCost ?? 0), history: historyMonths.map(m => ({ value: m.totalCost ?? 0 })) },
      units: { value: curr.unitsProduced ?? 0, delta: delta(curr.unitsProduced ?? 0, prev.unitsProduced ?? 0), history: historyMonths.map(m => ({ value: m.unitsProduced ?? 0 })) },
      products: { value: curr.productCount ?? 0, delta: delta(curr.productCount ?? 0, prev.productCount ?? 0), history: historyMonths.map(m => ({ value: m.productCount ?? 0 })) },
      costPerUnit: { value: curr.costPerUnit ?? 0, delta: delta(curr.costPerUnit ?? 0, prev.costPerUnit ?? 0), history: historyMonths.map(m => ({ value: m.costPerUnit ?? 0 })) },
    };
  }, [historyMonths]);

  if (isLoading) {
    return <ProductionSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            Error al cargar datos de producción.{' '}
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
              <Factory className="h-5 w-5" />
              Producción V2
              <Badge variant="secondary" className="ml-2 text-xs flex items-center gap-1">
                <Beaker className="h-3 w-3" />
                Desde Recetas
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Costos calculados desde producción mensual y recetas activas
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
                <Link href="/produccion">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ir a Producción
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Gestionar producción en el módulo dedicado</TooltipContent>
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
                <Factory className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin datos de producción</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  No hay producción mensual registrada para {currentMonth}.
                  Los costos se calculan desde los registros de producción y las recetas activas.
                </p>
                <Link href="/produccion">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Registrar Producción
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
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Costo Producción</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart2 }}>
                        ${formatCurrency(totalCost)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Consumo de insumos</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart2}15` }}
                    >
                      <DollarSign className="h-5 w-5" style={{ color: userColors.chart2 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Unidades</p>
                      <p className="text-2xl font-bold">
                        {formatNumber(summary.unitsProduced || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Total del período</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart1}15` }}
                    >
                      <Boxes className="h-5 w-5" style={{ color: userColors.chart1 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Productos</p>
                      <p className="text-2xl font-bold">{summary.productCount || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">Distintos producidos</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart3}15` }}
                    >
                      <Package className="h-5 w-5" style={{ color: userColors.chart3 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Costo Unit. Prom.</p>
                      <p className="text-2xl font-bold">${formatCurrency(unitCostAvg)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Por unidad</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart4}15` }}
                    >
                      <Beaker className="h-5 w-5" style={{ color: userColors.chart4 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Insumos</p>
                      <p className="text-2xl font-bold">{inputsConsumed.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Tipos distintos</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart5}15` }}
                    >
                      <FlaskConical className="h-5 w-5" style={{ color: userColors.chart5 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribución por Producto */}
            {showAnalytics && distributionData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" style={{ color: userColors.chart2 }} />
                    Distribución por Producto
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
                            {formatNumber(item.pct, 1)}%
                          </span>
                          <Badge variant={item.hasRecipe ? 'secondary' : 'outline'} className="text-xs shrink-0">
                            {item.hasRecipe ? '✓' : '—'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <Card className="shrink-0 w-36 text-center self-start">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Costo Total</p>
                        <p className="text-lg font-bold mt-1" style={{ color: userColors.chart2 }}>
                          ${formatCurrency(totalCost)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {summary.productCount} productos
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(summary.unitsProduced)} unid.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts: Costo por Producto + Top Insumos */}
            {(donutData.length > 0 || inputBarData.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {donutData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Factory className="h-4 w-4" style={{ color: userColors.chart2 }} />
                        Costo por Producto
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
                {inputBarData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FlaskConical className="h-4 w-4" style={{ color: userColors.chart5 }} />
                        Top Insumos por Costo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={inputBarData}
                          layout="vertical"
                          margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                          <XAxis
                            type="number"
                            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                          <RechartsTooltip
                            content={({ active, payload, label }: any) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <div className="bg-background border rounded-lg p-2 shadow-md text-xs">
                                  <p className="font-medium mb-1">{label}</p>
                                  <p style={{ color: userColors.chart5 }}>
                                    ${formatCurrency(Number(payload[0].value))}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="costo" fill={userColors.chart5} radius={[0, 4, 4, 0]} name="Costo" />
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
                    <TrendingUp className="h-4 w-4" style={{ color: userColors.chart2 }} />
                    Evolución 12 Meses — Costo de Producción
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
                              {payload.map((p: any) => (
                                <p key={p.dataKey} style={{ color: p.stroke }}>
                                  {p.name}: {p.dataKey === 'totalCost' ? `$${formatCurrency(Number(p.value))}` : formatNumber(Number(p.value))}
                                </p>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Line
                        dataKey="totalCost"
                        stroke={userColors.chart2}
                        strokeWidth={2}
                        dot={false}
                        name="Costo Total"
                      />
                      <Line
                        dataKey="unitsProduced"
                        stroke={userColors.chart1}
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="4 2"
                        name="Unidades"
                      />
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
                <CardTitle className="text-sm">Indicadores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <SemiGauge
                    pct={gaugeData.recipeCovPct}
                    label="Cobertura de Recetas"
                    meta="100%"
                    color={gaugeData.recipeCovPct >= 100 ? userColors.kpiPositive : gaugeData.recipeCovPct >= 60 ? userColors.chart4 : userColors.kpiNegative}
                  />
                  <SemiGauge
                    pct={gaugeData.top3Pct}
                    label="Concentración Top 3"
                    color={userColors.chart2}
                  />
                  <SemiGauge
                    pct={50}
                    label="Costo / Unidad"
                    color={userColors.chart3}
                    displayValue={`$${formatCurrency(gaugeData.unitCostAvg)}`}
                  />
                  <SemiGauge
                    pct={50}
                    label="Insumos Distintos"
                    color={userColors.chart5}
                    displayValue={String(gaugeData.inputsCount)}
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
                    label: 'Costo Producción',
                    metric: trendMetrics.totalCost,
                    color: userColors.chart2,
                    formatted: `$${formatCurrency(trendMetrics.totalCost.value)}`,
                    costMetric: true,
                  },
                  {
                    label: 'Unidades Producidas',
                    metric: trendMetrics.units,
                    color: userColors.chart1,
                    formatted: formatNumber(trendMetrics.units.value),
                    costMetric: false,
                  },
                  {
                    label: 'Productos Distintos',
                    metric: trendMetrics.products,
                    color: userColors.chart3,
                    formatted: String(trendMetrics.products.value),
                    costMetric: false,
                  },
                  {
                    label: 'Costo / Unidad',
                    metric: trendMetrics.costPerUnit,
                    color: userColors.chart4,
                    formatted: `$${formatCurrency(trendMetrics.costPerUnit.value)}`,
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
                          {isPositiveDelta ? '+' : ''}{formatNumber(t.metric.delta, 1)}% vs mes anterior
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
                  Configuración de Cálculo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    { key: 'soloConReceta', label: 'Solo con receta', desc: 'Filtrar productos sin receta' },
                    { key: 'incluirTodos', label: 'Incluir todos', desc: 'Productos sin receta en cero' },
                    { key: 'prorratearFijo', label: 'Prorratear fijo', desc: 'Incluir costos fijos' },
                    { key: 'desglosarInsumos', label: 'Desglose insumos', desc: 'Ver cada insumo por producto' },
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

            {/* Por Producto */}
            {showAnalytics && sortedByProduct.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart2}15` }}
                    >
                      <Factory className="h-3 w-3" style={{ color: userColors.chart2 }} />
                    </div>
                    Producción por Producto
                  </CardTitle>
                  <CardDescription>
                    Desglose de producción y costos por producto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Costo Insumos</TableHead>
                        <TableHead className="text-right">Costo Unitario</TableHead>
                        <TableHead className="w-32">% del Total</TableHead>
                        <TableHead>Receta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedByProduct.map((prod) => {
                        const unitCost = prod.quantity > 0 ? (prod.inputCost || 0) / prod.quantity : 0;
                        const pct = totalCost > 0 ? ((prod.inputCost || 0) / totalCost) * 100 : 0;
                        return (
                          <TableRow key={prod.productId}>
                            <TableCell className="font-medium">
                              {prod.productName || `Producto #${prod.productId}`}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(prod.quantity || 0)}
                            </TableCell>
                            <TableCell className="text-right font-bold" style={{ color: userColors.chart2 }}>
                              ${formatCurrency(prod.inputCost || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              ${formatCurrency(unitCost)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: userColors.chart2, width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-10 text-right">
                                  {formatNumber(pct, 1)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={prod.hasRecipe ? 'default' : 'outline'} className="text-xs">
                                {prod.hasRecipe ? 'Con receta' : 'Sin receta'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Consumo de Insumos */}
            {showAnalytics && sortedInputs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart5}15` }}
                    >
                      <FlaskConical className="h-3 w-3" style={{ color: userColors.chart5 }} />
                    </div>
                    Consumo de Insumos
                    <Badge variant="secondary" className="text-xs">{inputsConsumed.length} distintos · top 10</Badge>
                  </CardTitle>
                  <CardDescription>
                    Insumos consumidos según recetas (ordenados por costo)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Insumo</TableHead>
                        <TableHead className="text-right">Cant. Consumida</TableHead>
                        <TableHead className="text-right">Precio Unit.</TableHead>
                        <TableHead className="text-right">Costo Total</TableHead>
                        <TableHead className="w-32">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedInputs.map((input, index) => {
                        const pct = totalInputCost > 0 ? ((input.totalCost || 0) / totalInputCost) * 100 : 0;
                        return (
                          <TableRow key={input.inputId ?? index}>
                            <TableCell className="text-xs font-bold text-muted-foreground w-6">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {input.inputName || `Insumo #${input.inputId}`}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(input.quantity || 0)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              ${formatCurrency(input.unitCost || 0)}
                            </TableCell>
                            <TableCell className="text-right font-bold" style={{ color: userColors.chart2 }}>
                              ${formatCurrency(input.totalCost || 0)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: userColors.chart5, width: `${Math.min(pct, 100)}%` }}
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
                      Costos de Producción — Calculados desde Recetas
                    </p>
                    <p className="text-muted-foreground">
                      Los costos se calculan multiplicando las unidades producidas (registradas en Producción Mensual)
                      por las cantidades de insumos definidas en las recetas activas, usando el precio actual de cada insumo.
                      Para cargar producción del mes, ingresá al módulo de Producción.
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

function ProductionSkeleton() {
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    </div>
  );
}
