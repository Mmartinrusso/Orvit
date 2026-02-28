'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { Users, User } from 'lucide-react';
import { BarChart } from '../charts/BarChart';
import { ProgressBar } from '../charts/ProgressBar';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

export function TeamWorkloadWidget({
  companyId,
  sectorId,
  onRemove,
  isEditMode,
  style = 'bar-chart',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['team-workload', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sectorId) params.append('sectorId', sectorId.toString());

      const response = await fetch(`/api/maintenance/team-workload?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching team workload');
      return response.json();
    },
    staleTime: 2 * 60_000,
    enabled: !!companyId,
  });

  const workload = data?.workload || [];

  const barData = workload.slice(0, 8).map((w: any) => ({
    label: w.userName?.split(' ')[0] || `User ${w.userId}`,
    value: w.total,
  }));

  return (
    <WidgetWrapper
      title="Carga del Equipo"
      icon={<Users className="h-4 w-4 text-info-muted-foreground" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {workload.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Sin técnicos asignados</p>
        </div>
      ) : style === 'bar-chart' ? (
        <BarChart
          data={barData}
          horizontal={true}
          showLabels={true}
          showValues={true}
          colors={['bg-chart-1', 'bg-chart-3', 'bg-chart-5', 'bg-info', 'bg-primary']}
        />
      ) : (
        <div className="space-y-3">
          {workload.slice(0, 6).map((w: any) => {
            const maxLoad = Math.max(...workload.map((x: any) => x.total), 1);
            return (
              <div key={w.userId} className="space-y-1">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-medium truncate flex-1">{w.userName}</span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span title="Pendientes">{w.pending}p</span>
                    <span title="En progreso">{w.inProgress}a</span>
                    <span title="Completadas esta semana" className="text-success">{w.completedThisWeek}c</span>
                  </div>
                </div>
                <ProgressBar
                  value={w.total}
                  max={maxLoad}
                  showValue={false}
                  showPercentage={false}
                  size="sm"
                  color={w.total > maxLoad * 0.8 ? 'bg-destructive' : w.total > maxLoad * 0.5 ? 'bg-warning' : 'bg-info'}
                />
              </div>
            );
          })}
        </div>
      )}
    </WidgetWrapper>
  );
}
