'use client';

import { useQuery } from '@tanstack/react-query';

export interface MaintenanceAlert {
  id: number;
  type: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'UPCOMING';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  machineName: string;
  nextMaintenanceDate: string;
  daysUntilDue: number;
  alertDaysBefore: number[];
  assignedToName: string | null;
  frequencyDays: number;
}

export interface AlertsSummary {
  total: number;
  overdue: number;
  dueToday: number;
  dueSoon: number;
  upcoming: number;
  critical: number;
  high: number;
}

export interface MaintenanceAlertsResponse {
  alerts: MaintenanceAlert[];
  summary: AlertsSummary;
}

interface UseMaintenanceAlertsOptions {
  companyId: number | null;
  sectorId?: number | null;
  daysAhead?: number;
  enabled?: boolean;
}

async function fetchMaintenanceAlerts(
  companyId: number,
  daysAhead: number,
  sectorId?: number | null
): Promise<MaintenanceAlertsResponse> {
  const params = new URLSearchParams({
    companyId: companyId.toString(),
    daysAhead: daysAhead.toString(),
  });
  if (sectorId) params.set('sectorId', sectorId.toString());

  const response = await fetch(`/api/maintenance/preventive/alerts?${params}`);

  if (!response.ok) {
    throw new Error('Error al cargar alertas de mantenimiento');
  }

  return response.json();
}

export function useMaintenanceAlerts({
  companyId,
  sectorId,
  daysAhead = 7,
  enabled = true,
}: UseMaintenanceAlertsOptions) {
  return useQuery({
    queryKey: ['maintenance-alerts', companyId, sectorId, daysAhead],
    queryFn: () => fetchMaintenanceAlerts(companyId!, daysAhead, sectorId),
    enabled: enabled && companyId !== null,
    staleTime: 60 * 1000, // 1 minuto
    refetchInterval: 5 * 60 * 1000, // Refrescar cada 5 minutos
  });
}
