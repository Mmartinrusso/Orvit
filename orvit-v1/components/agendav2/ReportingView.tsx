'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, CheckCircle2, Clock, AlertCircle, Users, BarChart2 } from 'lucide-react';
import type { AgendaTask, AgendaStats } from '@/lib/agenda/types';
import { isTaskOverdue } from '@/lib/agenda/types';
import { ReportingViewSkeleton } from './TaskCardSkeleton';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Design tokens ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  PENDING:     '#9CA3AF',
  IN_PROGRESS: '#7C3AED',
  WAITING:     '#D97706',
  COMPLETED:   '#059669',
  CANCELLED:   '#ED8A94',
};

const PRIORITY_COLORS = {
  LOW:    '#C4C4C4',
  MEDIUM: '#7C3AED',
  HIGH:   '#D97706',
  URGENT: '#C05060',
};

// ── Fade-in animation util ────────────────────────────────────────────────────

function fadeStyle(mounted: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(10px)',
    transition: `opacity 350ms ease ${delay}ms, transform 350ms ease ${delay}ms`,
  };
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  animStyle,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: typeof CheckCircle2;
  accent: string;
  animStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #EBEBEB',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        ...animStyle,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <div
          style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
      </div>
      <div>
        <p style={{ fontSize: '28px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children, animStyle }: { title: string; children: React.ReactNode; animStyle?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #EBEBEB',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        ...animStyle,
      }}
    >
      <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#111827', borderRadius: '8px', padding: '8px 12px',
        fontSize: '12px', color: '#FFFFFF',
        boxShadow: '0 4px 12px rgba(0,0,0,.2)',
      }}
    >
      {label && <p style={{ fontWeight: 600, marginBottom: '4px' }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || '#FFFFFF' }}>
          {p.name}: <span style={{ fontWeight: 700 }}>{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ReportingViewProps {
  tasks: AgendaTask[];
  stats?: AgendaStats;
  isLoading?: boolean;
}

export function ReportingView({ tasks, stats, isLoading }: ReportingViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // ── Computed metrics ───────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const total      = tasks.length;
    const completed  = tasks.filter(t => t.status === 'COMPLETED').length;
    const overdue    = tasks.filter(t => isTaskOverdue(t)).length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byStatus = [
      { name: 'Pendiente',   value: tasks.filter(t => t.status === 'PENDING').length,     fill: STATUS_COLORS.PENDING },
      { name: 'En Progreso', value: tasks.filter(t => t.status === 'IN_PROGRESS').length, fill: STATUS_COLORS.IN_PROGRESS },
      { name: 'En revisión', value: tasks.filter(t => t.status === 'WAITING').length,     fill: STATUS_COLORS.WAITING },
      { name: 'Completada',  value: tasks.filter(t => t.status === 'COMPLETED').length,   fill: STATUS_COLORS.COMPLETED },
    ];

    const byPriority = [
      { name: 'Baja',    value: tasks.filter(t => t.priority === 'LOW').length,    fill: PRIORITY_COLORS.LOW },
      { name: 'Media',   value: tasks.filter(t => t.priority === 'MEDIUM').length, fill: PRIORITY_COLORS.MEDIUM },
      { name: 'Alta',    value: tasks.filter(t => t.priority === 'HIGH').length,   fill: PRIORITY_COLORS.HIGH },
      { name: 'Urgente', value: tasks.filter(t => t.priority === 'URGENT').length, fill: PRIORITY_COLORS.URGENT },
    ].filter(d => d.value > 0);

    const last7 = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const created    = tasks.filter(t => t.createdAt.startsWith(dateStr)).length;
      const completed2 = tasks.filter(t => t.completedAt?.startsWith(dateStr)).length;
      return {
        day: format(d, 'EEE', { locale: es }),
        Creadas: created,
        Completadas: completed2,
      };
    });

    const assigneeMap = new Map<string, number>();
    tasks.forEach(t => {
      const name = t.assignedToUser?.name || t.assignedToContact?.name || t.assignedToName || 'Sin asignar';
      assigneeMap.set(name, (assigneeMap.get(name) ?? 0) + 1);
    });
    const topAssignees = Array.from(assigneeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return { total, completed, overdue, inProgress, completionRate, byStatus, byPriority, last7, topAssignees };
  }, [tasks]);

  if (isLoading) {
    return <ReportingViewSkeleton />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <KpiCard
          label="Total tareas"
          value={metrics.total}
          sub="en tu agenda"
          icon={BarChart2}
          accent="#7C3AED"
          animStyle={fadeStyle(mounted, 0)}
        />
        <KpiCard
          label="Completadas"
          value={metrics.completed}
          sub={`${metrics.completionRate}% del total`}
          icon={CheckCircle2}
          accent="#059669"
          animStyle={fadeStyle(mounted, 60)}
        />
        <KpiCard
          label="En progreso"
          value={metrics.inProgress}
          sub="activas ahora"
          icon={TrendingUp}
          accent="#D97706"
          animStyle={fadeStyle(mounted, 120)}
        />
        <KpiCard
          label="Vencidas"
          value={metrics.overdue}
          sub={metrics.overdue > 0 ? 'requieren atención' : 'todo al día'}
          icon={AlertCircle}
          accent={metrics.overdue > 0 ? '#C05060' : '#059669'}
          animStyle={fadeStyle(mounted, 180)}
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        <Section title="Actividad — últimos 7 días" animStyle={fadeStyle(mounted, 240)}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.last7} barSize={10} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Creadas"    fill="#EDE9FE" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Completadas" fill="#059669" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', justifyContent: 'center' }}>
            {[{ color: '#EDE9FE', label: 'Creadas' }, { color: '#059669', label: 'Completadas' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.color, display: 'inline-block' }} />
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Distribución por estado" animStyle={fadeStyle(mounted, 300)}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.byStatus} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={75} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {metrics.byStatus.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* ── Bottom row ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        <Section title="Distribución por prioridad" animStyle={fadeStyle(mounted, 360)}>
          {metrics.byPriority.length === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9CA3AF', fontSize: '12px' }}>Sin datos</p>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: '0 0 160px' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={metrics.byPriority}
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {metrics.byPriority.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {metrics.byPriority.map(item => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.fill, flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: '#6B7280', flex: 1 }}>{item.name}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Más tareas por persona" animStyle={fadeStyle(mounted, 420)}>
          {metrics.topAssignees.length === 0 ? (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9CA3AF', fontSize: '12px' }}>Sin datos</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {metrics.topAssignees.map((item, i) => {
                const maxCount = metrics.topAssignees[0]?.count ?? 1;
                const pct = Math.round((item.count / maxCount) * 100);
                const colors = ['#7C3AED', '#059669', '#D97706', '#C05060', '#7040A8'];
                const color = colors[i % colors.length];
                return (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: `${color}20`, color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700,
                      }}
                    >
                      {item.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{item.name}</span>
                        <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 700 }}>{item.count}</span>
                      </div>
                      <div style={{ height: '4px', background: '#F0F0F0', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%', width: `${pct}%`, background: color,
                            borderRadius: '999px', transition: 'width 600ms ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {/* ── Completion rate bar ──────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF', border: '1px solid #EBEBEB',
          borderRadius: '12px', padding: '20px',
          boxShadow: '0 1px 4px rgba(0,0,0,.04)',
          ...fadeStyle(mounted, 480),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>Tasa de completación</h3>
          <span
            style={{
              fontSize: '20px', fontWeight: 800,
              color: metrics.completionRate >= 70 ? '#059669' : metrics.completionRate >= 40 ? '#D97706' : '#C05060',
            }}
          >
            {metrics.completionRate}%
          </span>
        </div>
        <div style={{ height: '8px', background: '#F0F0F0', borderRadius: '999px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', borderRadius: '999px',
              background: metrics.completionRate >= 70 ? '#059669' : metrics.completionRate >= 40 ? '#D97706' : '#C05060',
              width: mounted ? `${metrics.completionRate}%` : '0%',
              transition: 'width 900ms cubic-bezier(0.22,1,0.36,1) 500ms',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
            {metrics.completed} completadas de {metrics.total} totales
          </span>
          <span
            style={{
              fontSize: '11px',
              color: metrics.completionRate >= 70 ? '#059669' : '#9CA3AF',
              fontWeight: 600,
            }}
          >
            {metrics.completionRate >= 70 ? '¡Excelente ritmo!' : metrics.completionRate >= 40 ? 'Buen progreso' : 'Por mejorar'}
          </span>
        </div>
      </div>
    </div>
  );
}
