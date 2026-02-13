'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * ✨ HOOK OPTIMIZADO: Dashboard top products con React Query
 */
export function useDashboardTopProducts(
  companyId: string | number | undefined,
  month?: string,
  limit: number = 50,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['dashboard-top-products', companyId, month, limit],
    queryFn: async () => {
      if (!companyId) {
        throw new Error('Company ID is required');
      }
      
      const url = `/api/dashboard/top-products?companyId=${companyId}&month=${month || ''}&limit=${limit}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch top products');
      }
      
      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * ✨ HOOK OPTIMIZADO: Dashboard production summary con React Query
 */
export function useDashboardProductionSummary(
  companyId: string | number | undefined,
  month?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['dashboard-production-summary', companyId, month],
    queryFn: async () => {
      if (!companyId) {
        throw new Error('Company ID is required');
      }
      
      const url = `/api/dashboard/production-summary?companyId=${companyId}&month=${month || ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch production summary');
      }
      
      return response.json();
    },
    enabled: enabled && !!companyId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Helper para generar queryKey consistente
 */
export function calculadoraCostosFinalKey(
  companyId: number | string | undefined,
  productionMonth?: string,
  distributionMethod: 'sales' | 'production' = 'production'
): (string | number)[] {
  // ✨ FIX: Normalizar siempre para evitar queryKeys inconsistentes
  // Si companyId es undefined, usar 0 como placeholder (la query no se ejecutará por enabled)
  const normalizedCompanyId = companyId ? Number(companyId) : 0;
  const normalizedMonth = productionMonth || '';
  return ['calculadora-costos-final', normalizedCompanyId, normalizedMonth, distributionMethod];
}

/**
 * ✨ HOOK OPTIMIZADO: Calculadora costos final con React Query
 */
export function useCalculadoraCostosFinal(
  companyId: string | number | undefined,
  productionMonth?: string,
  distributionMethod: 'sales' | 'production' = 'production',
  enabled: boolean = true
) {
  return useQuery({
    queryKey: calculadoraCostosFinalKey(companyId, productionMonth, distributionMethod),
    queryFn: async () => {
      if (!companyId) {
        throw new Error('Company ID is required');
      }
      
      // ✨ FIX: Siempre incluir productionMonth si está disponible (queryKey estable)
      let url = `/api/calculadora-costos-final?companyId=${Number(companyId)}&distributionMethod=${distributionMethod}`;
      if (productionMonth) {
        url += `&productionMonth=${productionMonth}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch calculadora costos');
      }
      
      return response.json();
    },
    enabled: enabled && !!companyId && !!productionMonth, // ✨ FIX: Requerir productionMonth para evitar queries con undefined
    staleTime: 60 * 1000, // 1 minuto - este endpoint es más pesado
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    networkMode: 'always',
    retry: 1,
    // ✨ OPTIMIZADO: Mantener datos anteriores mientras se carga nueva query
    placeholderData: (previousData) => previousData,
  });
}

