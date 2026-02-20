'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  PlayCircle,
  CheckCircle,
  Lock,
  FileWarning,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DayTask {
  id: number;
  type: 'task' | 'fixed_task' | 'work_order' | 'checklist';
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  scheduledTime?: string;
  dueDate?: string;
  machine?: {
    id: number;
    name: string;
  };
  estimatedDuration?: number;
  progress?: number;
  requiresLOTO?: boolean;
  requiresPTW?: boolean;
  skillWarnings?: string[];
}

interface MobileDayTaskProps {
  task: DayTask;
  onStart?: (task: DayTask) => void;
  onComplete?: (task: DayTask) => void;
  onViewDetails?: (task: DayTask) => void;
}

const typeConfig = {
  task: { label: 'Tarea', icon: ClipboardCheck, color: 'bg-primary' },
  fixed_task: { label: 'Tarea Fija', icon: Clock, color: 'bg-muted-foreground' },
  work_order: { label: 'OT', icon: Wrench, color: 'bg-success' },
  checklist: { label: 'Checklist', icon: ClipboardCheck, color: 'bg-warning-muted-foreground' },
};

const priorityConfig = {
  low: { label: 'Baja', color: 'bg-muted text-foreground' },
  medium: { label: 'Media', color: 'bg-info-muted text-info-muted-foreground' },
  high: { label: 'Alta', color: 'bg-warning-muted text-warning-muted-foreground' },
  urgent: { label: 'Urgente', color: 'bg-destructive/10 text-destructive' },
};

const statusConfig = {
  pending: { label: 'Pendiente', color: 'bg-muted text-foreground' },
  approved: { label: 'Aprobada', color: 'bg-info-muted text-info-muted-foreground' },
  in_progress: { label: 'En Progreso', color: 'bg-warning-muted text-warning-muted-foreground' },
  completed: { label: 'Completada', color: 'bg-success-muted text-success-muted-foreground' },
};

export function MobileDayTask({
  task,
  onStart,
  onComplete,
  onViewDetails,
}: MobileDayTaskProps) {
  const TypeIcon = typeConfig[task.type]?.icon || ClipboardCheck;
  const isInProgress = task.status === 'in_progress';
  const isCompleted = task.status === 'completed';
  const canStart = task.status === 'pending' || task.status === 'approved';

  return (
    <Card
      className={cn(
        'transition-all active:scale-[0.98] cursor-pointer',
        isInProgress && 'ring-2 ring-warning-muted-foreground bg-warning-muted/50',
        isCompleted && 'opacity-60'
      )}
      onClick={() => onViewDetails?.(task)}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('p-1.5 rounded', typeConfig[task.type]?.color || 'bg-muted-foreground')}>
              <TypeIcon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm line-clamp-1">{task.title}</h3>
              {task.machine && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {task.machine.name}
                </p>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="outline" className={priorityConfig[task.priority]?.color}>
            {priorityConfig[task.priority]?.label}
          </Badge>
          <Badge variant="outline" className={statusConfig[task.status as keyof typeof statusConfig]?.color}>
            {statusConfig[task.status as keyof typeof statusConfig]?.label}
          </Badge>
          {task.requiresLOTO && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive">
              <Lock className="h-3 w-3 mr-1" />
              LOTO
            </Badge>
          )}
          {task.requiresPTW && (
            <Badge variant="outline" className="bg-warning-muted text-warning-muted-foreground">
              <FileWarning className="h-3 w-3 mr-1" />
              PTW
            </Badge>
          )}
        </div>

        {/* Time info */}
        {(task.scheduledTime || task.dueDate) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Clock className="h-3 w-3" />
            {task.scheduledTime && <span>Programado: {task.scheduledTime}</span>}
            {task.dueDate && (
              <span>Vence: {format(new Date(task.dueDate), 'HH:mm', { locale: es })}</span>
            )}
          </div>
        )}

        {/* Progress */}
        {isInProgress && task.progress !== undefined && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">{task.progress}%</span>
            </div>
            <Progress value={task.progress} className="h-2" />
          </div>
        )}

        {/* Skill warnings */}
        {task.skillWarnings && task.skillWarnings.length > 0 && (
          <div className="bg-warning-muted border border-warning-muted-foreground/20 rounded p-2 mb-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-xs text-warning-muted-foreground">
                <p className="font-medium">Advertencias de calificación:</p>
                <ul className="list-disc list-inside mt-1">
                  {task.skillWarnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!isCompleted && (
          <div className="flex gap-2">
            {canStart && onStart && (
              <Button
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onStart(task);
                }}
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                Iniciar
              </Button>
            )}
            {isInProgress && onComplete && (
              <Button
                size="sm"
                variant="default"
                className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(task);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Completar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MobileDayTask;
