'use client';

import React from 'react';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Wrench, CheckCircle } from 'lucide-react';

interface OrdersListWidgetProps {
  widgetId: string;
  companyId: number;
  sectorId?: number | null;
  style?: string;
}

export function OrdersListWidget({ widgetId, companyId, sectorId, style = 'list' }: OrdersListWidgetProps) {
  const { data, isLoading } = useWorkOrdersDashboard(companyId, sectorId, { enabled: !!companyId });

  const config: Record<string, { 
    orders: any[]; 
    emptyText: string; 
    icon: React.ReactNode;
    badgeVariant: 'destructive' | 'default' | 'outline';
    badgeText: string;
    borderColor: string;
  }> = {
    'orders-overdue-list': {
      orders: data?.overdue || [],
      emptyText: 'Sin órdenes vencidas',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
      badgeVariant: 'destructive',
      badgeText: 'Vencida',
      borderColor: 'border-l-red-500',
    },
    'orders-in-progress': {
      orders: data?.inProgress || [],
      emptyText: 'Sin órdenes en progreso',
      icon: <Wrench className="h-3.5 w-3.5 text-blue-500" />,
      badgeVariant: 'default',
      badgeText: 'En Progreso',
      borderColor: 'border-l-blue-500',
    },
    'orders-completed': {
      orders: data?.completedRecent || [],
      emptyText: 'Sin completadas recientes',
      icon: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
      badgeVariant: 'outline',
      badgeText: 'Completada',
      borderColor: 'border-l-green-500',
    },
  };

  const cfg = config[widgetId] || config['orders-overdue-list'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (cfg.orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>
        <p className="text-xs text-muted-foreground">{cfg.emptyText}</p>
      </div>
    );
  }

  if (style === 'cards') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {cfg.orders.slice(0, 4).map((order: any) => (
          <div 
            key={order.id} 
            className={`p-2 rounded-lg border-l-2 ${cfg.borderColor} bg-accent/30`}
          >
            <div className="font-medium text-xs truncate">{order.title || 'Sin título'}</div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {order.machine?.name || order.unidadMovil?.nombre || '-'}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cfg.orders.slice(0, 5).map((order: any) => (
        <div 
          key={order.id} 
          className={`flex items-center justify-between p-2 rounded-lg border-l-2 ${cfg.borderColor} bg-accent/30`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {cfg.icon}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-xs truncate">{order.title || 'Sin título'}</div>
              <div className="text-xs text-muted-foreground truncate">
                {order.machine?.name || order.unidadMovil?.nombre || '-'}
              </div>
            </div>
          </div>
          <Badge variant={cfg.badgeVariant} className="text-xs flex-shrink-0 ml-2">
            {cfg.badgeText}
          </Badge>
        </div>
      ))}
    </div>
  );
}

