'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Play, Repeat, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Frequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ALL';

const FREQ_TABS: { id: Frequency; label: string }[] = [
  { id: 'ALL', label: 'Todas' },
  { id: 'DAILY', label: 'Diaria' },
  { id: 'WEEKLY', label: 'Semanal' },
  { id: 'BIWEEKLY', label: 'Quincenal' },
  { id: 'MONTHLY', label: 'Mensual' },
  { id: 'QUARTERLY', label: 'Trimestral' },
];

interface FixedTask {
  id: number;
  title: string;
  frequency: string;
  isActive: boolean;
  priority: string;
  nextExecution?: string | null;
  lastExecution?: string | null;
  assignedTo?: { id: number; name: string } | null;
}

export function FixedTasksMobile() {
  const [activeFreq, setActiveFreq] = useState<Frequency>('ALL');
  const { currentCompany } = useCompany();

  const { data: fixedTasks = [], isLoading } = useQuery<FixedTask[]>({
    queryKey: ['fixed-tasks-mobile', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/agenda/fixed-tasks?companyId=${currentCompany?.id}`);
      if (!res.ok) throw new Error('Error fetching fixed tasks');
      const data = await res.json();
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 30_000,
  });

  const filtered = activeFreq === 'ALL'
    ? fixedTasks
    : fixedTasks.filter((t) => t.frequency === activeFreq);

  const activeTasks = filtered.filter((t) => t.isActive);
  const inactiveTasks = filtered.filter((t) => !t.isActive);

  return (
    <div className="pt-4 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <h2 className="text-lg font-bold text-foreground mb-3">Tareas Fijas</h2>

        {/* Frequency filter pills - horizontal scroll */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {FREQ_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFreq(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors',
                activeFreq === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : activeTasks.length === 0 && inactiveTasks.length === 0 ? (
        <div className="mx-4 flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Repeat className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No hay tareas fijas</p>
          <p className="mt-1 text-xs text-muted-foreground">Las tareas recurrentes aparecen aqui</p>
        </div>
      ) : (
        <div className="space-y-2 px-4">
          {activeTasks.map((task) => (
            <FixedTaskCard key={task.id} task={task} />
          ))}
          {inactiveTasks.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-4 pb-1">
                Inactivas
              </p>
              {inactiveTasks.map((task) => (
                <FixedTaskCard key={task.id} task={task} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FixedTaskCard({ task }: { task: FixedTask }) {
  const priorityBorder: Record<string, string> = {
    URGENT: 'border-l-destructive',
    HIGH: 'border-l-orange-500',
    MEDIUM: 'border-l-primary',
    LOW: 'border-l-muted-foreground/40',
  };

  const freqLabels: Record<string, string> = {
    DAILY: 'Diaria',
    WEEKLY: 'Semanal',
    BIWEEKLY: 'Quincenal',
    MONTHLY: 'Mensual',
    QUARTERLY: 'Trimestral',
    YEARLY: 'Anual',
  };

  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border p-3.5 border-l-[3px] transition-opacity',
        priorityBorder[task.priority] ?? 'border-l-muted-foreground/40',
        !task.isActive && 'opacity-50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Title */}
          <p className="text-sm font-semibold text-foreground line-clamp-2">{task.title}</p>

          {/* Meta row: frequency badge + assignee */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
              {freqLabels[task.frequency] ?? task.frequency}
            </span>
            {task.assignedTo && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                  {task.assignedTo.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate max-w-[100px]">{task.assignedTo.name}</span>
              </span>
            )}
          </div>

          {/* Next execution */}
          {task.nextExecution && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              Proxima: {format(new Date(task.nextExecution), "d MMM, HH:mm", { locale: es })}
            </p>
          )}
        </div>

        {/* Execute button */}
        {task.isActive && (
          <button className="shrink-0 flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-3 py-1.5 text-xs font-semibold active:scale-95 transition-transform">
            <Play className="h-3 w-3" />
            Ejecutar
          </button>
        )}
      </div>
    </div>
  );
}
