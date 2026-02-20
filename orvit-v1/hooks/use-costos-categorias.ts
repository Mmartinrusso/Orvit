'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface EmployeeCategory {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  employeeCount?: number;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  companyId: number;
}

/**
 * Helper para generar queryKey consistente
 */
export function costosCategoriasKey(companyId: number | string | undefined): (string | number)[] {
  return ['costos-categorias', Number(companyId)];
}

/**
 * Hook para obtener categorías de costos (empleados)
 */
export function useCostosCategorias(companyId: number | string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: costosCategoriasKey(companyId),
    queryFn: async () => {
      if (!companyId) {
        throw new Error('companyId es requerido');
      }
      
      const url = `/api/costos/categorias?companyId=${Number(companyId)}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener categorías');
      }

      const data = await response.json();
      // La API devuelve paginado { items, page, ... } — extraer el array
      return (Array.isArray(data) ? data : (data.items ?? [])) as EmployeeCategory[];
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
 * Hook para crear nueva categoría
 */
export function useCreateCategoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateCategoryData) => {
      const response = await fetch('/api/costos/categorias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al crear categoría');
      }
      
      return response.json() as Promise<EmployeeCategory>;
    },
    onSuccess: (_, variables) => {
      // Invalidar queries de categorías para esta empresa
      queryClient.invalidateQueries({ 
        queryKey: costosCategoriasKey(variables.companyId) 
      });
    },
  });
}

