'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { Hash, AlertTriangle, CheckCircle, Wrench, Loader2 } from 'lucide-react';

interface KpiStatWidgetProps {
  widgetId: string;
  companyId: number;
  sectorId?: number | null;
}

export function KpiStatWidget({ widgetId, companyId, sectorId }: KpiStatWidgetProps) {
  const { data, isLoading } = useWorkOrdersDashboard(companyId, sectorId, { enabled: !!companyId });

  const stats = data?.stats;

  const config: Record<string, { 
    value: number; 
    label: string; 
    icon: React.ReactNode; 
    color: string;
    bgColor: string;
  }> = {
    'kpi-total-orders': {
      value: stats?.total || 0,
      label: 'Total',
      icon: <Hash className="h-5 w-5" />,
      color: 'text-info-muted-foreground',
      bgColor: 'bg-info-muted',
    },
    'kpi-overdue': {
      value: stats?.overdue || 0,
      label: 'Vencidas',
      icon: <AlertTriangle className="h-5 w-5" />,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    'kpi-completed': {
      value: stats?.completedThisMonth || 0,
      label: 'Completadas',
      icon: <CheckCircle className="h-5 w-5" />,
      color: 'text-success',
      bgColor: 'bg-success-muted',
    },
    'kpi-in-progress': {
      value: stats?.inProgress || 0,
      label: 'En Progreso',
      icon: <Wrench className="h-5 w-5" />,
      color: 'text-warning-muted-foreground',
      bgColor: 'bg-warning-muted',
    },
  };

  const kpi = config[widgetId] || config['kpi-total-orders'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg', kpi.bgColor)}>
      <div className={kpi.color}>{kpi.icon}</div>
      <div>
        <div className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</div>
        <div className="text-xs text-muted-foreground">{kpi.label}</div>
      </div>
    </div>
  );
}

