'use client';

import { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  ListTodo,
  Send,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { isTaskOverdue } from '@/lib/agenda/types';
import type { AgendaTask, AgendaStats } from '@/lib/agenda/types';

interface DashboardMobileProps {
  tasks: AgendaTask[];
  stats?: AgendaStats | null;
  onTaskTap: (task: AgendaTask) => void;
}

/* ── Helpers ── */

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE'];

const STATUS_META = {
  PENDING:     { color: '#9CA3AF', label: 'Pendientes' },
  IN_PROGRESS: { color: '#3B82F6', label: 'En progreso' },
  WAITING:     { color: '#F59E0B', label: 'Esperando' },
  COMPLETED:   { color: '#10B981', label: 'Completadas' },
} as const;

type StatusKey = keyof typeof STATUS_META;
const STATUS_ORDER: StatusKey[] = ['PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED'];

function computeStats(taskList: AgendaTask[]) {
  const active = taskList.filter((t) => !t.isArchived);
  const total = active.length;

  const statusCounts: Record<StatusKey, number> = { PENDING: 0, IN_PROGRESS: 0, WAITING: 0, COMPLETED: 0 };
  let overdue = 0;
  let urgent = 0;
  const topActive: AgendaTask[] = [];
  const assigneeMap = new Map<string, { count: number; done: number; userId?: number }>();

  for (const t of active) {
    const s = t.status as StatusKey;
    if (s in statusCounts) statusCounts[s]++;

    if (isTaskOverdue(t)) overdue++;
    if (t.priority === 'URGENT' && t.status !== 'COMPLETED') urgent++;

    if (
      topActive.length < 5 &&
      (t.status === 'IN_PROGRESS' ||
        (t.status === 'PENDING' && (t.priority === 'URGENT' || t.priority === 'HIGH')))
    ) {
      topActive.push(t);
    }

    const name = t.assignedToName || t.assignedToUser?.name;
    if (name) {
      const prev = assigneeMap.get(name) || { count: 0, done: 0, userId: t.assignedToUserId ?? undefined };
      prev.count++;
      if (t.status === 'COMPLETED') prev.done++;
      assigneeMap.set(name, prev);
    }
  }

  const completed = statusCounts.COMPLETED;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const inProgress = statusCounts.IN_PROGRESS;

  const topAssignees = Array.from(assigneeMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  return { total, completed, inProgress, overdue, urgent, completionRate, statusCounts, topActive, topAssignees };
}

/* ── Mini KPI pill ── */
function KpiPill({ icon: Icon, value, label, color }: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-border/50 bg-card p-2.5 flex flex-col items-center gap-1">
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <span className="text-lg font-bold tabular-nums leading-none" style={{ color }}>{value}</span>
      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ── Stacked status bar (compact) ── */
function StatusBar({ statusCounts, total }: { statusCounts: Record<StatusKey, number>; total: number }) {
  if (total === 0) return null;
  const segments = STATUS_ORDER.map((key) => ({
    key,
    count: statusCounts[key] ?? 0,
    pct: total > 0 ? ((statusCounts[key] ?? 0) / total) * 100 : 0,
    color: STATUS_META[key].color,
    label: STATUS_META[key].label,
  }));

  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {segments.map((s) =>
          s.count > 0 ? (
            <div key={s.key} className="rounded-full" style={{ width: `${s.pct}%`, minWidth: '4px', backgroundColor: s.color }} />
          ) : null
        )}
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        {segments.map((s) =>
          s.count > 0 ? (
            <div key={s.key} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: s.color }}>{s.count}</span>
              <span className="text-[10px] text-muted-foreground/60">{s.label}</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

/* ── Donut Chart (CSS conic-gradient) ── */
function DonutChart({ statusCounts, total, completionRate }: {
  statusCounts: Record<StatusKey, number>;
  total: number;
  completionRate: number;
}) {
  const gradient = useMemo(() => {
    if (total === 0) return 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)';
    let cumDeg = 0;
    const stops: string[] = [];
    for (const key of STATUS_ORDER) {
      const count = statusCounts[key] ?? 0;
      if (count === 0) continue;
      const deg = (count / total) * 360;
      stops.push(`${STATUS_META[key].color} ${cumDeg}deg ${cumDeg + deg}deg`);
      cumDeg += deg;
    }
    return `conic-gradient(${stops.join(', ')})`;
  }, [statusCounts, total]);

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
        <div className="absolute inset-0 rounded-full" style={{ background: gradient }} />
        <div className="absolute inset-[15px] rounded-full bg-card flex items-center justify-center">
          <span className="text-xl font-bold text-foreground tabular-nums">{completionRate}%</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {STATUS_ORDER.map((key) => {
          const count = statusCounts[key] ?? 0;
          if (count === 0) return null;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={key} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_META[key].color }} />
              <span className="text-[11px] text-foreground flex-1">{STATUS_META[key].label}</span>
              <span className="text-[11px] font-semibold tabular-nums text-foreground">{count}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Section header ── */
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
    </div>
  );
}

/* ── Delegated person row ── */
function DelegatedPersonRow({ name, count, done }: { name: string; count: number; done: number }) {
  const pct = count > 0 ? Math.round((done / count) * 100) : 0;
  const pending = count - done;
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
        <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium text-foreground truncate">{name}</span>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {pending > 0 && (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">{pending} pend.</span>
            )}
            <span className="text-[10px] text-muted-foreground tabular-nums">{done}/{count}</span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: pct === 100 ? '#10B981' : pct >= 50 ? '#3B82F6' : '#F59E0B',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════ MAIN ══════════════════════════════════════════════ */

export function DashboardMobile({ tasks, onTaskTap }: DashboardMobileProps) {
  const { user } = useAuth();

  const isAdmin = user && (ADMIN_ROLES.includes(user.systemRole ?? '') || ADMIN_ROLES.includes(user.role));

  // Split tasks
  const { myTasks, delegatedTasks, allTasks } = useMemo(() => {
    const nonArchived = tasks.filter((t) => !t.isArchived);
    if (!user) return { myTasks: nonArchived, delegatedTasks: [], allTasks: nonArchived };

    const mine = nonArchived.filter(
      (t) => t.assignedToUserId === user.id || (!t.assignedToUserId && t.createdById === user.id)
    );
    const delegated = nonArchived.filter(
      (t) => t.createdById === user.id && t.assignedToUserId && t.assignedToUserId !== user.id
    );

    return { myTasks: mine, delegatedTasks: delegated, allTasks: nonArchived };
  }, [tasks, user]);

  const myStats = useMemo(() => computeStats(myTasks), [myTasks]);
  const delegatedStats = useMemo(() => computeStats(delegatedTasks), [delegatedTasks]);
  const allStats = useMemo(() => computeStats(allTasks), [allTasks]);

  return (
    <div className="px-4 pt-4 pb-6 space-y-6">

      {/* ═══════════════════ 1. MIS TAREAS ═══════════════════ */}
      <div>
        <SectionHeader icon={Inbox} title="Mis tareas" />

        {/* KPI pills row */}
        <div className="flex gap-2 mb-3">
          <KpiPill icon={ListTodo} value={myStats.total} label="Total" color="#6366F1" />
          <KpiPill icon={CheckCircle2} value={`${myStats.completionRate}%`} label="Listas" color="#10B981" />
          <KpiPill icon={TrendingUp} value={myStats.inProgress} label="En curso" color="#3B82F6" />
        </div>

        {/* Alerts row */}
        {(myStats.overdue > 0 || myStats.urgent > 0) && (
          <div className="flex items-center gap-3 mb-3">
            {myStats.overdue > 0 && (
              <div className="flex-1 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="text-[12px] font-semibold text-red-600 dark:text-red-400">{myStats.overdue} vencida{myStats.overdue !== 1 ? 's' : ''}</span>
              </div>
            )}
            {myStats.urgent > 0 && (
              <div className="flex-1 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 px-3 py-2">
                <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">{myStats.urgent} urgente{myStats.urgent !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Status bar */}
        <StatusBar statusCounts={myStats.statusCounts} total={myStats.total} />
      </div>

      {/* ═══════════════════ 2. TAREAS ENVIADAS ═══════════════════ */}
      {delegatedTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Send className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tareas enviadas
            </h3>
            <span className="text-[10px] bg-violet-100 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full font-semibold tabular-nums">
              {delegatedStats.completed}/{delegatedStats.total}
            </span>
          </div>

          {/* Per-person breakdown */}
          <div className="rounded-xl border border-border/50 bg-card p-3 space-y-3">
            {delegatedStats.topAssignees.map(([name, { count, done }]) => (
              <DelegatedPersonRow key={name} name={name} count={count} done={done} />
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════ 3. ADMIN: GENERAL ═══════════════════ */}
      {isAdmin && (
        <>
          {/* Donut */}
          {allStats.total > 0 && (
            <div>
              <SectionHeader icon={Clock} title="Estado general" />
              <div className="rounded-xl border border-border/50 bg-card p-4">
                <DonutChart
                  statusCounts={allStats.statusCounts}
                  total={allStats.total}
                  completionRate={allStats.completionRate}
                />
              </div>
            </div>
          )}

          {/* Team */}
          {allStats.topAssignees.length > 0 && (
            <div>
              <SectionHeader icon={Users} title="Carga del equipo" />
              <div className="rounded-xl border border-border/50 bg-card p-3 space-y-3">
                {allStats.topAssignees.map(([name, { count, done }]) => {
                  const pct = count > 0 ? Math.round((done / count) * 100) : 0;
                  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-primary">{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-medium text-foreground truncate">{name}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 ml-2">
                            {done}/{count}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 75 ? '#10B981' : pct >= 40 ? '#3B82F6' : '#9CA3AF',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Requieren atención (siempre visible) ── */}
      {allStats.topActive.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            Requieren atención
          </h3>
          <div className="space-y-1.5">
            {allStats.topActive.map((task) => {
              const borderColor: Record<string, string> = {
                URGENT: 'border-l-red-500',
                HIGH: 'border-l-amber-500',
                MEDIUM: 'border-l-blue-500',
                LOW: 'border-l-muted-foreground/30',
              };
              return (
                <button
                  key={task.id}
                  onClick={() => onTaskTap(task)}
                  className={cn(
                    'w-full bg-card rounded-lg p-3 border border-border/40 text-left',
                    'active:scale-[0.98] transition-transform border-l-[3px]',
                    borderColor[task.priority] ?? 'border-l-muted-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-foreground line-clamp-1 flex-1 min-w-0">
                      {task.title}
                    </p>
                    {task.priority === 'URGENT' && (
                      <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded shrink-0">
                        Urgente
                      </span>
                    )}
                    {task.priority === 'HIGH' && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                        Alta
                      </span>
                    )}
                  </div>
                  {task.assignedToName && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      → {task.assignedToName}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
