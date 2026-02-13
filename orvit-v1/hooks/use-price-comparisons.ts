'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface CompetitorPrice {
  id: number;
  name: string;
  prices: { [productId: number]: number | null };
}

export interface PriceComparison {
  id: string;
  name: string;
  createdAt: string;
  competitors: CompetitorPrice[];
  products: Array<{
    productId: number;
    productName: string;
    myPrice: number;
  }>;
}

export interface CreatePriceComparisonData {
  name: string;
  companyId: number;
  competitors: Array<{
    name: string;
    prices: { [productId: number]: number | null };
  }>;
  products: Array<{
    productId: number;
    productName: string;
    myPrice: number;
  }>;
}

/**
 * Helper para generar queryKey consistente
 */
export function priceComparisonsKey(companyId: number | string | undefined): (string | number)[] {
  return ['price-comparisons', Number(companyId)];
}

/**
 * Hook para obtener comparaciones de precios
 */
export function usePriceComparisons(companyId: number | string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: priceComparisonsKey(companyId),
    queryFn: async () => {
      if (!companyId) {
        throw new Error('companyId es requerido');
      }
      
      const url = `/api/price-comparisons?companyId=${Number(companyId)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener comparaciones de precios');
      }
      
      return response.json() as Promise<PriceComparison[]>;
    },
    enabled: enabled && !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false,
    networkMode: 'always',
    retry: 1,
  });
}

/**
 * Hook para crear nueva comparación de precios
 */
export function useCreatePriceComparison() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreatePriceComparisonData) => {
      const response = await fetch('/api/price-comparisons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al crear comparación de precios');
      }
      
      const result = await response.json();
      return result.comparison as PriceComparison;
    },
    onSuccess: (_, variables) => {
      // Invalidar queries de comparaciones para esta empresa
      queryClient.invalidateQueries({ 
        queryKey: priceComparisonsKey(variables.companyId) 
      });
    },
  });
}

/**
 * Hook para eliminar comparación de precios
 */
export function useDeletePriceComparison() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: number | string }) => {
      const response = await fetch(`/api/price-comparisons?id=${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al eliminar comparación');
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidar queries de comparaciones para esta empresa
      queryClient.invalidateQueries({ 
        queryKey: priceComparisonsKey(variables.companyId) 
      });
    },
  });
}

