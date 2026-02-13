'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Lock,
  FileWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DaySummary {
  totalTasks: number;
  completed: number;
  inProgress: number;
  pending: number;
  highPriority: number;
  activeLOTOs: number;
  activePTWs: number;
}

interface MobileDaySummaryProps {
  summary: DaySummary;
  isToday: boolean;
}

export function MobileDaySummary({ summary, isToday }: MobileDaySummaryProps) {
  const completionPercent = summary.totalTasks > 0
    ? Math.round((summary.completed / summary.totalTasks) * 100)
    : 0;

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
      <CardContent className="p-4">
        {/* Main progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold">
                {isToday ? 'Tu día' : 'Resumen'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {summary.completed} de {summary.totalTasks} tareas completadas
              </p>
            </div>
            <div className="text-3xl font-bold text-primary">
              {completionPercent}%
            </div>
          </div>
          <Progress value={completionPercent} className="h-3" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-white/50 rounded-lg">
            <div className="flex justify-center mb-1">
              <Clock className="h-4 w-4 text-gray-500" />
            </div>
            <p className="text-lg font-bold">{summary.pending}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </div>

          <div className="text-center p-2 bg-white/50 rounded-lg">
            <div className="flex justify-center mb-1">
              <div className="h-4 w-4 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <p className="text-lg font-bold">{summary.inProgress}</p>
            <p className="text-xs text-muted-foreground">En curso</p>
          </div>

          <div className="text-center p-2 bg-white/50 rounded-lg">
            <div className="flex justify-center mb-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-lg font-bold">{summary.completed}</p>
            <p className="text-xs text-muted-foreground">Listas</p>
          </div>

          <div className="text-center p-2 bg-white/50 rounded-lg">
            <div className="flex justify-center mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-lg font-bold">{summary.highPriority}</p>
            <p className="text-xs text-muted-foreground">Urgentes</p>
          </div>
        </div>

        {/* Active safety items */}
        {(summary.activeLOTOs > 0 || summary.activePTWs > 0) && (
          <div className="mt-3 pt-3 border-t border-primary/20">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Seguridad activa:
            </p>
            <div className="flex gap-2">
              {summary.activeLOTOs > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-700">
                  <Lock className="h-3 w-3 mr-1" />
                  {summary.activeLOTOs} LOTO activos
                </Badge>
              )}
              {summary.activePTWs > 0 && (
                <Badge variant="outline" className="bg-orange-100 text-orange-700">
                  <FileWarning className="h-3 w-3 mr-1" />
                  {summary.activePTWs} PTW activos
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MobileDaySummary;
