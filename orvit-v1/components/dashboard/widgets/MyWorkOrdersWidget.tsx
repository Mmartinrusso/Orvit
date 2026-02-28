'use client';

import React from 'react';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { ClipboardList, Clock, Wrench, CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendiente', variant: 'secondary' },
  SCHEDULED: { label: 'Programada', variant: 'outline' },
  IN_PROGRESS: { label: 'En Progreso', variant: 'default' },
  WAITING: { label: 'En Espera', variant: 'secondary' },
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'border-l-destructive',
  HIGH: 'border-l-warning',
  MEDIUM: 'border-l-info',
  LOW: 'border-l-muted-foreground',
};

export function MyWorkOrdersWidget({
  companyId,
  sectorId,
  userId,
  onRemove,
  isEditMode,
  style = 'list',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useWorkOrdersDashboard(companyId, sectorId);

  // Filter OTs assigned to current user
  const myOrders = React.useMemo(() => {
    if (!data || !userId) return [];
    const allOrders = [...(data.pending || []), ...(data.inProgress || [])];
    return allOrders
      .filter((o: any) => o.assignedTo?.id === userId || o.assignedWorker?.id === userId)
      .slice(0, 6);
  }, [data, userId]);

  return (
    <WidgetWrapper
      title="Mis OTs Asignadas"
      icon={<ClipboardList className="h-4 w-4 text-info-muted-foreground" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {myOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center mb-2">
            <ClipboardList className="h-5 w-5 text-success" />
          </div>
          <p className="text-xs text-muted-foreground">Sin OTs asignadas</p>
        </div>
      ) : style === 'cards' ? (
        <div className="grid grid-cols-2 gap-2">
          {myOrders.slice(0, 4).map((order: any) => (
            <div
              key={order.id}
              className={`p-2.5 rounded-lg bg-accent/30 border-l-2 ${PRIORITY_COLORS[order.priority] || 'border-l-muted'}`}
            >
              <div className="font-medium text-xs truncate">{order.title || `OT #${order.id}`}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {order.machine?.name || order.unidadMovil?.nombre || '—'}
              </div>
              <Badge variant={STATUS_CONFIG[order.status]?.variant || 'secondary'} className="text-xs mt-1">
                {STATUS_CONFIG[order.status]?.label || order.status}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {myOrders.map((order: any) => (
            <div
              key={order.id}
              className={`flex items-center justify-between p-2 rounded-lg bg-accent/30 border-l-2 ${PRIORITY_COLORS[order.priority] || 'border-l-muted'}`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {order.status === 'IN_PROGRESS' ? (
                  <Wrench className="h-3.5 w-3.5 text-info-muted-foreground flex-shrink-0" />
                ) : order.scheduledDate ? (
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-warning-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs truncate">{order.title || `OT #${order.id}`}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {order.machine?.name || order.unidadMovil?.nombre || '—'}
                  </div>
                </div>
              </div>
              <Badge variant={STATUS_CONFIG[order.status]?.variant || 'secondary'} className="text-xs ml-2 flex-shrink-0">
                {STATUS_CONFIG[order.status]?.label || order.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
