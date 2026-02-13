'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { DespachosFilters, PaginationParams, BatchActionParams, BatchActionResult } from './types';
import { DespachoType, DespachoStatus } from '@/lib/almacen/types';

interface UseDespachosParams {
  filters?: DespachosFilters;
  pagination?: PaginationParams;
  enabled?: boolean;
}

interface DespachosResponse {
  despachos: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Hook para obtener lista de despachos
 */
export function useDespachos(params: UseDespachosParams = {}) {
  const { currentCompany } = useCompany();
  const { filters = {}, pagination = { page: 1, pageSize: 20 }, enabled = true } = params;

  const queryKey = ['almacen', 'despachos', currentCompany?.id, filters, pagination];

  return useQuery<DespachosResponse>({
    queryKey,
    queryFn: async () => {
      if (!currentCompany?.id) {
        return { despachos: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });

      // Filtros
      if (filters.estado && filters.estado !== 'all') {
        searchParams.append('estado', filters.estado);
      }
      if (filters.tipo && filters.tipo !== 'all') {
        searchParams.append('tipo', filters.tipo);
      }
      if (filters.warehouseId) {
        searchParams.append('warehouseId', String(filters.warehouseId));
      }
      if (filters.despachadorId) {
        searchParams.append('despachadorId', String(filters.despachadorId));
      }
      if (filters.receptorId) {
        searchParams.append('receptorId', String(filters.receptorId));
      }
      if (filters.materialRequestId) {
        searchParams.append('materialRequestId', String(filters.materialRequestId));
      }

      const res = await fetch(`/api/almacen/despachos?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar despachos');
      }

      return res.json();
    },
    enabled: enabled && !!currentCompany?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook para obtener un despacho específico
 */
export function useDespacho(despachoId: number | null) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'despacho', despachoId],
    queryFn: async () => {
      if (!despachoId || !currentCompany?.id) return null;

      const res = await fetch(
        `/api/almacen/despachos/${despachoId}?companyId=${currentCompany.id}`
      );
      if (!res.ok) {
        throw new Error('Error al cargar despacho');
      }

      const data = await res.json();
      return data.despacho;
    },
    enabled: !!despachoId && !!currentCompany?.id,
  });
}

/**
 * Hook con mutations para despachos
 */
export function useDespachosMutations() {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['almacen', 'despachos'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'despacho'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'solicitudes'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'reservas'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'inventario'] });
  };

  // Crear nuevo despacho
  const create = useMutation({
    mutationFn: async (data: {
      tipo: DespachoType;
      materialRequestId?: number;
      warehouseId: number;
      despachadorId: number;
      receptorId?: number;
      destinatario?: string;
      notas?: string;
      items: Array<{
        materialRequestItemId?: number;
        supplierItemId: number;
        cantidadDespachada: number;
        lote?: string;
        ubicacion?: string;
      }>;
    }) => {
      const res = await fetch('/api/almacen/despachos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          companyId: currentCompany?.id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear despacho');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  // Actualizar estado del despacho
  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      action,
      userId,
      motivo,
      signatureUrl,
      signatureHash,
    }: {
      id: number;
      action: 'prepare' | 'ready' | 'dispatch' | 'receive' | 'cancel';
      userId?: number;
      motivo?: string;
      signatureUrl?: string;
      signatureHash?: string;
    }) => {
      const res = await fetch('/api/almacen/despachos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          userId,
          motivo,
          signatureUrl,
          signatureHash,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar despacho');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  // Marcar en preparación
  const prepare = useMutation({
    mutationFn: async (id: number) => {
      return updateStatus.mutateAsync({ id, action: 'prepare' });
    },
    onSuccess: invalidate,
  });

  // Marcar listo para despacho
  const markReady = useMutation({
    mutationFn: async (id: number) => {
      return updateStatus.mutateAsync({ id, action: 'ready' });
    },
    onSuccess: invalidate,
  });

  // Despachar (con firma opcional)
  const dispatch = useMutation({
    mutationFn: async ({
      id,
      userId,
      signatureUrl,
      signatureHash,
    }: {
      id: number;
      userId: number;
      signatureUrl?: string;
      signatureHash?: string;
    }) => {
      return updateStatus.mutateAsync({
        id,
        action: 'dispatch',
        userId,
        signatureUrl,
        signatureHash,
      });
    },
    onSuccess: invalidate,
  });

  // Confirmar recepción (con firma)
  const receive = useMutation({
    mutationFn: async ({
      id,
      userId,
      signatureUrl,
      signatureHash,
    }: {
      id: number;
      userId: number;
      signatureUrl?: string;
      signatureHash?: string;
    }) => {
      return updateStatus.mutateAsync({
        id,
        action: 'receive',
        userId,
        signatureUrl,
        signatureHash,
      });
    },
    onSuccess: invalidate,
  });

  // Cancelar despacho
  const cancel = useMutation({
    mutationFn: async ({ id, motivo }: { id: number; motivo?: string }) => {
      return updateStatus.mutateAsync({ id, action: 'cancel', motivo });
    },
    onSuccess: invalidate,
  });

  // Acción batch
  const batchAction = useMutation<BatchActionResult, Error, BatchActionParams>({
    mutationFn: async ({ ids, action, userId, motivo }) => {
      const res = await fetch('/api/almacen/despachos/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          action,
          userId,
          motivo,
          companyId: currentCompany?.id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error en acción masiva');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  return {
    create,
    updateStatus,
    prepare,
    markReady,
    dispatch,
    receive,
    cancel,
    batchAction,
  };
}

/**
 * Hook para obtener contadores de despachos por estado
 */
export function useDespachosCount() {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'despachos', 'count', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return {
          total: 0,
          borrador: 0,
          enPreparacion: 0,
          listoDespacho: 0,
          despachado: 0,
          recibido: 0,
        };
      }

      const estados: DespachoStatus[] = [
        'BORRADOR',
        'EN_PREPARACION',
        'LISTO_DESPACHO',
        'DESPACHADO',
        'RECIBIDO',
      ];

      const counts = await Promise.all(
        estados.map(async (estado) => {
          const res = await fetch(
            `/api/almacen/despachos?companyId=${currentCompany.id}&estado=${estado}&pageSize=1`
          );
          const data = await res.json();
          return { estado, count: data.total || 0 };
        })
      );

      const countMap = counts.reduce(
        (acc, { estado, count }) => {
          acc[estado] = count;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        total: Object.values(countMap).reduce((a, b) => a + b, 0),
        borrador: countMap['BORRADOR'] || 0,
        enPreparacion: countMap['EN_PREPARACION'] || 0,
        listoDespacho: countMap['LISTO_DESPACHO'] || 0,
        despachado: countMap['DESPACHADO'] || 0,
        recibido: countMap['RECIBIDO'] || 0,
      };
    },
    enabled: !!currentCompany?.id,
    staleTime: 60 * 1000,
  });
}
