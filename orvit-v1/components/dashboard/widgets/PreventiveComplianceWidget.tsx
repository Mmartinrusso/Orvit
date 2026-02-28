'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { Shield, CheckCircle, Clock, XCircle } from 'lucide-react';
import { DonutChart } from '../charts/DonutChart';
import { ProgressBar } from '../charts/ProgressBar';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

export function PreventiveComplianceWidget({
  companyId,
  sectorId,
  onRemove,
  isEditMode,
  style = 'donut-chart',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['preventive-compliance', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());

      const response = await fetch(`/api/maintenance/kpis?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching KPIs');
      return response.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!companyId,
  });

  const compliance = data?.preventiveCompliance || {};
  const scheduled = compliance.scheduled || compliance.total || 0;
  const completedOnTime = compliance.completedOnTime || 0;
  const completedLate = compliance.completedLate || 0;
  const missed = compliance.missed || Math.max(0, scheduled - completedOnTime - completedLate);
  const complianceRate = scheduled > 0 ? Math.round((completedOnTime / scheduled) * 100) : 0;

  const donutData = [
    { label: 'A Tiempo', value: completedOnTime, color: 'hsl(var(--success))' },
    { label: 'Tardío', value: completedLate, color: 'hsl(var(--warning))' },
    { label: 'Omitido', value: missed, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0);

  return (
    <WidgetWrapper
      title="Cumplimiento Preventivo"
      icon={<Shield className="h-4 w-4 text-info-muted-foreground" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {scheduled === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Sin datos preventivos</p>
        </div>
      ) : style === 'progress' || style === 'stat-card' ? (
        <div className="space-y-4">
          <div className="text-center">
            <div className={`text-3xl font-bold ${
              complianceRate >= 80 ? 'text-success' :
              complianceRate >= 50 ? 'text-warning-muted-foreground' : 'text-destructive'
            }`}>
              {complianceRate}%
            </div>
            <p className="text-xs text-muted-foreground">Cumplimiento</p>
          </div>
          <ProgressBar
            value={complianceRate}
            max={100}
            showPercentage={false}
            size="md"
            color={
              complianceRate >= 80 ? 'bg-success' :
              complianceRate >= 50 ? 'bg-warning' : 'bg-destructive'
            }
          />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <CheckCircle className="h-3.5 w-3.5 text-success mx-auto mb-0.5" />
              <div className="text-sm font-semibold">{completedOnTime}</div>
              <div className="text-xs text-muted-foreground">A tiempo</div>
            </div>
            <div>
              <Clock className="h-3.5 w-3.5 text-warning-muted-foreground mx-auto mb-0.5" />
              <div className="text-sm font-semibold">{completedLate}</div>
              <div className="text-xs text-muted-foreground">Tardío</div>
            </div>
            <div>
              <XCircle className="h-3.5 w-3.5 text-destructive mx-auto mb-0.5" />
              <div className="text-sm font-semibold">{missed}</div>
              <div className="text-xs text-muted-foreground">Omitido</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Cumplimiento: <span className={`font-semibold ${
              complianceRate >= 80 ? 'text-success' :
              complianceRate >= 50 ? 'text-warning-muted-foreground' : 'text-destructive'
            }`}>{complianceRate}%</span>
          </div>
          <DonutChart
            data={donutData}
            size={100}
            showTotal={true}
            totalLabel="Programados"
          />
        </div>
      )}
    </WidgetWrapper>
  );
}
