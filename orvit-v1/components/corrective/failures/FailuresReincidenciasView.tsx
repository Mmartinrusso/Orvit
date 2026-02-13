'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Repeat,
  Wrench,
  Calendar,
  TrendingUp,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface FailureOccurrence {
  id: number;
  title: string;
  status: string;
  priority: string;
  reportedAt: string;
  resolvedAt?: string;
  causedDowntime: boolean;
  machine?: { id: number; name: string; code?: string };
  subcomponent?: { id: number; name: string };
  failureId?: number;
}

interface RecurrenceGroup {
  key: string;
  machineId: number;
  machineName: string;
  machineCode?: string;
  subcomponentId?: number;
  subcomponentName?: string;
  occurrences: FailureOccurrence[];
  totalCount: number;
  openCount: number;
  lastOccurrence: string;
  avgDaysBetween: number;
  totalDowntimes: number;
  workOrdersCreated: number;
}

type TimeWindow = '30' | '60' | '90' | '180' | '365';

interface FailuresReincidenciasViewProps {
  onSelectFailure?: (failureId: number) => void;
  className?: string;
}

export function FailuresReincidenciasView({
  onSelectFailure,
  className,
}: FailuresReincidenciasViewProps) {
  const { currentCompany } = useCompany();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('30');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [minOccurrences, setMinOccurrences] = useState<string>('2');

  // Fetch failures
  const { data: failures = [], isLoading, error, refetch } = useQuery({
    queryKey: ['failures-reincidencias', currentCompany?.id, timeWindow],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const dateFrom = subDays(new Date(), parseInt(timeWindow)).toISOString();
      const res = await fetch(
        `/api/failure-occurrences?companyId=${currentCompany.id}&dateFrom=${dateFrom}&take=500`
      );
      if (!res.ok) throw new Error('Error al cargar fallas');
      const data = await res.json();
      return data.data || data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Group failures by machine + subcomponent
  const recurrenceGroups = useMemo(() => {
    const groups = new Map<string, RecurrenceGroup>();

    failures.forEach((failure: FailureOccurrence) => {
      if (!failure.machine) return;

      const key = failure.subcomponent
        ? `${failure.machine.id}-${failure.subcomponent.id}`
        : `${failure.machine.id}-0`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          machineId: failure.machine.id,
          machineName: failure.machine.name,
          machineCode: failure.machine.code,
          subcomponentId: failure.subcomponent?.id,
          subcomponentName: failure.subcomponent?.name,
          occurrences: [],
          totalCount: 0,
          openCount: 0,
          lastOccurrence: failure.reportedAt,
          avgDaysBetween: 0,
          totalDowntimes: 0,
          workOrdersCreated: 0,
        });
      }

      const group = groups.get(key)!;
      group.occurrences.push(failure);
      group.totalCount++;

      if (failure.status === 'OPEN' || failure.status === 'IN_PROGRESS') {
        group.openCount++;
      }
      if (failure.causedDowntime) {
        group.totalDowntimes++;
      }
      if (failure.failureId) {
        group.workOrdersCreated++;
      }
      if (new Date(failure.reportedAt) > new Date(group.lastOccurrence)) {
        group.lastOccurrence = failure.reportedAt;
      }
    });

    // Calculate average days between occurrences
    groups.forEach((group) => {
      if (group.occurrences.length > 1) {
        const sorted = group.occurrences
          .map((o) => new Date(o.reportedAt).getTime())
          .sort((a, b) => a - b);

        let totalDays = 0;
        for (let i = 1; i < sorted.length; i++) {
          totalDays += (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24);
        }
        group.avgDaysBetween = Math.round(totalDays / (sorted.length - 1));
      }
    });

    // Filter by minimum occurrences and sort
    return Array.from(groups.values())
      .filter((g) => g.totalCount >= parseInt(minOccurrences))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [failures, minOccurrences]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Stats
  const stats = useMemo(() => ({
    totalGroups: recurrenceGroups.length,
    totalOccurrences: recurrenceGroups.reduce((sum, g) => sum + g.totalCount, 0),
    openIssues: recurrenceGroups.reduce((sum, g) => sum + g.openCount, 0),
    criticalGroups: recurrenceGroups.filter(g => g.totalCount >= 5).length,
  }), [recurrenceGroups]);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="text-red-500">Error al cargar reincidencias</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header con filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Repeat className="h-5 w-5 text-amber-500" />
            Fallas Reincidentes
          </h2>
          <p className="text-sm text-muted-foreground">
            Agrupadas por máquina y componente
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={timeWindow} onValueChange={(v) => setTimeWindow(v as TimeWindow)}>
            <SelectTrigger className="w-36 h-9">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="60">Últimos 60 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
              <SelectItem value="180">Últimos 6 meses</SelectItem>
              <SelectItem value="365">Último año</SelectItem>
            </SelectContent>
          </Select>

          <Select value={minOccurrences} onValueChange={setMinOccurrences}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2+ veces</SelectItem>
              <SelectItem value="3">3+ veces</SelectItem>
              <SelectItem value="5">5+ veces</SelectItem>
              <SelectItem value="10">10+ veces</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          <TrendingUp className="h-3 w-3" />
          {stats.totalGroups} grupos recurrentes
        </Badge>
        <Badge variant="outline" className="gap-1">
          {stats.totalOccurrences} ocurrencias totales
        </Badge>
        {stats.openIssues > 0 && (
          <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
            <AlertCircle className="h-3 w-3" />
            {stats.openIssues} abiertas
          </Badge>
        )}
        {stats.criticalGroups > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {stats.criticalGroups} críticos (5+)
          </Badge>
        )}
      </div>

      {/* Lista de grupos */}
      {recurrenceGroups.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Repeat className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">Sin reincidencias detectadas</p>
              <p className="text-sm text-muted-foreground">
                No hay fallas repetidas en el período seleccionado
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {recurrenceGroups.map((group) => (
            <RecurrenceGroupCard
              key={group.key}
              group={group}
              isExpanded={expandedGroups.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
              onSelectFailure={onSelectFailure}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RecurrenceGroupCardProps {
  group: RecurrenceGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectFailure?: (failureId: number) => void;
}

function RecurrenceGroupCard({
  group,
  isExpanded,
  onToggle,
  onSelectFailure,
}: RecurrenceGroupCardProps) {
  const severityColor = group.totalCount >= 10
    ? 'border-l-red-500'
    : group.totalCount >= 5
    ? 'border-l-amber-500'
    : 'border-l-blue-500';

  return (
    <Card className={cn('border-l-4', severityColor)}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}

                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    {group.machineName}
                    {group.machineCode && (
                      <span className="text-xs text-muted-foreground">
                        ({group.machineCode})
                      </span>
                    )}
                  </CardTitle>
                  {group.subcomponentName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Componente: {group.subcomponentName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={group.totalCount >= 5 ? 'destructive' : 'secondary'}
                  className="font-bold"
                >
                  {group.totalCount}x
                </Badge>

                {group.openCount > 0 && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">
                    {group.openCount} abiertas
                  </Badge>
                )}

                {group.totalDowntimes > 0 && (
                  <Badge variant="outline" className="border-red-500 text-red-600 text-xs">
                    {group.totalDowntimes} paradas
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última: {formatDistanceToNow(new Date(group.lastOccurrence), { addSuffix: true, locale: es })}
              </span>
              {group.avgDaysBetween > 0 && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Promedio: cada {group.avgDaysBetween} días
                </span>
              )}
              <span>
                {group.workOrdersCreated} OTs generadas
              </span>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-4">
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2 pl-7">
                {group.occurrences
                  .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
                  .map((occ) => (
                    <div
                      key={occ.id}
                      className="flex items-center justify-between p-2 rounded border bg-muted/30 hover:bg-muted/50 cursor-pointer"
                      onClick={() => onSelectFailure?.(occ.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            occ.status === 'OPEN' && 'border-blue-500 text-blue-600',
                            occ.status === 'IN_PROGRESS' && 'border-amber-500 text-amber-600',
                            occ.status === 'RESOLVED' && 'border-green-500 text-green-600'
                          )}
                        >
                          {occ.status}
                        </Badge>
                        <span className="text-xs font-medium truncate max-w-[200px]">
                          {occ.title || `Falla #${occ.id}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {occ.causedDowntime && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                            Parada
                          </Badge>
                        )}
                        {occ.failureId && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            OT #{occ.failureId}
                          </Badge>
                        )}
                        <span>
                          {format(new Date(occ.reportedAt), 'dd/MM/yy HH:mm', { locale: es })}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default FailuresReincidenciasView;
