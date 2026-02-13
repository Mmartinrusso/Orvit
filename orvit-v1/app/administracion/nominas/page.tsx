'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Calendar,
  DollarSign,
  Users,
  AlertTriangle,
  TrendingUp,
  FileText,
  RefreshCcw,
  Settings,
  CreditCard,
  ChevronRight,
  Zap,
  Banknote,
  Calculator,
  MapPin,
} from 'lucide-react';

import { usePayrollProjection } from '@/hooks/use-payroll-dashboard';

// ============ UTILS ============

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return formatCurrency(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ============ CUSTOM TOOLTIP ============

function ChartTooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs">
      {children}
    </div>
  );
}

// ============ KPI CARD COMPONENT ============

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  sparkData,
  onClick,
  highlight,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  sparkData?: { x: string; y: number }[];
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        'min-h-[120px] rounded-lg border border-gray-300/90 shadow-sm bg-gradient-to-t from-black/5 via-gray-100/50 to-white dark:border-gray-600/90 dark:from-black/10 dark:via-gray-800/50 dark:to-gray-900',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        highlight && 'border-primary/50 bg-gradient-to-t from-primary/5 via-primary/5 to-white'
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2 px-4">
        <div className="text-muted-foreground text-xs font-normal">{title}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-4 pb-2 pt-0">
        <div className="text-3xl font-normal leading-none tabular-nums mb-1">{value}</div>
        {subtitle && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground leading-tight">
            <TrendingUp className="h-3 w-3" />
            <span className="font-medium">{subtitle}</span>
          </div>
        )}
        {sparkData && sparkData.length > 0 && (
          <div className="h-8 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="y"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#sparkFill)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ MAIN COMPONENT ============

export default function NominasPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isFetching } = usePayrollProjection();

  const shortcuts = [
    { label: 'Nueva Liquidacion', icon: Calculator, path: '/administracion/nominas/liquidaciones' },
    { label: 'Gremios', icon: Users, path: '/administracion/nominas/gremios' },
    { label: 'Sectores', icon: MapPin, path: '/administracion/nominas/sectores' },
    { label: 'Componentes', icon: TrendingUp, path: '/administracion/nominas/componentes' },
    { label: 'Adelantos', icon: CreditCard, path: '/administracion/nominas/adelantos' },
  ];

  // Transform monthly projection for chart
  const chartData = useMemo(() => {
    if (!data?.projection?.monthlyProjection) return [];
    return data.projection.monthlyProjection.map((p, idx) => ({
      name: new Date(p.paymentDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
      value: p.estimatedNet,
      x: String(idx),
      y: p.estimatedNet,
    }));
  }, [data?.projection?.monthlyProjection]);

  const sparkData = useMemo(() => {
    if (!chartData.length) return [];
    return chartData.map((d, i) => ({ x: String(i), y: d.value }));
  }, [chartData]);

  // Loading
  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 grid grid-cols-12 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-span-6 lg:col-span-3">
              <Skeleton className="h-32" />
            </div>
          ))}
          <div className="col-span-12 lg:col-span-8">
            <Skeleton className="h-80" />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <Skeleton className="h-80" />
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Panel de Nominas</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card>
            <CardContent className="py-10 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Error al cargar el dashboard</p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Not configured
  if (!data?.configured) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Panel de Nominas</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure el modulo para comenzar</p>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card>
            <CardContent className="py-10 text-center">
              <Settings className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Configure el modulo de nominas</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Antes de comenzar, debe configurar la frecuencia de pago, los componentes salariales y los feriados.
              </p>
              <Button onClick={() => router.push('/administracion/nominas/configuracion')}>
                <Settings className="mr-2 h-4 w-4" />
                Ir a Configuracion
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { nextPayment, pendingAdvances, alerts } = data.projection || {
    nextPayment: null,
    pendingAdvances: { total: 0, count: 0 },
    alerts: [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-start gap-4 justify-between">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Panel de Nominas</h1>
            <div className="mt-1 flex flex-col gap-0.5">
              <p className="text-sm text-muted-foreground">
                Proyecciones, liquidaciones y adelantos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                'inline-flex items-center border border-border rounded-md p-0.5 bg-muted/40 h-7',
                'px-2 text-[11px] font-normal gap-1.5',
                'hover:bg-muted disabled:opacity-50',
                isFetching && 'bg-background shadow-sm'
              )}
            >
              <RefreshCcw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6 grid grid-cols-12 gap-4 md:gap-6 items-start">
        {/* Alerts */}
        {alerts && alerts.length > 0 && (
          <div className="col-span-12 space-y-2">
            {alerts.map((alert, idx) => (
              <Alert
                key={idx}
                variant={alert.type === 'error' ? 'destructive' : 'default'}
              >
                {alert.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
                <AlertDescription>
                  <strong>{alert.message}</strong>
                  {alert.details && <span className="ml-2 text-sm">{alert.details}</span>}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* KPI Row */}
        <div className="col-span-6 lg:col-span-3">
          <KpiCard
            title="Proximo Pago"
            value={nextPayment ? formatCompact(nextPayment.estimatedTotal) : '-'}
            subtitle={nextPayment ? `${nextPayment.daysUntil === 0 ? 'Hoy' : nextPayment.daysUntil === 1 ? 'Manana' : `En ${nextPayment.daysUntil} dias`}` : 'Sin periodos'}
            icon={Banknote}
            highlight={nextPayment && nextPayment.daysUntil <= 3}
            sparkData={sparkData}
            onClick={() => router.push('/administracion/nominas/liquidaciones')}
          />
        </div>

        <div className="col-span-6 lg:col-span-3">
          <KpiCard
            title="Empleados"
            value={nextPayment?.employeeCount || 0}
            subtitle="activos en nomina"
            icon={Users}
            onClick={() => router.push('/empleados')}
          />
        </div>

        <div className="col-span-6 lg:col-span-3">
          <KpiCard
            title="Adelantos Pendientes"
            value={pendingAdvances?.count || 0}
            subtitle={pendingAdvances?.total ? formatCompact(pendingAdvances.total) : 'Sin pendientes'}
            icon={CreditCard}
            onClick={() => router.push('/administracion/nominas/adelantos')}
          />
        </div>

        <div className="col-span-6 lg:col-span-3">
          <KpiCard
            title="Costo Empleador"
            value={nextPayment ? formatCompact(nextPayment.breakdown.employerCost) : '-'}
            subtitle="proximo periodo"
            icon={DollarSign}
            onClick={() => router.push('/administracion/nominas/liquidaciones')}
          />
        </div>

        {/* Atajos Rapidos */}
        <div className="col-span-12">
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Acciones Rapidas
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex flex-wrap gap-2">
                {shortcuts.map((shortcut) => {
                  const Icon = shortcut.icon;
                  return (
                    <Button
                      key={shortcut.path}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2"
                      onClick={() => router.push(shortcut.path)}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {shortcut.label}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Next Payment Detail */}
        {nextPayment && (
          <div className="col-span-12 lg:col-span-8">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Proximo Pago - {nextPayment.periodDisplay}
                    </CardTitle>
                    <CardDescription className="text-xs capitalize">
                      {formatDate(nextPayment.date)}
                    </CardDescription>
                  </div>
                  <Badge variant={nextPayment.daysUntil <= 3 ? 'destructive' : 'secondary'}>
                    {nextPayment.daysUntil === 0
                      ? 'Hoy'
                      : nextPayment.daysUntil === 1
                        ? 'Manana'
                        : `En ${nextPayment.daysUntil} dias`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-[10px] text-muted-foreground mb-1">Total Bruto</div>
                    <div className="text-lg font-semibold">{formatCompact(nextPayment.breakdown.grossSalaries)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-[10px] text-muted-foreground mb-1">Descuentos</div>
                    <div className="text-lg font-semibold text-red-600">-{formatCompact(nextPayment.breakdown.deductions)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-[10px] text-muted-foreground mb-1">Adelantos</div>
                    <div className="text-lg font-semibold text-orange-600">-{formatCompact(nextPayment.breakdown.advances)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10">
                    <div className="text-[10px] text-muted-foreground mb-1">Neto a Pagar</div>
                    <div className="text-lg font-semibold text-primary">{formatCompact(nextPayment.breakdown.netTotal)}</div>
                  </div>
                </div>

                {/* Chart */}
                {chartData.length > 0 && (
                  <div className="h-32 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatCompact(v)}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <ChartTooltip>
                                <p className="font-medium">{payload[0]?.payload?.name}</p>
                                <p>{formatCurrency(payload[0]?.value as number)}</p>
                              </ChartTooltip>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#colorValue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Links */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Acceso Rapido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button
                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                onClick={() => router.push('/administracion/nominas/configuracion')}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Configuracion</div>
                    <div className="text-xs text-muted-foreground">Frecuencia, dias, feriados</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              <button
                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                onClick={() => router.push('/administracion/nominas/componentes')}
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Componentes</div>
                    <div className="text-xs text-muted-foreground">Formulas, haberes, descuentos</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              <button
                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                onClick={() => router.push('/administracion/nominas/adelantos')}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Adelantos</div>
                    <div className="text-xs text-muted-foreground">
                      {pendingAdvances?.count ? `${pendingAdvances.count} pendientes` : 'Sin pendientes'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              <button
                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                onClick={() => router.push('/administracion/nominas/liquidaciones')}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Liquidaciones</div>
                    <div className="text-xs text-muted-foreground">Generar, aprobar, pagar</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </div>

        {/* No next payment */}
        {!nextPayment && (
          <div className="col-span-12">
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No hay periodos de pago configurados</p>
                <Button variant="outline" onClick={() => router.push('/administracion/nominas/configuracion')}>
                  Generar periodos del mes
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Links adicionales */}
        <div className="col-span-12">
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Mas opciones:</span>
                <button
                  onClick={() => router.push('/administracion/nominas/liquidaciones')}
                  className="hover:text-foreground transition-colors"
                >
                  Historial
                </button>
                <button
                  onClick={() => router.push('/empleados')}
                  className="hover:text-foreground transition-colors"
                >
                  Empleados
                </button>
                <button
                  onClick={() => router.push('/administracion/nominas/componentes')}
                  className="hover:text-foreground transition-colors"
                >
                  Formulas
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
