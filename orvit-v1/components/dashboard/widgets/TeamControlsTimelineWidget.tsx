'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { ClipboardList, Clock, AlertTriangle, Bell, CheckCircle, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

const CONTROL_STATUS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  OVERDUE: {
    label: 'Vencido',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />,
    color: 'bg-destructive/10 border-destructive/30',
  },
  NOTIFIED: {
    label: 'Notificado',
    icon: <Bell className="h-3.5 w-3.5 text-warning-muted-foreground" />,
    color: 'bg-warning-muted border-warning/30',
  },
  PENDING: {
    label: 'Pendiente',
    icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
    color: 'bg-accent/30 border-border/30',
  },
};

export function TeamControlsTimelineWidget({
  companyId,
  sectorId,
  onRemove,
  isEditMode,
  style = 'list',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['team-controls-pending', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sectorId) params.append('sectorId', sectorId.toString());
      params.append('limit', '10');

      const response = await fetch(`/api/maintenance/controls/pending?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching controls');
      return response.json();
    },
    staleTime: 60_000,
    enabled: !!companyId,
  });

  const controls = data?.controls || [];
  const summary = data?.summary;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) {
      const absMins = Math.abs(diffMins);
      if (absMins < 60) return `Hace ${absMins}m`;
      if (absMins < 1440) return `Hace ${Math.floor(absMins / 60)}h`;
      return `Hace ${Math.floor(absMins / 1440)}d`;
    }
    if (diffMins < 60) return `En ${diffMins}m`;
    if (diffMins < 1440) return `En ${Math.floor(diffMins / 60)}h`;
    return `En ${Math.floor(diffMins / 1440)}d`;
  };

  return (
    <WidgetWrapper
      title="Controles del Equipo"
      icon={<ClipboardList className="h-4 w-4 text-info-muted-foreground" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {controls.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center mb-2">
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <p className="text-xs text-muted-foreground">Sin controles pendientes del equipo</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {summary && (
            <div className="flex items-center gap-2 mb-2 text-xs">
              <Badge variant="secondary">{summary.total} total</Badge>
              {summary.overdue > 0 && (
                <Badge variant="destructive">{summary.overdue} vencidos</Badge>
              )}
              <Badge variant="outline">{summary.pending} pendientes</Badge>
            </div>
          )}
          {controls.slice(0, 6).map((control: any) => {
            const statusCfg = CONTROL_STATUS[control.status] || CONTROL_STATUS.PENDING;
            return (
              <div
                key={control.id}
                className={`flex items-start gap-2 p-2 rounded-lg border ${statusCfg.color}`}
              >
                <div className="mt-0.5 flex-shrink-0">{statusCfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs truncate">
                    {control.description || `Control #${control.order}`}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <User className="h-2.5 w-2.5" />
                    <span className="truncate">
                      {control.solutionApplied?.performedBy?.name || 'Sin asignar'}
                    </span>
                    <span className="mx-0.5">·</span>
                    <span className="truncate">
                      {control.solutionApplied?.machineName || ''}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDate(control.scheduledAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetWrapper>
  );
}
