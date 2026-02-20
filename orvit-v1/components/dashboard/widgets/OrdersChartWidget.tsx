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
  PENDING: { label: 'Pendiente', color: 'hsl(var(--warning))' },
  IN_PROGRESS: { label: 'En Progreso', color: 'hsl(var(--primary))' },
  COMPLETED: { label: 'Completada', color: 'hsl(var(--success))' },
  CANCELLED: { label: 'Cancelada', color: 'hsl(var(--destructive))' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: 'Crítica', color: 'hsl(var(--destructive))' },
  HIGH: { label: 'Alta', color: 'hsl(var(--chart-5))' },
  MEDIUM: { label: 'Media', color: 'hsl(var(--warning))' },
  LOW: { label: 'Baja', color: 'hsl(var(--success))' },
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
      color: config[key]?.color || 'hsl(var(--muted-foreground))',
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

