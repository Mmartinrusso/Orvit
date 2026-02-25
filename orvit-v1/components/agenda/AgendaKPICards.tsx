'use client';

import { useState } from 'react';
import { useUserColors } from '@/hooks/use-user-colors';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CalendarDays, CheckCircle2, Users, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgendaStats } from '@/lib/agenda/types';


interface AgendaKPICardsProps {
  stats?: AgendaStats;
  onKpiClick?: (filter: string) => void;
}

export function AgendaKPICards({ stats, onKpiClick }: AgendaKPICardsProps) {
  const userColors = useUserColors();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  if (!stats) {
    return (
      <>
        {/* Mobile skeleton toggle */}
        <div className="md:hidden h-10 bg-muted/40 rounded-lg border animate-pulse" />
        {/* Desktop skeleton grid */}
        <div className="hidden md:grid md:grid-cols-5 gap-3 md:gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile: compact summary row + toggle */}
      <button
        className="md:hidden w-full relative flex items-center justify-center px-3 py-2.5 bg-muted/40 rounded-lg border text-sm transition-colors hover:bg-muted/60"
        onClick={() => setMobileExpanded((v) => !v)}
      >
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: userColors.chart1 }} />
            <span className="font-semibold text-foreground">{stats.pending}</span>
            <span>pendientes</span>
          </span>
          {stats.overdue > 0 && (
            <span className="flex items-center gap-1.5" style={{ color: userColors.kpiNegative }}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-semibold">{stats.overdue}</span>
              <span>vencidas</span>
            </span>
          )}
          {stats.dueToday > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" style={{ color: userColors.chart4 }} />
              <span className="font-semibold text-foreground">{stats.dueToday}</span>
              <span>hoy</span>
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'absolute right-3 h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
            mobileExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* KPI Grid — siempre visible en desktop, colapsable en mobile */}
      <div
        className={cn(
          'grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4',
          !mobileExpanded && 'hidden md:grid'
        )}
      >
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
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Top Asignados</p>
            </div>
            {stats.topAssignees.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin asignaciones</p>
            ) : (
              <div className="space-y-1">
                {stats.topAssignees.slice(0, 3).map((assignee) => (
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
    </>
  );
}
