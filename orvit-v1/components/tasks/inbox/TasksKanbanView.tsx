'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { AVATAR_COLORS } from '@/lib/colors';
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Calendar, AlertTriangle, MessageSquare, Mic, MoreVertical, Eye, Pencil, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
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
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}



// Configuración de status (match con constantes de tareas)
const STATUS_CONFIG: Record<string, {
  label: string;
  labelShort: string;
  color: string;
  bgColor: string;
}> = {
  'pendiente': {
    label: 'Pendiente',
    labelShort: 'Pend.',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  'en-curso': {
    label: 'En Curso',
    labelShort: 'En curso',
    color: 'text-info-muted-foreground',
    bgColor: 'bg-info-muted',
  },
  'realizada': {
    label: 'Realizada',
    labelShort: 'Hecha',
    color: 'text-success',
    bgColor: 'bg-success-muted',
  },
  'cancelada': {
    label: 'Cancelada',
    labelShort: 'Canc.',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
};

interface TasksKanbanViewProps {
  tasks: Task[];
  onSelect: (task: Task) => void;
  onStatusChange: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

export function TasksKanbanView({ tasks, onSelect, onStatusChange, onEdit, onDelete }: TasksKanbanViewProps) {
  const userColors = useUserColors();

  // Agrupar tareas por persona asignada
  const tasksByPerson = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    // Columna "Sin asignar"
    grouped.set('__unassigned__', []);

    tasks.forEach((task) => {
      // Solo mostrar tareas no completadas/canceladas en kanban
      if (task.status === 'realizada' || task.status === 'cancelada') {
        return;
      }

      const key = task.assignedTo?.name || '__unassigned__';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(task);
    });

    // Ordenar tareas dentro de cada columna por prioridad y fecha
    grouped.forEach((personTasks) => {
      personTasks.sort((a, b) => {
        // Primero por prioridad
        const priorityOrder: Record<string, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };
        const priorityDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        if (priorityDiff !== 0) return priorityDiff;

        // Luego por fecha
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
    });

    return grouped;
  }, [tasks]);

  // Eliminar columnas vacías excepto "Sin asignar" si hay otras con tareas
  const columns = useMemo(() => {
    const entries = Array.from(tasksByPerson.entries());
    const nonEmpty = entries.filter(([, tasks]) => tasks.length > 0);

    // Si no hay tareas en ningún lado, mostrar solo "Sin asignar"
    if (nonEmpty.length === 0) {
      return [['__unassigned__', []] as [string, Task[]]];
    }

    return nonEmpty;
  }, [tasksByPerson]);

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    if (task.status === 'realizada' || task.status === 'cancelada') return false;
    return new Date(task.dueDate) < new Date();
  };

  const isFromDiscord = (task: Task) => {
    const tags = task.tags || [];
    return tags.includes('discord');
  };

  const isFromAudio = (task: Task) => {
    const tags = task.tags || [];
    return tags.includes('audio');
  };

  if (tasks.filter(t => t.status !== 'realizada' && t.status !== 'cancelada').length === 0) {
    return (
      <Card className="flex items-center justify-center h-64">
        <div className="text-center py-12">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">Sin tareas activas</h3>
          <p className="text-muted-foreground text-sm">
            Todas las tareas están completadas o canceladas
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {columns.map(([personName, personTasks]) => (
        <div
          key={personName}
          className="flex-shrink-0 w-[300px] flex flex-col bg-muted/30 rounded-lg"
        >
          {/* Column Header */}
          <div className="p-3 border-b bg-muted/50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    style={{
                      backgroundColor:
                        personName === '__unassigned__'
                          ? userColors.kpiNeutral
                          : getAvatarColor(personName),
                    }}
                    className="text-white text-xs font-medium"
                  >
                    {personName === '__unassigned__' ? '?' : getInitials(personName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-sm">
                    {personName === '__unassigned__' ? 'Sin asignar' : personName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {personTasks.length} tarea{personTasks.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Column Content */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-2">
              {personTasks.map((task) => {
                const statusConfig = STATUS_CONFIG[task.status] ?? {
                  bgColor: 'bg-muted',
                  color: 'text-muted-foreground',
                  labelShort: task.status,
                };
                const overdue = isOverdue(task);
                const dueToday = task.dueDate && isToday(new Date(task.dueDate));
                const fromDiscord = isFromDiscord(task);
                const fromAudio = isFromAudio(task);

                return (
                  <Card
                    key={task.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md group',
                      'relative overflow-hidden'
                    )}
                    onClick={() => onSelect(task)}
                  >
                    {/* Priority indicator */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{
                        backgroundColor:
                          task.priority === 'urgente'
                            ? userColors.kpiNegative
                            : task.priority === 'alta'
                              ? userColors.chart4
                              : task.priority === 'media'
                                ? userColors.chart1
                                : userColors.kpiNeutral,
                      }}
                    />

                    <CardContent className="p-3 pl-4">
                      <div className="flex items-start gap-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={task.status === 'realizada'}
                            onCheckedChange={() => onStatusChange(task)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">{task.title}</p>

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge
                              className={cn(statusConfig.bgColor, statusConfig.color, 'text-xs')}
                            >
                              {statusConfig.labelShort}
                            </Badge>

                            {task.dueDate && (
                              <div
                                className={cn(
                                  'flex items-center gap-1 text-xs',
                                  overdue && 'text-destructive font-medium',
                                  dueToday && !overdue && 'text-warning-muted-foreground'
                                )}
                              >
                                <Calendar className="h-3 w-3" />
                                {isToday(new Date(task.dueDate))
                                  ? `Hoy, ${format(new Date(task.dueDate), 'HH:mm')}`
                                  : format(new Date(task.dueDate), "d MMM, HH:mm", { locale: es })}
                              </div>
                            )}

                            {overdue && (
                              <AlertTriangle
                                className="h-3.5 w-3.5"
                                style={{ color: userColors.kpiNegative }}
                              />
                            )}

                            {/* Indicador de origen Discord */}
                            {fromDiscord && (
                              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                {fromAudio ? (
                                  <Mic className="h-3 w-3" />
                                ) : (
                                  <MessageSquare className="h-3 w-3" />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Subtasks progress */}
                          {task.subtasks && task.subtasks.length > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      backgroundColor: userColors.chart5,
                                      width: `${(task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100}%`
                                    }}
                                  />
                                </div>
                                <span>{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 3-dot menu */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                                aria-label="Acciones de tarea"
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => onSelect(task)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalles
                              </DropdownMenuItem>
                              {onEdit && (
                                <DropdownMenuItem onClick={() => onEdit(task)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => onStatusChange(task)}>
                                {task.status === 'realizada' ? (
                                  <><Circle className="h-4 w-4 mr-2" />Marcar pendiente</>
                                ) : (
                                  <><CheckCircle2 className="h-4 w-4 mr-2" />Marcar realizada</>
                                )}
                              </DropdownMenuItem>
                              {onDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => onDelete(task)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {personTasks.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Sin tareas pendientes
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
