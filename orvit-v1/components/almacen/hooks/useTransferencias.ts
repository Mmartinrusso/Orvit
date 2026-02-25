'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { TransferenciasFilters, PaginationParams } from './types';

interface UseTransferenciasParams {
  filters?: TransferenciasFilters;
  pagination?: PaginationParams;
  enabled?: boolean;
}

interface TransferenciasResponse {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Hook para obtener lista de transferencias
 */
export function useTransferencias(params: UseTransferenciasParams = {}) {
  const { currentCompany } = useCompany();
  const { filters = {}, pagination = { page: 1, pageSize: 20 }, enabled = true } = params;

  const queryKey = ['almacen', 'transferencias', currentCompany?.id, filters, pagination];

  return useQuery<TransferenciasResponse>({
    queryKey,
    queryFn: async () => {
      if (!currentCompany?.id) {
        return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      }

      const searchParams = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.pageSize),
      });

      if (filters.estado && filters.estado !== 'all') {
        searchParams.append('estado', filters.estado);
      }
      if (filters.warehouseId) {
        searchParams.append('warehouseOrigenId', String(filters.warehouseId));
      }
      if (filters.warehouseOrigenId) {
        searchParams.append('warehouseOrigenId', String(filters.warehouseOrigenId));
      }
      if (filters.warehouseDestinoId) {
        searchParams.append('warehouseDestinoId', String(filters.warehouseDestinoId));
      }
      if (filters.fechaDesde) {
        searchParams.append('fechaDesde', filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        searchParams.append('fechaHasta', filters.fechaHasta);
      }

      const res = await fetch(`/api/compras/stock/transferencias?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar transferencias');
      }

      return res.json();
    },
    enabled: enabled && !!currentCompany?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook para obtener una transferencia específica
 */
export function useTransferencia(transferId: number | null) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'transferencia', transferId],
    queryFn: async () => {
      if (!transferId || !currentCompany?.id) return null;

      const res = await fetch(`/api/compras/stock/transferencias/${transferId}`);
      if (!res.ok) {
        throw new Error('Error al cargar transferencia');
      }

      return res.json();
    },
    enabled: !!transferId && !!currentCompany?.id,
  });
}

/**
 * Hook con mutations para transferencias
 */
export function useTransferenciasMutations() {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['almacen', 'transferencias'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'transferencia'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'inventario'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'movimientos'] });
  };

  const create = useMutation({
    mutationFn: async (data: {
      warehouseOrigenId: number;
      warehouseDestinoId: number;
      motivo?: string;
      notas?: string;
      items: Array<{
        supplierItemId: number;
        cantidad: number;
        notas?: string;
      }>;
    }) => {
      const res = await fetch('/api/compras/stock/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear transferencia');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  const send = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/compras/stock/transferencias/${id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al enviar transferencia');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  const receive = useMutation({
    mutationFn: async ({ id, items }: {
      id: number;
      items?: Array<{ itemId: number; cantidadRecibida: number; notas?: string }>;
    }) => {
      const res = await fetch(`/api/compras/stock/transferencias/${id}/recibir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al recibir transferencia');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/compras/stock/transferencias/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al cancelar transferencia');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  return {
    create,
    send,
    receive,
    cancel,
  };
}
