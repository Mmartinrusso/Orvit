'use client';

import { useQuery } from '@tanstack/react-query';

interface UseMachineDetailOptions {
  machineId: number | null | undefined;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ Hook centralizado para detalle de máquina
 * Reemplaza fetch directo en MachineDetailDialog
 */
export function useMachineDetail(options: UseMachineDetailOptions) {
  const {
    machineId,
    enabled = true,
    staleTime = 60 * 1000 // 60s cache (datos de máquina cambian poco)
  } = options;

  return useQuery({
    queryKey: ['machine-detail', Number(machineId)],
    queryFn: async () => {
      if (!machineId) throw new Error('machineId is required');
      
      const response = await fetch(`/api/machines/detail?machineId=${machineId}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: enabled && !!machineId,
    staleTime,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData // Evitar flash
  });
}

