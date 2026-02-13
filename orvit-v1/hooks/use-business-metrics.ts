'use client';

import { useQuery } from '@tanstack/react-query';

// ── Types ──────────────────────────────────────────────────────────

interface MetricDataPoint {
  period: string;
  name: string;
  sum: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

interface MetricsResponse {
  data: MetricDataPoint[];
  groupBy: string;
  startDate: string;
  endDate: string;
}

interface MetricKPI {
  current: number;
  previous: number;
  change: number;
  count: number;
}

interface MetricsSummary {
  work_orders_created: MetricKPI;
  work_orders_completed: MetricKPI;
  resolution_time: MetricKPI;
  costs_calculated: MetricKPI;
  successful_logins: MetricKPI;
  failed_logins: MetricKPI;
  period: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
}

// ── Query Keys ─────────────────────────────────────────────────────

export const businessMetricsKeys = {
  all: ['business-metrics'] as const,
  list: (params: Record<string, string>) =>
    [...businessMetricsKeys.all, 'list', params] as const,
  summary: () => [...businessMetricsKeys.all, 'summary'] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────

interface UseBusinessMetricsParams {
  name?: string;
  startDate: string;
  endDate: string;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  enabled?: boolean;
}

/**
 * Hook para obtener métricas de negocio agregadas por período temporal.
 */
export function useBusinessMetrics({
  name,
  startDate,
  endDate,
  groupBy = 'day',
  enabled = true,
}: UseBusinessMetricsParams) {
  const params: Record<string, string> = { startDate, endDate, groupBy };
  if (name) params.name = name;

  return useQuery<MetricsResponse, Error>({
    queryKey: businessMetricsKeys.list(params),
    queryFn: async () => {
      const qs = new URLSearchParams(params).toString();
      const response = await fetch(`/api/admin/metrics?${qs}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener métricas');
      }

      return response.json();
    },
    enabled: enabled && !!startDate && !!endDate,
    staleTime: 60 * 1000, // 1 minuto
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para obtener el resumen de KPIs (últimos 30 días vs período anterior).
 */
export function useBusinessMetricsSummary(enabled = true) {
  return useQuery<MetricsSummary, Error>({
    queryKey: businessMetricsKeys.summary(),
    queryFn: async () => {
      const response = await fetch('/api/admin/metrics/summary');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener resumen de métricas');
      }

      return response.json();
    },
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
