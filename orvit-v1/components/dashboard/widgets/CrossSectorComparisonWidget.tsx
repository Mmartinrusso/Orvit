'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetWrapper, WidgetProps } from './WidgetWrapper';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { Building2 } from 'lucide-react';
import { BarChart } from '../charts/BarChart';
import { ProgressBar } from '../charts/ProgressBar';

interface ExtendedWidgetProps extends WidgetProps {
  onRemove?: () => void;
  isEditMode?: boolean;
  style?: WidgetStyle;
  headerActions?: React.ReactNode;
}

export function CrossSectorComparisonWidget({
  companyId,
  onRemove,
  isEditMode,
  style = 'bar-chart',
  headerActions,
}: ExtendedWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cross-sector-stats', companyId],
    queryFn: async () => {
      const response = await fetch('/api/maintenance/cross-sector-stats');
      if (!response.ok) throw new Error('Error fetching cross-sector stats');
      return response.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!companyId,
  });

  const sectors = data?.sectors || [];

  const activeData = sectors.map((s: any) => ({
    label: s.sectorName?.substring(0, 10) || `Sector ${s.sectorId}`,
    value: s.activeOTs || 0,
  }));

  const overdueData = sectors.map((s: any) => ({
    label: s.sectorName?.substring(0, 10) || `Sector ${s.sectorId}`,
    value: s.overdueOTs || 0,
    color: 'bg-destructive',
  }));

  return (
    <WidgetWrapper
      title="Comparativa Sectores"
      icon={<Building2 className="h-4 w-4 text-info-muted-foreground" />}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onRemove={onRemove}
      isEditMode={isEditMode}
      headerActions={headerActions}
    >
      {sectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Sin datos por sector</p>
        </div>
      ) : style === 'bar-chart' ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">OTs Activas</p>
            <BarChart
              data={activeData}
              height={80}
              showLabels={true}
              showValues={true}
              colors={['bg-info', 'bg-primary', 'bg-chart-1', 'bg-chart-3', 'bg-chart-5']}
            />
          </div>
          {overdueData.some((d: any) => d.value > 0) && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">OTs Vencidas</p>
              <BarChart
                data={overdueData}
                height={80}
                showLabels={true}
                showValues={true}
                colors={['bg-destructive', 'bg-warning', 'bg-chart-1']}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sectors.map((sector: any) => (
            <div key={sector.sectorId} className="p-2 rounded-lg bg-accent/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">{sector.sectorName}</span>
                <span className="text-xs text-muted-foreground">
                  {sector.activeOTs} activas
                  {sector.overdueOTs > 0 && (
                    <span className="text-destructive ml-1">({sector.overdueOTs} vencidas)</span>
                  )}
                </span>
              </div>
              <ProgressBar
                value={sector.completionRate}
                max={100}
                label="Tasa completitud"
                showPercentage={true}
                size="sm"
                color={
                  sector.completionRate >= 80 ? 'bg-success'
                  : sector.completionRate >= 50 ? 'bg-warning'
                  : 'bg-destructive'
                }
              />
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
