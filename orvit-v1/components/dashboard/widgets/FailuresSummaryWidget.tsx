'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { AlertOctagon, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { BarChart } from '../charts/BarChart';
import { DonutChart } from '../charts/DonutChart';
import { Badge } from '@/components/ui/badge';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

export function FailuresSummaryWidget({ 
  companyId, 
  sectorId,
  onRemove,
  isEditMode,
  style = 'stat-card',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['failures-summary', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      params.append('type', 'CORRECTIVE');
      
      const response = await fetch(`/api/maintenance/kpis?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching failures');
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const failureData = [
    {
      label: 'Abiertas',
      value: data?.overdueMaintenance || 0,
      color: 'hsl(var(--destructive))',
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />
    },
    {
      label: 'En Proceso',
      value: Math.floor((data?.totalMaintenances || 0) * 0.3),
      color: 'hsl(var(--warning))',
      icon: <Clock className="h-4 w-4 text-warning-muted-foreground" />
    },
    {
      label: 'Resueltas',
      value: data?.completedOnTime || 0,
      color: 'hsl(var(--success))',
      icon: <CheckCircle className="h-4 w-4 text-success" />
    },
  ];

  const renderContent = () => {
    switch (style) {
      case 'bar-chart':
        return (
          <BarChart 
            data={failureData}
            horizontal={true}
            showLabels={true}
            showValues={true}
          />
        );
      
      case 'donut-chart':
        return (
          <DonutChart 
            data={failureData}
            size={100}
            showTotal={true}
            totalLabel="Fallas"
          />
        );
      
      case 'stat-card':
      default:
        return (
          <div className="grid grid-cols-3 gap-3">
            {failureData.map((item, index) => (
              <div 
                key={index}
                className="p-3 rounded-lg bg-accent/30 text-center"
              >
                <div className="flex justify-center mb-2">
                  {item.icon}
                </div>
                <div className="text-lg font-semibold text-foreground">
                  {item.value}
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <WidgetWrapper
      title="Resumen de Fallas"
      icon={<AlertOctagon className="h-4 w-4 text-destructive" />}
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

