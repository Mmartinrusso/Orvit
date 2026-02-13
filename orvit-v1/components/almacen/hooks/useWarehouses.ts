'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { normalizeWarehouses, WarehouseDTO, WarehouseCreateInput } from '@/lib/almacen/types';

interface UseWarehousesOptions {
  includeInactive?: boolean;
  isTransit?: boolean;
}

/**
 * Hook para obtener lista de depósitos/almacenes
 * Usa adapter para normalizar datos (acepta name/nombre)
 */
export function useWarehouses(options?: UseWarehousesOptions) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'warehouses', currentCompany?.id, options?.includeInactive, options?.isTransit],
    queryFn: async (): Promise<WarehouseDTO[]> => {
      if (!currentCompany?.id) return [];

      const params = new URLSearchParams({
        companyId: String(currentCompany.id),
      });

      if (options?.includeInactive) {
        params.append('includeInactive', 'true');
      }

      if (options?.isTransit !== undefined) {
        params.append('isTransit', String(options.isTransit));
      }

      const res = await fetch(`/api/almacen/warehouses?${params}`);
      if (!res.ok) {
        throw new Error('Error al cargar depósitos');
      }

      const data = await res.json();
      // Siempre normalizar con adapter para garantizar campos consistentes
      return normalizeWarehouses(data.warehouses || []);
    },
    enabled: !!currentCompany?.id,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook para obtener un depósito específico
 */
export function useWarehouse(warehouseId: number | null) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'warehouse', warehouseId],
    queryFn: async (): Promise<WarehouseDTO | null> => {
      if (!warehouseId || !currentCompany?.id) return null;

      const params = new URLSearchParams({
        companyId: String(currentCompany.id),
      });

      const res = await fetch(`/api/almacen/warehouses?${params}`);
      if (!res.ok) {
        throw new Error('Error al cargar depósito');
      }

      const data = await res.json();
      const warehouses = normalizeWarehouses(data.warehouses || []);
      return warehouses.find(w => w.id === warehouseId) || null;
    },
    enabled: !!warehouseId && !!currentCompany?.id,
  });
}

/**
 * Hook para obtener el depósito por defecto
 */
export function useDefaultWarehouse() {
  const { data: warehouses, isLoading } = useWarehouses();

  const defaultWarehouse = warehouses?.find(w => w.isDefault) || warehouses?.[0] || null;

  return {
    defaultWarehouse,
    isLoading,
  };
}

/**
 * Hook con mutations para CRUD de warehouses
 */
export function useWarehousesMutations() {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['almacen', 'warehouses'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'warehouse'] });
  };

  const create = useMutation({
    mutationFn: async (data: Omit<WarehouseCreateInput, 'companyId'>) => {
      const res = await fetch('/api/almacen/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          companyId: currentCompany?.id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear depósito');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (data: { id: number; [key: string]: any }) => {
      const res = await fetch('/api/almacen/warehouses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar depósito');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  const setDefault = useMutation({
    mutationFn: async (warehouseId: number) => {
      const res = await fetch('/api/almacen/warehouses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: warehouseId, isDefault: true }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al establecer depósito por defecto');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch('/api/almacen/warehouses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar estado');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  return {
    create,
    update,
    setDefault,
    toggleActive,
  };
}
