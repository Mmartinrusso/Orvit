'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  PlayCircle,
  XCircle,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AgendaTask, AgendaTaskStatus, Priority } from '@/lib/agenda/types';
import {
  TASK_STATUS_CONFIG,
  PRIORITY_CONFIG,
  isTaskOverdue,
  getAssigneeName,
} from '@/lib/agenda/types';



// Mapeo para statuses unificados (lowercase) que no están en TASK_STATUS_CONFIG (uppercase)
const STATUS_LABEL_MAP: Record<string, { label: string; labelShort: string; bgColor: string; color: string }> = {
  'pending':     { label: 'Pendiente',  labelShort: 'Pend.',    bgColor: 'bg-muted', color: 'text-muted-foreground' },
  'in_progress': { label: 'En Progreso',labelShort: 'En prog.', bgColor: 'bg-info-muted',  color: 'text-info-muted-foreground'  },
  'waiting':     { label: 'Esperando',  labelShort: 'Esp.',     bgColor: 'bg-warning-muted', color: 'text-warning-muted-foreground' },
  'completed':   { label: 'Completada', labelShort: 'Comp.',    bgColor: 'bg-success-muted', color: 'text-success' },
  'cancelled':   { label: 'Cancelada',  labelShort: 'Canc.',    bgColor: 'bg-destructive/10',   color: 'text-destructive'   },
};

// Mapeo para prioridades unificadas (lowercase) que no están en PRIORITY_CONFIG (uppercase)
const PRIORITY_LABEL_MAP: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  'low':    { label: 'Baja',    color: 'text-muted-foreground',  bgColor: 'bg-muted',  borderColor: 'border-border'  },
  'medium': { label: 'Media',   color: 'text-info-muted-foreground',   bgColor: 'bg-info-muted',   borderColor: 'border-info-muted'   },
  'high':   { label: 'Alta',    color: 'text-warning-muted-foreground', bgColor: 'bg-warning-muted', borderColor: 'border-warning-muted' },
  'urgent': { label: 'Urgente', color: 'text-destructive',    bgColor: 'bg-destructive/10',    borderColor: 'border-destructive/30'    },
};

interface AgendaListViewProps {
  tasks: AgendaTask[];
  onSelect?: (task: AgendaTask) => void;
  onEdit: (task: AgendaTask) => void;
  onDelete: (task: AgendaTask) => void;
  onStatusChange: (task: AgendaTask, status: AgendaTaskStatus) => void;
}

export function AgendaListView({
  tasks,
  onSelect,
  onEdit,
  onDelete,
  onStatusChange,
}: AgendaListViewProps) {
  const userColors = useUserColors();

  if (tasks.length === 0) {
    return (
      <Card className="flex items-center justify-center h-64">
        <div className="text-center py-12">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No hay tareas</h3>
          <p className="text-muted-foreground text-sm">
            Crea tu primera tarea para comenzar a organizar tus pedidos
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-380px)]">
      {tasks.map((task) => {
        const statusConfig = TASK_STATUS_CONFIG[task.status as AgendaTaskStatus]
          ?? STATUS_LABEL_MAP[task.status]
          ?? { bgColor: 'bg-muted', color: 'text-muted-foreground', labelShort: task.status, label: task.status };
        const priorityConfig = PRIORITY_CONFIG[task.priority as Priority]
          ?? PRIORITY_LABEL_MAP[task.priority]
          ?? { color: 'text-muted-foreground', borderColor: 'border-border', bgColor: 'bg-muted', label: task.priority, labelShort: task.priority };
        const overdue = isTaskOverdue(task);
        const dueToday = task.dueDate && isToday(new Date(task.dueDate));

        return (
          <Card
            key={(task as any).uid || task.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              (task.status === 'COMPLETED' || task.status === 'completed') && 'opacity-60',
              (task.status === 'CANCELLED' || task.status === 'cancelled') && 'opacity-50'
            )}
            onClick={() => onSelect?.(task)}
          >
            {/* Left border accent */}
            <div
              className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-lg')}
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

            <CardContent className="p-4 pl-5">
              <div className="flex items-start gap-3">
                {/* Checkbox para completar rápido */}
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={task.status === 'COMPLETED' || task.status === 'completed'}
                    onCheckedChange={(checked) => {
                      onStatusChange(task, checked ? 'COMPLETED' : 'PENDING');
                    }}
                    disabled={task.status === 'CANCELLED' || task.status === 'cancelled'}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3
                        className={cn(
                          'font-medium text-sm',
                          (task.status === 'COMPLETED' || task.status === 'completed') && 'line-through text-muted-foreground'
                        )}
                      >
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={cn(statusConfig.bgColor, statusConfig.color, 'text-xs')}>
                        {statusConfig.labelShort}
                      </Badge>
                      {overdue && task.status !== 'COMPLETED' && task.status !== 'completed' && task.status !== 'CANCELLED' && task.status !== 'cancelled' && (
                        <Badge
                          variant="destructive"
                          className="text-xs gap-1"
                          style={{
                            backgroundColor: `${userColors.kpiNegative}20`,
                            color: userColors.kpiNegative,
                          }}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Vencida
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {/* Asignado */}
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[150px]">{getAssigneeName(task)}</span>
                    </div>

                    {/* Fecha */}
                    {task.dueDate && (
                      <div
                        className={cn(
                          'flex items-center gap-1',
                          overdue && 'text-destructive font-medium',
                          dueToday && !overdue && 'text-warning-muted-foreground font-medium'
                        )}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {isToday(new Date(task.dueDate))
                            ? `Hoy, ${format(new Date(task.dueDate), 'HH:mm')}`
                            : format(new Date(task.dueDate), "d MMM, HH:mm", { locale: es })}
                        </span>
                      </div>
                    )}

                    {/* Prioridad */}
                    <Badge
                      variant="outline"
                      className={cn('text-xs', priorityConfig.color, priorityConfig.borderColor)}
                    >
                      {priorityConfig.label}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Opciones">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelect?.(task)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalles
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(task)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />

                      {/* Quick status changes */}
                      {task.status !== 'COMPLETED' && task.status !== 'completed' && (
                        <DropdownMenuItem
                          onClick={() => onStatusChange(task, 'COMPLETED')}
                          className="text-success"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Marcar completada
                        </DropdownMenuItem>
                      )}
                      {(task.status === 'PENDING' || task.status === 'pending') && (
                        <DropdownMenuItem onClick={() => onStatusChange(task, 'IN_PROGRESS')}>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Marcar en progreso
                        </DropdownMenuItem>
                      )}
                      {task.status !== 'WAITING' && task.status !== 'waiting' && task.status !== 'COMPLETED' && task.status !== 'completed' && (
                        <DropdownMenuItem onClick={() => onStatusChange(task, 'WAITING')}>
                          <Clock className="h-4 w-4 mr-2" />
                          Marcar esperando
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(task)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
