'use client';

import React from 'react';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
}

export function RecentCompletedWidget({ 
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

  const recentOrders = data?.completedRecent?.slice(0, 5) || [];

  return (
    <WidgetWrapper
      title="Completadas Recientemente"
      icon={<CheckCircle className="h-4 w-4 text-success" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
    >
      {recentOrders.length > 0 ? (
        <div className="space-y-2">
          {recentOrders.map((order: any) => (
            <div 
              key={order.id} 
              className="flex items-center justify-between p-2 rounded-lg bg-success-muted border border-success-muted"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-success-muted">
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs text-foreground truncate">
                    {order.title || 'Sin título'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {order.assignedTo?.name || order.assignedWorker?.name || 'Sin asignar'}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-success-muted text-success border-success-muted ml-2 flex-shrink-0">
                Completada
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <CheckCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">No hay completadas recientes</p>
        </div>
      )}
    </WidgetWrapper>
  );
}

