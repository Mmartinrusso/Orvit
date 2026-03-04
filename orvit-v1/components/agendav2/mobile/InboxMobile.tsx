'use client';

import { useState, useMemo, useRef } from 'react';
import { Search, X, ArrowUpDown, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskCardMobile } from './TaskCardMobile';
import type { AgendaTask } from '@/lib/agenda/types';

interface InboxMobileProps {
  tasks: AgendaTask[];
  onTaskTap: (task: AgendaTask) => void;
  onToggleComplete: (taskId: number) => void;
}

type FilterType = 'all' | 'pending' | 'in_progress' | 'waiting' | 'urgent';
type SortType = 'recent' | 'priority' | 'date';

const FILTERS: { id: FilterType; label: string; activeClasses: string }[] = [
  { id: 'all', label: 'Todas', activeClasses: 'bg-primary/10 text-primary' },
  { id: 'pending', label: 'Pendientes', activeClasses: 'bg-primary/10 text-primary' },
  { id: 'in_progress', label: 'Progreso', activeClasses: 'bg-primary/10 text-primary' },
  { id: 'waiting', label: 'Espera', activeClasses: 'bg-primary/10 text-primary' },
  { id: 'urgent', label: 'Urgentes', activeClasses: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' },
];

const SORT_OPTIONS: { id: SortType; label: string }[] = [
  { id: 'recent', label: 'Recientes' },
  { id: 'priority', label: 'Prioridad' },
  { id: 'date', label: 'Fecha' },
];

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function InboxMobile({ tasks, onTaskTap, onToggleComplete }: InboxMobileProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('recent');
  const [showSort, setShowSort] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredTasks = useMemo(() => {
    let result = tasks.filter((t) => !t.isArchived);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.group?.name || '').toLowerCase().includes(q)
      );
    }

    // Filter
    switch (filter) {
      case 'pending':
        result = result.filter((t) => t.status === 'PENDING');
        break;
      case 'in_progress':
        result = result.filter((t) => t.status === 'IN_PROGRESS');
        break;
      case 'waiting':
        result = result.filter((t) => t.status === 'WAITING');
        break;
      case 'urgent':
        result = result.filter((t) => t.priority === 'URGENT');
        break;
    }

    // Sort
    result.sort((a, b) => {
      switch (sort) {
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'priority':
          return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        case 'date':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, search, filter, sort]);

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        {/* Search bar */}
        <div
          className="relative bg-muted/50 rounded-xl focus-within:ring-2 focus-within:ring-primary/20 transition-all"
          onClick={() => inputRef.current?.focus()}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tareas..."
            className="w-full h-10 pl-10 pr-10 rounded-xl bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filters + Sort row */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
            {FILTERS.map((f) => {
              const isActive = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all',
                    isActive ? f.activeClasses : 'bg-muted text-muted-foreground'
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Sort button */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowSort(!showSort)}
              className="flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:bg-muted transition-colors"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
            {showSort && (
              <>
                {/* Backdrop to close dropdown */}
                <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
                <div className="absolute right-0 top-full mt-1 bg-card rounded-xl shadow-lg border border-border py-1 z-20 min-w-[130px]">
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSort(s.id);
                        setShowSort(false);
                      }}
                      className={cn(
                        'block w-full text-left px-3 py-2 text-xs transition-colors',
                        sort === s.id
                          ? 'text-primary font-semibold bg-primary/5'
                          : 'text-foreground hover:bg-muted/50'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 py-1.5 flex justify-end">
        <span className="text-xs text-muted-foreground">
          {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <div className="mx-4 flex flex-col items-center justify-center rounded-2xl py-14 bg-muted/30">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Inbox className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <p className="text-sm text-muted-foreground">
            {search ? 'No se encontraron tareas' : 'No hay tareas'}
          </p>
        </div>
      ) : (
        <div className="pb-4 space-y-3">
          {filteredTasks.map((task) => (
            <TaskCardMobile
              key={task.id}
              task={task}
              onTap={onTaskTap}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
