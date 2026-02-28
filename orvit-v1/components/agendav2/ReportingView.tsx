'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, CheckCircle2, Clock, AlertCircle, Users, BarChart2 } from 'lucide-react';
import type { AgendaTask, AgendaStats } from '@/lib/agenda/types';
import { isTaskOverdue } from '@/lib/agenda/types';
import { format, subDays, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Design tokens ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  PENDING:     '#9C9CAA',
  IN_PROGRESS: '#3070A8',
  WAITING:     '#907840',
  COMPLETED:   '#568177',
  CANCELLED:   '#ED8A94',
};

const PRIORITY_COLORS = {
  LOW:    '#C4C4C4',
  MEDIUM: '#3070A8',
  HIGH:   '#907840',
  URGENT: '#C05060',
};

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: typeof CheckCircle2;
  accent: string;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #EEEEEE',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#9C9CAA' }}>{label}</span>
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
        <p style={{ fontSize: '28px', fontWeight: 800, color: '#050505', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: '11px', color: '#9C9CAA', marginTop: '4px' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #EEEEEE',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      }}
    >
      <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#050505', marginBottom: '16px' }}>
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
        background: '#050505', borderRadius: '8px', padding: '8px 12px',
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

  // ── Computed metrics ───────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const total     = tasks.length;
    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const overdue   = tasks.filter(t => isTaskOverdue(t)).length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Tasks per status for bar chart
    const byStatus = [
      { name: 'Pendiente',   value: tasks.filter(t => t.status === 'PENDING').length,     fill: STATUS_COLORS.PENDING },
      { name: 'En Progreso', value: tasks.filter(t => t.status === 'IN_PROGRESS').length, fill: STATUS_COLORS.IN_PROGRESS },
      { name: 'Esperando',   value: tasks.filter(t => t.status === 'WAITING').length,     fill: STATUS_COLORS.WAITING },
      { name: 'Completada',  value: tasks.filter(t => t.status === 'COMPLETED').length,   fill: STATUS_COLORS.COMPLETED },
    ];

    // Tasks per priority for pie chart
    const byPriority = [
      { name: 'Baja',    value: tasks.filter(t => t.priority === 'LOW').length,    fill: PRIORITY_COLORS.LOW },
      { name: 'Media',   value: tasks.filter(t => t.priority === 'MEDIUM').length, fill: PRIORITY_COLORS.MEDIUM },
      { name: 'Alta',    value: tasks.filter(t => t.priority === 'HIGH').length,   fill: PRIORITY_COLORS.HIGH },
      { name: 'Urgente', value: tasks.filter(t => t.priority === 'URGENT').length, fill: PRIORITY_COLORS.URGENT },
    ].filter(d => d.value > 0);

    // Last 7 days activity
    const last7 = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const created   = tasks.filter(t => t.createdAt.startsWith(dateStr)).length;
      const completed2 = tasks.filter(t => t.completedAt?.startsWith(dateStr)).length;
      return {
        day: format(d, 'EEE', { locale: es }),
        Creadas: created,
        Completadas: completed2,
      };
    });

    // Top assignees
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
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '100px', borderRadius: '16px', background: '#F0F0F0', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
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
          accent="#3070A8"
        />
        <KpiCard
          label="Completadas"
          value={metrics.completed}
          sub={`${metrics.completionRate}% del total`}
          icon={CheckCircle2}
          accent="#568177"
        />
        <KpiCard
          label="En progreso"
          value={metrics.inProgress}
          sub="activas ahora"
          icon={TrendingUp}
          accent="#907840"
        />
        <KpiCard
          label="Vencidas"
          value={metrics.overdue}
          sub={metrics.overdue > 0 ? 'requieren atención' : 'todo al día'}
          icon={AlertCircle}
          accent={metrics.overdue > 0 ? '#C05060' : '#568177'}
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Activity last 7 days */}
        <Section title="Actividad — últimos 7 días">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.last7} barSize={10} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9C9CAA' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9C9CAA' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Creadas"    fill="#D0E0F0" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Completadas" fill="#568177" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', justifyContent: 'center' }}>
            {[{ color: '#D0E0F0', label: 'Creadas' }, { color: '#568177', label: 'Completadas' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.color, display: 'inline-block' }} />
                <span style={{ fontSize: '11px', color: '#9C9CAA' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* By status */}
        <Section title="Distribución por estado">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.byStatus} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9C9CAA' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9C9CAA' }} axisLine={false} tickLine={false} width={75} />
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

        {/* By priority (pie) */}
        <Section title="Distribución por prioridad">
          {metrics.byPriority.length === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9C9CAA', fontSize: '12px' }}>Sin datos</p>
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
                    <span style={{ fontSize: '12px', color: '#575456', flex: 1 }}>{item.name}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#050505' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Top assignees */}
        <Section title="Más tareas por persona">
          {metrics.topAssignees.length === 0 ? (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9C9CAA', fontSize: '12px' }}>Sin datos</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {metrics.topAssignees.map((item, i) => {
                const maxCount = metrics.topAssignees[0]?.count ?? 1;
                const pct = Math.round((item.count / maxCount) * 100);
                const colors = ['#3070A8', '#568177', '#907840', '#C05060', '#7040A8'];
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
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#050505', truncate: true }}>{item.name}</span>
                        <span style={{ fontSize: '11px', color: '#9C9CAA', fontWeight: 700 }}>{item.count}</span>
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
          background: '#FFFFFF', border: '1px solid #EEEEEE',
          borderRadius: '16px', padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#050505' }}>Tasa de completación</h3>
          <span
            style={{
              fontSize: '20px', fontWeight: 800, color: metrics.completionRate >= 70 ? '#568177' : '#907840',
            }}
          >
            {metrics.completionRate}%
          </span>
        </div>
        <div style={{ height: '8px', background: '#F0F0F0', borderRadius: '999px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', borderRadius: '999px',
              background: metrics.completionRate >= 70 ? '#568177' : metrics.completionRate >= 40 ? '#907840' : '#C05060',
              width: `${metrics.completionRate}%`,
              transition: 'width 800ms cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{ fontSize: '11px', color: '#9C9CAA' }}>
            {metrics.completed} completadas de {metrics.total} totales
          </span>
          <span
            style={{
              fontSize: '11px', color: metrics.completionRate >= 70 ? '#568177' : '#9C9CAA', fontWeight: 600,
            }}
          >
            {metrics.completionRate >= 70 ? '¡Excelente ritmo!' : metrics.completionRate >= 40 ? 'Buen progreso' : 'Por mejorar'}
          </span>
        </div>
      </div>
    </div>
  );
}
