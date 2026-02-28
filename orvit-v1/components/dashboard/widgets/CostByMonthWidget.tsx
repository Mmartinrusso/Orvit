'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { DollarSign } from 'lucide-react';
import { BarChart } from '../charts/BarChart';
import { AreaChart } from '../charts/AreaChart';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

export function CostByMonthWidget({
  companyId,
  sectorId,
  onRemove,
  isEditMode,
  style = 'bar-chart',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['maintenance-costs', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());

      const response = await fetch(`/api/maintenance/costs?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching costs');
      return response.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!companyId,
  });

  const chartData = useMemo(() => {
    const monthly = data?.monthly || data?.byMonth;
    if (Array.isArray(monthly) && monthly.length > 0) {
      return monthly.slice(-6).map((item: any) => ({
        label: item.month || item.label || '',
        value: Math.round(item.total || item.cost || item.value || 0),
      }));
    }
    return [];
  }, [data]);

  const totalCost = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val}`;
  };

  return (
    <WidgetWrapper
      title="Costos Mensuales"
      icon={<DollarSign className="h-4 w-4 text-chart-1" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Sin datos de costos</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Total 6M: <span className="font-semibold text-foreground">{formatCurrency(totalCost)}</span>
          </div>
          {style === 'area-chart' ? (
            <AreaChart
              data={chartData}
              height={140}
              showLabels={true}
              showGrid={true}
              color="hsl(var(--chart-1))"
            />
          ) : (
            <BarChart
              data={chartData}
              height={140}
              showLabels={true}
              showValues={true}
              colors={['bg-chart-1', 'bg-chart-3', 'bg-primary', 'bg-chart-5', 'bg-info', 'bg-warning']}
            />
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
