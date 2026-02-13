'use client';

import { useQuery } from '@tanstack/react-query';

interface UseChecklistsOptions {
  companyId: number | null | undefined;
  sectorId?: number | null;
  machineId?: number | null;
  checklistId?: number | null;
  skip?: number;
  take?: number;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ Hook centralizado para checklists
 * Reemplaza fetch directo en ChecklistManagementDialog y EnhancedMaintenancePanel
 */
export function useChecklists(options: UseChecklistsOptions) {
  const {
    companyId,
    sectorId,
    machineId,
    checklistId,
    skip = 0,
    take = 10,
    enabled = true,
    staleTime = 60 * 1000 // 60s cache (checklists cambian poco)
  } = options;

  return useQuery({
    queryKey: ['checklists', Number(companyId), Number(sectorId) || null, Number(machineId) || null, Number(checklistId) || null, skip, take],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      if (machineId) params.append('machineId', machineId.toString());
      if (checklistId) params.append('checklistId', checklistId.toString());
      params.append('skip', skip.toString());
      params.append('take', take.toString());

      const response = await fetch(`/api/maintenance/checklists?${params.toString()}`);
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

