'use client';

import { useQuery } from '@tanstack/react-query';

interface UseMaintenancePendingOptions {
  companyId: number | null | undefined;
  sectorId?: number | null;
  machineId?: number | null;
  priority?: string;
  type?: string;
  machineIds?: string;
  unidadMovilIds?: string;
  searchTerm?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ Hook centralizado para mantenimientos pendientes
 * Reemplaza fetch directo en EnhancedMaintenancePanel
 */
export function useMaintenancePending(options: UseMaintenancePendingOptions) {
  const {
    companyId,
    sectorId,
    machineId,
    priority,
    type,
    machineIds,
    unidadMovilIds,
    searchTerm,
    sortOrder,
    page = 0,
    pageSize = 50,
    enabled = true,
    staleTime = 30 * 1000 // 30s cache
  } = options;

  return useQuery({
    queryKey: [
      'maintenance-pending', 
      Number(companyId), 
      Number(sectorId) || null, 
      Number(machineId) || null, 
      priority, 
      type,
      machineIds,
      unidadMovilIds,
      searchTerm,
      sortOrder,
      page,
      pageSize
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      if (machineId) params.append('machineId', machineId.toString());
      if (priority) params.append('priority', priority);
      if (type) params.append('type', type);
      if (machineIds) params.append('machineIds', machineIds);
      if (unidadMovilIds) params.append('unidadMovilIds', unidadMovilIds);
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (sortOrder) params.append('sortOrder', sortOrder);
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const response = await fetch(`/api/maintenance/pending?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData // Evitar flash
  });
}

