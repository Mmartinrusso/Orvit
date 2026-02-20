'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  X,
  Edit,
  Trash2,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  PlayCircle,
  XCircle,
  AlertTriangle,
  Bell,
  MessageSquare,
  Mic,
  Globe,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AgendaTask, AgendaTaskStatus } from '@/lib/agenda/types';
import {
  TASK_STATUS_CONFIG,
  PRIORITY_CONFIG,
  SOURCE_CONFIG,
  isTaskOverdue,
  getDaysOverdue,
  getAssigneeName,
  getAssigneeType,
} from '@/lib/agenda/types';


interface AgendaDetailPanelProps {
  task: AgendaTask;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: AgendaTaskStatus) => void;
}

export function AgendaDetailPanel({
  task,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
}: AgendaDetailPanelProps) {
  const userColors = useUserColors();

  const statusConfig = TASK_STATUS_CONFIG[task.status];
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const sourceConfig = SOURCE_CONFIG[task.source];
  const overdue = isTaskOverdue(task);
  const daysOverdue = getDaysOverdue(task);
  const assigneeType = getAssigneeType(task);

  return (
    <Card className="w-[400px] flex flex-col h-full">
      {/* Header */}
      <CardHeader className="pb-3 border-b">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg leading-tight">{task.title}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={cn(statusConfig.bgColor, statusConfig.color)}>
                {statusConfig.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn(priorityConfig.color, priorityConfig.borderColor)}
              >
                {priorityConfig.label}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Content */}
      <ScrollArea className="flex-1">
        <CardContent className="pt-4 space-y-4">
          {/* Alerta de vencida */}
          {overdue && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
            <div
              className="p-3 rounded-lg flex items-center gap-2"
              style={{
                backgroundColor: `${userColors.kpiNegative}15`,
                borderColor: `${userColors.kpiNegative}40`,
              }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: userColors.kpiNegative }} />
              <div>
                <p className="font-medium text-sm" style={{ color: userColors.kpiNegative }}>
                  Tarea vencida
                </p>
                <p className="text-xs text-muted-foreground">
                  {daysOverdue} día{daysOverdue !== 1 ? 's' : ''} de atraso
                </p>
              </div>
            </div>
          )}

          {/* Descripción */}
          {task.description && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Descripción
              </h4>
              <p className="text-sm whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <Separator />

          {/* Info */}
          <div className="space-y-3">
            {/* Asignado a */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Asignado a</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{getAssigneeName(task)}</span>
                {assigneeType && (
                  <Badge variant="outline" className="text-xs">
                    {assigneeType === 'user' ? 'Usuario' : 'Contacto'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Fecha de vencimiento */}
            {task.dueDate && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Vence</span>
                </div>
                <span
                  className={cn('text-sm font-medium', overdue && 'text-destructive')}
                >
                  {format(new Date(task.dueDate), "EEEE d 'de' MMMM, HH:mm 'hs'", { locale: es })}
                </span>
              </div>
            )}

            {/* Origen */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {task.source === 'DISCORD_VOICE' ? (
                  <Mic className="h-4 w-4" />
                ) : task.source === 'DISCORD_TEXT' ? (
                  <MessageSquare className="h-4 w-4" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                <span>Origen</span>
              </div>
              <span className="text-sm">{sourceConfig.label}</span>
            </div>

            {/* Creada */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Creada</span>
              </div>
              <span className="text-sm">
                {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true, locale: es })}
              </span>
            </div>

            {/* Completada */}
            {task.completedAt && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Completada</span>
                </div>
                <span className="text-sm">
                  {format(new Date(task.completedAt), "d MMM ''yy HH:mm", { locale: es })}
                </span>
              </div>
            )}
          </div>

          {/* Recordatorios */}
          {task.reminders && task.reminders.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5" />
                  Recordatorios ({task.reminders.length})
                </h4>
                <div className="space-y-2">
                  {task.reminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className={cn(
                        'p-2 rounded-lg border text-sm',
                        reminder.isSent ? 'bg-muted/50' : ''
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{format(new Date(reminder.remindAt), "d MMM HH:mm", { locale: es })}</span>
                        {reminder.isSent ? (
                          <Badge variant="secondary" className="text-xs">
                            Enviado
                          </Badge>
                        ) : (
                          <Badge className="text-xs">Pendiente</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Nota de completado */}
          {task.completedNote && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Nota de cierre
                </h4>
                <p className="text-sm">{task.completedNote}</p>
              </div>
            </>
          )}
        </CardContent>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t space-y-2">
        {/* Quick status buttons */}
        {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
          <div className="flex gap-2">
            {task.status === 'PENDING' && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onStatusChange('IN_PROGRESS')}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                En progreso
              </Button>
            )}
            <Button
              size="sm"
              className="flex-1"
              style={{ backgroundColor: userColors.kpiPositive }}
              onClick={() => onStatusChange('COMPLETED')}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Completar
            </Button>
          </div>
        )}

        {/* Edit/Delete */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
