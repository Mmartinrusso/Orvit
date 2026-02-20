'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle, Wrench, XCircle, AlertTriangle, Cog } from 'lucide-react';
import { DonutChart } from '../charts/DonutChart';

interface MachineStatusWidgetProps {
  companyId: number;
  sectorId?: number | null;
  style?: string;
}

export function MachineStatusWidget({ companyId, sectorId, style = 'donut-chart' }: MachineStatusWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['machines', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      
      const response = await fetch(`/api/machines?${params.toString()}`);
      if (!response.ok) throw new Error('Error');
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const machines = Array.isArray(data) ? data : data?.machines || [];
  const total = machines.length;

  // Simular estados basados en cantidad de máquinas
  const statusData = [
    { label: 'Operativas', value: Math.floor(total * 0.75), color: 'hsl(var(--success))', icon: <CheckCircle className="h-4 w-4" /> },
    { label: 'Mantenimiento', value: Math.floor(total * 0.15), color: 'hsl(var(--warning))', icon: <Wrench className="h-4 w-4" /> },
    { label: 'Fuera de servicio', value: Math.floor(total * 0.10), color: 'hsl(var(--destructive))', icon: <XCircle className="h-4 w-4" /> },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
        Sin máquinas
      </div>
    );
  }

  if (style === 'cards') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {statusData.map((item, index) => (
          <div key={index} className="text-center p-2 rounded-lg bg-accent/30">
            <div className="flex justify-center mb-1" style={{ color: item.color }}>{item.icon}</div>
            <div className="text-lg font-bold" style={{ color: item.color }}>{item.value}</div>
            <div className="text-xs text-muted-foreground truncate">{item.label}</div>
          </div>
        ))}
      </div>
    );
  }

  if (style === 'list') {
    return (
      <div className="space-y-2">
        {statusData.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
            <div className="flex items-center gap-2">
              <span style={{ color: item.color }}>{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </div>
            <span className="text-sm font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DonutChart 
      data={statusData}
      size={90}
      thickness={16}
      showTotal={true}
      totalLabel="Máquinas"
    />
  );
}
