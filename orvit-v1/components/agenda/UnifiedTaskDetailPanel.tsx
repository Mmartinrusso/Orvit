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
  AlertTriangle,
  Bell,
  MessageSquare,
  Mic,
  Globe,
  FileText,
  Tag,
  ListChecks,
  Paperclip,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { UnifiedTask } from '@/types/unified-task';
import {
  UNIFIED_STATUS_CONFIG,
  UNIFIED_PRIORITY_CONFIG,
  ORIGIN_CONFIG,
  isUnifiedTaskOverdue,
} from '@/types/unified-task';
import { SOURCE_CONFIG } from '@/lib/agenda/types';



interface UnifiedTaskDetailPanelProps {
  task: UnifiedTask;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
}

export function UnifiedTaskDetailPanel({
  task,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
}: UnifiedTaskDetailPanelProps) {
  const userColors = useUserColors();
  const statusConfig = UNIFIED_STATUS_CONFIG[task.status];
  const priorityConfig = UNIFIED_PRIORITY_CONFIG[task.priority];
  const originConfig = ORIGIN_CONFIG[task.origin];
  const overdue = isUnifiedTaskOverdue(task);

  // Datos específicos según origen
  const agendaTask = task.originalAgendaTask;
  const regularTask = task.originalRegularTask;

  // Calcular días de atraso
  const daysOverdue = (() => {
    if (!overdue || !task.dueDate) return 0;
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    return Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  })();

  return (
    <Card className="w-[400px] flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <CardHeader className="pb-3 border-b">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg leading-tight">{task.title}</CardTitle>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Badge de origen */}
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  color: originConfig.color,
                  backgroundColor: originConfig.bgColor,
                  borderColor: `${originConfig.color}30`,
                }}
              >
                {originConfig.label}
              </Badge>
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
          <Button variant="ghost" size="icon" aria-label="Cerrar panel de detalles" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Content */}
      <ScrollArea className="flex-1">
        <CardContent className="pt-4 space-y-4">
          {/* Alerta de vencida */}
          {overdue && task.status !== 'completed' && task.status !== 'cancelled' && (
            <div
              role="alert"
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

          {/* Info común */}
          <div className="space-y-3">
            {/* Asignado a */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Asignado a</span>
              </div>
              <span className="text-sm font-medium">{task.assigneeName}</span>
            </div>

            {/* Fecha de vencimiento */}
            {task.dueDate && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Vence</span>
                </div>
                <span className={cn('text-sm font-medium', overdue && 'text-destructive')}>
                  {format(new Date(task.dueDate), "EEEE d 'de' MMMM, HH:mm 'hs'", { locale: es })}
                </span>
              </div>
            )}

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
          </div>

          {/* === Campos específicos de Agenda === */}
          {agendaTask && (
            <>
              <Separator />
              <div className="space-y-3">
                {/* Origen */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {agendaTask.source === 'DISCORD_VOICE' ? (
                      <Mic className="h-4 w-4" />
                    ) : agendaTask.source === 'DISCORD_TEXT' ? (
                      <MessageSquare className="h-4 w-4" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    <span>Origen</span>
                  </div>
                  <span className="text-sm">{SOURCE_CONFIG[agendaTask.source].label}</span>
                </div>

                {/* Completada */}
                {agendaTask.completedAt && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Completada</span>
                    </div>
                    <span className="text-sm">
                      {format(new Date(agendaTask.completedAt), "d MMM ''yy HH:mm", { locale: es })}
                    </span>
                  </div>
                )}
              </div>

              {/* Recordatorios */}
              {agendaTask.reminders && agendaTask.reminders.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5" />
                      Recordatorios ({agendaTask.reminders.length})
                    </h4>
                    <div className="space-y-2">
                      {agendaTask.reminders.map((reminder) => (
                        <div
                          key={reminder.id}
                          className={cn(
                            'p-2 rounded-lg border text-sm',
                            reminder.isSent ? 'bg-muted/50' : ''
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span>{format(new Date(reminder.remindAt), 'd MMM HH:mm', { locale: es })}</span>
                            {reminder.isSent ? (
                              <Badge variant="secondary" className="text-xs">Enviado</Badge>
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
              {agendaTask.completedNote && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Nota de cierre
                    </h4>
                    <p className="text-sm">{agendaTask.completedNote}</p>
                  </div>
                </>
              )}
            </>
          )}

          {/* === Campos específicos de Task Regular === */}
          {regularTask && (
            <>
              <Separator />
              <div className="space-y-3">
                {/* Progreso */}
                {regularTask.progress > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Progreso</span>
                      <span className="text-xs font-medium">{regularTask.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          backgroundColor: userColors.chart1,
                          width: `${regularTask.progress}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Tags */}
                {regularTask.tags && regularTask.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5" />
                      Etiquetas
                    </h4>
                    <div className="flex gap-1 flex-wrap">
                      {regularTask.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subtareas */}
                {regularTask.subtasks && regularTask.subtasks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                      <ListChecks className="h-3.5 w-3.5" />
                      Subtareas ({regularTask.subtasks.filter(s => s.completed).length}/{regularTask.subtasks.length})
                    </h4>
                    <div className="space-y-1">
                      {regularTask.subtasks.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2 text-sm">
                          <div className={cn(
                            'h-4 w-4 rounded border flex items-center justify-center',
                            sub.completed ? 'bg-success-muted border-success-muted' : 'border-muted-foreground/30'
                          )}>
                            {sub.completed && <CheckCircle2 className="h-3 w-3 text-success" />}
                          </div>
                          <span className={cn(sub.completed && 'line-through text-muted-foreground')}>
                            {sub.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Archivos */}
                {regularTask.files && regularTask.files.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5" />
                      Archivos ({regularTask.files.length})
                    </h4>
                    <div className="space-y-1">
                      {regularTask.files.map((file) => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-info-muted-foreground hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {file.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t space-y-2">
        {task.status !== 'completed' && task.status !== 'cancelled' && (
          <div className="flex gap-2">
            {task.status === 'pending' && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onStatusChange('in_progress')}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                En progreso
              </Button>
            )}
            <Button
              size="sm"
              className="flex-1"
              style={{ backgroundColor: userColors.kpiPositive }}
              onClick={() => onStatusChange('completed')}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Completar
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            aria-label="Eliminar tarea"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
