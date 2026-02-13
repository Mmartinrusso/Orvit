'use client';

import React from 'react';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { Loader2 } from 'lucide-react';
import { BarChart } from '../charts/BarChart';
import { DonutChart } from '../charts/DonutChart';

interface OrdersChartWidgetProps {
  widgetId: string;
  companyId: number;
  sectorId?: number | null;
  style?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: '#eab308' },
  IN_PROGRESS: { label: 'En Progreso', color: '#3b82f6' },
  COMPLETED: { label: 'Completada', color: '#22c55e' },
  CANCELLED: { label: 'Cancelada', color: '#ef4444' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: 'Crítica', color: '#ef4444' },
  HIGH: { label: 'Alta', color: '#f97316' },
  MEDIUM: { label: 'Media', color: '#eab308' },
  LOW: { label: 'Baja', color: '#22c55e' },
};

export function OrdersChartWidget({ widgetId, companyId, sectorId, style = 'bar-chart' }: OrdersChartWidgetProps) {
  const { data, isLoading } = useWorkOrdersDashboard(companyId, sectorId, { enabled: !!companyId });

  const stats = data?.stats;
  const isPriority = widgetId === 'orders-by-priority';
  const rawData = isPriority ? stats?.byPriority : stats?.byType;
  const config = isPriority ? PRIORITY_CONFIG : STATUS_CONFIG;

  const chartData = Object.entries(rawData || {})
    .filter(([_, count]) => (count as number) > 0)
    .map(([key, count]) => ({
      label: config[key]?.label || key,
      value: count as number,
      color: config[key]?.color || '#6b7280',
    }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
        Sin datos
      </div>
    );
  }

  if (style === 'donut-chart') {
    return (
      <DonutChart 
        data={chartData}
        size={90}
        thickness={16}
        showTotal={true}
        totalLabel="Total"
      />
    );
  }

  if (style === 'list') {
    const total = chartData.reduce((sum, d) => sum + d.value, 0);
    return (
      <div className="space-y-2">
        {chartData.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs">{item.label}</span>
            </div>
            <div className="text-xs font-medium">
              {item.value} <span className="text-muted-foreground">({Math.round((item.value / total) * 100)}%)</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <BarChart 
      data={chartData}
      horizontal={true}
      showLabels={true}
      showValues={true}
    />
  );
}

