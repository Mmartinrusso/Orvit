'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Timer, Activity, Target, CheckCircle2 } from 'lucide-react';
import { BarChart } from '../charts/BarChart';

interface MaintenanceKPIsWidgetProps {
  companyId: number;
  sectorId?: number | null;
  style?: string;
}

export function MaintenanceKPIsWidget({ companyId, sectorId, style = 'stat-card' }: MaintenanceKPIsWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-kpis', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      
      const response = await fetch(`/api/maintenance/kpis?${params.toString()}`);
      if (!response.ok) throw new Error('Error');
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const kpis = [
    {
      label: 'MTTR',
      value: data?.avgMTTR || 0,
      displayValue: `${data?.avgMTTR?.toFixed(1) || '0'}h`,
      icon: <Timer className="h-4 w-4 text-warning-muted-foreground" />,
      color: 'hsl(var(--chart-5))',
    },
    {
      label: 'MTBF',
      value: data?.avgMTBF || 0,
      displayValue: `${data?.avgMTBF?.toFixed(0) || '0'}h`,
      icon: <Activity className="h-4 w-4 text-info-muted-foreground" />,
      color: 'hsl(var(--chart-1))',
    },
    {
      label: 'Disponibilidad',
      value: data?.uptime || 0,
      displayValue: `${data?.uptime?.toFixed(1) || '0'}%`,
      icon: <Target className="h-4 w-4 text-info-muted-foreground" />,
      color: 'hsl(var(--primary))',
    },
    {
      label: 'Completitud',
      value: data?.completionRate || 0,
      displayValue: `${data?.completionRate?.toFixed(1) || '0'}%`,
      icon: <CheckCircle2 className="h-4 w-4 text-success" />,
      color: 'hsl(var(--success))',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (style === 'bar-chart') {
    return (
      <BarChart 
        data={kpis.map(k => ({ label: k.label, value: k.value, color: k.color }))}
        horizontal={true}
        showLabels={true}
        showValues={true}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {kpis.map((kpi, index) => (
        <div key={index} className="text-center p-2 rounded-lg bg-accent/30">
          <div className="flex justify-center mb-1">{kpi.icon}</div>
          <div className="text-lg font-bold" style={{ color: kpi.color }}>{kpi.displayValue}</div>
          <div className="text-xs text-muted-foreground">{kpi.label}</div>
        </div>
      ))}
    </div>
  );
}
