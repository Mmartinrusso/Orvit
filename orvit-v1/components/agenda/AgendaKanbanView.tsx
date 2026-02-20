'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Calendar, AlertTriangle, MoreVertical, Eye, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AgendaTask, AgendaTaskStatus, Priority } from '@/lib/agenda/types';
import { TASK_STATUS_CONFIG, PRIORITY_CONFIG, isTaskOverdue, getAssigneeName } from '@/lib/agenda/types';



interface AgendaKanbanViewProps {
  tasks: AgendaTask[];
  onSelect: (task: AgendaTask) => void;
  onStatusChange: (task: AgendaTask, status: AgendaTaskStatus) => void;
  onEdit?: (task: AgendaTask) => void;
  onDelete?: (task: AgendaTask) => void;
}

export function AgendaKanbanView({ tasks, onSelect, onStatusChange, onEdit, onDelete }: AgendaKanbanViewProps) {
  const userColors = useUserColors();

  // Agrupar tareas por persona asignada
  const tasksByPerson = useMemo(() => {
    const grouped = new Map<string, AgendaTask[]>();

    // Columna "Sin asignar"
    grouped.set('__unassigned__', []);

    tasks.forEach((task) => {
      // Solo mostrar tareas no completadas/canceladas en kanban
      if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
        return;
      }

      const key = task.assignedToName || '__unassigned__';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(task);
    });

    // Ordenar tareas dentro de cada columna por prioridad y fecha
    grouped.forEach((personTasks, key) => {
      personTasks.sort((a, b) => {
        // Primero por prioridad
        const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
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
    const nonEmpty = entries.filter(([key, tasks]) => tasks.length > 0);

    // Si no hay tareas en ningún lado, mostrar solo "Sin asignar"
    if (nonEmpty.length === 0) {
      return [['__unassigned__', []] as [string, AgendaTask[]]];
    }

    return nonEmpty;
  }, [tasksByPerson]);

  if (tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length === 0) {
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
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart1}20` }}
                >
                  <User className="h-4 w-4" style={{ color: userColors.chart1 }} />
                </div>
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
                const STATUS_LABEL_FALLBACK: Record<string, string> = {
                  pending: 'Pend.', in_progress: 'En prog.', waiting: 'Esp.', completed: 'Comp.', cancelled: 'Canc.',
                };
                const statusConfig = TASK_STATUS_CONFIG[task.status as AgendaTaskStatus] ?? {
                  bgColor: 'bg-muted',
                  color: 'text-muted-foreground',
                  labelShort: STATUS_LABEL_FALLBACK[task.status] || task.status,
                };
                const priorityConfig = PRIORITY_CONFIG[task.priority as Priority];
                const overdue = isTaskOverdue(task);
                const dueToday = task.dueDate && isToday(new Date(task.dueDate));

                return (
                  <Card
                    key={(task as any).uid || task.id}
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
                          (task.priority === 'URGENT' || task.priority === 'urgent')
                            ? userColors.kpiNegative
                            : (task.priority === 'HIGH' || task.priority === 'high')
                              ? userColors.chart4
                              : (task.priority === 'MEDIUM' || task.priority === 'medium')
                                ? userColors.chart1
                                : userColors.kpiNeutral,
                      }}
                    />

                    <CardContent className="p-3 pl-4">
                      <div className="flex items-start gap-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={task.status === 'COMPLETED'}
                            onCheckedChange={() => onStatusChange(task, 'COMPLETED')}
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
                          </div>
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
                              <DropdownMenuItem onClick={() => onStatusChange(task, 'COMPLETED')}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Marcar completada
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
