'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ConsolidationData {
  month: string;
  exists: boolean;
  isClosed: boolean;
  calculatedAt: string | null;
  version: string;
  costs: {
    payroll: number;
    purchases: number;
    indirect: number;
    production: number;
    maintenance: number;
  };
  revenue: {
    sales: number;
    cogs: number;
    margin: number;
  };
  summary: {
    totalCost: number;
    totalRevenue: number;
    netResult: number;
  };
  details: any;
}

export interface CostConfig {
  version: string;
  usePayrollData: boolean;
  useComprasData: boolean;
  useVentasData: boolean;
  useProdData: boolean;
  useIndirectData: boolean;
  useMaintData: boolean;
}

/**
 * Hook para obtener la consolidación mensual de costos V2
 */
export function useConsolidation(month: string, enabled: boolean = true) {
  return useQuery<ConsolidationData>({
    queryKey: ['consolidation', month],
    queryFn: async () => {
      const response = await fetch(`/api/costos/consolidation?month=${month}`);
      if (!response.ok) throw new Error('Error fetching consolidation');
      return response.json();
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

/**
 * Hook para recalcular la consolidación
 */
export function useRecalculateConsolidation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ month, force = false }: { month: string; force?: boolean }) => {
      const response = await fetch('/api/costos/consolidation/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, force }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error recalculating');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consolidation', variables.month] });
    },
  });
}

/**
 * Hook para obtener la configuración de costos
 */
export function useCostConfig() {
  return useQuery<{ config: CostConfig }>({
    queryKey: ['costConfig'],
    queryFn: async () => {
      const response = await fetch('/api/costos/config');
      if (!response.ok) throw new Error('Error fetching config');
      return response.json();
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

/**
 * Hook para actualizar la configuración
 */
export function useUpdateCostConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<CostConfig>) => {
      const response = await fetch('/api/costos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Error updating config');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costConfig'] });
      queryClient.invalidateQueries({ queryKey: ['prerequisites'] });
    },
  });
}

/**
 * Hook para cerrar/reabrir período
 */
export function useClosePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ month, action }: { month: string; action: 'close' | 'reopen' }) => {
      const response = await fetch('/api/costos/consolidation/close', {
        method: action === 'close' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consolidation', variables.month] });
    },
  });
}

/**
 * Hook para obtener datos de un módulo específico
 */
export function useModuleCosts(module: string, month: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['moduleCosts', module, month],
    queryFn: async () => {
      const response = await fetch(`/api/costos/${module}?month=${month}`);
      if (!response.ok) throw new Error(`Error fetching ${module} costs`);
      return response.json();
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}
