'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
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
    isAlert?: boolean;
  }> = {
    'kpi-total-orders': {
      value: stats?.total || 0,
      label: 'Total',
      icon: <Hash className="h-4 w-4 text-muted-foreground" />,
    },
    'kpi-overdue': {
      value: stats?.overdue || 0,
      label: 'Vencidas',
      icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
      isAlert: true,
    },
    'kpi-completed': {
      value: stats?.completedThisMonth || 0,
      label: 'Completadas',
      icon: <CheckCircle className="h-4 w-4 text-muted-foreground" />,
    },
    'kpi-in-progress': {
      value: stats?.inProgress || 0,
      label: 'En Progreso',
      icon: <Wrench className="h-4 w-4 text-muted-foreground" />,
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground">{kpi.label}</div>
            <div className={cn('text-2xl font-bold', kpi.isAlert && kpi.value > 0 && 'text-destructive')}>{kpi.value}</div>
          </div>
          <div className="p-2 rounded-lg bg-muted">{kpi.icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

