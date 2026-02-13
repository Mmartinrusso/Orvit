'use client';

import { useClientAnalytics } from '@/hooks/use-client-analytics';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';

interface ClientAlertsBadgeProps {
  clientId: string;
  showTooltip?: boolean;
}

export function ClientAlertsBadge({ clientId, showTooltip = true }: ClientAlertsBadgeProps) {
  const { data, isLoading } = useClientAnalytics(clientId, 'mes');

  if (isLoading) {
    return <Skeleton className="h-5 w-8 rounded-full" />;
  }

  if (!data) return null;

  const activeAlerts = Object.entries(data.alerts).filter(([_, value]) => value === true);
  const alertCount = activeAlerts.length;

  if (alertCount === 0) return null;

  const alertMessages = {
    nearCreditLimit: 'Cerca del límite de crédito',
    exceededCreditLimit: 'Límite de crédito excedido',
    hasOverdueInvoices: 'Facturas vencidas',
    slowPayer: 'Pagador lento',
    noRecentActivity: 'Sin actividad reciente',
  };

  const badge = (
    <Badge variant="destructive" className="text-xs cursor-help">
      <AlertTriangle className="w-3 h-3 mr-1" />
      {alertCount}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-sm">Alertas Activas</p>
            <ul className="text-xs space-y-1 list-disc list-inside">
              {activeAlerts.map(([key]) => (
                <li key={key}>
                  {alertMessages[key as keyof typeof alertMessages]}
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
