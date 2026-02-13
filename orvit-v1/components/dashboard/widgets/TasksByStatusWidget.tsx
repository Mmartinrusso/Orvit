'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { DonutChart } from '../charts/DonutChart';
import { BarChart } from '../charts/BarChart';

interface TasksByStatusWidgetProps {
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

export function TasksByStatusWidget({ companyId, sectorId, style = 'donut-chart' }: TasksByStatusWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks-stats', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      
      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (!response.ok) throw new Error('Error');
      const tasks = await response.json();
      
      const taskList = Array.isArray(tasks) ? tasks : tasks.tasks || [];
      const byStatus: Record<string, number> = {};
      
      taskList.forEach((task: any) => {
        const status = task.status || 'PENDING';
        byStatus[status] = (byStatus[status] || 0) + 1;
      });
      
      return byStatus;
    },
    staleTime: 60 * 1000,
  });

  const chartData = Object.entries(data || {}).map(([status, count]) => ({
    label: STATUS_CONFIG[status]?.label || status,
    value: count as number,
    color: STATUS_CONFIG[status]?.color || '#6b7280',
  })).filter(d => d.value > 0);

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
        Sin tareas
      </div>
    );
  }

  if (style === 'bar-chart') {
    return <BarChart data={chartData} horizontal={true} showLabels={true} showValues={true} />;
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
            <span className="text-xs font-medium">{item.value} ({Math.round((item.value/total)*100)}%)</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DonutChart 
      data={chartData}
      size={90}
      thickness={16}
      showTotal={true}
      totalLabel="Tareas"
    />
  );
}
