'use client';

import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { InventarioFilters, PaginationParams } from './types';

interface UseInventarioParams {
  filters?: InventarioFilters;
  pagination?: PaginationParams;
  enabled?: boolean;
}

interface InventarioItem {
  supplierItem: {
    id: number;
    code: string;
    name: string;
    unit: string;
    category?: { id: number; name: string };
  };
  warehouseId: number;
  warehouse?: { id: number; nombre: string; codigo: string };
  stockActual: number;
  stockReservado: number;
  stockDisponible: number;
  stockMinimo: number;
  stockReorden: number;
  isBelowMinimum: boolean;
  isBelowReorder: boolean;
}

interface InventarioResponse {
  items: InventarioItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Hook para obtener disponibilidad de inventario
 */
export function useInventario(params: UseInventarioParams = {}) {
  const { currentCompany } = useCompany();
  const { filters = {}, pagination = { page: 1, pageSize: 50 }, enabled = true } = params;

  const queryKey = ['almacen', 'inventario', currentCompany?.id, filters, pagination];

  return useQuery<InventarioResponse>({
    queryKey,
    queryFn: async () => {
      if (!currentCompany?.id) {
        return { items: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      }

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });

      if (filters.warehouseId) {
        searchParams.append('warehouseId', String(filters.warehouseId));
      }
      if (filters.search) {
        searchParams.append('search', filters.search);
      }
      if (filters.onlyBelowMinimum) {
        searchParams.append('onlyBelowMinimum', 'true');
      }
      if (filters.onlyBelowReorder) {
        searchParams.append('onlyBelowReorder', 'true');
      }

      const res = await fetch(`/api/almacen/availability?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar inventario');
      }

      const data = await res.json();

      // Transform API response to match UI expected format
      const transformedItems = (data.items || []).map((item: any) => ({
        supplierItemId: item.supplierItemId,
        warehouseId: item.warehouseId,
        supplierItem: {
          id: item.supplierItemId,
          codigoProveedor: item.itemCode,
          nombre: item.itemName,
          unidad: item.unit,
        },
        warehouse: {
          id: item.warehouseId,
          nombre: item.warehouseName,
        },
        stockActual: item.onHand ?? 0,
        stockReservado: item.reserved ?? 0,
        stockDisponible: item.available ?? 0,
        stockMinimo: item.stockMinimo ?? 0,
        stockReorden: item.puntoReposicion ?? item.stockMinimo ?? 0,
        isBelowMinimum: item.belowMinimum ?? false,
        isBelowReorder: item.belowReorderPoint ?? false,
      }));

      return {
        items: transformedItems,
        total: data.total ?? 0,
        page: data.page ?? 1,
        pageSize: data.pageSize ?? 50,
        totalPages: data.totalPages ?? 1,
      };
    },
    enabled: enabled && !!currentCompany?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook para obtener disponibilidad de un item específico en un almacén
 */
export function useItemAvailability(supplierItemId: number | null, warehouseId: number | null) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'availability', supplierItemId, warehouseId],
    queryFn: async () => {
      if (!supplierItemId || !warehouseId || !currentCompany?.id) return null;

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
        supplierItemId: String(supplierItemId),
        warehouseId: String(warehouseId),
      });

      const res = await fetch(`/api/almacen/availability?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al verificar disponibilidad');
      }

      const data = await res.json();
      return data.availability;
    },
    enabled: !!supplierItemId && !!warehouseId && !!currentCompany?.id,
  });
}

/**
 * Hook para verificar disponibilidad para una cantidad específica
 */
export function useCheckAvailability(
  supplierItemId: number | null,
  warehouseId: number | null,
  quantity: number
) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'checkAvailability', supplierItemId, warehouseId, quantity],
    queryFn: async () => {
      if (!supplierItemId || !warehouseId || !currentCompany?.id || quantity <= 0) {
        return { available: false, shortfall: quantity };
      }

      const res = await fetch('/api/almacen/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierItemId,
          warehouseId,
          quantity,
          companyId: currentCompany.id,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al verificar disponibilidad');
      }

      return res.json();
    },
    enabled: !!supplierItemId && !!warehouseId && !!currentCompany?.id && quantity > 0,
  });
}

/**
 * Hook para obtener items con stock bajo
 */
export function useLowStockItems(warehouseId?: number) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'lowStock', currentCompany?.id, warehouseId],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
        onlyBelowReorder: 'true',
        pageSize: '100',
      });

      if (warehouseId) {
        searchParams.append('warehouseId', String(warehouseId));
      }

      const res = await fetch(`/api/almacen/availability?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar items con bajo stock');
      }

      const data = await res.json();
      return data.items || [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para obtener resumen de inventario
 */
export function useInventarioSummary(warehouseId?: number) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'inventario', 'summary', currentCompany?.id, warehouseId],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return {
          totalItems: 0,
          itemsBelowMinimum: 0,
          itemsBelowReorder: 0,
          totalValue: 0,
        };
      }

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
        pageSize: '1000', // Obtener todos para calcular
      });

      if (warehouseId) {
        searchParams.append('warehouseId', String(warehouseId));
      }

      const res = await fetch(`/api/almacen/availability?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar resumen de inventario');
      }

      const data = await res.json();
      const items = data.items || [];

      return {
        totalItems: items.length,
        itemsBelowMinimum: items.filter((i: any) => i.belowMinimum).length,
        itemsBelowReorder: items.filter((i: any) => i.belowReorderPoint).length,
        totalValue: 0, // Se puede calcular si hay precio unitario
      };
    },
    enabled: !!currentCompany?.id,
    staleTime: 5 * 60 * 1000,
  });
}
