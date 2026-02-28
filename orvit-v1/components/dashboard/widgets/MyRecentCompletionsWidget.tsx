'use client';

import React from 'react';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { CheckCircle2, Trophy } from 'lucide-react';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

export function MyRecentCompletionsWidget({
  companyId,
  sectorId,
  userId,
  onRemove,
  isEditMode,
  style = 'list',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useWorkOrdersDashboard(companyId, sectorId);

  const myCompleted = React.useMemo(() => {
    if (!data || !userId) return [];
    return (data.completedRecent || [])
      .filter((o: any) => o.assignedTo?.id === userId || o.assignedWorker?.id === userId)
      .slice(0, 5);
  }, [data, userId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  return (
    <WidgetWrapper
      title="Mis Completadas"
      icon={<Trophy className="h-4 w-4 text-success" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {myCompleted.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Sin completadas recientes</p>
        </div>
      ) : style === 'cards' ? (
        <div className="grid grid-cols-2 gap-2">
          {myCompleted.slice(0, 4).map((order: any) => (
            <div key={order.id} className="p-2.5 rounded-lg bg-success-muted/50 border border-success/20">
              <div className="font-medium text-xs truncate">{order.title || `OT #${order.id}`}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {order.machine?.name || order.unidadMovil?.nombre || '—'}
              </div>
              {order.completedDate && (
                <div className="text-xs text-success mt-1">{formatDate(order.completedDate)}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {myCompleted.map((order: any) => (
            <div key={order.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs truncate">{order.title || `OT #${order.id}`}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {order.machine?.name || order.unidadMovil?.nombre || '—'}
                  </div>
                </div>
              </div>
              {order.completedDate && (
                <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                  {formatDate(order.completedDate)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
