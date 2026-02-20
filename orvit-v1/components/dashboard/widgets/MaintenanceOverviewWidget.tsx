'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { ClipboardList, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
}

export function MaintenanceOverviewWidget({ 
  companyId, 
  sectorId,
  onRemove,
  isEditMode 
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useWorkOrdersDashboard(
    companyId,
    sectorId,
    { enabled: !!companyId }
  );

  const stats = data?.stats;

  const items = [
    {
      label: 'Total Órdenes',
      value: stats?.total || 0,
      icon: <ClipboardList className="h-4 w-4 text-info-muted-foreground" />,
      bgColor: 'bg-info-muted',
    },
    {
      label: 'Vencidas',
      value: stats?.overdue || 0,
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      bgColor: 'bg-destructive/10',
    },
    {
      label: 'En Progreso',
      value: stats?.inProgress || 0,
      icon: <Clock className="h-4 w-4 text-warning-muted-foreground" />,
      bgColor: 'bg-warning-muted',
    },
    {
      label: 'Completadas',
      value: stats?.completedThisMonth || 0,
      icon: <CheckCircle className="h-4 w-4 text-success" />,
      bgColor: 'bg-success-muted',
    },
  ];

  return (
    <WidgetWrapper
      title="Resumen de Mantenimiento"
      icon={<ClipboardList className="h-4 w-4" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
    >
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, index) => (
          <div 
            key={index} 
            className={cn('p-3 rounded-lg flex items-center gap-3', item.bgColor)}
          >
            <div className="flex-shrink-0">
              {item.icon}
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">
                {item.value}
              </div>
              <div className="text-xs text-muted-foreground">
                {item.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetWrapper>
  );
}

