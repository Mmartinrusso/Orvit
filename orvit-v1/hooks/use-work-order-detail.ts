'use client';

import { useQuery } from '@tanstack/react-query';

interface WorkOrderDetailData {
  workOrder: any;
  relatedHistory: any[];
  metadata: {
    workOrderId: number;
    timestamp: string;
  };
}

interface UseWorkOrderDetailOptions {
  enabled?: boolean;
  staleTime?: number;
}

/**
 * ✨ HOOK OPTIMIZADO: Detalle completo de una orden de trabajo
 * Usa el endpoint agregador /api/work-orders/detail
 * 
 * ANTES: 3-5 requests separados
 * DESPUÉS: 1 request con React Query
 */
export function useWorkOrderDetail(
  workOrderId: number | null | undefined,
  options: UseWorkOrderDetailOptions = {}
) {
  const { enabled = true, staleTime = 2 * 60 * 1000 } = options; // 2 min cache

  return useQuery<WorkOrderDetailData>({
    queryKey: ['work-order-detail', workOrderId],
    queryFn: async () => {
      const response = await fetch(`/api/work-orders/detail?workOrderId=${workOrderId}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: enabled && !!workOrderId,
    staleTime,
    refetchOnWindowFocus: false
  });
}
