'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { WorkOrder, WorkOrderStatus } from '@/lib/types';
import {
  ClipboardList,
  Clock,
  PlayCircle,
  AlertTriangle,
  UserX,
} from 'lucide-react';

export type KpiFilterType = WorkOrderStatus | 'ALL' | 'OVERDUE' | 'UNASSIGNED' | null;

interface WorkOrdersKpisProps {
  workOrders: WorkOrder[];
  activeFilter?: KpiFilterType;
  onFilterClick?: (filter: KpiFilterType) => void;
  className?: string;
}

interface KpiItem {
  id: KpiFilterType;
  label: string;
  icon: React.ElementType;
  getValue: (orders: WorkOrder[]) => number;
  dotColor: string;
  iconColor: string;
}

const kpiDefinitions: KpiItem[] = [
  {
    id: 'ALL',
    label: 'Total',
    icon: ClipboardList,
    getValue: (orders) => orders.length,
    dotColor: 'bg-primary',
    iconColor: 'text-primary',
  },
  {
    id: WorkOrderStatus.PENDING,
    label: 'Pendientes',
    icon: Clock,
    getValue: (orders) => orders.filter(o => o.status === WorkOrderStatus.PENDING).length,
    dotColor: 'bg-amber-500',
    iconColor: 'text-amber-500',
  },
  {
    id: WorkOrderStatus.IN_PROGRESS,
    label: 'En proceso',
    icon: PlayCircle,
    getValue: (orders) => orders.filter(o => o.status === WorkOrderStatus.IN_PROGRESS).length,
    dotColor: 'bg-blue-500',
    iconColor: 'text-blue-500',
  },
  {
    id: 'OVERDUE',
    label: 'Vencidas',
    icon: AlertTriangle,
    getValue: (orders) => {
      const now = new Date();
      return orders.filter(o => {
        if (!o.scheduledDate) return false;
        return new Date(o.scheduledDate) < now &&
          o.status !== WorkOrderStatus.COMPLETED &&
          o.status !== WorkOrderStatus.CANCELLED;
      }).length;
    },
    dotColor: 'bg-rose-500',
    iconColor: 'text-rose-500',
  },
  {
    id: 'UNASSIGNED',
    label: 'Sin asignar',
    icon: UserX,
    getValue: (orders) => orders.filter(o => 
      !o.assignedToId && 
      o.status !== WorkOrderStatus.COMPLETED &&
      o.status !== WorkOrderStatus.CANCELLED
    ).length,
    dotColor: 'bg-slate-500',
    iconColor: 'text-slate-500',
  },
];

export function WorkOrdersKpis({
  workOrders,
  activeFilter = null,
  onFilterClick,
  className,
}: WorkOrdersKpisProps) {
  const handleClick = (kpiId: KpiFilterType) => {
    if (!onFilterClick) return;
    // Toggle: si ya está activo, desactivar (null)
    if (activeFilter === kpiId) {
      onFilterClick(null);
    } else {
      onFilterClick(kpiId);
    }
  };

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3', className)}>
      {kpiDefinitions.map((kpi) => {
        const value = kpi.getValue(workOrders);
        const isActive = activeFilter === kpi.id;
        const Icon = kpi.icon;

        return (
          <Card
            key={kpi.id}
            className={cn(
              'cursor-pointer transition-all duration-200 border-border bg-card',
              'hover:shadow-md hover:border-border/80',
              isActive && 'ring-2 ring-ring/30 border-ring/50 bg-accent/30 shadow-sm'
            )}
            onClick={() => handleClick(kpi.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate mb-1">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-normal text-foreground tabular-nums">
                    {value}
                  </p>
                </div>
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-xl',
                  'bg-muted/50',
                  isActive && 'bg-primary/10'
                )}>
                  <Icon className={cn('w-5 h-5', kpi.iconColor)} />
                </div>
              </div>
              
              {/* Indicador de activo */}
              {isActive && (
                <div className="mt-3 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Filtro activo
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Función helper para usar en el filtrado
export function applyKpiFilter(orders: WorkOrder[], filter: KpiFilterType): WorkOrder[] {
  if (!filter || filter === 'ALL') return orders;

  const now = new Date();

  switch (filter) {
    case 'OVERDUE':
      return orders.filter(o => {
        if (!o.scheduledDate) return false;
        return new Date(o.scheduledDate) < now &&
          o.status !== WorkOrderStatus.COMPLETED &&
          o.status !== WorkOrderStatus.CANCELLED;
      });
    case 'UNASSIGNED':
      return orders.filter(o => 
        !o.assignedToId && 
        o.status !== WorkOrderStatus.COMPLETED &&
        o.status !== WorkOrderStatus.CANCELLED
      );
    case WorkOrderStatus.PENDING:
    case WorkOrderStatus.IN_PROGRESS:
    case WorkOrderStatus.COMPLETED:
    case WorkOrderStatus.CANCELLED:
    case WorkOrderStatus.ON_HOLD:
      return orders.filter(o => o.status === filter);
    default:
      return orders;
  }
}
