'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Plus, Inbox, CircleDashed, PauseCircle, CircleCheckBig, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskCardMobile } from './TaskCardMobile';
import type { AgendaTask, AgendaTaskStatus } from '@/lib/agenda/types';

interface BoardMobileProps {
  tasks: AgendaTask[];
  onTaskTap: (task: AgendaTask) => void;
  onToggleComplete: (taskId: number) => void;
  onCreateTask: () => void;
}

const COLUMNS: {
  status: AgendaTaskStatus;
  label: string;
  icon: typeof Inbox;
  color: string;
  emptyLabel: string;
}[] = [
  {
    status: 'PENDING',
    label: 'Pendiente',
    icon: Inbox,
    color: 'text-muted-foreground',
    emptyLabel: 'pendientes',
  },
  {
    status: 'IN_PROGRESS',
    label: 'En progreso',
    icon: CircleDashed,
    color: 'text-blue-600 dark:text-blue-400',
    emptyLabel: 'en progreso',
  },
  {
    status: 'WAITING',
    label: 'En espera',
    icon: PauseCircle,
    color: 'text-amber-600 dark:text-amber-400',
    emptyLabel: 'en espera',
  },
  {
    status: 'COMPLETED',
    label: 'Completada',
    icon: CircleCheckBig,
    color: 'text-emerald-600 dark:text-emerald-400',
    emptyLabel: 'completadas',
  },
];

const SWIPE_THRESHOLD = 80;

export function BoardMobile({ tasks, onTaskTap, onToggleComplete, onCreateTask }: BoardMobileProps) {
  const [activeStatus, setActiveStatus] = useState<AgendaTaskStatus>('PENDING');

  // Swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const scrollLockRef = useRef<'horizontal' | 'vertical' | null>(null);

  const activeIndex = COLUMNS.findIndex((c) => c.status === activeStatus);
  const activeColumn = COLUMNS[activeIndex];
  const ActiveIcon = activeColumn.icon;

  // Pre-compute tasks per column
  const tasksByStatus = useMemo(() => {
    const map: Record<string, AgendaTask[]> = {};
    for (const col of COLUMNS) {
      map[col.status] = tasks.filter((t) => t.status === col.status && !t.isArchived);
    }
    return map;
  }, [tasks]);

  const goTo = (index: number) => {
    if (index >= 0 && index < COLUMNS.length) {
      setActiveStatus(COLUMNS[index].status);
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    scrollLockRef.current = null;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;

      if (!scrollLockRef.current) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        scrollLockRef.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }

      if (scrollLockRef.current === 'vertical') return;

      e.preventDefault();
      setIsDragging(true);

      let delta = dx;
      if ((activeIndex === 0 && dx > 0) || (activeIndex === COLUMNS.length - 1 && dx < 0)) {
        delta = dx * 0.3;
      }
      setTouchDelta(delta);
    },
    [touchStart, activeIndex]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) {
      setTouchStart(null);
      return;
    }

    if (Math.abs(touchDelta) > SWIPE_THRESHOLD) {
      if (touchDelta < 0 && activeIndex < COLUMNS.length - 1) {
        setActiveStatus(COLUMNS[activeIndex + 1].status);
      } else if (touchDelta > 0 && activeIndex > 0) {
        setActiveStatus(COLUMNS[activeIndex - 1].status);
      }
    }

    setTouchStart(null);
    setTouchDelta(0);
    setIsDragging(false);
    scrollLockRef.current = null;
  }, [isDragging, touchDelta, activeIndex]);

  const activeCount = tasksByStatus[activeColumn.status]?.length ?? 0;

  return (
    <div className="flex flex-col min-h-0 overflow-hidden">
      {/* Column header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <ActiveIcon className={cn('h-6 w-6', activeColumn.color)} strokeWidth={1.8} />
          <h2 className="text-xl font-bold tracking-tight">{activeColumn.label}</h2>
          <span className="text-sm text-muted-foreground font-medium tabular-nums">{activeCount}</span>
        </div>
        <button
          onClick={onCreateTask}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-muted hover:bg-muted/80 transition-colors active:scale-95"
        >
          <Plus className="h-4 w-4 text-foreground" strokeWidth={2.5} />
        </button>
      </div>

      {/* Page dots + arrows */}
      <div className="flex items-center justify-center gap-3 pb-3">
        <button
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="p-0.5 text-muted-foreground disabled:opacity-20 active:scale-90 transition-all"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1.5">
          {COLUMNS.map((col, i) => (
            <button
              key={col.status}
              onClick={() => setActiveStatus(col.status)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === activeIndex ? 'w-5 bg-foreground' : 'w-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
        <button
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex === COLUMNS.length - 1}
          className="p-0.5 text-muted-foreground disabled:opacity-20 active:scale-90 transition-all"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Swipeable columns */}
      <div
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(calc(-${activeIndex * 100}% + ${touchDelta}px))`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        >
          {COLUMNS.map((col) => {
            const columnTasks = tasksByStatus[col.status] ?? [];
            const EmptyIcon = col.icon;

            return (
              <div key={col.status} className="w-full shrink-0 overflow-y-auto">
                {columnTasks.length === 0 ? (
                  <div className="mx-4 flex flex-col items-center justify-center rounded-2xl py-14 bg-muted/30">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                      <EmptyIcon className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Sin tareas {col.emptyLabel}
                    </p>
                    <button
                      onClick={onCreateTask}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Crear tarea
                    </button>
                  </div>
                ) : (
                  <div className="pb-4 space-y-3">
                    {columnTasks.map((task) => (
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
          })}
        </div>
      </div>
    </div>
  );
}
