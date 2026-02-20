'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { AVATAR_COLORS } from '@/lib/colors';
import { useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';
import { isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Task } from '@/hooks/use-task-store';





function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

interface UserTaskStats {
  userId: string;
  name: string;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completedToday: number;
}

interface TasksUserSidebarProps {
  tasks: Task[];
  users: any[];
  selectedUserId: string | null;
  onUserSelect: (userId: string | null) => void;
}

export function TasksUserSidebar({
  tasks,
  users,
  selectedUserId,
  onUserSelect,
}: TasksUserSidebarProps) {
  const userColors = useUserColors();

  const userStats = useMemo((): UserTaskStats[] => {
    // Calcular stats por usuario a partir de las tareas
    const statsMap = new Map<string, UserTaskStats>();

    // Inicializar todos los usuarios con count 0
    users.forEach((u) => {
      statsMap.set(u.id?.toString(), {
        userId: u.id?.toString(),
        name: u.name || u.username || 'Sin nombre',
        totalTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        completedToday: 0,
      });
    });

    // Acumular stats de tareas
    const now = new Date();
    tasks.forEach((task) => {
      const uid = task.assignedTo?.id?.toString();
      if (!uid) return;

      if (!statsMap.has(uid)) {
        statsMap.set(uid, {
          userId: uid,
          name: task.assignedTo?.name || 'Sin nombre',
          totalTasks: 0,
          pendingTasks: 0,
          inProgressTasks: 0,
          overdueTasks: 0,
          completedToday: 0,
        });
      }

      const s = statsMap.get(uid)!;
      s.totalTasks++;

      if (task.status === 'pendiente') s.pendingTasks++;
      if (task.status === 'en-curso') s.inProgressTasks++;
      if (
        task.status === 'realizada' &&
        task.updatedAt &&
        isToday(new Date(task.updatedAt))
      ) {
        s.completedToday++;
      }
      if (
        task.dueDate &&
        new Date(task.dueDate) < now &&
        task.status !== 'realizada' &&
        task.status !== 'cancelada'
      ) {
        s.overdueTasks++;
      }
    });

    // Ordenar: usuarios con tareas primero, luego por nombre
    return Array.from(statsMap.values()).sort((a, b) => {
      if (b.totalTasks !== a.totalTasks) return b.totalTasks - a.totalTasks;
      return a.name.localeCompare(b.name);
    });
  }, [tasks, users]);

  const usersWithTasks = userStats.filter((u) => u.totalTasks > 0).length;

  return (
    <Card className="w-72 flex-shrink-0 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: userColors.chart1 }} />
            Usuarios ({usersWithTasks})
          </span>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-7 px-2', !selectedUserId && 'bg-muted')}
            onClick={() => onUserSelect(null)}
          >
            Todos
          </Button>
        </CardTitle>
      </CardHeader>

      <ScrollArea className="flex-1 px-4 pb-4">
        <div className="space-y-2">
          {userStats.map((u) => {
            const isSelected = selectedUserId === u.userId;
            const hasOverdue = u.overdueTasks > 0;

            return (
              <div
                key={u.userId}
                role="button"
                tabIndex={0}
                aria-label={`Filtrar por ${u.name}: ${u.pendingTasks} pendientes${u.overdueTasks > 0 ? `, ${u.overdueTasks} vencidas` : ''}`}
                aria-pressed={isSelected}
                className={cn(
                  'p-3 rounded-lg cursor-pointer transition-all border',
                  isSelected
                    ? 'bg-primary/10 border-primary/50'
                    : 'hover:bg-muted/50 border-transparent',
                  hasOverdue && !isSelected && 'border-l-2 border-l-red-500'
                )}
                onClick={() => onUserSelect(isSelected ? null : u.userId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onUserSelect(isSelected ? null : u.userId);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback
                      style={{ backgroundColor: getAvatarColor(u.name) }}
                      className="text-white text-xs font-medium"
                    >
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {u.pendingTasks} pendiente{u.pendingTasks !== 1 ? 's' : ''}
                      </span>
                      {u.overdueTasks > 0 && (
                        <span className="text-destructive font-medium">
                          • {u.overdueTasks} vencida{u.overdueTasks !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-xs h-5"
                    style={
                      u.inProgressTasks > 0
                        ? {
                            backgroundColor: `${userColors.chart1}15`,
                            color: userColors.chart1,
                          }
                        : {}
                    }
                  >
                    {u.totalTasks}
                  </Badge>
                </div>

                {u.totalTasks > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          backgroundColor: userColors.kpiPositive,
                          width: `${
                            ((u.totalTasks - u.pendingTasks - u.inProgressTasks) /
                              u.totalTasks) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {userStats.length === 0 && (
            <div role="status" className="text-center py-8 text-muted-foreground text-sm">
              No hay usuarios disponibles
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
