'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { cn, formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  AlertTriangle,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Target,
  DollarSign,
  BarChart3,
  RefreshCw,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, ReferenceLine,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import { SemiGauge } from './SemiGauge';

interface UserColorPreferences {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  kpiPositive: string;
  kpiNegative: string;
  kpiNeutral: string;
  [key: string]: string;
}

interface ProductRow {
  productId: string;
  productName: string;
  categoryName: string | null;
  unitsProduced: number;
  unitsSold: number;
  costPerUnit: number;
  costMaterials: number;
  costIndirect: number;
  costTotal: number;
  revenuePriceAvg: number;
  revenueTotal: number;
  grossMargin: number;
  marginPercent: number;
  hasRecipe: boolean;
  hasSales: boolean;
}

interface CalculatorTotals {
  totalUnitsProduced: number;
  totalCostMaterials: number;
  totalCostIndirect: number;
  totalCostTotal: number;
  totalRevenue: number;
  totalGrossMargin: number;
  avgMarginPercent: number;
  avgSalePrice: number;
  avgCostPerUnit: number;
}

interface CalculatorData {
  month: string;
  products: ProductRow[];
  totals: CalculatorTotals;
  availableMonths: string[];
  warnings: string[];
}

const formatCurrency = (value: number): string =>
  (value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatUnitCost = (value: number): string =>
  (value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatPercent = (value: number): string => formatNumber(value ?? 0, 1) + '%';

// Mini sparkline — gradient IDs prefixed with 'rent-' to avoid conflicts
function Sparkline({ data, color, height = 40 }: { data: { value: number }[]; color: string; height?: number }) {
  const gradId = `rent-${color.replace('#', '')}`;
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

interface RentabilidadViewProps {
  colors: UserColorPreferences;
  month: string;
}

export function RentabilidadView({ colors, month: initialMonth }: RentabilidadViewProps) {
  const { currentCompany } = useCompany();

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [data, setData] = useState<CalculatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Umbral de margen mínimo (configurable por el usuario en la UI)
  const [marginThreshold, setMarginThreshold] = useState(30);

  // ── Vista personalizada ───────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'resumen' | 'analitico' | 'completo'>(() => {
    if (typeof window === 'undefined') return 'analitico';
    return (localStorage.getItem('costos-view-rentabilidad') as 'resumen' | 'analitico' | 'completo') ?? 'analitico';
  });
  const showAnalytics = viewMode !== 'resumen';
  const handleViewMode = (m: 'resumen' | 'analitico' | 'completo') => {
    setViewMode(m);
    localStorage.setItem('costos-view-rentabilidad', m);
  };

  const navigateMonth = (dir: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let m = month + (dir === 'next' ? 1 : -1);
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const formatMonthDisplay = (s: string) => {
    const [y, m] = s.split('-').map(Number);
    const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${names[m - 1]} ${y}`;
  };

  useEffect(() => {
    if (!currentCompany?.id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/costos/v2/calculator?month=${selectedMonth}`)
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar datos');
        return r.json();
      })
      .then((d: CalculatorData & { success: boolean }) => {
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentCompany?.id, selectedMonth]);

  // Historial 12 meses (usa feature=sales para obtener revenue, cost, grossMargin, marginPercent)
  const historyQuery = useQuery({
    queryKey: ['costos-history-sales-rent', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch('/api/costos/v2/history?feature=sales&months=12');
      if (!res.ok) throw new Error('Error al cargar historial');
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!currentCompany?.id,
  });

  // Productos con alerta de margen bajo
  const lowMarginProducts = useMemo(
    () => (data?.products ?? []).filter((p) => p.hasSales && p.marginPercent < marginThreshold),
    [data, marginThreshold]
  );

  // Datos de charts existentes
  const donutData = useMemo(() => {
    const t = data?.totals;
    if (!t) return [];
    return [
      { name: 'Materias Primas', value: t.totalCostMaterials || 0, color: colors.chart2 },
      { name: 'Costos Indirectos', value: t.totalCostIndirect || 0, color: colors.chart4 },
    ].filter(d => d.value > 0);
  }, [data, colors]);

  const marginBarData = useMemo(
    () =>
      (data?.products ?? [])
        .filter((p: ProductRow) => p.hasSales)
        .sort((a: ProductRow, b: ProductRow) => b.marginPercent - a.marginPercent)
        .slice(0, 8)
        .map((p: ProductRow) => ({
          name: (p.productName || '—').slice(0, 14),
          margen: Number(formatNumber(p.marginPercent, 1)),
        })),
    [data]
  );

  // ─── Nuevas secciones ───────────────────────────────────────────────────────

  // Distribución por ingreso (top 8 productos con ventas)
  const distributionData = useMemo(() => {
    if (!data?.products) return [];
    const sorted = [...data.products]
      .filter(p => p.hasSales)
      .sort((a, b) => b.revenueTotal - a.revenueTotal)
      .slice(0, 8);
    const maxVal = sorted[0]?.revenueTotal ?? 1;
    return sorted.map(p => ({
      label: p.productName,
      value: p.revenueTotal,
      pct: (p.revenueTotal / maxVal) * 100,
      marginPct: p.marginPercent,
      isAbove: p.marginPercent >= marginThreshold,
    }));
  }, [data, marginThreshold]);

  // Datos de gauges
  const gaugeData = useMemo(() => {
    const empty = { okPct: 0, marginGaugePct: 0, costMatPct: 0, withBothPct: 0, okCount: 0, withSalesCount: 0 };
    if (!data?.products || !data?.totals) return empty;
    const productsWithSales = data.products.filter(p => p.hasSales);
    const okCount = productsWithSales.filter(p => p.marginPercent >= marginThreshold).length;
    const okPct = productsWithSales.length > 0 ? (okCount / productsWithSales.length) * 100 : 0;
    const marginGaugePct = Math.min(100, Math.max(0, data.totals.avgMarginPercent));
    const costMatPct = data.totals.totalRevenue > 0
      ? (data.totals.totalCostMaterials / data.totals.totalRevenue) * 100
      : 0;
    const withBoth = data.products.filter(p => p.hasRecipe && p.hasSales).length;
    const withBothPct = data.products.length > 0 ? (withBoth / data.products.length) * 100 : 0;
    return { okPct, marginGaugePct, costMatPct, withBothPct, okCount, withSalesCount: productsWithSales.length };
  }, [data, marginThreshold]);

  // Datos para evolución 12 meses
  const evolutionData = useMemo(() => {
    if (!historyQuery.data?.months) return [];
    return (historyQuery.data.months as any[]).map((m) => ({
      month: m.month.slice(5), // "MM"
      marginPercent: m.marginPercent ?? 0,
      revenue: Math.round((m.revenue ?? 0) / 1000), // en $k
    }));
  }, [historyQuery.data]);

  // Tendencias strip (4 métricas)
  const trendMetrics = useMemo(() => {
    const historyMonths: any[] = historyQuery.data?.months ?? [];
    const n = historyMonths.length;
    const curr = n > 0 ? historyMonths[n - 1] : null;
    const prev = n > 1 ? historyMonths[n - 2] : null;
    if (!curr) return [];
    const calcDelta = (cv: number, pv: number) =>
      pv > 0 ? ((cv - pv) / pv) * 100 : 0;
    return [
      {
        label: 'Margen Promedio',
        formatted: formatPercent(curr.marginPercent ?? 0),
        delta: calcDelta(curr.marginPercent ?? 0, prev?.marginPercent ?? 0),
        history: historyMonths.map((m: any) => ({ value: m.marginPercent ?? 0 })),
        color: colors.kpiPositive,
        positiveIsGood: true,
      },
      {
        label: 'Margen Bruto $',
        formatted: `$${formatCurrency(curr.grossMargin ?? 0)}`,
        delta: calcDelta(curr.grossMargin ?? 0, prev?.grossMargin ?? 0),
        history: historyMonths.map((m: any) => ({ value: m.grossMargin ?? 0 })),
        color: colors.chart1,
        positiveIsGood: true,
      },
      {
        label: 'Ingresos',
        formatted: `$${formatCurrency(curr.revenue ?? 0)}`,
        delta: calcDelta(curr.revenue ?? 0, prev?.revenue ?? 0),
        history: historyMonths.map((m: any) => ({ value: m.revenue ?? 0 })),
        color: colors.chart5,
        positiveIsGood: true,
      },
      {
        label: 'Costo Total',
        formatted: `$${formatCurrency(curr.cost ?? 0)}`,
        delta: calcDelta(curr.cost ?? 0, prev?.cost ?? 0),
        history: historyMonths.map((m: any) => ({ value: m.cost ?? 0 })),
        color: colors.chart4,
        positiveIsGood: false,
      },
    ];
  }, [historyQuery.data, colors]);

  // ───────────────────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Producto', 'Categoría', 'Uds. Prod.', 'Uds. Vend.', 'Costo/UN', 'Precio Venta/UN', 'Ingresos', 'Margen %'];
    const rows = data.products.map((p) => [
      p.productName,
      p.categoryName ?? '-',
      p.unitsProduced,
      p.unitsSold,
      formatUnitCost(p.costPerUnit),
      formatUnitCost(p.revenuePriceAvg),
      formatCurrency(p.revenueTotal),
      formatPercent(p.marginPercent),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rentabilidad_${selectedMonth}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Calculando rentabilidad...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/10">
        <CardContent className="p-6 text-center text-destructive">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p className="font-medium">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const products = data?.products ?? [];
  const totals = data?.totals;
  const hasData = products.length > 0 && !!totals;

  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* Header con navegación de mes */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background min-w-[130px] justify-center">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatMonthDisplay(selectedMonth)}</span>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* Umbral configurable */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Umbral mínimo:</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={marginThreshold}
                  onChange={(e) => setMarginThreshold(Number(e.target.value))}
                  className="w-20 h-8 text-sm text-center"
                  min={0}
                  max={100}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              {(['resumen', 'analitico', 'completo'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleViewMode(m)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-md transition-all',
                    viewMode === m ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {m === 'resumen' ? 'Resumen' : m === 'analitico' ? 'Analítico' : 'Completo'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPIs */}
        {totals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4" style={{ borderLeftColor: colors.chart1 }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4" style={{ color: colors.chart1 }} />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Ingresos Totales</p>
                </div>
                <p className="text-2xl font-bold">${formatCurrency(totals.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">{products.filter((p) => p.hasSales).length} productos con ventas</p>
              </CardContent>
            </Card>

            <Card className="border-l-4" style={{ borderLeftColor: colors.chart2 }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4" style={{ color: colors.chart2 }} />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Costo Total</p>
                </div>
                <p className="text-2xl font-bold">${formatCurrency(totals.totalCostTotal)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Mat: ${formatCurrency(totals.totalCostMaterials)} + Ind: ${formatCurrency(totals.totalCostIndirect)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4" style={{ borderLeftColor: colors.kpiPositive }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4" style={{ color: colors.kpiPositive }} />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Margen Promedio</p>
                </div>
                <p
                  className="text-2xl font-bold"
                  style={{ color: totals.avgMarginPercent >= marginThreshold ? colors.kpiPositive : colors.kpiNegative }}
                >
                  {formatPercent(totals.avgMarginPercent)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Margen bruto ponderado</p>
              </CardContent>
            </Card>

            <Card className="border-l-4" style={{ borderLeftColor: colors.chart4 }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4" style={{ color: colors.chart4 }} />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Costo Prom/Unidad</p>
                </div>
                <p className="text-2xl font-bold">${formatUnitCost(totals.avgCostPerUnit)}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(totals.totalUnitsProduced)} uds producidas</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alertas de margen bajo */}
        {lowMarginProducts.length > 0 && (
          <Card style={{ borderColor: colors.chart3 + '60', backgroundColor: colors.chart3 + '08' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4" style={{ color: colors.chart3 }} />
                <span className="font-medium text-sm">
                  {lowMarginProducts.length} producto{lowMarginProducts.length !== 1 ? 's' : ''} con margen por debajo del umbral ({marginThreshold}%)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowMarginProducts.map((p) => (
                  <Badge
                    key={p.productId}
                    variant="outline"
                    style={{ borderColor: colors.chart3 + '80', color: colors.chart3 }}
                  >
                    {p.productName}: {formatPercent(p.marginPercent)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts: Desglose de Costo + Margen por Producto */}
        {(donutData.length > 0 || marginBarData.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {donutData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" style={{ color: colors.chart2 }} />
                    Desglose del Costo
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
            {marginBarData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" style={{ color: colors.kpiPositive }} />
                    Margen % por Producto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={marginBarData}
                      margin={{ left: 0, right: 8, top: 4, bottom: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                      <YAxis
                        tickFormatter={(v: number) => `${v}%`}
                        tick={{ fontSize: 11 }}
                      />
                      <RechartsTooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-background border rounded-lg p-2 shadow-md text-xs">
                              <p className="font-medium mb-1">{label}</p>
                              <p style={{ color: payload[0].value >= marginThreshold ? colors.kpiPositive : colors.kpiNegative }}>
                                Margen: {formatNumber(Number(payload[0].value), 1)}%
                              </p>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine
                        y={marginThreshold}
                        stroke={colors.chart4}
                        strokeDasharray="4 2"
                        label={{ value: `Umbral ${marginThreshold}%`, position: 'insideTopRight', fontSize: 10, fill: colors.chart4 }}
                      />
                      <Bar dataKey="margen" name="Margen %" radius={[4, 4, 0, 0]}>
                        {marginBarData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.margen >= marginThreshold ? colors.kpiPositive : colors.kpiNegative}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ─── NUEVO: Distribución por Ingreso ─────────────────────────────────── */}
        {showAnalytics && hasData && distributionData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: colors.chart1 }} />
                Distribución por Producto (Top {distributionData.length} por ingreso)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                {/* Barras horizontales */}
                <div className="flex-1 space-y-3">
                  {distributionData.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-right w-28 shrink-0 truncate text-muted-foreground">
                        {item.label}
                      </span>
                      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.pct}%`,
                            backgroundColor: item.isAbove ? colors.kpiPositive : colors.kpiNegative,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium w-24 text-right shrink-0">
                        ${formatCurrency(item.value)}
                      </span>
                      <span
                        className="text-xs font-semibold w-14 text-right shrink-0"
                        style={{ color: item.isAbove ? colors.kpiPositive : colors.kpiNegative }}
                      >
                        {formatPercent(item.marginPct)}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Sidebar con totales */}
                <Card className="shrink-0 w-36 text-center self-start">
                  <CardContent className="p-3 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Ingresos</p>
                      <p className="text-lg font-bold" style={{ color: colors.chart1 }}>
                        ${formatCurrency(totals?.totalRevenue ?? 0)}
                      </p>
                    </div>
                    <div className="border-t pt-2">
                      <p className="text-xs text-muted-foreground">Sobre umbral</p>
                      <p className="text-base font-bold" style={{ color: colors.kpiPositive }}>
                        {gaugeData.okCount}/{gaugeData.withSalesCount}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── NUEVO: Indicadores ────────────────────────────────────────────────── */}
        {showAnalytics && hasData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" style={{ color: colors.chart5 }} />
                Indicadores de Rentabilidad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="flex flex-col items-center gap-1">
                  <SemiGauge
                    pct={gaugeData.okPct}
                    label="Productos sobre umbral"
                    meta="100%"
                    color={gaugeData.okPct >= 80 ? colors.kpiPositive : gaugeData.okPct >= 50 ? colors.chart4 : colors.kpiNegative}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {gaugeData.okCount} de {gaugeData.withSalesCount} productos
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <SemiGauge
                    pct={gaugeData.marginGaugePct}
                    label="Margen Promedio"
                    meta={`>${marginThreshold}%`}
                    color={gaugeData.marginGaugePct >= marginThreshold ? colors.kpiPositive : colors.kpiNegative}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    vs umbral {marginThreshold}%
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <SemiGauge
                    pct={Math.min(100, gaugeData.costMatPct)}
                    label="% Costo Materiales"
                    color={gaugeData.costMatPct <= 40 ? colors.kpiPositive : gaugeData.costMatPct <= 60 ? colors.chart4 : colors.kpiNegative}
                    displayValue={`${formatPercent(gaugeData.costMatPct)}`}
                  />
                  <p className="text-xs text-muted-foreground text-center">sobre ingresos totales</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <SemiGauge
                    pct={gaugeData.withBothPct}
                    label="Con receta y ventas"
                    meta="100%"
                    color={gaugeData.withBothPct >= 80 ? colors.kpiPositive : gaugeData.withBothPct >= 50 ? colors.chart4 : colors.kpiNegative}
                  />
                  <p className="text-xs text-muted-foreground text-center">productos completos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── NUEVO: Evolución 12 meses ─────────────────────────────────────────── */}
        {showAnalytics && evolutionData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: colors.kpiPositive }} />
                Evolución 12 meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={evolutionData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 11 }}
                    domain={[0, 'auto']}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(v: number) => `$${v}k`}
                    tick={{ fontSize: 11 }}
                    domain={[0, 'auto']}
                  />
                  <RechartsTooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-md text-xs space-y-1">
                          <p className="font-medium">{label}</p>
                          {payload.map((p: any, i: number) => (
                            <p key={i} style={{ color: p.color }}>
                              {p.name}: {p.name === 'Margen %' ? `${p.value}%` : `$${p.value}k`}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <ReferenceLine
                    yAxisId="left"
                    y={marginThreshold}
                    stroke={colors.chart4}
                    strokeDasharray="4 2"
                    label={{ value: `Umbral ${marginThreshold}%`, position: 'insideTopLeft', fontSize: 10, fill: colors.chart4 }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="marginPercent"
                    name="Margen %"
                    stroke={colors.kpiPositive}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    name="Ingresos $k"
                    stroke={colors.chart1}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ─── NUEVO: Tendencias Strip ────────────────────────────────────────────── */}
        {showAnalytics && trendMetrics.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Tendencias del período</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {trendMetrics.map((t) => {
                const isPositiveDelta = t.delta >= 0;
                const deltaColor = t.positiveIsGood
                  ? (isPositiveDelta ? colors.kpiPositive : colors.kpiNegative)
                  : (isPositiveDelta ? colors.kpiNegative : colors.kpiPositive);
                return (
                  <Card key={t.label}>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground mb-1">{t.label}</p>
                      <Sparkline data={t.history} color={t.color} height={40} />
                      <p className="text-base font-bold mt-1">{t.formatted}</p>
                      <p className="text-xs" style={{ color: deltaColor }}>
                        {isPositiveDelta ? '+' : ''}{formatNumber(t.delta, 1)}% vs mes anterior
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabla de rentabilidad por producto */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: colors.chart1 }} />
              P&L por Producto — {formatMonthDisplay(selectedMonth)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {products.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Sin producción registrada en este período</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Uds. Prod.</TableHead>
                    <TableHead className="text-right">Uds. Vend.</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        Costo/UN
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Materiales + Indirectos distribuidos</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Precio Venta/UN</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    const isLow = p.hasSales && p.marginPercent < marginThreshold;
                    const marginColor = !p.hasSales
                      ? colors.kpiNeutral
                      : p.marginPercent >= marginThreshold
                        ? colors.kpiPositive
                        : colors.kpiNegative;

                    const MarginIcon = !p.hasSales
                      ? Minus
                      : p.marginPercent >= marginThreshold + 10
                        ? TrendingUp
                        : p.marginPercent >= marginThreshold
                          ? Minus
                          : TrendingDown;

                    return (
                      <TableRow
                        key={p.productId}
                        className={cn(isLow && 'bg-destructive/5')}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{p.productName}</p>
                            {p.categoryName && (
                              <p className="text-xs text-muted-foreground">{p.categoryName}</p>
                            )}
                            {!p.hasRecipe && (
                              <Badge variant="outline" className="text-xs mt-0.5 text-warning-muted-foreground border-warning-muted">
                                Sin receta
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(p.unitsProduced)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {p.hasSales ? formatCurrency(p.unitsSold) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          ${formatUnitCost(p.costPerUnit)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {p.hasSales ? (
                            <span className="font-medium">${formatUnitCost(p.revenuePriceAvg)}</span>
                          ) : (
                            <span className="text-muted-foreground">Sin ventas</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {p.hasSales ? `$${formatCurrency(p.revenueTotal)}` : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <MarginIcon
                              className="h-3.5 w-3.5"
                              style={{ color: marginColor }}
                            />
                            <span
                              className="font-bold text-sm"
                              style={{ color: marginColor }}
                            >
                              {p.hasSales ? formatPercent(p.marginPercent) : '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {!p.hasSales ? (
                            <Badge variant="secondary" className="text-xs">Sin ventas</Badge>
                          ) : isLow ? (
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{ color: colors.kpiNegative, borderColor: colors.kpiNegative + '60' }}
                            >
                              ⚠ Bajo umbral
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{ color: colors.kpiPositive, borderColor: colors.kpiPositive + '60' }}
                            >
                              ✓ Ok
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Advertencias del consolidador */}
        {data?.warnings && data.warnings.length > 0 && (
          <Card className="border-warning-muted bg-warning-muted">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-warning-muted-foreground" />
                <span className="text-sm font-medium text-warning-muted-foreground">Notas del cálculo</span>
              </div>
              <ul className="space-y-1">
                {data.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-warning-muted-foreground flex items-start gap-1.5">
                    <span className="mt-0.5">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
