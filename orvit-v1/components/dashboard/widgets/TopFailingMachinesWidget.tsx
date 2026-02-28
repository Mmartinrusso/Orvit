'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { AlertTriangle, Cog } from 'lucide-react';
import { BarChart } from '../charts/BarChart';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

export function TopFailingMachinesWidget({
  companyId,
  sectorId,
  onRemove,
  isEditMode,
  style = 'bar-chart',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['kpis-failing-machines', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());

      const response = await fetch(`/api/maintenance/kpis?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching KPIs');
      return response.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!companyId,
  });

  const chartData = useMemo(() => {
    const failureFreq = data?.trends?.failureFrequency;
    if (Array.isArray(failureFreq) && failureFreq.length > 0) {
      return failureFreq.slice(0, 8).map((item: any) => ({
        label: item.machineName || item.name || item.label || 'Máquina',
        value: item.count || item.failures || item.value || 0,
      }));
    }
    return [];
  }, [data]);

  return (
    <WidgetWrapper
      title="Top Máquinas con Fallas"
      icon={<AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center mb-2">
            <Cog className="h-5 w-5 text-success" />
          </div>
          <p className="text-xs text-muted-foreground">Sin fallas registradas</p>
        </div>
      ) : style === 'list' ? (
        <div className="space-y-2">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-bold text-muted-foreground w-4">{index + 1}</span>
                <Cog className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium truncate">{item.label}</span>
              </div>
              <span className="text-xs font-semibold text-destructive ml-2">
                {item.value} fallas
              </span>
            </div>
          ))}
        </div>
      ) : (
        <BarChart
          data={chartData}
          horizontal={true}
          showLabels={true}
          showValues={true}
          colors={['bg-destructive', 'bg-warning', 'bg-chart-1', 'bg-chart-3', 'bg-muted-foreground']}
        />
      )}
    </WidgetWrapper>
  );
}
