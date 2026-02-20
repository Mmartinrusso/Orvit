'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { PieChart as PieIcon } from 'lucide-react';
import { PieChart } from '../charts/PieChart';
import { DonutChart } from '../charts/DonutChart';
import { BarChart } from '../charts/BarChart';
import { ProgressBar } from '../charts/ProgressBar';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

export function MaintenanceByTypeWidget({ 
  companyId, 
  sectorId,
  onRemove,
  isEditMode,
  style = 'donut-chart',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['maintenance-kpis', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      
      const response = await fetch(`/api/maintenance/kpis?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching KPIs');
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const preventive = data?.preventiveVsCorrective?.preventive || 0;
  const corrective = data?.preventiveVsCorrective?.corrective || 0;
  const total = preventive + corrective;

  const chartData = [
    { label: 'Preventivo', value: preventive, color: 'hsl(var(--success))' },
    { label: 'Correctivo', value: corrective, color: 'hsl(var(--chart-5))' },
  ].filter(d => d.value > 0);

  const renderContent = () => {
    if (total === 0) {
      return (
        <div className="flex items-center justify-center h-full py-8">
          <p className="text-xs text-muted-foreground">Sin datos</p>
        </div>
      );
    }

    switch (style) {
      case 'pie-chart':
        return (
          <PieChart 
            data={chartData}
            size={120}
            showLegend={true}
          />
        );
      
      case 'bar-chart':
        return (
          <BarChart 
            data={chartData}
            horizontal={false}
            height={150}
            showLabels={true}
            showValues={true}
          />
        );
      
      case 'progress':
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Preventivo</span>
                <span className="text-sm font-medium text-foreground">{preventive}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-success h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${(preventive / total) * 100}%` }}
                />
              </div>
              <div className="text-xs text-success mt-1">
                {((preventive / total) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Correctivo</span>
                <span className="text-sm font-medium text-foreground">{corrective}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-warning h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${(corrective / total) * 100}%` }}
                />
              </div>
              <div className="text-xs text-warning-muted-foreground mt-1">
                {((corrective / total) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        );
      
      case 'donut-chart':
      default:
        return (
          <DonutChart 
            data={chartData}
            size={100}
            showTotal={true}
            totalLabel="Total"
          />
        );
    }
  };

  return (
    <WidgetWrapper
      title="Preventivo vs Correctivo"
      icon={<PieIcon className="h-4 w-4" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {renderContent()}
    </WidgetWrapper>
  );
}
