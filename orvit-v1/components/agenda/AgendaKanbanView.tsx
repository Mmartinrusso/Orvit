'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Calendar, AlertTriangle } from 'lucide-react';
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

const DEFAULT_COLORS = {
  chart1: '#6366f1',
  chart2: '#8b5cf6',
  chart3: '#ec4899',
  chart4: '#f59e0b',
  chart5: '#10b981',
  chart6: '#06b6d4',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};

interface AgendaKanbanViewProps {
  tasks: UnifiedTask[];
  onSelect: (task: UnifiedTask) => void;
  onStatusChange: (task: UnifiedTask, status: string) => void;
}

export function AgendaKanbanView({ tasks, onSelect, onStatusChange }: AgendaKanbanViewProps) {
  const userColors = DEFAULT_COLORS;

  // Agrupar tareas por persona asignada
  const tasksByPerson = useMemo(() => {
    const grouped = new Map<string, UnifiedTask[]>();
    grouped.set('__unassigned__', []);

    tasks.forEach((task) => {
      if (task.status === 'completed' || task.status === 'cancelled') return;

      const key = task.assigneeName === 'Sin asignar' ? '__unassigned__' : task.assigneeName;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(task);
    });

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
    grouped.forEach((personTasks) => {
      personTasks.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
    });

    return grouped;
  }, [tasks]);

  const columns = useMemo(() => {
    const entries = Array.from(tasksByPerson.entries());
    const nonEmpty = entries.filter(([, tasks]) => tasks.length > 0);
    if (nonEmpty.length === 0) return [['__unassigned__', []] as [string, UnifiedTask[]]];
    return nonEmpty;
  }, [tasksByPerson]);

  if (tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length === 0) {
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
          role="region"
          aria-label={`Columna: ${personName === '__unassigned__' ? 'Sin asignar' : personName} - ${personTasks.length} tarea${personTasks.length !== 1 ? 's' : ''}`}
          className="flex-shrink-0 w-[300px] flex flex-col bg-muted/30 rounded-lg"
        >
          {/* Column Header */}
          <div className="p-3 border-b bg-muted/50 rounded-t-lg">
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

          {/* Column Content */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-2">
              {personTasks.map((task) => {
                const statusConfig = UNIFIED_STATUS_CONFIG[task.status];
                const originConfig = ORIGIN_CONFIG[task.origin];
                const overdue = isUnifiedTaskOverdue(task);
                const dueToday = task.dueDate && isToday(new Date(task.dueDate));

                return (
                  <Card
                    key={task.uid}
                    role="button"
                    tabIndex={0}
                    aria-label={`Tarea: ${task.title}`}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md relative overflow-hidden'
                    )}
                    onClick={() => onSelect(task)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(task);
                      }
                    }}
                  >
                    {/* Priority indicator */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{
                        backgroundColor:
                          task.priority === 'urgent' ? userColors.kpiNegative
                            : task.priority === 'high' ? userColors.chart4
                              : task.priority === 'medium' ? userColors.chart1
                                : userColors.kpiNeutral,
                      }}
                    />

                    <CardContent className="p-3 pl-4">
                      <div className="flex items-start gap-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={false}
                            aria-label={`Completar tarea: ${task.title}`}
                            onCheckedChange={() => onStatusChange(task, 'completed')}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">{task.title}</p>

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {/* Badge de origen */}
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1"
                              style={{
                                color: originConfig.color,
                                backgroundColor: originConfig.bgColor,
                                borderColor: `${originConfig.color}30`,
                              }}
                            >
                              {originConfig.label}
                            </Badge>

                            <Badge className={cn(statusConfig.bgColor, statusConfig.color, 'text-xs')}>
                              {statusConfig.labelShort}
                            </Badge>

                            {task.dueDate && (
                              <div
                                className={cn(
                                  'flex items-center gap-1 text-xs',
                                  overdue && 'text-red-600 font-medium',
                                  dueToday && !overdue && 'text-amber-600'
                                )}
                              >
                                <Calendar className="h-3 w-3" />
                                {isToday(new Date(task.dueDate))
                                  ? `Hoy, ${formatDateTz(task.dueDate, 'HH:mm')}`
                                  : formatDateTz(task.dueDate, "d MMM, HH:mm")}
                              </div>
                            )}

                            {overdue && (
                              <AlertTriangle className="h-3.5 w-3.5" style={{ color: userColors.kpiNegative }} />
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {personTasks.length === 0 && (
                <div role="status" className="text-center py-8 text-sm text-muted-foreground">
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
