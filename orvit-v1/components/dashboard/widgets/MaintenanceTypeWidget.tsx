'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { DonutChart } from '../charts/DonutChart';
import { PieChart } from '../charts/PieChart';
import { BarChart } from '../charts/BarChart';

interface MaintenanceTypeWidgetProps {
  companyId: number;
  sectorId?: number | null;
  style?: string;
}

export function MaintenanceTypeWidget({ companyId, sectorId, style = 'donut-chart' }: MaintenanceTypeWidgetProps) {
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

  const preventive = data?.preventiveVsCorrective?.preventive || 0;
  const corrective = data?.preventiveVsCorrective?.corrective || 0;
  const total = preventive + corrective;

  const chartData = [
    { label: 'Preventivo', value: preventive, color: '#22c55e' },
    { label: 'Correctivo', value: corrective, color: '#f97316' },
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
        Sin datos
      </div>
    );
  }

  if (style === 'pie-chart') {
    return <PieChart data={chartData} size={100} showLegend={true} />;
  }

  if (style === 'bar-chart') {
    return <BarChart data={chartData} horizontal={true} showLabels={true} showValues={true} />;
  }

  if (style === 'progress') {
    return (
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Preventivo</span>
            <span className="font-medium">{preventive} ({Math.round((preventive/total)*100)}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(preventive/total)*100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Correctivo</span>
            <span className="font-medium">{corrective} ({Math.round((corrective/total)*100)}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${(corrective/total)*100}%` }} />
          </div>
        </div>
      </div>
    );
  }

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

