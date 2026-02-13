'use client';

import { useQuery } from '@tanstack/react-query';

interface UseMachineFailuresOptions {
  machineId: number | null | undefined;
  companyId: number | null | undefined;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ Hook centralizado para fallas de una máquina
 * Reemplaza fetch directo en MachineDetailDialog
 */
export function useMachineFailures(options: UseMachineFailuresOptions) {
  const {
    machineId,
    companyId,
    enabled = true,
    staleTime = 30 * 1000 // 30s cache
  } = options;

  return useQuery({
    queryKey: ['machine-failures', Number(machineId), Number(companyId)],
    queryFn: async () => {
      if (!machineId || !companyId) throw new Error('machineId and companyId are required');
      
      const response = await fetch(`/api/failures?machineId=${machineId}&companyId=${companyId}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data.failures || [];
    },
    enabled: enabled && !!machineId && !!companyId,
    staleTime,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData // Evitar flash
  });
}

