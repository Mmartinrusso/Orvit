'use client';

import { useQuery } from '@tanstack/react-query';

export interface WorkOrderAlert {
  id: number;
  type: 'OVERDUE' | 'SLA_BREACHED' | 'UNASSIGNED_CRITICAL' | 'WAITING_TOO_LONG' | 'WITH_DOWNTIME';
  priority: string;
  title: string;
  machineName: string | null;
  machineId: number | null;
  scheduledDate: string | null;
  hoursOverdue: number;
  status: string;
  assignedToName: string | null;
  waitingReason: string | null;
  slaStatus: string | null;
}

export interface WorkOrderAlertsSummary {
  total: number;
  overdue: number;
  slaBreeched: number;
  unassignedCritical: number;
  waitingTooLong: number;
  withDowntime: number;
}

export interface WorkOrderAlertsResponse {
  alerts: WorkOrderAlert[];
  summary: WorkOrderAlertsSummary;
  generatedAt: string;
}

interface UseWorkOrderAlertsOptions {
  waitingHours?: number;
  limit?: number;
  enabled?: boolean;
}

async function fetchWorkOrderAlerts(
  waitingHours: number,
  limit: number
): Promise<WorkOrderAlertsResponse> {
  const params = new URLSearchParams({
    waitingHours: waitingHours.toString(),
    limit: limit.toString(),
  });

  const response = await fetch(`/api/work-orders/alerts?${params}`);

  if (!response.ok) {
    throw new Error('Error al cargar alertas de órdenes de trabajo');
  }

  return response.json();
}

export function useWorkOrderAlerts({
  waitingHours = 24,
  limit = 30,
  enabled = true,
}: UseWorkOrderAlertsOptions = {}) {
  return useQuery({
    queryKey: ['work-order-alerts', waitingHours, limit],
    queryFn: () => fetchWorkOrderAlerts(waitingHours, limit),
    enabled,
    staleTime: 60 * 1000, // 1 minuto
    refetchInterval: 5 * 60 * 1000, // Refrescar cada 5 minutos
  });
}
