'use client';

import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';
import { useState, useMemo } from 'react';
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
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  ExternalLink,
  RefreshCw,
  Info,
  CheckCircle,
  Clock,
  SlidersHorizontal,
  BarChart3,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { SemiGauge } from './SemiGauge';
import { cn, formatNumber } from '@/lib/utils';

interface PayrollViewV2Props {
  companyId: string;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
  userColors?: UserColorPreferences;
}

const formatCurrency = (value: number): string =>
  value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatPercent = (value: number): string => formatNumber(value, 1) + '%';

const PayrollCustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg p-2 shadow-md text-xs">
      <p className="font-medium mb-1">{payload[0]?.name || payload[0]?.payload?.name}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.color }}>
          {p.name}: ${formatCurrency(Number(p.value))}
        </p>
      ))}
    </div>
  );
};

function Sparkline({ data, color, height = 40 }: { data: { value: number }[]; color: string; height?: number }) {
  if (data.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">
        —
      </div>
    );
  }
  const gradId = `sg-pay-${color.replace('#', '')}`;
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

export function PayrollViewV2({
  companyId,
  selectedMonth,
  onMonthChange,
  userColors = DEFAULT_COLORS as UserColorPreferences,
}: PayrollViewV2Props) {
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);
  const [config, setConfig] = useState({
    soloCerradas: true,
    incluirCargas: true,
    porCategoria: false,
    prorratearSAC: false,
  });

  // ── Vista personalizada ──────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'resumen' | 'analitico' | 'completo'>(() => {
    if (typeof window === 'undefined') return 'analitico';
    return (localStorage.getItem('costos-view-nominas') as 'resumen' | 'analitico' | 'completo') ?? 'analitico';
  });
  const showAnalytics = viewMode !== 'resumen';
  const showConfig = viewMode === 'completo';
  const handleViewMode = (m: 'resumen' | 'analitico' | 'completo') => {
    setViewMode(m);
    localStorage.setItem('costos-view-nominas', m);
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['costos-payroll-v2', companyId, currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/costos/payroll?month=${currentMonth}`);
      if (!response.ok) throw new Error('Error fetching payroll data');
      return response.json();
    },
    enabled: !!companyId && !!currentMonth,
  });

  const { data: historyData } = useQuery({
    queryKey: ['costos-history-payroll', companyId],
    queryFn: async () => {
      const r = await fetch(`/api/costos/v2/history?feature=payroll&months=12`);
      if (!r.ok) throw new Error('Error fetching history');
      return r.json();
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });

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

  // Datos derivados — TODOS antes de early returns
  const payrollData = data?.data;
  const hasData = payrollData && payrollData.totalEmployerCost > 0;
  const cargasSociales = Math.max(0, (payrollData?.totalEmployerCost || 0) - (payrollData?.totalGross || 0));

  const donutData = useMemo(() => [
    { name: 'Salarios Brutos', value: payrollData?.totalGross || 0 },
    { name: 'Cargas Sociales', value: cargasSociales },
  ].filter(d => d.value > 0), [payrollData, cargasSociales]);

  const barData = useMemo(
    () => (payrollData?.details || []).map((d: any) => ({
      name: d.period?.slice(0, 7) || '—',
      Bruto: d.totalGross || 0,
      Empleador: d.totalEmployerCost || 0,
    })),
    [payrollData]
  );

  const PIE_COLORS = [userColors.chart1, userColors.chart4];

  // Distribución por liquidación (horizontal bars)
  const distributionData = useMemo(() => {
    const details: any[] = payrollData?.details || [];
    const maxVal = Math.max(...details.map(d => d.totalEmployerCost || 0), 1);
    return details.map((d, i) => ({
      label: `${d.periodType === 'MENSUAL' ? 'Mensual' : d.periodType || 'Nom.'} ${d.period || ''}`.trim(),
      bruto: d.totalGross || 0,
      empleador: d.totalEmployerCost || 0,
      pct: (d.totalEmployerCost || 0) / maxVal * 100,
      status: d.status,
      color: i % 2 === 0 ? userColors.chart1 : userColors.chart2,
    }));
  }, [payrollData, userColors]);

  // Gauge data
  const gaugeData = useMemo(() => {
    const details: any[] = payrollData?.details || [];
    const totalGross = payrollData?.totalGross || 0;
    const cargasPct = totalGross > 0 ? (cargasSociales / totalGross) * 100 : 0;
    const paidCount = details.filter(d => d.status === 'PAID').length;
    const paidPct = details.length > 0 ? (paidCount / details.length) * 100 : 0;
    const empCount = payrollData?.employeeCount || 0;
    const payCount = payrollData?.payrollCount || 1;
    const empPerPayroll = payCount > 0 ? empCount / payCount : 0;
    const costPerEmp = empCount > 0 ? (payrollData?.totalEmployerCost || 0) / empCount : 0;
    return { cargasPct, paidPct, empPerPayroll, costPerEmp };
  }, [payrollData, cargasSociales]);

  // Historia
  const historyMonths: any[] = historyData?.months ?? [];

  const evolutionData = useMemo(
    () =>
      historyMonths.map(m => ({
        month: m.month ? m.month.slice(5) : '',
        totalGross: m.totalGross ?? 0,
        cargasSociales: m.cargasSociales ?? 0,
        employerCost: m.employerCost ?? 0,
      })),
    [historyMonths]
  );

  const trendMetrics = useMemo(() => {
    if (historyMonths.length < 2) return null;
    const prev = historyMonths[historyMonths.length - 2];
    const curr = historyMonths[historyMonths.length - 1];
    const delta = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : 0);
    return {
      employerCost: { value: curr.employerCost ?? 0, delta: delta(curr.employerCost ?? 0, prev.employerCost ?? 0), history: historyMonths.map(m => ({ value: m.employerCost ?? 0 })) },
      employees: { value: curr.employeeCount ?? 0, delta: delta(curr.employeeCount ?? 0, prev.employeeCount ?? 0), history: historyMonths.map(m => ({ value: m.employeeCount ?? 0 })) },
      payrolls: { value: curr.payrollCount ?? 0, delta: delta(curr.payrollCount ?? 0, prev.payrollCount ?? 0), history: historyMonths.map(m => ({ value: m.payrollCount ?? 0 })) },
      costPerEmployee: { value: curr.costPerEmployee ?? 0, delta: delta(curr.costPerEmployee ?? 0, prev.costPerEmployee ?? 0), history: historyMonths.map(m => ({ value: m.costPerEmployee ?? 0 })) },
      cargasPct: {
        value: (curr.totalGross ?? 0) > 0 ? ((curr.cargasSociales ?? 0) / (curr.totalGross ?? 1)) * 100 : 0,
        delta: (() => {
          const cp = (prev.totalGross ?? 0) > 0 ? ((prev.cargasSociales ?? 0) / (prev.totalGross ?? 1)) * 100 : 0;
          const cc = (curr.totalGross ?? 0) > 0 ? ((curr.cargasSociales ?? 0) / (curr.totalGross ?? 1)) * 100 : 0;
          return cp > 0 ? ((cc - cp) / cp) * 100 : 0;
        })(),
        history: historyMonths.map(m => ({
          value: (m.totalGross ?? 0) > 0 ? ((m.cargasSociales ?? 0) / (m.totalGross ?? 1)) * 100 : 0,
        })),
      },
    };
  }, [historyMonths]);

  if (isLoading) {
    return <PayrollSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            Error al cargar datos de nóminas.{' '}
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
              <Users className="h-5 w-5" />
              Costos de Nómina V2
              <Badge variant="secondary" className="ml-2 text-xs">Automático</Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Datos importados automáticamente desde el módulo de Nóminas
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
                <Link href="/nominas">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ir a Nóminas
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Gestionar nóminas en el módulo dedicado</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin datos de nómina</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  No hay nóminas cerradas (APPROVED/PAID) para el período {currentMonth}.
                  Los costos de nómina se importan automáticamente cuando se cierran las liquidaciones.
                </p>
                <Link href="/nominas">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Crear Nómina
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
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Costo Empleador</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart1 }}>
                        ${formatCurrency(payrollData.totalEmployerCost || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Costo total para la empresa</p>
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
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Sueldos Brutos</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart2 }}>
                        ${formatCurrency(payrollData.totalGross || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {payrollData.employeeCount || 0} empleados
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart2}15` }}
                    >
                      <Users className="h-5 w-5" style={{ color: userColors.chart2 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Cargas Sociales</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart4 }}>
                        ${formatCurrency(cargasSociales)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatPercent(payrollData.totalGross > 0 ? (cargasSociales / payrollData.totalGross) * 100 : 0)} del bruto
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart4}15` }}
                    >
                      <TrendingUp className="h-5 w-5" style={{ color: userColors.chart4 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Nóminas</p>
                      <p className="text-2xl font-bold">
                        {payrollData.payrollCount || 0}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Liquidaciones cerradas</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${userColors.chart3}15` }}
                    >
                      <Calendar className="h-5 w-5" style={{ color: userColors.chart3 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribución por Liquidación */}
            {showAnalytics && distributionData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" style={{ color: userColors.chart1 }} />
                    Distribución por Liquidación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6">
                    <div className="flex-1 space-y-3">
                      {distributionData.map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-right w-40 shrink-0 truncate">{item.label}</span>
                          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                            />
                          </div>
                          <span className="text-xs font-medium w-24 text-right shrink-0">
                            ${formatCurrency(item.empleador)}
                          </span>
                          <Badge
                            variant={item.status === 'PAID' ? 'default' : 'secondary'}
                            className="text-xs shrink-0 w-20 justify-center"
                          >
                            {item.status === 'PAID' ? '✓ Pagado' : 'Aprobado'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <Card className="shrink-0 w-36 text-center self-start">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Total Empleador</p>
                        <p className="text-lg font-bold mt-1" style={{ color: userColors.chart1 }}>
                          ${formatCurrency(payrollData.totalEmployerCost || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {payrollData.payrollCount} nóminas
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payrollData.employeeCount} empleados
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart1}15` }}
                    >
                      <DollarSign className="h-3 w-3" style={{ color: userColors.chart1 }} />
                    </div>
                    Composición del Costo Empleador
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
                      <RechartsTooltip content={<PayrollCustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart2}15` }}
                    >
                      <Users className="h-3 w-3" style={{ color: userColors.chart2 }} />
                    </div>
                    Bruto vs Costo Empleador por Liquidación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} fontSize={11} width={52} />
                      <RechartsTooltip content={<PayrollCustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} />
                      <Bar dataKey="Bruto" fill={userColors.chart2} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Empleador" fill={userColors.chart1} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Evolución 12 meses */}
            {showAnalytics && evolutionData.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" style={{ color: userColors.chart1 }} />
                    Evolución 12 Meses — Costos Laborales
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
                      <Line dataKey="totalGross" stroke={userColors.chart2} strokeWidth={2} dot={false} name="Bruto" />
                      <Line dataKey="cargasSociales" stroke={userColors.chart4} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Cargas" />
                      <Line dataKey="employerCost" stroke={userColors.chart1} strokeWidth={1.5} dot={false} strokeDasharray="2 2" name="Total Empleador" />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {showAnalytics && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Indicadores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <SemiGauge
                    pct={gaugeData.cargasPct}
                    label="% Cargas Sociales"
                    meta="<35%"
                    color={gaugeData.cargasPct <= 35 ? userColors.kpiPositive : userColors.kpiNegative}
                  />
                  <SemiGauge
                    pct={gaugeData.paidPct}
                    label="% Nóminas Pagas"
                    meta="100%"
                    color={gaugeData.paidPct >= 100 ? userColors.kpiPositive : userColors.chart4}
                  />
                  <SemiGauge
                    pct={50}
                    label="Empleados / Nómina"
                    color={userColors.chart3}
                    displayValue={formatNumber(gaugeData.empPerPayroll, 1)}
                  />
                  <SemiGauge
                    pct={50}
                    label="Costo / Empleado"
                    color={userColors.chart2}
                    displayValue={`$${formatCurrency(gaugeData.costPerEmp)}`}
                  />
                </div>
              </CardContent>
            </Card>

            )}
            {/* Tendencias Strip */}
            {showAnalytics && trendMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Costo Empleador', metric: trendMetrics.employerCost, color: userColors.chart1, formatted: `$${formatCurrency(trendMetrics.employerCost.value)}`, costMetric: true },
                  { label: 'Empleados', metric: trendMetrics.employees, color: userColors.chart2, formatted: String(trendMetrics.employees.value), costMetric: false },
                  { label: 'Liquidaciones', metric: trendMetrics.payrolls, color: userColors.chart3, formatted: String(trendMetrics.payrolls.value), costMetric: false },
                  { label: 'Costo / Empleado', metric: trendMetrics.costPerEmployee, color: userColors.chart4, formatted: `$${formatCurrency(trendMetrics.costPerEmployee.value)}`, costMetric: true },
                  { label: '% Cargas', metric: trendMetrics.cargasPct, color: userColors.chart6, formatted: `${formatNumber(trendMetrics.cargasPct.value, 1)}%`, costMetric: true },
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
                          {isPositiveDelta ? '+' : ''}{formatNumber(t.metric.delta, 1)}%
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

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
                    { key: 'soloCerradas', label: 'Solo cerradas', desc: 'Estado PAID o APPROVED' },
                    { key: 'incluirCargas', label: 'Incluir cargas patronales', desc: 'Aportes del empleador' },
                    { key: 'porCategoria', label: 'Por categoría', desc: 'Agrupar por tipo de empleado' },
                    { key: 'prorratearSAC', label: 'Prorratear SAC', desc: 'Incluir aguinaldo en el período' },
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
            {/* Detalle de Nóminas */}
            {showAnalytics && payrollData.details && payrollData.details.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalle de Liquidaciones</CardTitle>
                  <CardDescription>
                    Nóminas cerradas incluidas en el cálculo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Empleados</TableHead>
                        <TableHead className="text-right">Bruto</TableHead>
                        <TableHead className="text-right">Costo Empleador</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollData.details.map((run: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant="outline">
                              {run.periodType === 'MENSUAL' ? 'Mensual' : run.periodType}
                            </Badge>
                          </TableCell>
                          <TableCell>{run.period}</TableCell>
                          <TableCell>
                            <Badge
                              variant={run.status === 'PAID' ? 'default' : 'secondary'}
                              className="flex items-center gap-1 w-fit"
                            >
                              {run.status === 'PAID' ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              {run.status === 'PAID' ? 'Pagado' : 'Aprobado'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{run.employeeCount}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${formatCurrency(run.totalGross)}
                          </TableCell>
                          <TableCell className="text-right font-bold" style={{ color: userColors.chart1 }}>
                            ${formatCurrency(run.totalEmployerCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                      Datos V2 — Importación Automática
                    </p>
                    <p className="text-muted-foreground">
                      Los costos de nómina se importan automáticamente desde las liquidaciones
                      cerradas (APPROVED o PAID) del módulo de Nóminas. Para agregar o modificar
                      datos, gestiona las nóminas desde el módulo dedicado.
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

function PayrollSkeleton() {
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
      <Skeleton className="h-48" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    </div>
  );
}
