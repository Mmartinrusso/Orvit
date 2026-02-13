'use client';

import React from 'react';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
}

export function OverdueOrdersWidget({ 
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

  const overdueOrders = data?.overdue?.slice(0, 5) || [];

  return (
    <WidgetWrapper
      title="Órdenes Vencidas"
      icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      className={overdueOrders.length > 0 ? 'border-red-200' : ''}
    >
      {overdueOrders.length > 0 ? (
        <div className="space-y-2">
          {overdueOrders.map((order: any) => (
            <div 
              key={order.id} 
              className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs text-foreground truncate">
                  {order.title || 'Sin título'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {order.machine?.name || order.unidadMovil?.nombre || 'Sin asignar'}
                </div>
              </div>
              <Badge variant="destructive" className="text-xs ml-2 flex-shrink-0">
                Vencida
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
            <AlertTriangle className="h-6 w-6 text-green-500" />
          </div>
          <p className="text-xs text-muted-foreground">No hay órdenes vencidas</p>
        </div>
      )}
    </WidgetWrapper>
  );
}

