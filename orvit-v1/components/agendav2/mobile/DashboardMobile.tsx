'use client';

import { useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressRing } from './ProgressRing';
import { isTaskOverdue } from '@/lib/agenda/types';
import type { AgendaTask, AgendaStats } from '@/lib/agenda/types';

interface DashboardMobileProps {
  tasks: AgendaTask[];
  stats?: AgendaStats | null;
  onTaskTap: (task: AgendaTask) => void;
}

const STATUS_SEGMENTS = [
  { key: 'COMPLETED', label: 'Completadas', barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  { key: 'IN_PROGRESS', label: 'En progreso', barClass: 'bg-primary', dotClass: 'bg-primary' },
  { key: 'PENDING', label: 'Pendientes', barClass: 'bg-muted-foreground/30', dotClass: 'bg-muted-foreground/30' },
  { key: 'WAITING', label: 'En espera', barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
] as const;

export function DashboardMobile({ tasks, stats, onTaskTap }: DashboardMobileProps) {
  const computed = useMemo(() => {
    const activeTasks = tasks.filter((t) => !t.isArchived);
    const total = activeTasks.length;

    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let waiting = 0;
    let overdue = 0;
    let urgent = 0;
    let createdToday = 0;
    let completedToday = 0;
    const assigneeMap = new Map<string, number>();
    const topActive: AgendaTask[] = [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    for (const t of activeTasks) {
      if (t.status === 'COMPLETED') completed++;
      else if (t.status === 'IN_PROGRESS') inProgress++;
      else if (t.status === 'WAITING') waiting++;
      else pending++;

      if (isTaskOverdue(t)) overdue++;
      if (t.priority === 'URGENT' && t.status !== 'COMPLETED') urgent++;

      if (new Date(t.createdAt).getTime() >= todayMs) createdToday++;
      if (t.status === 'COMPLETED' && t.completedAt && new Date(t.completedAt).getTime() >= todayMs) completedToday++;

      if (
        topActive.length < 5 &&
        (t.status === 'IN_PROGRESS' ||
          (t.status === 'PENDING' && (t.priority === 'URGENT' || t.priority === 'HIGH')))
      ) {
        topActive.push(t);
      }

      const name = t.assignedToName || t.assignedToUser?.name;
      if (name) assigneeMap.set(name, (assigneeMap.get(name) || 0) + 1);
    }

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const topAssignees = Array.from(assigneeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const maxAssigneeCount = topAssignees.length > 0 ? topAssignees[0][1] : 1;

    const statusCounts: Record<string, number> = {
      COMPLETED: completed,
      IN_PROGRESS: inProgress,
      PENDING: pending,
      WAITING: waiting,
    };

    return {
      total,
      pending,
      inProgress,
      completed,
      waiting,
      overdue,
      urgent,
      completionRate,
      topActive,
      topAssignees,
      maxAssigneeCount,
      statusCounts,
      createdToday,
      completedToday,
    };
  }, [tasks]);

  return (
    <div className="px-4 pt-4 pb-6 space-y-3">
      {/* ── Hero card ── */}
      <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
        <div className="flex flex-col items-center text-center">
          <ProgressRing percent={computed.completionRate} size={64} strokeWidth={5} />
          <p className="text-sm font-semibold text-foreground mt-3">
            {computed.completionRate}% completado
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {computed.completed} de {computed.total} tareas
          </p>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Pendientes */}
        <div className="bg-card rounded-xl p-3 border border-border flex flex-col items-center gap-1.5">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-foreground leading-none">{computed.pending}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendientes</p>
        </div>
        {/* En progreso */}
        <div className="bg-card rounded-xl p-3 border border-border flex flex-col items-center gap-1.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground leading-none">{computed.inProgress}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">En progreso</p>
        </div>
        {/* Vencidas */}
        <div
          className={cn(
            'rounded-xl p-3 border flex flex-col items-center gap-1.5',
            computed.overdue > 0
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
              : 'bg-card border-border'
          )}
        >
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              computed.overdue > 0 ? 'bg-red-500/10' : 'bg-muted'
            )}
          >
            <AlertTriangle
              className={cn('h-4 w-4', computed.overdue > 0 ? 'text-red-500' : 'text-muted-foreground')}
            />
          </div>
          <p
            className={cn(
              'text-lg font-bold leading-none',
              computed.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
            )}
          >
            {computed.overdue}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vencidas</p>
        </div>
      </div>

      {/* ── Status breakdown ── */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
          Estado de tareas
        </h3>
        {/* Segmented bar */}
        <div className="h-2 rounded-full overflow-hidden flex bg-muted">
          {STATUS_SEGMENTS.map((s) => {
            const count = computed.statusCounts[s.key] ?? 0;
            const pct = computed.total > 0 ? (count / computed.total) * 100 : 0;
            return pct > 0 ? (
              <div key={s.key} className={cn('h-full', s.barClass)} style={{ width: `${pct}%` }} />
            ) : null;
          })}
        </div>
        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
          {STATUS_SEGMENTS.map((s) => {
            const count = computed.statusCounts[s.key] ?? 0;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full shrink-0', s.dotClass)} />
                <span className="text-xs text-muted-foreground flex-1">{s.label}</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Team section ── */}
      {computed.topAssignees.length > 0 && (
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Equipo
            </h3>
          </div>
          <div className="space-y-3">
            {computed.topAssignees.map(([name, count]) => {
              const pct = (count / computed.maxAssigneeCount) * 100;
              const initials = name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <div key={name} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground truncate">{name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-primary/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Urgent alert ── */}
      {computed.overdue > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              {computed.overdue} tarea{computed.overdue !== 1 ? 's' : ''} vencida{computed.overdue !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-500/70 dark:text-red-400/60">
              Requieren atención inmediata
            </p>
          </div>
        </div>
      )}

      {/* ── Priority tasks carousel ── */}
      {computed.topActive.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2.5 px-0.5">
            Tareas prioritarias
          </h3>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
            {computed.topActive.map((task) => {
              const borderColor: Record<string, string> = {
                URGENT: 'border-l-red-500',
                HIGH: 'border-l-amber-500',
                MEDIUM: 'border-l-primary',
                LOW: 'border-l-muted-foreground/30',
              };
              return (
                <button
                  key={task.id}
                  onClick={() => onTaskTap(task)}
                  className={cn(
                    'bg-card rounded-xl p-3.5 border border-border min-w-[170px] max-w-[190px] shrink-0 text-left',
                    'active:scale-[0.97] transition-transform border-l-[3px]',
                    borderColor[task.priority] ?? 'border-l-muted-foreground/30'
                  )}
                >
                  {task.group?.name && (
                    <span className="text-[10px] font-medium text-primary/70 mb-0.5 block truncate">
                      {task.group.name}
                    </span>
                  )}
                  <p className="text-[13px] font-semibold text-foreground line-clamp-2 leading-snug">
                    {task.title}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    {task.assignedToName && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {task.assignedToName}
                      </span>
                    )}
                    {task.priority === 'URGENT' && (
                      <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded shrink-0 uppercase">
                        Urgente
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Today stats ── */}
      <div className="bg-card rounded-xl px-4 py-3 border border-border">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span>Creadas hoy:</span>
          <span className="font-semibold text-foreground tabular-nums">{computed.createdToday}</span>
          <span className="mx-1.5 text-border">|</span>
          <span>Completadas hoy:</span>
          <span className="font-semibold text-foreground tabular-nums">
            {stats?.completedToday ?? computed.completedToday}
          </span>
        </div>
      </div>
    </div>
  );
}
