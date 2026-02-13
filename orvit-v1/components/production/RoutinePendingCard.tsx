'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  CheckCircle2,
  Clock,
  Shield,
  Wrench,
  ClipboardCheck,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoutineCardData {
  templateId: number;
  code: string;
  name: string;
  type: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  draftId: number | null;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  workCenter?: { id: number; name: string } | null;
  minutesSinceStarted?: number | null;
  isOverdue?: boolean;
}

interface RoutinePendingCardProps {
  routine: RoutineCardData;
  onStart: (templateId: number) => void;
  onContinue: (draftId: number) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  SHIFT_START: <Sun className="h-4 w-4" />,
  SHIFT_END: <Moon className="h-4 w-4" />,
  SAFETY: <Shield className="h-4 w-4" />,
  SETUP: <Wrench className="h-4 w-4" />,
  '5S': <Sparkles className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  SHIFT_START: '#f59e0b',
  SHIFT_END: '#8b5cf6',
  SAFETY: '#ef4444',
  SETUP: '#3b82f6',
  '5S': '#10b981',
};

const typeLabels: Record<string, string> = {
  SHIFT_START: 'Inicio Turno',
  SHIFT_END: 'Fin Turno',
  SAFETY: 'Seguridad',
  SETUP: 'Setup',
  '5S': '5S',
};

export default function RoutinePendingCard({ routine, onStart, onContinue }: RoutinePendingCardProps) {
  const typeColor = typeColors[routine.type] || '#6366f1';
  const icon = typeIcons[routine.type] || <ClipboardCheck className="h-4 w-4" />;
  const typeLabel = typeLabels[routine.type] || routine.type.replace('_', ' ');

  const statusColor =
    routine.status === 'COMPLETED' ? '#10b981' :
    routine.isOverdue ? '#ef4444' :
    routine.status === 'IN_PROGRESS' ? '#f59e0b' :
    'transparent';

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200 hover:shadow-md border',
        routine.status === 'COMPLETED' && 'opacity-60',
        routine.isOverdue && routine.status === 'IN_PROGRESS' && 'border-red-300 dark:border-red-800'
      )}
    >
      {/* Left accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
        style={{ backgroundColor: statusColor }}
      />

      <CardContent className="p-4 pl-5">
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${typeColor}12`, color: typeColor }}
          >
            {icon}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{routine.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 font-medium"
                    style={{ borderColor: `${typeColor}40`, color: typeColor }}
                  >
                    {typeLabel}
                  </Badge>
                  {routine.workCenter && (
                    <span className="text-[11px] text-muted-foreground truncate">{routine.workCenter.name}</span>
                  )}
                </div>
              </div>

              {/* Status indicator for completed */}
              {routine.status === 'COMPLETED' && (
                <div className="h-7 w-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              )}
            </div>

            {/* Progress bar for IN_PROGRESS */}
            {routine.status === 'IN_PROGRESS' && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {routine.progress.completed} de {routine.progress.total} items
                  </span>
                  <span className="font-bold" style={{ color: routine.isOverdue ? '#ef4444' : '#f59e0b' }}>
                    {routine.progress.percentage}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${routine.progress.percentage}%`,
                      backgroundColor: routine.isOverdue ? '#ef4444' : '#f59e0b',
                    }}
                  />
                </div>
                {routine.minutesSinceStarted != null && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className={cn(
                      'text-xs',
                      routine.isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
                    )}>
                      {routine.minutesSinceStarted} min
                      {routine.isOverdue && ' · Vencida'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Action button */}
            {routine.status !== 'COMPLETED' && (
              <div className="mt-3">
                {routine.status === 'IN_PROGRESS' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 h-9 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/20"
                    onClick={() => routine.draftId && onContinue(routine.draftId)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Continuar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full gap-1.5 h-9"
                    onClick={() => onStart(routine.templateId)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Iniciar
                  </Button>
                )}
              </div>
            )}

            {/* Completed state */}
            {routine.status === 'COMPLETED' && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Completada hoy
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
