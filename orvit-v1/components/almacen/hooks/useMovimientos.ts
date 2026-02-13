'use client';

import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { MovimientosFilters, PaginationParams } from './types';

interface UseMovimientosParams {
  filters?: MovimientosFilters;
  pagination?: PaginationParams;
  enabled?: boolean;
}

interface MovimientoItem {
  id: number;
  fecha: string;
  tipo: string;
  cantidad: number;
  stockAnterior: number;
  stockPosterior: number;
  referencia?: string;
  notas?: string;
  supplierItem: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
  warehouse: {
    id: number;
    nombre: string;
    codigo: string;
  };
  usuario?: {
    id: number;
    name: string;
  };
}

interface MovimientosResponse {
  movimientos: MovimientoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Hook para obtener movimientos de stock (kardex)
 */
export function useMovimientos(params: UseMovimientosParams = {}) {
  const { currentCompany } = useCompany();
  const { filters = {}, pagination = { page: 1, pageSize: 50 }, enabled = true } = params;

  const queryKey = ['almacen', 'movimientos', currentCompany?.id, filters, pagination];

  return useQuery<MovimientosResponse>({
    queryKey,
    queryFn: async () => {
      if (!currentCompany?.id) {
        return { movimientos: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      }

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });

      if (filters.warehouseId) {
        searchParams.append('warehouseId', String(filters.warehouseId));
      }
      if (filters.supplierItemId) {
        searchParams.append('supplierItemId', String(filters.supplierItemId));
      }
      if (filters.tipo && filters.tipo !== 'all') {
        searchParams.append('tipo', filters.tipo);
      }
      if (filters.fechaDesde) {
        searchParams.append('fechaDesde', filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        searchParams.append('fechaHasta', filters.fechaHasta);
      }

      const res = await fetch(`/api/almacen/movements?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar movimientos');
      }

      return res.json();
    },
    enabled: enabled && !!currentCompany?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook para obtener kardex de un item específico
 */
export function useKardex(supplierItemId: number | null, warehouseId?: number | null) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'kardex', supplierItemId, warehouseId, currentCompany?.id],
    queryFn: async () => {
      if (!supplierItemId || !currentCompany?.id) {
        return { movimientos: [], supplierItem: null };
      }

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
        supplierItemId: String(supplierItemId),
        pageSize: '100',
      });

      if (warehouseId) {
        searchParams.append('warehouseId', String(warehouseId));
      }

      const res = await fetch(`/api/almacen/movements?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar kardex');
      }

      const data = await res.json();
      return {
        movimientos: data.movimientos || [],
        supplierItem: data.movimientos?.[0]?.supplierItem || null,
      };
    },
    enabled: !!supplierItemId && !!currentCompany?.id,
  });
}

/**
 * Hook para obtener resumen de movimientos del día
 */
export function useMovimientosHoy(warehouseId?: number) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'movimientos', 'hoy', currentCompany?.id, warehouseId],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return {
          entradas: 0,
          salidas: 0,
          ajustes: 0,
          transferencias: 0,
        };
      }

      const today = new Date().toISOString().split('T')[0];

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
        fechaDesde: today,
        fechaHasta: today,
        pageSize: '1000',
      });

      if (warehouseId) {
        searchParams.append('warehouseId', String(warehouseId));
      }

      const res = await fetch(`/api/almacen/movements?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar movimientos de hoy');
      }

      const data = await res.json();
      const movimientos = data.movimientos || [];

      return {
        entradas: movimientos.filter((m: any) => m.tipo === 'ENTRADA').length,
        salidas: movimientos.filter((m: any) => m.tipo === 'SALIDA').length,
        ajustes: movimientos.filter((m: any) =>
          m.tipo === 'AJUSTE_POSITIVO' || m.tipo === 'AJUSTE_NEGATIVO'
        ).length,
        transferencias: movimientos.filter((m: any) =>
          m.tipo === 'TRANSFERENCIA_ENTRADA' || m.tipo === 'TRANSFERENCIA_SALIDA'
        ).length,
      };
    },
    enabled: !!currentCompany?.id,
    staleTime: 60 * 1000,
  });
}
