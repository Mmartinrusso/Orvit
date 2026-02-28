'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { Activity, Heart } from 'lucide-react';
import { BarChart } from '../charts/BarChart';
import { ProgressBar } from '../charts/ProgressBar';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

const getHealthColor = (score: number) => {
  if (score >= 80) return { bar: 'bg-success', text: 'text-success' };
  if (score >= 50) return { bar: 'bg-warning', text: 'text-warning-muted-foreground' };
  return { bar: 'bg-destructive', text: 'text-destructive' };
};

export function HealthScoresOverviewWidget({
  companyId,
  sectorId,
  onRemove,
  isEditMode,
  style = 'list',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['health-scores', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());

      const response = await fetch(`/api/maintenance/health-score?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching health scores');
      return response.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!companyId,
  });

  const machines = React.useMemo(() => {
    const raw = data?.machines || data?.scores || [];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((m: any) => m.healthScore != null)
      .sort((a: any, b: any) => (a.healthScore || 0) - (b.healthScore || 0))
      .slice(0, 8);
  }, [data]);

  const avgScore = React.useMemo(() => {
    if (machines.length === 0) return 0;
    const sum = machines.reduce((acc: number, m: any) => acc + (m.healthScore || 0), 0);
    return Math.round(sum / machines.length);
  }, [machines]);

  const barData = machines.map((m: any) => ({
    label: (m.name || m.machineName || `#${m.id}`).substring(0, 12),
    value: m.healthScore || 0,
    color: (m.healthScore || 0) >= 80 ? 'bg-success'
      : (m.healthScore || 0) >= 50 ? 'bg-warning' : 'bg-destructive',
  }));

  return (
    <WidgetWrapper
      title="Health Scores"
      icon={<Activity className="h-4 w-4 text-info-muted-foreground" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {machines.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <Heart className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Sin datos de health score</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Promedio:</span>
            <span className={`font-semibold ${getHealthColor(avgScore).text}`}>{avgScore}%</span>
          </div>

          {style === 'bar-chart' ? (
            <BarChart
              data={barData}
              horizontal={true}
              showLabels={true}
              showValues={true}
            />
          ) : (
            <div className="space-y-2">
              {machines.slice(0, 6).map((m: any) => {
                const score = m.healthScore || 0;
                const colors = getHealthColor(score);
                return (
                  <ProgressBar
                    key={m.id}
                    value={score}
                    max={100}
                    label={m.name || m.machineName || `Máquina #${m.id}`}
                    showPercentage={true}
                    size="sm"
                    color={colors.bar}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
