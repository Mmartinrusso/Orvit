'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Clock, AlertTriangle, UserX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FailureFilters } from './FailureFiltersBar';

interface FailureStats {
  totalOpen: number;
  recurrences: number;
  withDowntime: number;
  unassigned: number;
}

interface FailureKPIsProps {
  activeFilter?: FailureFilters;
  onFilterChange?: (filters: FailureFilters) => void;
}

type KPIKey = 'totalOpen' | 'recurrences' | 'withDowntime' | 'unassigned';

interface KpiItem {
  key: KPIKey;
  title: string;
  icon: typeof AlertCircle;
  iconColor: string;
  filter: Partial<FailureFilters>;
}

const kpiDefinitions: KpiItem[] = [
  {
    key: 'totalOpen',
    title: 'Total Abiertas',
    icon: AlertCircle,
    iconColor: 'text-info-muted-foreground',
    filter: { status: ['REPORTED', 'IN_PROGRESS'] },
  },
  {
    key: 'recurrences',
    title: 'Reincidencias',
    icon: AlertTriangle,
    iconColor: 'text-warning-muted-foreground',
    filter: { status: ['REPORTED', 'IN_PROGRESS'] },
  },
  {
    key: 'withDowntime',
    title: 'Con Downtime',
    icon: Clock,
    iconColor: 'text-destructive',
    filter: { causedDowntime: true, status: ['REPORTED', 'IN_PROGRESS'] },
  },
  {
    key: 'unassigned',
    title: 'Sin Asignar',
    icon: UserX,
    iconColor: 'text-muted-foreground',
    filter: { hasWorkOrder: false, status: ['REPORTED', 'IN_PROGRESS'] },
  },
];

/**
 * KPIs clickeables del dashboard de Fallas
 * Al hacer click, aplica filtros correspondientes
 */
export function FailureKPIs({ activeFilter, onFilterChange }: FailureKPIsProps) {
  const { data: stats, isLoading } = useQuery<FailureStats>({
    queryKey: ['failure-stats'],
    queryFn: async () => {
      const res = await fetch('/api/failure-occurrences/stats');
      if (!res.ok) throw new Error('Error al cargar estadísticas');
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <Skeleton className="h-3 w-[80px] mb-2" />
                  <Skeleton className="h-7 w-[40px]" />
                </div>
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Check if a KPI filter is active
  const isKPIActive = (kpiKey: KPIKey): boolean => {
    if (!activeFilter) return false;

    switch (kpiKey) {
      case 'totalOpen':
        return (
          activeFilter.status?.includes('REPORTED') &&
          activeFilter.status?.includes('IN_PROGRESS') &&
          !activeFilter.causedDowntime &&
          activeFilter.hasWorkOrder === undefined
        );
      case 'withDowntime':
        return activeFilter.causedDowntime === true;
      case 'unassigned':
        return activeFilter.hasWorkOrder === false;
      default:
        return false;
    }
  };

  const handleKPIClick = (kpi: KpiItem) => {
    if (!onFilterChange) return;

    // If already active, clear filters
    if (isKPIActive(kpi.key)) {
      onFilterChange({});
    } else {
      // Apply KPI filter (clear other filters first)
      onFilterChange(kpi.filter);
    }
  };

  const getValue = (key: KPIKey): number => {
    if (!stats) return 0;
    return stats[key] || 0;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpiDefinitions.map((kpi) => {
        const Icon = kpi.icon;
        const isActive = isKPIActive(kpi.key);
        const value = getValue(kpi.key);

        return (
          <Card
            key={kpi.key}
            className={cn(
              'cursor-pointer transition-all duration-200 border-border bg-card',
              'hover:shadow-md hover:border-border/80',
              isActive && 'ring-2 ring-ring/30 border-ring/50 bg-accent/30 shadow-sm'
            )}
            onClick={() => handleKPIClick(kpi)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate mb-1">
                    {kpi.title}
                  </p>
                  <p className="text-2xl font-normal text-foreground tabular-nums">
                    {value}
                  </p>
                </div>
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-xl',
                  'bg-muted/50',
                  isActive && 'bg-primary/10'
                )}>
                  <Icon className={cn('w-5 h-5', kpi.iconColor)} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
