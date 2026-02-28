'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { Target, Clock } from 'lucide-react';
import { DonutChart } from '../charts/DonutChart';
import { BarChart } from '../charts/BarChart';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

export function SolutionEffectivenessWidget({
  companyId,
  sectorId,
  onRemove,
  isEditMode,
  style = 'donut-chart',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['solution-effectiveness', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sectorId) params.append('sectorId', sectorId.toString());

      const response = await fetch(`/api/maintenance/solution-effectiveness?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching solution effectiveness');
      return response.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!companyId,
  });

  const byOutcome = data?.byOutcome || {};
  const total = data?.total || 0;
  const avgMinutes = data?.avgResolutionMinutes || 0;

  const donutData = [
    { label: 'Funcionó', value: byOutcome['FUNCIONÓ'] || 0, color: 'hsl(var(--success))' },
    { label: 'Parcial', value: byOutcome['PARCIAL'] || 0, color: 'hsl(var(--warning))' },
    { label: 'No Funcionó', value: byOutcome['NO_FUNCIONÓ'] || 0, color: 'hsl(var(--destructive))' },
  ];

  const barData = donutData.map(d => ({
    label: d.label,
    value: d.value,
    color: d.color === 'hsl(var(--success))' ? 'bg-success' :
           d.color === 'hsl(var(--warning))' ? 'bg-warning' : 'bg-destructive',
  }));

  const successRate = total > 0
    ? Math.round(((byOutcome['FUNCIONÓ'] || 0) / total) * 100)
    : 0;

  return (
    <WidgetWrapper
      title="Efectividad Soluciones"
      icon={<Target className="h-4 w-4 text-success" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <Target className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Sin datos de soluciones</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-success" />
              <span className="font-semibold text-success">{successRate}%</span>
              <span className="text-muted-foreground">efectivas</span>
            </div>
            {avgMinutes > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{avgMinutes}min promedio</span>
              </div>
            )}
          </div>

          {style === 'bar-chart' ? (
            <BarChart
              data={barData}
              horizontal={true}
              showLabels={true}
              showValues={true}
            />
          ) : (
            <DonutChart
              data={donutData}
              size={110}
              showTotal={true}
              totalLabel="Total"
            />
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
