'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ListTodo, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isTaskOverdue } from '@/lib/agenda/types';
import type { AgendaTask, AgendaStats } from '@/lib/agenda/types';

interface ReportingMobileProps {
  tasks: AgendaTask[];
  stats?: AgendaStats | null;
}

const STATUS_CONFIG = [
  { status: 'COMPLETED', label: 'Completadas', barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  { status: 'IN_PROGRESS', label: 'En progreso', barClass: 'bg-primary', dotClass: 'bg-primary' },
  { status: 'PENDING', label: 'Pendientes', barClass: 'bg-muted-foreground/30', dotClass: 'bg-muted-foreground/30' },
  { status: 'WAITING', label: 'En espera', barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
] as const;

const PRIORITY_CONFIG = [
  { priority: 'URGENT', label: 'Urgente', barClass: 'bg-red-500', dotClass: 'bg-red-500' },
  { priority: 'HIGH', label: 'Alta', barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
  { priority: 'MEDIUM', label: 'Media', barClass: 'bg-primary', dotClass: 'bg-primary' },
  { priority: 'LOW', label: 'Baja', barClass: 'bg-muted-foreground/30', dotClass: 'bg-muted-foreground/30' },
] as const;

export function ReportingMobile({ tasks, stats }: ReportingMobileProps) {
  const computed = useMemo(() => {
    const activeTasks = tasks.filter((t) => !t.isArchived);
    const total = activeTasks.length;

    const statusCounts: Record<string, number> = { COMPLETED: 0, IN_PROGRESS: 0, PENDING: 0, WAITING: 0 };
    const priorityCounts: Record<string, number> = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    let overdue = 0;

    for (const t of activeTasks) {
      if (t.status in statusCounts) statusCounts[t.status]++;
      if (t.priority in priorityCounts) priorityCounts[t.priority]++;
      if (isTaskOverdue(t)) overdue++;
    }

    const completed = statusCounts.COMPLETED;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const maxStatusCount = Math.max(...Object.values(statusCounts), 1);
    const maxPriorityCount = Math.max(...Object.values(priorityCounts), 1);

    const statusDist = STATUS_CONFIG.map((s) => {
      const count = statusCounts[s.status] ?? 0;
      return { ...s, count, pct: maxStatusCount > 0 ? (count / maxStatusCount) * 100 : 0 };
    });

    const priorityDist = PRIORITY_CONFIG.map((p) => {
      const count = priorityCounts[p.priority] ?? 0;
      return { ...p, count, pct: maxPriorityCount > 0 ? (count / maxPriorityCount) * 100 : 0 };
    });

    return { total, completed, overdue, completionRate, statusDist, priorityDist };
  }, [tasks]);

  return (
    <div className="px-4 pt-4 pb-6 space-y-3">
      {/* ── Header ── */}
      <div>
        <h2 className="text-lg font-bold text-foreground">Reportes</h2>
        <p className="text-xs text-muted-foreground">Resumen general de tareas</p>
      </div>

      {/* ── KPI grid 2x2 ── */}
      <div className="grid grid-cols-2 gap-2">
        {/* Total */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <ListTodo className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground leading-none">{computed.total}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
            Total tareas
          </p>
        </div>

        {/* Completadas */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground leading-none">{computed.completed}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
            Completadas
          </p>
        </div>

        {/* Vencidas */}
        <div
          className={cn(
            'rounded-xl p-4 border',
            computed.overdue > 0
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
              : 'bg-card border-border'
          )}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center',
                computed.overdue > 0 ? 'bg-red-500/10' : 'bg-muted'
              )}
            >
              <AlertTriangle
                className={cn('h-4 w-4', computed.overdue > 0 ? 'text-red-500' : 'text-muted-foreground')}
              />
            </div>
          </div>
          <p
            className={cn(
              'text-2xl font-bold leading-none',
              computed.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
            )}
          >
            {computed.overdue}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Vencidas</p>
        </div>

        {/* Tasa completitud */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-full bg-violet-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-violet-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground leading-none">{computed.completionRate}%</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
            Completitud
          </p>
        </div>
      </div>

      {/* ── Status distribution ── */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">
          Distribución por estado
        </h3>
        <div className="space-y-3">
          {computed.statusDist.map((s) => (
            <div key={s.status} className="flex items-center gap-3">
              <span className={cn('w-2 h-2 rounded-full shrink-0', s.dotClass)} />
              <span className="text-xs text-muted-foreground w-24 shrink-0">{s.label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', s.barClass)}
                  style={{ width: `${s.pct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-foreground tabular-nums w-6 text-right shrink-0">
                {s.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Priority distribution ── */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">
          Distribución por prioridad
        </h3>
        <div className="space-y-3">
          {computed.priorityDist.map((p) => (
            <div key={p.priority} className="flex items-center gap-3">
              <span className={cn('w-2 h-2 rounded-full shrink-0', p.dotClass)} />
              <span className="text-xs text-muted-foreground w-24 shrink-0">{p.label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', p.barClass)}
                  style={{ width: `${p.pct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-foreground tabular-nums w-6 text-right shrink-0">
                {p.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
