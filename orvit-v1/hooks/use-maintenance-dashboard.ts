'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  MaintenanceDashboardData,
  UseOptimizedDataReturn
} from '@/types/performance';

interface UseMaintenanceDashboardOptions {
  pageSize?: number;
  enabled?: boolean;
  refetchInterval?: number;
}

type UseMaintenanceDashboardReturn = UseOptimizedDataReturn<MaintenanceDashboardData>;

/**
 * Fetch del dashboard unificado de mantenimiento.
 */
async function fetchDashboardData(
  companyId: number,
  sectorId: number | null | undefined,
  pageSize: number
): Promise<MaintenanceDashboardData> {
  const params = new URLSearchParams({
    companyId: companyId.toString(),
    pageSize: pageSize.toString()
  });

  if (sectorId) {
    params.append('sectorId', sectorId.toString());
  }

  const response = await fetch(`/api/maintenance/dashboard?${params.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data || typeof data !== 'object') {
    throw new Error('Respuesta del dashboard inválida');
  }

  return data;
}

/**
 * Hook principal — migrado a TanStack Query v5.
 *
 * TanStack Query brinda de forma nativa:
 *   - Deduplicación de requests con misma queryKey
 *   - Cache con staleTime configurable
 *   - Refetch automático opcional
 *   - Loading / error state management
 */
export function useMaintenanceDashboard(
  companyId: number | null | undefined,
  sectorId?: number | null,
  options: UseMaintenanceDashboardOptions = {}
): UseMaintenanceDashboardReturn {
  const {
    pageSize = 50,
    enabled = true,
    refetchInterval
  } = options;

  const query = useQuery<MaintenanceDashboardData>({
    queryKey: ['maintenance-dashboard', companyId, sectorId, pageSize],
    queryFn: () => fetchDashboardData(companyId!, sectorId, pageSize),
    enabled: enabled && !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchInterval: refetchInterval || false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch
  };
}

// ============================================================================
// HOOKS DERIVADOS — compatibilidad con código existente
// ============================================================================

export function usePendingMaintenances(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  return { data: data?.pending || [], isLoading, isError, error, refetch };
}

export function useCompletedTodayMaintenances(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  return { data: data?.completedToday || [], isLoading, isError, error, refetch };
}

export function useMaintenanceMachines(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  return { data: data?.machines || [], isLoading, isError, error, refetch };
}

export function useMaintenanceMobileUnits(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  return { data: data?.mobileUnits || [], isLoading, isError, error, refetch };
}

export function useMaintenanceKPIs(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  return { data: data?.kpis || null, isLoading, isError, error, refetch };
}

export function useMaintenanceChecklists(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  return { data: data?.checklists || [], isLoading, isError, error, refetch };
}

export function useMaintenanceRecentHistory(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  return { data: data?.recentHistory || [], isLoading, isError, error, refetch };
}
