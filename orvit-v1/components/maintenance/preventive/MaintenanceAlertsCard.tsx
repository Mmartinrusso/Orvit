'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Wrench,
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useMaintenanceAlerts, MaintenanceAlert } from '@/hooks/use-maintenance-alerts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MaintenanceAlertsCardProps {
  className?: string;
  maxAlerts?: number;
  onViewAll?: () => void;
  onAlertClick?: (alert: MaintenanceAlert) => void;
}

const getAlertTypeInfo = (type: MaintenanceAlert['type']) => {
  switch (type) {
    case 'OVERDUE':
      return {
        label: 'Vencido',
        icon: AlertTriangle,
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        iconColor: 'text-red-500',
      };
    case 'DUE_TODAY':
      return {
        label: 'Hoy',
        icon: Clock,
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-200',
        iconColor: 'text-orange-500',
      };
    case 'DUE_SOON':
      return {
        label: 'Pronto',
        icon: Bell,
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
        iconColor: 'text-yellow-500',
      };
    case 'UPCOMING':
      return {
        label: 'Programado',
        icon: Calendar,
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        iconColor: 'text-blue-500',
      };
    default:
      return {
        label: type,
        icon: Bell,
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-700',
        borderColor: 'border-gray-200',
        iconColor: 'text-gray-500',
      };
  }
};

const formatAlertDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return format(date, "d 'de' MMM", { locale: es });
  } catch {
    return 'Sin fecha';
  }
};

export function MaintenanceAlertsCard({
  className,
  maxAlerts = 5,
  onViewAll,
  onAlertClick,
}: MaintenanceAlertsCardProps) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ? parseInt(currentCompany.id.toString()) : null;

  const { data, isLoading, error } = useMaintenanceAlerts({
    companyId,
    daysAhead: 7,
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas de Mantenimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas de Mantenimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Error al cargar alertas</p>
        </CardContent>
      </Card>
    );
  }

  const alerts = data?.alerts || [];
  const summary = data?.summary;
  const displayAlerts = alerts.slice(0, maxAlerts);
  const hasMore = alerts.length > maxAlerts;

  if (alerts.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas de Mantenimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Todo al día</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            No hay mantenimientos pendientes en los próximos 7 días
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className, summary?.critical && summary.critical > 0 && 'border-red-200')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas de Mantenimiento
          </CardTitle>
          {summary && (
            <div className="flex items-center gap-1">
              {summary.overdue > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {summary.overdue} vencido{summary.overdue !== 1 ? 's' : ''}
                </Badge>
              )}
              {summary.dueToday > 0 && (
                <Badge className="text-xs bg-orange-100 text-orange-800 hover:bg-orange-100">
                  {summary.dueToday} hoy
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {displayAlerts.map((alert) => {
            const typeInfo = getAlertTypeInfo(alert.type);
            const Icon = typeInfo.icon;

            return (
              <div
                key={`${alert.id}-${alert.type}`}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50',
                  typeInfo.bgColor,
                  typeInfo.borderColor
                )}
                onClick={() => onAlertClick?.(alert)}
              >
                <div className={cn('p-1.5 rounded-full', typeInfo.bgColor)}>
                  <Icon className={cn('h-4 w-4', typeInfo.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{alert.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3 w-3" />
                      {alert.machineName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatAlertDate(alert.nextMaintenanceDate)}
                    </span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-xs shrink-0', typeInfo.textColor, typeInfo.borderColor)}
                >
                  {alert.daysUntilDue < 0
                    ? `${Math.abs(alert.daysUntilDue)}d atrasado`
                    : alert.daysUntilDue === 0
                      ? 'Hoy'
                      : `${alert.daysUntilDue}d`}
                </Badge>
              </div>
            );
          })}
        </div>

        {hasMore && onViewAll && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={onViewAll}
          >
            Ver todas las alertas ({alerts.length})
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
