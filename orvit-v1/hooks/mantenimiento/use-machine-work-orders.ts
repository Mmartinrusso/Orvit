'use client';

import { useQuery } from '@tanstack/react-query';

interface UseMachineWorkOrdersOptions {
  machineId: number | null | undefined;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ Hook centralizado para órdenes de trabajo de una máquina
 * Reemplaza fetch directo en MachineDetailDialog
 */
export function useMachineWorkOrders(options: UseMachineWorkOrdersOptions) {
  const {
    machineId,
    enabled = true,
    staleTime = 30 * 1000 // 30s cache
  } = options;

  return useQuery({
    queryKey: ['machine-work-orders', Number(machineId)],
    queryFn: async () => {
      if (!machineId) throw new Error('machineId is required');

      const response = await fetch(`/api/work-orders?machineId=${machineId}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      // API returns { data: [...], pagination: {...} } — extract the array
      return Array.isArray(result) ? result : (result.data || []);
    },
    enabled: enabled && !!machineId,
    staleTime,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData // Evitar flash
  });
}

