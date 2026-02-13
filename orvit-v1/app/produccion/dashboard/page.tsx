'use client';

import React, { useState, useEffect, useCallback } from 'react';
import EmployeeDashboard from '@/components/production/EmployeeDashboard';
import {
  Factory,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Package,
  Pause,
  Play,
  BarChart3,
  Activity,
  Loader2,
  RefreshCw,
  Calendar,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, subDays, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface KPIData {
  orders: {
    total: number;
    inProgress: number;
    completed: number;
    paused: number;
    planVsRealPercent: number;
  };
  production: {
    totalGood: number;
    totalScrap: number;
    totalRework: number;
    scrapPercent: number;
    totalProductiveMinutes: number;
    totalDowntimeMinutes: number;
    availabilityPercent: number;
  };
  downtimes: {
    total: number;
    totalMinutes: number;
    unplanned: number;
    planned: number;
    paretoByReason: { code: string; name: string; count: number; minutes: number }[];
  };
  quality: {
    total: number;
    approved: number;
    rejected: number;
    hold: number;
    approvalRate: number;
  };
  lots: {
    blocked: number;
    pending: number;
    approved: number;
  };
  charts: {
    productionByDay: { date: string; good: number; scrap: number }[];
  };
  recentEvents: {
    id: number;
    type: string;
    entityType: string;
    orderCode?: string;
    performedBy?: string;
    performedAt: string;
    notes?: string;
  }[];
}

const COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const DEFAULT_COLORS = {
  chart1: '#6366f1',
  chart2: '#8b5cf6',
  chart4: '#f59e0b',
  chart5: '#10b981',
  chart6: '#06b6d4',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};

function ManagerDashboard() {
  const { currentSector, currentCompany } = useCompany();
  const { user } = useAuth();
  const userColors = DEFAULT_COLORS;
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [workCenters, setWorkCenters] = useState<{ id: number; name: string }[]>([]);
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string>('');

  const fetchKPIs = useCallback(async () => {
    if (!currentSector) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
      });
      if (selectedWorkCenter) {
        params.set('workCenterId', selectedWorkCenter);
      }

      const res = await fetch(`/api/production/kpis?${params}`);
      const data = await res.json();
      if (data.success) {
        setKpis(data.kpis);
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedWorkCenter, currentSector]);

  const fetchWorkCenters = useCallback(async () => {
    try {
      const res = await fetch('/api/production/work-centers?status=ACTIVE');
      const data = await res.json();
      if (data.success) {
        setWorkCenters(data.workCenters);
      }
    } catch (error) {
      console.error('Error fetching work centers:', error);
    }
  }, []);

  useEffect(() => {
    fetchWorkCenters();
  }, [fetchWorkCenters]);

  useEffect(() => {
    if (currentSector) {
      fetchKPIs();
    }
  }, [fetchKPIs, currentSector]);

  // Si no hay sector seleccionado, mostrar mensaje
  if (!currentSector) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sector no seleccionado</h2>
          <p className="text-sm text-muted-foreground">
            Por favor, selecciona un sector para acceder al dashboard de producción.
          </p>
        </div>
      </div>
    );
  }

  const setQuickFilter = (filter: 'today' | 'week' | 'month' | '30days') => {
    const today = new Date();
    switch (filter) {
      case 'today':
        setDateFrom(format(today, 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
      case 'week':
        setDateFrom(format(subDays(today, 7), 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
      case 'month':
        setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
      case '30days':
        setDateFrom(format(subDays(today, 30), 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CREATED: 'Creado',
      RELEASED: 'Liberado',
      STARTED: 'Iniciado',
      PAUSED: 'Pausado',
      RESUMED: 'Reanudado',
      COMPLETED: 'Completado',
      CANCELLED: 'Cancelado',
      REPORT_CREATED: 'Parte creado',
      REPORT_UPDATED: 'Parte actualizado',
      REPORT_CONFIRMED: 'Parte confirmado',
      REPORT_REVIEWED: 'Parte revisado',
      LOT_CREATED: 'Lote creado',
      LOT_BLOCKED: 'Lote bloqueado',
      LOT_RELEASED: 'Lote liberado',
      DOWNTIME_STARTED: 'Parada iniciada',
      DOWNTIME_ENDED: 'Parada finalizada',
      LINKED_TO_WO: 'OT vinculada',
    };
    return labels[type] || type;
  };

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${userColors.chart1}15` }}
            >
              <Factory className="h-5 w-5" style={{ color: userColors.chart1 }} />
            </div>
            Dashboard de Producción
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {currentSector?.name} · Métricas y KPIs del módulo
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchKPIs()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5">
              {(['today', 'week', 'month', '30days'] as const).map((f) => {
                const labels = { today: 'Hoy', week: 'Semana', month: 'Mes', '30days': '30 días' };
                return (
                  <Button key={f} variant="outline" size="sm" className="h-8 text-xs" onClick={() => setQuickFilter(f)}>
                    {labels[f]}
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-8" />
              <span className="text-muted-foreground text-sm">a</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-8" />
            </div>

            <Select value={selectedWorkCenter || 'all'} onValueChange={(v) => setSelectedWorkCenter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-48 h-8">
                <SelectValue placeholder="Todos los centros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los centros</SelectItem>
                {workCenters.map((wc) => (
                  <SelectItem key={wc.id} value={wc.id.toString()}>{wc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {kpis && (
        <>
          {/* KPI Cards Row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Órdenes Activas', value: kpis.orders.inProgress,
                sub: <Badge variant="outline" className="text-[10px]"><Pause className="h-2.5 w-2.5 mr-0.5" />{kpis.orders.paused} pausadas</Badge>,
                icon: ClipboardList, color: userColors.chart1,
                link: '/produccion/ordenes?status=IN_PROGRESS', linkLabel: 'Ver órdenes',
              },
              {
                label: 'Plan vs Real', value: `${kpis.orders.planVsRealPercent}%`,
                sub: (
                  <span className="text-xs font-medium flex items-center gap-1" style={{ color: kpis.orders.planVsRealPercent >= 100 ? userColors.kpiPositive : userColors.kpiNegative }}>
                    {kpis.orders.planVsRealPercent >= 100 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {kpis.orders.planVsRealPercent >= 100 ? 'Cumplido' : 'Por debajo'}
                  </span>
                ),
                icon: BarChart3, color: kpis.orders.planVsRealPercent >= 100 ? userColors.kpiPositive : userColors.chart4,
              },
              {
                label: '% Scrap', value: `${kpis.production.scrapPercent}%`,
                sub: <span className="text-xs text-muted-foreground">{kpis.production.totalScrap.toLocaleString()} unidades</span>,
                icon: AlertTriangle, color: kpis.production.scrapPercent > 5 ? userColors.kpiNegative : userColors.kpiPositive,
              },
              {
                label: 'Disponibilidad', value: `${kpis.production.availabilityPercent}%`,
                sub: <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{formatMinutes(kpis.production.totalDowntimeMinutes)} paradas</span>,
                icon: Activity, color: kpis.production.availabilityPercent >= 85 ? userColors.kpiPositive : userColors.chart4,
              },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                      <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                      <div className="mt-1">{kpi.sub}</div>
                    </div>
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15` }}>
                      <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                    </div>
                  </div>
                  {kpi.link && (
                    <Link href={kpi.link} className="text-xs hover:underline mt-2 block" style={{ color: userColors.chart1 }}>
                      {kpi.linkLabel} →
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* KPI Cards Row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Paradas Totales', value: kpis.downtimes.total,
                sub: (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{kpis.downtimes.unplanned} no planif.</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{kpis.downtimes.planned} planif.</Badge>
                  </div>
                ),
                icon: Pause, color: userColors.kpiNegative,
                link: '/produccion/paradas', linkLabel: 'Ver paradas',
              },
              {
                label: 'Aprobación QC', value: `${kpis.quality.approvalRate}%`,
                sub: <span className="text-xs text-muted-foreground">{kpis.quality.approved}/{kpis.quality.total} controles</span>,
                icon: CheckCircle2, color: kpis.quality.approvalRate >= 95 ? userColors.kpiPositive : userColors.chart4,
                link: '/produccion/calidad', linkLabel: 'Ver calidad',
              },
              {
                label: 'Lotes Bloqueados', value: kpis.lots.blocked,
                sub: <Badge variant="outline" className="text-[10px] px-1.5 py-0">{kpis.lots.pending} pendientes</Badge>,
                icon: Package, color: kpis.lots.blocked > 0 ? userColors.kpiNegative : userColors.kpiPositive,
                link: '/produccion/calidad?tab=lots', linkLabel: 'Ver lotes',
              },
              {
                label: 'Producción Total', value: kpis.production.totalGood.toLocaleString(),
                sub: <span className="text-xs text-muted-foreground">+{kpis.production.totalRework.toLocaleString()} retrabajo</span>,
                icon: TrendingUp, color: userColors.kpiPositive,
              },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                      <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                      <div className="mt-1">{kpi.sub}</div>
                    </div>
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15` }}>
                      <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                    </div>
                  </div>
                  {kpi.link && (
                    <Link href={kpi.link} className="text-xs hover:underline mt-2 block" style={{ color: userColors.chart1 }}>
                      {kpi.linkLabel} →
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" style={{ color: userColors.kpiPositive }} />
                  Producción Diaria
                </CardTitle>
                <CardDescription className="text-xs">Unidades buenas vs scrap por día</CardDescription>
              </CardHeader>
              <CardContent>
                {kpis.charts.productionByDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={kpis.charts.productionByDay}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd/MM', { locale: es })} fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip labelFormatter={(v) => format(new Date(v), 'dd MMM yyyy', { locale: es })} />
                      <Legend />
                      <Line type="monotone" dataKey="good" name="Buenas" stroke={userColors.kpiPositive} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="scrap" name="Scrap" stroke={userColors.kpiNegative} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sin datos para el período seleccionado</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Pause className="h-4 w-4" style={{ color: userColors.kpiNegative }} />
                  Pareto de Paradas
                </CardTitle>
                <CardDescription className="text-xs">Top motivos de parada por minutos</CardDescription>
              </CardHeader>
              <CardContent>
                {kpis.downtimes.paretoByReason.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={kpis.downtimes.paretoByReason} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" fontSize={11} />
                      <YAxis type="category" dataKey="name" fontSize={11} width={95} tickFormatter={(v) => v.length > 15 ? v.substring(0, 15) + '...' : v} />
                      <Tooltip formatter={(value: number) => [`${formatMinutes(value)} (${kpis.downtimes.paretoByReason.find(d => d.minutes === value)?.count || 0} eventos)`, 'Tiempo']} />
                      <Bar dataKey="minutes" fill={userColors.kpiNegative} radius={[0, 4, 4, 0]}>
                        {kpis.downtimes.paretoByReason.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sin paradas registradas en el período</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" style={{ color: userColors.kpiPositive }} />
                  Controles de Calidad
                </CardTitle>
                <CardDescription className="text-xs">Distribución por resultado</CardDescription>
              </CardHeader>
              <CardContent>
                {kpis.quality.total > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Aprobados', value: kpis.quality.approved, color: userColors.kpiPositive },
                          { name: 'Rechazados', value: kpis.quality.rejected, color: userColors.kpiNegative },
                          { name: 'Retenidos', value: kpis.quality.hold, color: userColors.chart4 },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value"
                      >
                        {[
                          { name: 'Aprobados', value: kpis.quality.approved, color: userColors.kpiPositive },
                          { name: 'Rechazados', value: kpis.quality.rejected, color: userColors.kpiNegative },
                          { name: 'Retenidos', value: kpis.quality.hold, color: userColors.chart4 },
                        ].filter(d => d.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sin controles en el período</div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" style={{ color: userColors.chart6 }} />
                  Actividad Reciente
                </CardTitle>
                <CardDescription className="text-xs">Últimos eventos de producción</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {kpis.recentEvents.length > 0 ? (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {kpis.recentEvents.map((event) => (
                      <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${userColors.chart6}15` }}>
                          <Activity className="h-3.5 w-3.5" style={{ color: userColors.chart6 }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {getEventTypeLabel(event.type)}
                            {event.orderCode && <span className="text-muted-foreground ml-1">- {event.orderCode}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {event.performedBy} · {format(new Date(event.performedAt), 'dd/MM HH:mm', { locale: es })}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{event.entityType.replace('_', ' ')}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sin actividad reciente</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Accesos Rápidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { href: '/produccion/ordenes/nueva', icon: ClipboardList, label: 'Nueva Orden', color: userColors.chart1 },
                  { href: '/produccion/registro-diario', icon: Package, label: 'Producción del Día', color: userColors.kpiPositive },
                  { href: '/produccion/paradas', icon: Clock, label: 'Registrar Parada', color: userColors.chart4 },
                  { href: '/produccion/calidad', icon: CheckCircle2, label: 'Control Calidad', color: userColors.chart6 },
                  { href: '/produccion/configuracion', icon: Factory, label: 'Configuración', color: userColors.kpiNeutral },
                  { href: '/produccion/reportes', icon: BarChart3, label: 'Reportes', color: userColors.chart2 },
                ].map((link) => (
                  <Link key={link.href} href={link.href}>
                    <Button variant="outline" className="w-full h-20 flex flex-col gap-2 hover:border-primary/30 transition-colors">
                      <link.icon className="h-5 w-5" style={{ color: link.color }} />
                      <span className="text-xs">{link.label}</span>
                    </Button>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function ProductionDashboardPage() {
  const { hasPermission, user } = useAuth();

  const isManager = hasPermission('produccion.dashboard.admin') || user?.role === 'ADMIN' || hasPermission('produccion.rutinas.manage');

  if (!isManager) {
    return <EmployeeDashboard />;
  }

  return <ManagerDashboard />;
}
