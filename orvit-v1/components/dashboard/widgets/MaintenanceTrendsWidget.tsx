'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { TrendingUp } from 'lucide-react';
import { LineChart } from '../charts/LineChart';
import { AreaChart } from '../charts/AreaChart';
import { BarChart } from '../charts/BarChart';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

export function MaintenanceTrendsWidget({ 
  companyId, 
  sectorId,
  onRemove,
  isEditMode,
  style = 'area-chart',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['maintenance-trends', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      
      const response = await fetch(`/api/maintenance/kpis?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching trends');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Generar datos de tendencia (simulados basados en KPIs reales)
  const trendData = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    const baseValue = data?.totalMaintenances || 10;
    
    return months.map((month, index) => ({
      label: month,
      value: Math.max(1, Math.floor(baseValue * (0.7 + Math.random() * 0.6))),
    }));
  }, [data]);

  const renderContent = () => {
    switch (style) {
      case 'line-chart':
        return (
          <LineChart 
            data={trendData}
            height={150}
            showDots={true}
            showArea={false}
            color="hsl(var(--primary))"
          />
        );
      
      case 'bar-chart':
        return (
          <BarChart 
            data={trendData}
            height={150}
            horizontal={false}
            showLabels={true}
            showValues={true}
          />
        );
      
      case 'area-chart':
      default:
        return (
          <AreaChart 
            data={trendData}
            height={150}
            showLabels={true}
            showGrid={true}
            color="hsl(var(--primary))"
          />
        );
    }
  };

  return (
    <WidgetWrapper
      title="Tendencia de Mantenimientos"
      icon={<TrendingUp className="h-4 w-4 text-info-muted-foreground" />}
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

