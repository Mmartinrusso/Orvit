'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { AlertOctagon, AlertTriangle, Clock, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DonutChart } from '../charts/DonutChart';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  CRITICAL: { label: 'Crítica', color: 'hsl(var(--destructive))', badgeVariant: 'destructive' },
  HIGH: { label: 'Alta', color: 'hsl(var(--warning))', badgeVariant: 'default' },
  MEDIUM: { label: 'Media', color: 'hsl(var(--chart-1))', badgeVariant: 'secondary' },
  LOW: { label: 'Baja', color: 'hsl(var(--muted-foreground))', badgeVariant: 'outline' },
};

export function FailuresOpenWidget({
  companyId,
  sectorId,
  onRemove,
  isEditMode,
  style = 'list',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['failures-open', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      params.append('status', 'OPEN,IN_PROGRESS,UNDER_INVESTIGATION');
      params.append('limit', '10');

      const response = await fetch(`/api/failure-occurrences?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching failures');
      return response.json();
    },
    staleTime: 2 * 60_000,
    enabled: !!companyId,
  });

  const failures = Array.isArray(data) ? data : data?.failures || data?.data || [];

  const donutData = React.useMemo(() => {
    const bySeverity: Record<string, number> = {};
    for (const f of failures) {
      const sev = f.severity || 'MEDIUM';
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }
    return Object.entries(bySeverity).map(([key, value]) => ({
      label: SEVERITY_CONFIG[key]?.label || key,
      value,
      color: SEVERITY_CONFIG[key]?.color || 'hsl(var(--muted-foreground))',
    }));
  }, [failures]);

  return (
    <WidgetWrapper
      title="Fallas Abiertas"
      icon={<AlertOctagon className="h-4 w-4 text-destructive" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
      className={failures.length > 0 ? 'border-destructive/20' : ''}
    >
      {failures.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center mb-2">
            <AlertOctagon className="h-5 w-5 text-success" />
          </div>
          <p className="text-xs text-muted-foreground">Sin fallas abiertas</p>
        </div>
      ) : style === 'donut-chart' ? (
        <DonutChart
          data={donutData}
          size={110}
          showTotal={true}
          totalLabel="Fallas"
        />
      ) : (
        <div className="space-y-2">
          {failures.slice(0, 5).map((failure: any) => {
            const sevCfg = SEVERITY_CONFIG[failure.severity] || SEVERITY_CONFIG.MEDIUM;
            return (
              <div
                key={failure.id}
                className="flex items-center justify-between p-2 rounded-lg bg-accent/30"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">{failure.title || 'Sin título'}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {failure.machine?.name || '—'}
                    </div>
                  </div>
                </div>
                <Badge variant={sevCfg.badgeVariant} className="text-xs ml-2 flex-shrink-0">
                  {sevCfg.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </WidgetWrapper>
  );
}
