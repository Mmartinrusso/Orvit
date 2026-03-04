'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Play,
  Plus,
  RotateCcw,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useFixedTasks } from '@/hooks/use-fixed-tasks';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { FixedTaskFormSheet } from '../FixedTaskFormSheet';

/* ── Types ── */

type FreqKey = 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';

interface FixedTask {
  id: string;
  title: string;
  description: string;
  frequency: FreqKey;
  assignedTo: { id: string; name: string };
  department: string;
  instructives: { id: string; title: string; content: string; attachments?: string[] }[];
  estimatedTime: number;
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  lastExecuted?: string;
  nextExecution: string;
  createdAt: string;
  completedAt?: string;
  isCompleted?: boolean;
  executionTime?: string;
}

/* ── Constants ── */

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE'];

const FREQ_COLUMNS: { key: FreqKey; label: string; short: string; color: string }[] = [
  { key: 'diaria', label: 'Diaria', short: 'D', color: 'bg-violet-500' },
  { key: 'semanal', label: 'Semanal', short: 'S', color: 'bg-blue-500' },
  { key: 'quincenal', label: 'Quincenal', short: 'Q', color: 'bg-cyan-500' },
  { key: 'mensual', label: 'Mensual', short: 'M', color: 'bg-emerald-500' },
  { key: 'trimestral', label: 'Trimestral', short: 'T', color: 'bg-amber-500' },
  { key: 'semestral', label: 'Semestral', short: 'Se', color: 'bg-orange-500' },
  { key: 'anual', label: 'Anual', short: 'A', color: 'bg-red-500' },
];

const PRIORITY_CHIP: Record<string, { bg: string; text: string; label: string }> = {
  alta: { bg: '#FEF3C7', text: '#D97706', label: 'Alta' },
  media: { bg: '#EFF6FF', text: '#2563EB', label: 'Media' },
  baja: { bg: '#F3F4F6', text: '#6B7280', label: 'Baja' },
};

const SWIPE_THRESHOLD = 80;

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatTime(mins: number) {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/* ── FixedTaskCard (same as desktop) ── */

function FixedTaskCardMobile({
  task,
  currentUserId,
  onExecute,
}: {
  task: FixedTask;
  currentUserId?: string;
  onExecute: (t: FixedTask) => void;
}) {
  const prio = PRIORITY_CHIP[task.priority] ?? PRIORITY_CHIP.media;
  const isOverdue = !task.isCompleted && task.nextExecution && isPast(new Date(task.nextExecution));
  const canExecute = !task.isCompleted && task.isActive && String(task.assignedTo.id) === String(currentUserId);

  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border/50 p-4 active:scale-[0.98] transition-transform',
        task.isCompleted && 'opacity-70',
        !task.isActive && !task.isCompleted && 'opacity-50',
      )}
    >
      {/* Status badges */}
      {task.isCompleted && (
        <div className="flex items-center gap-1.5 mb-2">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          <span className="text-[11px] font-semibold text-emerald-600">Completada</span>
        </div>
      )}
      {!task.isActive && !task.isCompleted && (
        <span className="inline-block text-[11px] font-medium text-red-600 bg-red-100 dark:bg-red-950/30 px-2 py-0.5 rounded-full mb-2">
          Inactiva
        </span>
      )}

      {/* Title + Execute */}
      <div className="flex items-start gap-2">
        <p className={cn(
          'flex-1 text-[14px] font-semibold leading-snug line-clamp-2 min-w-0',
          task.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground',
        )}>
          {task.title}
        </p>
        {canExecute && (
          <button
            onClick={(e) => { e.stopPropagation(); onExecute(task); }}
            className="shrink-0 flex items-center gap-1.5 bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold active:scale-95 transition-transform"
          >
            <Play className="h-3 w-3" />
            Ejecutar
          </button>
        )}
        {task.isCompleted && (
          <span className="shrink-0 flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold">
            ✓
          </span>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed mt-1.5">
          {task.description}
        </p>
      )}

      {/* Assignee box */}
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2 mt-2.5">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[8px] font-bold bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400">
            {getInitials(task.assignedTo.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-foreground truncate">{task.assignedTo.name}</p>
          <p className="text-[10px] text-muted-foreground">{task.department}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-2.5">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {task.executionTime ?? formatTime(task.estimatedTime)}
        </span>
        {task.instructives.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <FileText className="h-3 w-3" />
            {task.instructives.length}
          </span>
        )}
        <span className={cn(
          'flex items-center gap-1 text-[11px]',
          isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground',
        )}>
          <Calendar className="h-3 w-3" />
          {format(new Date(task.nextExecution), 'd MMM', { locale: es })}
        </span>
      </div>

      {/* Reset info */}
      {task.isCompleted && task.completedAt && (
        <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-1.5 mt-2">
          <RotateCcw className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            Reinicio: {format(new Date(task.nextExecution), "d 'de' MMM", { locale: es })}
          </span>
        </div>
      )}

      {/* Footer: priority + overdue */}
      <div className="flex items-center justify-between border-t border-border/30 pt-2.5 mt-2.5">
        <span
          className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: prio.bg, color: prio.text }}
        >
          {prio.label}
        </span>
        {isOverdue && !task.isCompleted && (
          <span className="text-[11px] font-semibold text-red-500">Vencida</span>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ── */

interface FixedTasksMobileProps {
  createFormOpen?: boolean;
  onCreateFormClose?: () => void;
}

export function FixedTasksMobile({ createFormOpen, onCreateFormClose }: FixedTasksMobileProps) {
  const { user } = useAuth();
  const { tasks, loading, createTask, completeTask } = useFixedTasks();

  const [activeIndex, setActiveIndex] = useState(0);
  const [filterUserIds, setFilterUserIds] = useState<string[]>([]);
  const [localFormOpen, setLocalFormOpen] = useState(false);

  const isFormOpen = createFormOpen || localFormOpen;
  const closeForm = () => {
    setLocalFormOpen(false);
    onCreateFormClose?.();
  };

  // Swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const scrollLockRef = useRef<'horizontal' | 'vertical' | null>(null);

  const isAdmin = user && (ADMIN_ROLES.includes(user.systemRole ?? '') || ADMIN_ROLES.includes(user.role));
  const hasViewPermission = isAdmin || user?.permissions?.includes('fixed_tasks.edit');

  // User filter options (from tasks)
  const userOptions = useMemo((): MultiSelectOption[] => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      if (t.assignedTo?.id && t.assignedTo.name) {
        map.set(t.assignedTo.id, t.assignedTo.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ value: id, label: name }));
  }, [tasks]);

  // Filter tasks: by user (if admin) or only mine
  const filteredTasks = useMemo(() => {
    let result = tasks.filter((t: FixedTask) => t.isActive);
    if (!hasViewPermission && user) {
      // Non-admin: only my tasks
      result = result.filter((t: FixedTask) => String(t.assignedTo.id) === String(user.id));
    } else if (filterUserIds.length > 0) {
      const idSet = new Set(filterUserIds);
      result = result.filter((t: FixedTask) => idSet.has(t.assignedTo.id));
    }
    return result;
  }, [tasks, hasViewPermission, user, filterUserIds]);

  // Group by frequency
  const tasksByFreq = useMemo(() => {
    const map: Record<string, FixedTask[]> = {};
    for (const col of FREQ_COLUMNS) {
      map[col.key] = filteredTasks.filter((t: FixedTask) => t.frequency === col.key);
    }
    return map;
  }, [filteredTasks]);

  const activeCol = FREQ_COLUMNS[activeIndex];
  const activeTasks = tasksByFreq[activeCol.key] ?? [];

  const goTo = (index: number) => {
    if (index >= 0 && index < FREQ_COLUMNS.length) setActiveIndex(index);
  };

  // Swipe handlers
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
      if ((activeIndex === 0 && dx > 0) || (activeIndex === FREQ_COLUMNS.length - 1 && dx < 0)) {
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
      if (touchDelta < 0 && activeIndex < FREQ_COLUMNS.length - 1) {
        setActiveIndex(activeIndex + 1);
      } else if (touchDelta > 0 && activeIndex > 0) {
        setActiveIndex(activeIndex - 1);
      }
    }

    setTouchStart(null);
    setTouchDelta(0);
    setIsDragging(false);
    scrollLockRef.current = null;
  }, [isDragging, touchDelta, activeIndex]);

  const handleExecute = async (task: FixedTask) => {
    try {
      toast.loading('Ejecutando tarea...', { id: 'execute' });
      await completeTask(task.id, {
        actualTime: task.estimatedTime,
        notes: '',
        executedBy: user?.name ?? 'Usuario',
        completedAt: new Date().toISOString(),
      });
      toast.success('Tarea ejecutada', { id: 'execute' });
    } catch {
      toast.error('Error al ejecutar tarea', { id: 'execute' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 overflow-hidden">
      {/* Column header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold', activeCol.color)}>
            {activeCol.short}
          </span>
          <h2 className="text-xl font-bold tracking-tight">{activeCol.label}</h2>
          <span className="text-sm text-muted-foreground font-medium tabular-nums">{activeTasks.length}</span>
        </div>
        <button
          onClick={() => setLocalFormOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-muted active:scale-90 transition-transform"
        >
          <Plus className="h-4 w-4 text-foreground" />
        </button>
      </div>

      {/* Page dots + arrows */}
      <div className="flex items-center justify-center gap-3 pb-2">
        <button
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="p-0.5 text-muted-foreground disabled:opacity-20 active:scale-90 transition-all"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1.5">
          {FREQ_COLUMNS.map((col, i) => (
            <button
              key={col.key}
              onClick={() => setActiveIndex(i)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === activeIndex ? 'w-5 bg-foreground' : 'w-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
        <button
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex === FREQ_COLUMNS.length - 1}
          className="p-0.5 text-muted-foreground disabled:opacity-20 active:scale-90 transition-all"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Admin user filter */}
      {hasViewPermission && userOptions.length > 1 && (
        <div className="px-5 pb-2">
          <MultiSelect
            options={userOptions}
            selected={filterUserIds}
            onChange={setFilterUserIds}
            placeholder="Persona: Todos"
            searchPlaceholder="Buscar persona..."
            className="h-8 min-h-[2rem] text-xs"
            maxCount={2}
          />
        </div>
      )}

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
          {FREQ_COLUMNS.map((col) => {
            const colTasks = tasksByFreq[col.key] ?? [];
            return (
              <div key={col.key} className="w-full shrink-0 overflow-y-auto px-4">
                {colTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl py-14 bg-muted/30">
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center mb-3 text-white text-sm font-bold', col.color)}>
                      {col.short}
                    </div>
                    <p className="text-sm text-muted-foreground">Sin tareas {col.label.toLowerCase()}s</p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-4">
                    {colTasks.map((task: FixedTask) => (
                      <FixedTaskCardMobile
                        key={task.id}
                        task={task}
                        currentUserId={user?.id ? String(user.id) : undefined}
                        onExecute={handleExecute}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create form */}
      <FixedTaskFormSheet
        isOpen={isFormOpen}
        onClose={closeForm}
        onSubmit={async (taskData) => {
          await createTask(taskData);
          closeForm();
          toast.success('Tarea fija creada');
        }}
        frequency={activeCol.key}
      />
    </div>
  );
}
