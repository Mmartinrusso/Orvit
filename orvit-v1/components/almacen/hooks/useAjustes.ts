'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { AjustesFilters, PaginationParams } from './types';

interface UseAjustesParams {
  filters?: AjustesFilters;
  pagination?: PaginationParams;
  enabled?: boolean;
}

interface AjustesResponse {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  reasonCodes: Record<string, string[]>;
}

/**
 * Hook para obtener lista de ajustes
 */
export function useAjustes(params: UseAjustesParams = {}) {
  const { currentCompany } = useCompany();
  const { filters = {}, pagination = { page: 1, pageSize: 20 }, enabled = true } = params;

  const queryKey = ['almacen', 'ajustes', currentCompany?.id, filters, pagination];

  return useQuery<AjustesResponse>({
    queryKey,
    queryFn: async () => {
      if (!currentCompany?.id) {
        return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, reasonCodes: {} };
      }

      const searchParams = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.pageSize),
      });

      if (filters.estado && filters.estado !== 'all') {
        searchParams.append('estado', filters.estado);
      }
      if (filters.tipo && filters.tipo !== 'all') {
        searchParams.append('tipo', filters.tipo);
      }
      if (filters.warehouseId) {
        searchParams.append('warehouseId', String(filters.warehouseId));
      }
      if (filters.fechaDesde) {
        searchParams.append('fechaDesde', filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        searchParams.append('fechaHasta', filters.fechaHasta);
      }

      const res = await fetch(`/api/compras/stock/ajustes?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar ajustes');
      }

      return res.json();
    },
    enabled: enabled && !!currentCompany?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook para obtener un ajuste específico
 */
export function useAjuste(ajusteId: number | null) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'ajuste', ajusteId],
    queryFn: async () => {
      if (!ajusteId || !currentCompany?.id) return null;

      const res = await fetch(`/api/compras/stock/ajustes/${ajusteId}`);
      if (!res.ok) {
        throw new Error('Error al cargar ajuste');
      }

      return res.json();
    },
    enabled: !!ajusteId && !!currentCompany?.id,
  });
}

/**
 * Hook con mutations para ajustes
 */
export function useAjustesMutations() {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['almacen', 'ajustes'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'ajuste'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'inventario'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'movimientos'] });
  };

  const create = useMutation({
    mutationFn: async (data: {
      tipo: string;
      warehouseId: number;
      motivo: string;
      motivoDetalle?: string;
      reasonCode?: string;
      notas?: string;
      items: Array<{
        supplierItemId: number;
        cantidadActual: number;
        cantidadNueva: number;
        notas?: string;
      }>;
    }) => {
      const res = await fetch('/api/compras/stock/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear ajuste');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  const confirm = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/compras/stock/ajustes/${id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al confirmar ajuste');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/compras/stock/ajustes/${id}/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al aprobar ajuste');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/compras/stock/ajustes/${id}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al rechazar ajuste');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  return {
    create,
    confirm,
    approve,
    reject,
  };
}
