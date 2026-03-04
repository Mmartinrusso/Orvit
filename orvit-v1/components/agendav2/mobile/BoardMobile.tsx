'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Plus, Inbox, CircleDashed, PauseCircle, CircleCheckBig, ChevronLeft, ChevronRight, Send, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { TaskCardMobile } from './TaskCardMobile';
import type { AgendaTask, AgendaTaskStatus } from '@/lib/agenda/types';

interface UserOption {
  id: number;
  name: string;
  avatar?: string | null;
}

interface BoardMobileProps {
  tasks: AgendaTask[];
  companyUsers?: UserOption[];
  onTaskTap: (task: AgendaTask) => void;
  onToggleComplete: (taskId: number) => void;
  onCreateTask: () => void;
}

type BoardFilter = 'all' | 'mine' | 'delegated' | 'team';

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE'];

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

export function BoardMobile({ tasks, companyUsers, onTaskTap, onToggleComplete, onCreateTask }: BoardMobileProps) {
  const { user } = useAuth();
  const [activeStatus, setActiveStatus] = useState<AgendaTaskStatus>('PENDING');
  const [filter, setFilter] = useState<BoardFilter>('all');

  // Person filters (multi-select: array of string IDs)
  const [delegatedToIds, setDelegatedToIds] = useState<string[]>([]);
  const [teamFromIds, setTeamFromIds] = useState<string[]>([]);
  const [teamToIds, setTeamToIds] = useState<string[]>([]);

  // Swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const scrollLockRef = useRef<'horizontal' | 'vertical' | null>(null);

  const isAdmin = user && (ADMIN_ROLES.includes(user.systemRole ?? '') || ADMIN_ROLES.includes(user.role));

  const activeIndex = COLUMNS.findIndex((c) => c.status === activeStatus);
  const activeColumn = COLUMNS[activeIndex];
  const ActiveIcon = activeColumn.icon;

  // Build filter options
  const filters = useMemo(() => {
    const base: { id: BoardFilter; label: string; icon?: typeof Send }[] = [
      { id: 'all', label: 'Todas' },
      { id: 'mine', label: 'Mías' },
      { id: 'delegated', label: 'Enviadas', icon: Send },
    ];
    if (isAdmin) base.push({ id: 'team', label: 'Equipo', icon: Users });
    return base;
  }, [isAdmin]);

  // Extract unique assignees from MY delegated tasks (for "Enviadas" person filter)
  const delegatedAssigneeOptions = useMemo((): MultiSelectOption[] => {
    if (!user) return [];
    const map = new Map<number, string>();
    for (const t of tasks) {
      if (t.isArchived) continue;
      if (t.createdById === user.id && t.assignedToUserId && t.assignedToUserId !== user.id) {
        const id = t.assignedToUserId;
        if (!map.has(id)) {
          map.set(id, t.assignedToName || t.assignedToUser?.name || `User ${id}`);
        }
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ value: String(id), label: name }));
  }, [tasks, user]);

  // Company users as MultiSelect options (for admin team filter)
  // Extract all unique users from tasks when companyUsers prop is empty
  const companyUserOptions = useMemo((): MultiSelectOption[] => {
    if (companyUsers && companyUsers.length > 0) {
      return companyUsers.map((u) => ({ value: String(u.id), label: u.name }));
    }
    // Fallback: extract from tasks
    const map = new Map<number, string>();
    for (const t of tasks) {
      if (t.isArchived) continue;
      if (t.createdById && t.createdBy?.name) {
        map.set(t.createdById as number, t.createdBy.name);
      }
      if (t.assignedToUserId) {
        const name = t.assignedToName || t.assignedToUser?.name || `User ${t.assignedToUserId}`;
        map.set(t.assignedToUserId, name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ value: String(id), label: name }));
  }, [companyUsers, tasks]);

  // Filter tasks by perspective
  const filteredTasks = useMemo(() => {
    const nonArchived = tasks.filter((t) => !t.isArchived);
    if (!user) return nonArchived;

    if (filter === 'mine') {
      return nonArchived.filter(
        (t) => t.assignedToUserId === user.id || (!t.assignedToUserId && t.createdById === user.id)
      );
    }

    if (filter === 'delegated') {
      let delegated = nonArchived.filter(
        (t) => t.createdById === user.id && t.assignedToUserId && t.assignedToUserId !== user.id
      );
      if (delegatedToIds.length > 0) {
        const idSet = new Set(delegatedToIds.map(Number));
        delegated = delegated.filter((t) => t.assignedToUserId && idSet.has(t.assignedToUserId));
      }
      return delegated;
    }

    if (filter === 'team') {
      // Show only delegated tasks (creator assigned to someone else)
      let teamTasks = nonArchived.filter(
        (t) => t.assignedToUserId && t.createdById !== t.assignedToUserId
      );
      if (teamFromIds.length > 0) {
        const idSet = new Set(teamFromIds.map(Number));
        teamTasks = teamTasks.filter((t) => idSet.has(t.createdById));
      }
      if (teamToIds.length > 0) {
        const idSet = new Set(teamToIds.map(Number));
        teamTasks = teamTasks.filter((t) => t.assignedToUserId && idSet.has(t.assignedToUserId));
      }
      return teamTasks;
    }

    // 'all'
    return nonArchived;
  }, [tasks, filter, user, delegatedToIds, teamFromIds, teamToIds]);

  // Pre-compute tasks per column, split mine vs delegated for "all" view
  const tasksByStatus = useMemo(() => {
    const map: Record<string, { mine: AgendaTask[]; delegated: AgendaTask[] }> = {};
    for (const col of COLUMNS) {
      const colTasks = filteredTasks.filter((t) => t.status === col.status);
      if (filter === 'all' && user) {
        const mine = colTasks.filter(
          (t) => t.assignedToUserId === user.id || (!t.assignedToUserId && t.createdById === user.id)
        );
        const delegated = colTasks.filter(
          (t) => t.createdById === user.id && t.assignedToUserId && t.assignedToUserId !== user.id
        );
        const other = colTasks.filter(
          (t) => !mine.includes(t) && !delegated.includes(t)
        );
        map[col.status] = { mine: [...mine, ...other], delegated };
      } else {
        map[col.status] = { mine: colTasks, delegated: [] };
      }
    }
    return map;
  }, [filteredTasks, filter, user]);

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

  const activeBucket = tasksByStatus[activeColumn.status];
  const activeCount = (activeBucket?.mine.length ?? 0) + (activeBucket?.delegated.length ?? 0);

  return (
    <div className="flex flex-col min-h-0 overflow-hidden">
      {/* Column header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
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
      <div className="flex items-center justify-center gap-3 pb-2">
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

      {/* Filter pills — centered */}
      <div className="flex items-center justify-center gap-1.5 pb-1">
        {filters.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                setDelegatedToIds([]);
                setTeamFromIds([]);
                setTeamToIds([]);
              }}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all duration-200',
                filter === f.id
                  ? 'bg-foreground text-background'
                  : 'bg-muted/60 text-muted-foreground'
              )}
            >
              {Icon && <Icon className="inline h-3 w-3 mr-1 -mt-px" />}
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Person filter: "Enviadas" → multi-select assignees */}
      {filter === 'delegated' && delegatedAssigneeOptions.length > 1 && (
        <div className="px-5 pb-2">
          <MultiSelect
            options={delegatedAssigneeOptions}
            selected={delegatedToIds}
            onChange={setDelegatedToIds}
            placeholder="Para: Todos"
            searchPlaceholder="Buscar persona..."
            className="h-8 min-h-[2rem] text-xs"
            maxCount={2}
          />
        </div>
      )}

      {/* Person filter: "Equipo" → multi-selects for from + to */}
      {filter === 'team' && companyUserOptions.length > 0 && (
        <div className="flex items-center gap-2 px-5 pb-2">
          <div className="flex-1 min-w-0">
            <MultiSelect
              options={companyUserOptions}
              selected={teamFromIds}
              onChange={setTeamFromIds}
              placeholder="De: Todos"
              searchPlaceholder="Buscar..."
              className="h-8 min-h-[2rem] text-xs"
              maxCount={1}
            />
          </div>
          <div className="flex-1 min-w-0">
            <MultiSelect
              options={companyUserOptions}
              selected={teamToIds}
              onChange={setTeamToIds}
              placeholder="Para: Todos"
              searchPlaceholder="Buscar..."
              className="h-8 min-h-[2rem] text-xs"
              maxCount={1}
            />
          </div>
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
          {COLUMNS.map((col) => {
            const bucket = tasksByStatus[col.status] ?? { mine: [], delegated: [] };
            const total = bucket.mine.length + bucket.delegated.length;
            const EmptyIcon = col.icon;
            const emptyMsg =
              filter === 'mine'
                ? `No tenés tareas ${col.emptyLabel}`
                : filter === 'delegated'
                ? `Sin tareas enviadas ${col.emptyLabel}`
                : filter === 'team'
                ? `Sin tareas enviadas ${col.emptyLabel}`
                : `Sin tareas ${col.emptyLabel}`;

            return (
              <div key={col.status} className="w-full shrink-0 overflow-y-auto">
                {total === 0 ? (
                  <div className="mx-4 flex flex-col items-center justify-center rounded-2xl py-14 bg-muted/30">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                      <EmptyIcon className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{emptyMsg}</p>
                    {filter !== 'delegated' && filter !== 'team' && (
                      <button
                        onClick={onCreateTask}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Crear tarea
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="pb-4">
                    {/* My tasks */}
                    {bucket.mine.length > 0 && (
                      <div className="space-y-3">
                        {bucket.mine.map((task) => (
                          <TaskCardMobile
                            key={task.id}
                            task={task}
                            onTap={onTaskTap}
                            onToggleComplete={onToggleComplete}
                          />
                        ))}
                      </div>
                    )}

                    {/* Delegated tasks — shown with section divider in "all" */}
                    {bucket.delegated.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                          <Send className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                            Enviadas
                          </span>
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
                            {bucket.delegated.length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {bucket.delegated.map((task) => (
                            <TaskCardMobile
                              key={task.id}
                              task={task}
                              onTap={onTaskTap}
                              onToggleComplete={onToggleComplete}
                            />
                          ))}
                        </div>
                      </>
                    )}
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
