'use client';

import { useQuery } from '@tanstack/react-query';

interface WorkOrder {
  id: number;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  scheduledDate?: string;
  completedDate?: string;
  machine?: {
    id: number;
    name: string;
    nickname?: string;
  };
  unidadMovil?: {
    id: number;
    nombre: string;
    patente?: string;
  };
  assignedTo?: {
    id: number;
    name: string;
  };
  assignedWorker?: {
    id: number;
    name: string;
  };
}

interface WorkOrdersStats {
  total: number;
  pending: number;
  inProgress: number;
  completedThisMonth: number;
  overdue: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

interface WorkOrdersDashboardData {
  pending: WorkOrder[];
  inProgress: WorkOrder[];
  completedRecent: WorkOrder[];
  overdue: WorkOrder[];
  stats: WorkOrdersStats;
  metadata: {
    companyId: number;
    sectorId: number | null;
    timestamp: string;
  };
}

interface UseWorkOrdersDashboardOptions {
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ HOOK OPTIMIZADO: Dashboard de órdenes de trabajo
 * Usa el endpoint agregador /api/work-orders/dashboard
 * 
 * ANTES: 4-6 requests separados
 * DESPUÉS: 1 request con React Query
 */
export function useWorkOrdersDashboard(
  companyId: number | null | undefined,
  sectorId?: number | null,
  options: UseWorkOrdersDashboardOptions = {}
) {
  const { enabled = true, staleTime = 2 * 60 * 1000 } = options; // 2 min cache

  return useQuery<WorkOrdersDashboardData>({
    queryKey: ['work-orders-dashboard', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());

      const response = await fetch(`/api/work-orders/dashboard?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime,
    refetchOnWindowFocus: false
  });
}

// Hooks derivados para compatibilidad
export function usePendingWorkOrders(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useWorkOrdersDashboard(companyId, sectorId);
  
  return {
    workOrders: data?.pending || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useInProgressWorkOrders(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, refetch } = useWorkOrdersDashboard(companyId, sectorId);
  
  return {
    workOrders: data?.inProgress || [],
    isLoading,
    refetch
  };
}

export function useOverdueWorkOrders(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, refetch } = useWorkOrdersDashboard(companyId, sectorId);
  
  return {
    workOrders: data?.overdue || [],
    isLoading,
    refetch
  };
}

export function useWorkOrdersStats(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading } = useWorkOrdersDashboard(companyId, sectorId);
  
  return {
    stats: data?.stats || null,
    isLoading
  };
}
