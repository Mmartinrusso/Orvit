'use client';

import React from 'react';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { BarChart3 } from 'lucide-react';
import { BarChart } from '../charts/BarChart';
import { DonutChart } from '../charts/DonutChart';
import { PieChart } from '../charts/PieChart';
import { ProgressBar } from '../charts/ProgressBar';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
  dataType?: 'status' | 'priority';
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendientes', color: '#eab308' },
  IN_PROGRESS: { label: 'En Proceso', color: '#3b82f6' },
  COMPLETED: { label: 'Completadas', color: '#22c55e' },
  CANCELLED: { label: 'Canceladas', color: '#ef4444' },
  ON_HOLD: { label: 'En Espera', color: '#6b7280' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: 'Crítica', color: '#ef4444' },
  HIGH: { label: 'Alta', color: '#f97316' },
  MEDIUM: { label: 'Media', color: '#eab308' },
  LOW: { label: 'Baja', color: '#22c55e' },
};

export function OrdersByStatusWidget({ 
  companyId, 
  sectorId,
  onRemove,
  isEditMode,
  style = 'bar-chart',
  headerActions,
  settings,
}: ExtendedWidgetProps) {
  const dataType = settings?.dataType || 'status';
  
  const { data, isLoading, isError, refetch } = useWorkOrdersDashboard(
    companyId,
    sectorId,
    { enabled: !!companyId }
  );

  const stats = data?.stats;
  const rawData = dataType === 'priority' ? stats?.byPriority : stats?.byType;
  const config = dataType === 'priority' ? PRIORITY_CONFIG : STATUS_CONFIG;
  const total = stats?.total || 0;

  const chartData = Object.entries(rawData || {})
    .filter(([_, count]) => count > 0)
    .map(([key, count]) => ({
      label: config[key]?.label || key,
      value: count as number,
      color: config[key]?.color || '#6b7280',
    }));

  const renderContent = () => {
    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full py-8">
          <p className="text-xs text-muted-foreground">Sin datos</p>
        </div>
      );
    }

    switch (style) {
      case 'donut-chart':
        return (
          <DonutChart 
            data={chartData}
            size={100}
            showTotal={true}
            totalLabel="Total"
          />
        );
      
      case 'pie-chart':
        return (
          <PieChart 
            data={chartData}
            size={120}
            showLegend={true}
          />
        );
      
      case 'progress':
        return (
          <div className="space-y-3">
            {chartData.map((item, index) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <ProgressBar 
                  key={index}
                  value={percentage}
                  max={100}
                  label={item.label}
                  color={`bg-[${item.color}]`}
                  showValue={true}
                  showPercentage={false}
                />
              );
            })}
          </div>
        );
      
      case 'list':
        return (
          <div className="space-y-2">
            {chartData.map((item, index) => {
              const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-foreground">{item.value}</span>
                    <span className="text-xs text-muted-foreground ml-1">({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      
      case 'bar-chart':
      default:
        return (
          <BarChart 
            data={chartData}
            horizontal={true}
            showLabels={true}
            showValues={true}
          />
        );
    }
  };

  return (
    <WidgetWrapper
      title={dataType === 'priority' ? 'Órdenes por Prioridad' : 'Órdenes por Estado'}
      icon={<BarChart3 className="h-4 w-4" />}
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
