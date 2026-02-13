'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CalendarDays, CheckCircle2, Users } from 'lucide-react';
import type { AgendaStats } from '@/lib/agenda/types';

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

interface AgendaKPICardsProps {
  stats?: AgendaStats;
  onKpiClick?: (filter: string) => void;
}

export function AgendaKPICards({ stats, onKpiClick }: AgendaKPICardsProps) {
  const userColors = DEFAULT_COLORS;

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {/* Pendientes */}
      <Card
        className="cursor-pointer transition-all hover:shadow-md"
        onClick={() => onKpiClick?.('pending')}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Pendientes</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
              {stats.urgentPending > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium" style={{ color: userColors.chart4 }}>
                    {stats.urgentPending}
                  </span>{' '}
                  urgentes
                </p>
              )}
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.chart1}15` }}
            >
              <Clock className="h-5 w-5" style={{ color: userColors.chart1 }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vencidas */}
      <Card
        className="cursor-pointer transition-all hover:shadow-md"
        onClick={() => onKpiClick?.('overdue')}
        style={
          stats.overdue > 0
            ? {
                borderColor: `${userColors.kpiNegative}50`,
                backgroundColor: `${userColors.kpiNegative}08`,
              }
            : {}
        }
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Vencidas</p>
              <p
                className="text-2xl font-bold"
                style={{ color: stats.overdue > 0 ? userColors.kpiNegative : undefined }}
              >
                {stats.overdue}
              </p>
              {stats.overdue > 0 && (
                <p className="text-xs mt-1" style={{ color: userColors.kpiNegative }}>
                  Requieren atención
                </p>
              )}
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.kpiNegative}15` }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: userColors.kpiNegative }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Para Hoy */}
      <Card
        className="cursor-pointer transition-all hover:shadow-md"
        onClick={() => onKpiClick?.('today')}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Para Hoy</p>
              <p className="text-2xl font-bold">{stats.dueToday}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.dueToday === 0 ? 'Día libre' : 'tareas'}
              </p>
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.chart4}15` }}
            >
              <CalendarDays className="h-5 w-5" style={{ color: userColors.chart4 }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completadas Hoy */}
      <Card className="cursor-pointer transition-all hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Completadas Hoy
              </p>
              <p className="text-2xl font-bold" style={{ color: userColors.kpiPositive }}>
                {stats.completedToday}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.completed} en total
              </p>
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.kpiPositive}15` }}
            >
              <CheckCircle2 className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Asignados */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Top Asignados</p>
          </div>
          {stats.topAssignees.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin asignaciones</p>
          ) : (
            <div className="space-y-1">
              {stats.topAssignees.slice(0, 3).map((assignee, idx) => (
                <div key={assignee.name} className="flex justify-between items-center text-sm">
                  <span className="truncate max-w-[120px]">{assignee.name}</span>
                  <Badge variant="outline" className="ml-2">
                    {assignee.count}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
