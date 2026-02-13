'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { DevolucionesFilters, PaginationParams } from './types';
import { DevolucionStatus } from '@/lib/almacen/types';

interface UseDevolucionesParams {
  filters?: DevolucionesFilters;
  pagination?: PaginationParams;
  enabled?: boolean;
}

interface DevolucionesResponse {
  devoluciones: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Hook para obtener lista de devoluciones
 */
export function useDevoluciones(params: UseDevolucionesParams = {}) {
  const { currentCompany } = useCompany();
  const { filters = {}, pagination = { page: 1, pageSize: 20 }, enabled = true } = params;

  const queryKey = ['almacen', 'devoluciones', currentCompany?.id, filters, pagination];

  return useQuery<DevolucionesResponse>({
    queryKey,
    queryFn: async () => {
      if (!currentCompany?.id) {
        return { devoluciones: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });

      if (filters.estado && filters.estado !== 'all') {
        searchParams.append('estado', filters.estado);
      }
      if (filters.warehouseId) {
        searchParams.append('warehouseId', String(filters.warehouseId));
      }
      if (filters.solicitanteId) {
        searchParams.append('solicitanteId', String(filters.solicitanteId));
      }

      const res = await fetch(`/api/almacen/devoluciones?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar devoluciones');
      }

      return res.json();
    },
    enabled: enabled && !!currentCompany?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook para obtener una devolución específica
 */
export function useDevolucion(devolucionId: number | null) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'devolucion', devolucionId],
    queryFn: async () => {
      if (!devolucionId || !currentCompany?.id) return null;

      const res = await fetch(
        `/api/almacen/devoluciones/${devolucionId}?companyId=${currentCompany.id}`
      );
      if (!res.ok) {
        throw new Error('Error al cargar devolución');
      }

      const data = await res.json();
      return data.devolucion;
    },
    enabled: !!devolucionId && !!currentCompany?.id,
  });
}

/**
 * Hook con mutations para devoluciones
 */
export function useDevolucionesMutations() {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['almacen', 'devoluciones'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'devolucion'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'inventario'] });
  };

  // Crear nueva devolución
  const create = useMutation({
    mutationFn: async (data: {
      despachoId?: number;
      warehouseId: number;
      solicitanteId: number;
      revisorId?: number;
      motivo: string;
      notas?: string;
      items: Array<{
        despachoItemId?: number;
        supplierItemId: number;
        cantidadDevuelta: number;
        estado?: string;
        notas?: string;
      }>;
    }) => {
      const res = await fetch('/api/almacen/devoluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          companyId: currentCompany?.id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear devolución');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  // Actualizar estado de devolución
  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      action,
      userId,
      motivo,
    }: {
      id: number;
      action: 'submit' | 'accept' | 'reject';
      userId?: number;
      motivo?: string;
    }) => {
      const res = await fetch('/api/almacen/devoluciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          userId,
          motivo,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar devolución');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  // Enviar para revisión
  const submit = useMutation({
    mutationFn: async (id: number) => {
      return updateStatus.mutateAsync({ id, action: 'submit' });
    },
    onSuccess: invalidate,
  });

  // Aceptar devolución
  const accept = useMutation({
    mutationFn: async ({ id, userId }: { id: number; userId: number }) => {
      return updateStatus.mutateAsync({ id, action: 'accept', userId });
    },
    onSuccess: invalidate,
  });

  // Rechazar devolución
  const reject = useMutation({
    mutationFn: async ({
      id,
      userId,
      motivo,
    }: {
      id: number;
      userId: number;
      motivo?: string;
    }) => {
      return updateStatus.mutateAsync({ id, action: 'reject', userId, motivo });
    },
    onSuccess: invalidate,
  });

  return {
    create,
    updateStatus,
    submit,
    accept,
    reject,
  };
}

/**
 * Hook para obtener contadores de devoluciones por estado
 */
export function useDevolucionesCount() {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'devoluciones', 'count', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return {
          total: 0,
          borrador: 0,
          pendienteRevision: 0,
          aceptada: 0,
          rechazada: 0,
        };
      }

      const estados: DevolucionStatus[] = [
        'BORRADOR',
        'PENDIENTE_REVISION',
        'ACEPTADA',
        'RECHAZADA',
      ];

      const counts = await Promise.all(
        estados.map(async (estado) => {
          const res = await fetch(
            `/api/almacen/devoluciones?companyId=${currentCompany.id}&estado=${estado}&pageSize=1`
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
        pendienteRevision: countMap['PENDIENTE_REVISION'] || 0,
        aceptada: countMap['ACEPTADA'] || 0,
        rechazada: countMap['RECHAZADA'] || 0,
      };
    },
    enabled: !!currentCompany?.id,
    staleTime: 60 * 1000,
  });
}
