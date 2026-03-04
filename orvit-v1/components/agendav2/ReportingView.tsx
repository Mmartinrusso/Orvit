'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  AlertCircle, BarChart2, CalendarCheck, CheckCircle2, ChevronDown, Clock,
  Filter, FolderDot, ListTodo, Search, SlidersHorizontal, TrendingUp, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgendaTask, AgendaStats } from '@/lib/agenda/types';
import { isTaskOverdue } from '@/lib/agenda/types';
import { ReportingViewSkeleton } from './TaskCardSkeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { format, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Design tokens ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING:     '#9CA3AF',
  IN_PROGRESS: '#7C3AED',
  WAITING:     '#D97706',
  COMPLETED:   '#059669',
  CANCELLED:   '#ED8A94',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:     'Pendiente',
  IN_PROGRESS: 'En progreso',
  WAITING:     'Esperando',
  COMPLETED:   'Completada',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW:    '#9CA3AF',
  MEDIUM: '#7C3AED',
  HIGH:   '#D97706',
  URGENT: '#C05060',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW:    'Baja',
  MEDIUM: 'Media',
  HIGH:   'Alta',
  URGENT: 'Urgente',
};

type TimeRange = '7d' | '30d' | 'all';

// ── Fade-in animation ─────────────────────────────────────────────────────────

function fadeStyle(mounted: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(10px)',
    transition: `opacity 350ms ease ${delay}ms, transform 350ms ease ${delay}ms`,
  };
}

// ── KPI Card (dark mode compatible) ──────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent, animStyle,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  animStyle?: React.CSSProperties;
}) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 shadow-sm"
      style={animStyle}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div
          className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center"
          style={{ backgroundColor: `${accent}18` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
      </div>
      <div>
        <p className="text-[28px] font-extrabold text-foreground leading-none tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children, animStyle, className }: {
  title: string;
  children: React.ReactNode;
  animStyle?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-5 shadow-sm', className)} style={animStyle}>
      <h3 className="text-[13px] font-bold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-[12px] text-popover-foreground shadow-lg">
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAssigneeName(t: AgendaTask): string {
  return t.assignedToUser?.name || t.assignedToContact?.name || t.assignedToName || 'Sin asignar';
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function filterByRange(tasks: AgendaTask[], range: TimeRange): AgendaTask[] {
  if (range === 'all') return tasks;
  const days = range === '7d' ? 7 : 30;
  const cutoff = subDays(new Date(), days);
  return tasks.filter(t => new Date(t.createdAt) >= cutoff);
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ReportingViewProps {
  tasks: AgendaTask[];
  stats?: AgendaStats;
  isLoading?: boolean;
}

export function ReportingView({ tasks, stats, isLoading }: ReportingViewProps) {
  const [mounted, setMounted] = useState(false);
  const [filterUserId, setFilterUserId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // ── User options ──────────────────────────────────────────────────────────

  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      const id = String(t.assignedToUserId ?? t.assignedToContactId ?? '');
      const name = getAssigneeName(t);
      if (id && name !== 'Sin asignar') map.set(id, name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // ── Filtered tasks ────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => !t.isArchived);

    if (filterUserId !== 'all') {
      result = result.filter(t => {
        const id = String(t.assignedToUserId ?? t.assignedToContactId ?? '');
        return id === filterUserId;
      });
    }

    result = filterByRange(result, timeRange);
    return result;
  }, [tasks, filterUserId, timeRange]);

  // ── Computed metrics ──────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'COMPLETED').length;
    const overdue = filteredTasks.filter(t => isTaskOverdue(t)).length;
    const inProgress = filteredTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const pending = filteredTasks.filter(t => t.status === 'PENDING').length;
    const completedToday = filteredTasks.filter(t => t.completedAt && isToday(new Date(t.completedAt))).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Status distribution
    const byStatus = (['PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED'] as const).map(key => ({
      name: STATUS_LABELS[key],
      value: filteredTasks.filter(t => t.status === key).length,
      fill: STATUS_COLORS[key],
    }));

    // Priority distribution
    const byPriority = (['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map(key => ({
      name: PRIORITY_LABELS[key],
      value: filteredTasks.filter(t => t.priority === key).length,
      fill: PRIORITY_COLORS[key],
    })).filter(d => d.value > 0);

    // Activity trend
    const days = timeRange === '30d' ? 30 : timeRange === '7d' ? 7 : 14;
    const activity = Array.from({ length: days }).map((_, i) => {
      const d = subDays(new Date(), days - 1 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      return {
        day: days <= 14 ? format(d, 'EEE', { locale: es }) : format(d, 'd/M'),
        Creadas: filteredTasks.filter(t => t.createdAt.startsWith(dateStr)).length,
        Completadas: filteredTasks.filter(t => t.completedAt?.startsWith(dateStr)).length,
      };
    });

    // Per-assignee breakdown (stacked: completed vs pending)
    const assigneeMap = new Map<string, { total: number; done: number; name: string }>();
    for (const t of filteredTasks) {
      const name = getAssigneeName(t);
      const prev = assigneeMap.get(name) || { total: 0, done: 0, name };
      prev.total++;
      if (t.status === 'COMPLETED') prev.done++;
      assigneeMap.set(name, prev);
    }
    const byAssignee = Array.from(assigneeMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map(a => ({
        name: a.name,
        Completadas: a.done,
        Pendientes: a.total - a.done,
        total: a.total,
      }));

    // By group
    const groupMap = new Map<string, number>();
    for (const t of filteredTasks) {
      const name = t.group?.name ?? 'Sin grupo';
      groupMap.set(name, (groupMap.get(name) ?? 0) + 1);
    }
    const byGroup = Array.from(groupMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    return {
      total, completed, overdue, inProgress, pending, completedToday, completionRate,
      byStatus, byPriority, activity, byAssignee, byGroup,
    };
  }, [filteredTasks, timeRange]);

  if (isLoading) return <ReportingViewSkeleton />;

  const PERSON_COLORS = ['#7C3AED', '#059669', '#D97706', '#C05060', '#3B82F6', '#EC4899', '#06B6D4', '#7040A8'];

  return (
    <div className="flex flex-col gap-5">

      {/* ── Toolbar: Filters ─────────────────────────────────────────── */}
      <div
        className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center justify-between gap-4 shadow-sm"
        style={fadeStyle(mounted, 0)}
      >
        <div className="flex items-center gap-3">
          <Select value={filterUserId} onValueChange={setFilterUserId}>
            <SelectTrigger className="w-[180px] h-8 text-[12px] font-medium border-0 bg-muted/60 rounded-lg shadow-none focus:ring-1 focus:ring-border">
              <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Persona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {userOptions.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filterUserId !== 'all' && (
            <button
              onClick={() => setFilterUserId('all')}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
          {([
            { value: '7d' as const, label: '7 días' },
            { value: '30d' as const, label: '30 días' },
            { value: 'all' as const, label: 'Todo' },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={cn(
                'px-3.5 py-1.5 text-[12px] font-semibold rounded-md transition-all duration-150',
                timeRange === opt.value
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI row (6 cards, 3x2) ──────────────────────────────────── */}
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total"
          value={metrics.total}
          sub="tareas"
          icon={BarChart2}
          accent="#7C3AED"
          animStyle={fadeStyle(mounted, 40)}
        />
        <KpiCard
          label="Completadas"
          value={metrics.completed}
          sub={`${metrics.completionRate}% del total`}
          icon={CheckCircle2}
          accent="#059669"
          animStyle={fadeStyle(mounted, 80)}
        />
        <KpiCard
          label="En progreso"
          value={metrics.inProgress}
          sub="activas ahora"
          icon={TrendingUp}
          accent="#3B82F6"
          animStyle={fadeStyle(mounted, 120)}
        />
        <KpiCard
          label="Pendientes"
          value={metrics.pending}
          sub="sin empezar"
          icon={Clock}
          accent="#9CA3AF"
          animStyle={fadeStyle(mounted, 160)}
        />
        <KpiCard
          label="Vencidas"
          value={metrics.overdue}
          sub={metrics.overdue > 0 ? 'requieren atención' : 'todo al día'}
          icon={AlertCircle}
          accent={metrics.overdue > 0 ? '#C05060' : '#059669'}
          animStyle={fadeStyle(mounted, 200)}
        />
        <KpiCard
          label="Completadas hoy"
          value={metrics.completedToday}
          sub="en el día"
          icon={CalendarCheck}
          accent="#06B6D4"
          animStyle={fadeStyle(mounted, 240)}
        />
      </div>

      {/* ── Row 1: Activity + Status donut ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title={`Actividad — últimos ${timeRange === '30d' ? '30' : timeRange === '7d' ? '7' : '14'} días`}
          animStyle={fadeStyle(mounted, 280)}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.activity} barSize={timeRange === '30d' ? 6 : 10} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Creadas" fill="#E9D5FF" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Completadas" fill="#059669" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            {[{ color: '#E9D5FF', label: 'Creadas' }, { color: '#059669', label: 'Completadas' }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: l.color }} />
                <span className="text-[11px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Distribución por estado" animStyle={fadeStyle(mounted, 320)}>
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0" style={{ width: 160, height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.byStatus.filter(d => d.value > 0)}
                    cx="50%" cy="50%"
                    innerRadius={48} outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {metrics.byStatus.filter(d => d.value > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5">
              {metrics.byStatus.map(item => {
                const pct = metrics.total > 0 ? Math.round((item.value / metrics.total) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                    <span className="text-[12px] text-muted-foreground flex-1">{item.name}</span>
                    <span className="text-[13px] font-bold text-foreground tabular-nums">{item.value}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      </div>

      {/* ── Row 2: Per-user stacked + Priority donut ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Carga por persona" animStyle={fadeStyle(mounted, 360)}>
          {metrics.byAssignee.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Sin datos</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, metrics.byAssignee.length * 36)}>
              <BarChart data={metrics.byAssignee} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Completadas" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Pendientes" stackId="a" fill="#E9D5FF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {metrics.byAssignee.length > 0 && (
            <div className="flex gap-4 mt-2 justify-center">
              {[{ color: '#059669', label: 'Completadas' }, { color: '#E9D5FF', label: 'Pendientes' }].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: l.color }} />
                  <span className="text-[11px] text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Distribución por prioridad" animStyle={fadeStyle(mounted, 400)}>
          {metrics.byPriority.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Sin datos</p>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0" style={{ width: 160, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.byPriority}
                      cx="50%" cy="50%"
                      innerRadius={48} outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {metrics.byPriority.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2.5">
                {metrics.byPriority.map(item => {
                  const pct = metrics.total > 0 ? Math.round((item.value / metrics.total) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                      <span className="text-[12px] text-muted-foreground flex-1">{item.name}</span>
                      <span className="text-[13px] font-bold text-foreground tabular-nums">{item.value}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* ── Row 3: By group + Completion rate ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Tareas por grupo" animStyle={fadeStyle(mounted, 440)}>
          {metrics.byGroup.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Sin datos</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {metrics.byGroup.map((item, i) => {
                const maxCount = metrics.byGroup[0]?.count ?? 1;
                const pct = Math.round((item.count / maxCount) * 100);
                const color = PERSON_COLORS[i % PERSON_COLORS.length];
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <FolderDot className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium text-foreground truncate">{item.name}</span>
                        <span className="text-[11px] text-muted-foreground font-bold tabular-nums">{item.count}</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Completion rate */}
        <div
          className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between"
          style={fadeStyle(mounted, 480)}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-bold text-foreground">Tasa de completación</h3>
            <span
              className="text-[24px] font-extrabold tabular-nums"
              style={{
                color: metrics.completionRate >= 70 ? '#059669' : metrics.completionRate >= 40 ? '#D97706' : '#C05060',
              }}
            >
              {metrics.completionRate}%
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: metrics.completionRate >= 70 ? '#059669' : metrics.completionRate >= 40 ? '#D97706' : '#C05060',
                width: mounted ? `${metrics.completionRate}%` : '0%',
                transition: 'width 900ms cubic-bezier(0.22,1,0.36,1) 500ms',
              }}
            />
          </div>
          <div className="flex justify-between mt-3">
            <span className="text-[11px] text-muted-foreground">
              {metrics.completed} completadas de {metrics.total} totales
            </span>
            <span
              className="text-[11px] font-semibold"
              style={{
                color: metrics.completionRate >= 70 ? '#059669' : metrics.completionRate >= 40 ? '#D97706' : '#C05060',
              }}
            >
              {metrics.completionRate >= 70 ? '¡Excelente!' : metrics.completionRate >= 40 ? 'Buen progreso' : 'Por mejorar'}
            </span>
          </div>

          {/* Mini stats row */}
          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border">
            <div className="flex-1 text-center">
              <p className="text-[18px] font-bold text-foreground tabular-nums">{metrics.completedToday}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hoy</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex-1 text-center">
              <p className="text-[18px] font-bold text-foreground tabular-nums">{metrics.inProgress}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Activas</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex-1 text-center">
              <p className="text-[18px] font-bold tabular-nums" style={{ color: metrics.overdue > 0 ? '#C05060' : '#059669' }}>
                {metrics.overdue}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vencidas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
