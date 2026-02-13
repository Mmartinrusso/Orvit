'use client';

import { useQuery } from '@tanstack/react-query';

export interface FailureAlert {
  id: number;
  type: 'CRITICAL_UNASSIGNED' | 'CRITICAL_STALE' | 'WITH_DOWNTIME' | 'RECURRENCE';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  title: string;
  machineName: string;
  machineId: number;
  reportedAt: string;
  hoursOpen: number;
  hasWorkOrder: boolean;
  assignedToName: string | null;
  causedDowntime: boolean;
  isRecurrence: boolean;
}

export interface FailureAlertsSummary {
  total: number;
  criticalUnassigned: number;
  criticalStale: number;
  withDowntime: number;
  recurrences: number;
}

export interface FailureAlertsResponse {
  alerts: FailureAlert[];
  summary: FailureAlertsSummary;
  generatedAt: string;
}

interface UseFailureAlertsOptions {
  staleHours?: number;
  limit?: number;
  enabled?: boolean;
}

async function fetchFailureAlerts(
  staleHours: number,
  limit: number
): Promise<FailureAlertsResponse> {
  const params = new URLSearchParams({
    staleHours: staleHours.toString(),
    limit: limit.toString(),
  });

  const response = await fetch(`/api/failure-occurrences/alerts?${params}`);

  if (!response.ok) {
    throw new Error('Error al cargar alertas de fallas');
  }

  return response.json();
}

export function useFailureAlerts({
  staleHours = 4,
  limit = 20,
  enabled = true,
}: UseFailureAlertsOptions = {}) {
  return useQuery({
    queryKey: ['failure-alerts', staleHours, limit],
    queryFn: () => fetchFailureAlerts(staleHours, limit),
    enabled,
    staleTime: 60 * 1000, // 1 minuto
    refetchInterval: 5 * 60 * 1000, // Refrescar cada 5 minutos
  });
}
