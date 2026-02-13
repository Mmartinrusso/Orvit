'use client';

import { useQuery } from '@tanstack/react-query';

interface MaintenanceHistoryItem {
  id: string;
  maintenanceId: number;
  maintenanceType: 'PREVENTIVE' | 'CORRECTIVE';
  type: string;
  title: string;
  description?: string;
  machineId?: number;
  machineName?: string;
  assignedToName?: string;
  executedAt: string;
  actualDuration?: number;
  notes?: string;
  issues?: string;
  completionStatus: string;
  companyId: number;
  cost?: number;
  isFromChecklist: boolean;
  checklistId?: string;
  priority?: string;
  status?: string;
  scheduledDate?: string;
  completedDate?: string;
}

interface MaintenanceHistoryResponse {
  success: boolean;
  data: {
    executions: MaintenanceHistoryItem[];
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
    nextPage: number | null;
  };
}

interface UseMaintenanceHistoryOptions {
  enabled?: boolean;
  staleTime?: number;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  machineIds?: number[];
  unidadMovilIds?: number[];
}

/**
 * ✨ HOOK OPTIMIZADO: Historial de mantenimiento
 * Usa el endpoint /api/maintenance/history con paginación
 * 
 * Soporta:
 * - Paginación
 * - Filtro por máquina/unidad móvil
 * - Búsqueda por término
 * - Cache con React Query
 */
export function useMaintenanceHistory(
  companyId: number | null | undefined,
  sectorId?: number | null,
  options: UseMaintenanceHistoryOptions = {}
) {
  const { 
    enabled = true, 
    staleTime = 2 * 60 * 1000, // 2 min cache
    page = 0,
    pageSize = 50,
    searchTerm,
    machineIds,
    unidadMovilIds
  } = options;

  return useQuery<MaintenanceHistoryResponse>({
    queryKey: ['maintenance-history', companyId, sectorId, page, pageSize, searchTerm, machineIds, unidadMovilIds],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (machineIds?.length) params.append('machineIds', machineIds.join(','));
      if (unidadMovilIds?.length) params.append('unidadMovilIds', unidadMovilIds.join(','));

      const response = await fetch(`/api/maintenance/history?${params.toString()}`);
      
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

// Hook simplificado para obtener solo las ejecuciones
export function useMaintenanceExecutions(
  companyId: number | null | undefined,
  sectorId?: number | null,
  options: UseMaintenanceHistoryOptions = {}
) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceHistory(companyId, sectorId, options);
  
  return {
    executions: data?.data?.executions || [],
    pagination: data?.pagination || null,
    isLoading,
    isError,
    error,
    refetch
  };
}
