'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  ListTodo,
} from 'lucide-react';
import { isToday } from 'date-fns';
import { formatDateTz } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { UnifiedTask } from '@/types/unified-task';
import {
  UNIFIED_STATUS_CONFIG,
  UNIFIED_PRIORITY_CONFIG,
  ORIGIN_CONFIG,
  isUnifiedTaskOverdue,
} from '@/types/unified-task';
import { UnifiedTaskDetailPanel } from './UnifiedTaskDetailPanel';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#ef4444', '#84cc16', '#f97316'
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface AgendaListViewProps {
  tasks: UnifiedTask[];
  onStatusChange: (task: UnifiedTask, status: string) => void;
  onEdit: (task: UnifiedTask) => void;
  onDelete: (task: UnifiedTask) => void;
}

export function AgendaListView({
  tasks,
  onStatusChange,
  onEdit,
  onDelete,
}: AgendaListViewProps) {
  const [selectedTask, setSelectedTask] = useState<UnifiedTask | null>(null);

  if (tasks.length === 0) {
    return (
      <Card className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <ListTodo className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No hay tareas</h3>
          <p className="text-muted-foreground text-sm">
            No se encontraron tareas con los filtros actuales
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Lista master */}
      <div className="flex-1 min-w-0">
        <ScrollArea className="h-full">
          <div className="space-y-1 pr-4">
            {tasks.map((task) => {
              const overdue = isUnifiedTaskOverdue(task);
              const statusConfig = UNIFIED_STATUS_CONFIG[task.status];
              const priorityConfig = UNIFIED_PRIORITY_CONFIG[task.priority];
              const originConfig = ORIGIN_CONFIG[task.origin];
              const isCompleted = task.status === 'completed';
              const isSelected = selectedTask?.uid === task.uid;

              return (
                <div
                  key={task.uid}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver detalles de tarea: ${task.title}`}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border group',
                    isSelected
                      ? 'bg-primary/5 border-primary/30'
                      : 'hover:bg-muted/50 border-transparent',
                    overdue && !isCompleted && !isSelected && 'border-l-2 border-l-red-500',
                    isCompleted && 'opacity-60'
                  )}
                  onClick={() => setSelectedTask(task)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTask(task);
                    }
                  }}
                >
                  {/* Avatar */}
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback
                      style={{ backgroundColor: getAvatarColor(task.assigneeName) }}
                      className="text-white text-xs"
                    >
                      {getInitials(task.assigneeName)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        'text-sm font-medium truncate',
                        isCompleted && 'line-through'
                      )}>
                        {task.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {/* Origen badge */}
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1.5"
                        style={{
                          color: originConfig.color,
                          backgroundColor: originConfig.bgColor,
                          borderColor: `${originConfig.color}30`,
                        }}
                      >
                        {originConfig.label}
                      </Badge>

                      {/* Priority */}
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] h-4 px-1.5', priorityConfig.color, priorityConfig.borderColor)}
                      >
                        {priorityConfig.label}
                      </Badge>

                      {/* Assignee name */}
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {task.assigneeName}
                      </span>

                      {/* Due date */}
                      {task.dueDate && (
                        <span className={cn(
                          'text-xs flex items-center gap-1',
                          overdue && !isCompleted ? 'text-red-500 font-medium' : 'text-muted-foreground'
                        )}>
                          <Clock className="h-3 w-3" />
                          {isToday(new Date(task.dueDate))
                            ? `Hoy, ${formatDateTz(task.dueDate, 'HH:mm')}`
                            : formatDateTz(task.dueDate, 'd MMM')}
                        </span>
                      )}

                      {overdue && !isCompleted && (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {!isCompleted && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            aria-label="Marcar en progreso"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStatusChange(task, 'in_progress');
                            }}
                          >
                            <PlayCircle className="h-4 w-4 text-blue-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>En progreso</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            aria-label="Completar tarea"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStatusChange(task, 'completed');
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Completar</TooltipContent>
                      </Tooltip>
                    </div>
                  )}

                  {/* Status dot */}
                  <div className={cn('h-2 w-2 rounded-full flex-shrink-0', statusConfig.dotColor)} />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Detail panel */}
      {selectedTask && (
        <UnifiedTaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEdit={() => onEdit(selectedTask)}
          onDelete={() => onDelete(selectedTask)}
          onStatusChange={(status) => onStatusChange(selectedTask, status)}
        />
      )}
    </div>
  );
}
