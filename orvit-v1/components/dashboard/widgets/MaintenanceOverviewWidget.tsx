'use client';

import React from 'react';
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
      icon: <ClipboardList className="h-4 w-4 text-blue-500" />,
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Vencidas',
      value: stats?.overdue || 0,
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      bgColor: 'bg-red-50',
    },
    {
      label: 'En Progreso',
      value: stats?.inProgress || 0,
      icon: <Clock className="h-4 w-4 text-yellow-500" />,
      bgColor: 'bg-yellow-50',
    },
    {
      label: 'Completadas',
      value: stats?.completedThisMonth || 0,
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      bgColor: 'bg-green-50',
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
            className={`p-3 rounded-lg ${item.bgColor} flex items-center gap-3`}
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

