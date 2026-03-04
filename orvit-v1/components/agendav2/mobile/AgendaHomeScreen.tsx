'use client';

import { useState, useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, ChevronDown, ChevronRight, ChevronUp, FolderKanban, ListChecks } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WeekStrip } from './WeekStrip';
import { MonthCalendarMobile } from './MonthCalendarMobile';
import { TaskCardMobile } from './TaskCardMobile';
import { ProgressRing } from './ProgressRing';
import { useAuth } from '@/contexts/AuthContext';
import { isTaskOverdue } from '@/lib/agenda/types';
import type { AgendaTask } from '@/lib/agenda/types';
import { cn } from '@/lib/utils';

interface GroupItem {
  id: number;
  name: string;
  color?: string | null;
  isProject: boolean;
  _count?: { tasks: number };
}

interface AgendaHomeScreenProps {
  tasks: AgendaTask[];
  groups?: GroupItem[];
  onTaskTap: (task: AgendaTask) => void;
  onToggleComplete: (taskId: number) => void;
  onMenuOpen: () => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function AgendaHomeScreen({
  tasks,
  groups,
  onTaskTap,
  onToggleComplete,
  onMenuOpen,
}: AgendaHomeScreenProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showMonthCal, setShowMonthCal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const { user } = useAuth();

  const dayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), selectedDate)),
    [tasks, selectedDate]
  );

  const completedCount = dayTasks.filter((t) => t.status === 'COMPLETED').length;
  const completionPct = dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : 0;

  // Flat sorted list: overdue → in_progress → pending (no section headers)
  const activeTasks = useMemo(() => {
    const active = dayTasks.filter((t) => t.status !== 'COMPLETED');
    const priority: Record<string, number> = { overdue: 0, IN_PROGRESS: 1, WAITING: 2, PENDING: 3 };
    return active.sort((a, b) => {
      const aKey = isTaskOverdue(a) ? 'overdue' : a.status;
      const bKey = isTaskOverdue(b) ? 'overdue' : b.status;
      return (priority[aKey] ?? 9) - (priority[bKey] ?? 9);
    });
  }, [dayTasks]);

  const completedTasks = useMemo(
    () => dayTasks.filter((t) => t.status === 'COMPLETED'),
    [dayTasks]
  );

  // Groups with completion stats derived from all tasks
  const groupStats = useMemo(() => {
    if (!groups || groups.length === 0) return [];
    return groups.map((g) => {
      const groupTasks = tasks.filter((t) => t.groupId === g.id && !t.isArchived);
      const done = groupTasks.filter((t) => t.status === 'COMPLETED').length;
      return { ...g, total: groupTasks.length, done };
    }).filter((g) => g.total > 0);
  }, [groups, tasks]);

  const firstName = user?.name?.split(' ')[0] ?? 'Usuario';

  return (
    <div className="flex flex-col min-h-0">
      {/* ── Header area ── */}
      <div
        className="shrink-0"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        {/* Top bar: avatar + greeting + bell */}
        <div className="flex items-center justify-between px-5 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={onMenuOpen} className="active:scale-95 transition-transform">
              <Avatar className="h-9 w-9 ring-2 ring-border">
                <AvatarImage src={user?.avatar ?? undefined} />
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                  {user?.name?.slice(0, 2).toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
            </button>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">{getGreeting()}, {firstName}</p>
              <button
                onClick={() => setShowMonthCal(!showMonthCal)}
                className="flex items-center gap-1 active:opacity-70 transition-opacity"
              >
                <p className="text-xs text-muted-foreground capitalize">
                  {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
                </p>
                {showMonthCal ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          <button className="flex items-center justify-center active:scale-95 transition-transform w-9 h-9 rounded-full bg-muted/50">
            <Bell className="h-[18px] w-[18px] text-muted-foreground" />
          </button>
        </div>

        {/* Calendar: Week strip or Month */}
        {showMonthCal ? (
          <MonthCalendarMobile
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            tasks={tasks}
            onCollapse={() => setShowMonthCal(false)}
          />
        ) : (
          <WeekStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        )}

        {/* Daily summary line */}
        <div className="flex items-center gap-3 px-5 py-2.5">
          <ProgressRing percent={completionPct} size={32} strokeWidth={3} />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{completedCount}</span>
            {' '}de{' '}
            <span className="font-medium text-foreground">{dayTasks.length}</span>
            {' '}completada{dayTasks.length !== 1 ? 's' : ''} hoy
          </p>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto pb-4">
        {/* Pinned groups/projects */}
        {groupStats.length > 0 && (
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[13px] font-medium text-muted-foreground">Proyectos</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {groupStats.slice(0, 4).map((g) => (
                <div
                  key={g.id}
                  className="bg-card border border-border rounded-xl p-3 active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: g.color ? `${g.color}15` : 'var(--muted)' }}
                    >
                      <FolderKanban
                        className="h-4 w-4"
                        style={{ color: g.color ?? 'var(--muted-foreground)' }}
                      />
                    </div>
                  </div>
                  <p className="text-[13px] font-medium text-foreground truncate">{g.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <ListChecks className="h-3 w-3 inline mr-1 -mt-px" />
                    {g.done}/{g.total} completadas
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's tasks header */}
        {dayTasks.length > 0 && (
          <div className="flex items-center gap-2 px-5 pb-2">
            <span className="text-[13px] font-medium text-muted-foreground">
              Tareas de hoy
            </span>
            <span className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
              {activeTasks.length}
            </span>
          </div>
        )}

        {/* Task list (flat, no section headers) */}
        {dayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 px-8">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <span className="text-xl text-muted-foreground/60">&#10003;</span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Sin tareas para este día
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {isSameDay(selectedDate, new Date())
                ? 'Disfruta tu día libre'
                : format(selectedDate, "d 'de' MMMM", { locale: es })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTasks.map((task) => (
              <TaskCardMobile
                key={task.id}
                task={task}
                onTap={onTaskTap}
                onToggleComplete={onToggleComplete}
              />
            ))}

            {/* Completed — collapsible */}
            {completedTasks.length > 0 && (
              <div className="px-5 pt-2">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 w-full py-2"
                >
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200',
                      showCompleted && 'rotate-90'
                    )}
                  />
                  <span className="text-[13px] font-medium text-muted-foreground">
                    Completadas
                  </span>
                  <span className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
                    {completedTasks.length}
                  </span>
                </button>

                {showCompleted && (
                  <div className="space-y-3 pt-1">
                    {completedTasks.map((task) => (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
