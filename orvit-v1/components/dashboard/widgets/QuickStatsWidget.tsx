'use client';

import React from 'react';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { Hash, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';

type QuickStatType = 'total' | 'overdue' | 'completed' | 'mttr';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  statType?: QuickStatType;
}

export function QuickStatsWidget({ 
  companyId, 
  sectorId,
  onRemove,
  isEditMode,
  settings 
}: ExtendedWidgetProps) {
  const statType = settings?.statType || 'total';
  
  const { data: workOrdersData, isLoading: loadingWO, refetch: refetchWO } = useWorkOrdersDashboard(
    companyId,
    sectorId,
    { enabled: !!companyId }
  );

  const { data: kpisData, isLoading: loadingKPIs, refetch: refetchKPIs } = useQuery({
    queryKey: ['maintenance-kpis', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      
      const response = await fetch(`/api/maintenance/kpis?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching KPIs');
      return response.json();
    },
    enabled: !!companyId && statType === 'mttr',
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = loadingWO || (statType === 'mttr' && loadingKPIs);
  const stats = workOrdersData?.stats;

  const configs: Record<QuickStatType, { 
    title: string; 
    value: string | number; 
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  }> = {
    total: {
      title: 'Total Órdenes',
      value: stats?.total || 0,
      icon: <Hash className="h-5 w-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    overdue: {
      title: 'Órdenes Vencidas',
      value: stats?.overdue || 0,
      icon: <AlertTriangle className="h-5 w-5" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    completed: {
      title: 'Completadas',
      value: stats?.completedThisMonth || 0,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    mttr: {
      title: 'MTTR',
      value: `${kpisData?.avgMTTR?.toFixed(1) || '0'}h`,
      icon: <Timer className="h-5 w-5" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  };

  const config = configs[statType as QuickStatType] || configs.total;

  return (
    <WidgetWrapper
      title={config.title}
      icon={<span className={config.color}>{config.icon}</span>}
      isLoading={isLoading}
      onRefresh={() => {
        refetchWO();
        if (statType === 'mttr') refetchKPIs();
      }}
      onRemove={onRemove}
      isEditMode={isEditMode}
    >
      <div className={`flex items-center justify-center h-full ${config.bgColor} rounded-lg py-4`}>
        <div className="text-center">
          <div className={`text-3xl font-bold ${config.color}`}>
            {config.value}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Este mes
          </div>
        </div>
      </div>
    </WidgetWrapper>
  );
}

