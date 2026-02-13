'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { SolicitudesFilters, PaginationParams, BatchActionParams, BatchActionResult } from './types';
import { MaterialRequestStatus, MaterialRequestType } from '@/lib/almacen/types';

interface UseSolicitudesParams {
  filters?: SolicitudesFilters;
  pagination?: PaginationParams;
  enabled?: boolean;
}

interface SolicitudesResponse {
  requests: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Hook para obtener lista de solicitudes de material
 */
export function useSolicitudes(params: UseSolicitudesParams = {}) {
  const { currentCompany } = useCompany();
  const { filters = {}, pagination = { page: 1, pageSize: 20 }, enabled = true } = params;

  const queryKey = ['almacen', 'solicitudes', currentCompany?.id, filters, pagination];

  return useQuery<SolicitudesResponse>({
    queryKey,
    queryFn: async () => {
      if (!currentCompany?.id) {
        return { requests: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
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
      if (filters.urgencia && filters.urgencia !== 'all') {
        searchParams.append('urgencia', filters.urgencia);
      }
      if (filters.warehouseId) {
        searchParams.append('warehouseId', String(filters.warehouseId));
      }
      if (filters.solicitanteId) {
        searchParams.append('solicitanteId', String(filters.solicitanteId));
      }
      if (filters.workOrderId) {
        searchParams.append('workOrderId', String(filters.workOrderId));
      }
      if (filters.productionOrderId) {
        searchParams.append('productionOrderId', String(filters.productionOrderId));
      }

      const res = await fetch(`/api/almacen/requests?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar solicitudes');
      }

      return res.json();
    },
    enabled: enabled && !!currentCompany?.id,
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook para obtener una solicitud específica
 */
export function useSolicitud(solicitudId: number | null) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'solicitud', solicitudId],
    queryFn: async () => {
      if (!solicitudId || !currentCompany?.id) return null;

      const res = await fetch(
        `/api/almacen/requests/${solicitudId}?companyId=${currentCompany.id}`
      );
      if (!res.ok) {
        throw new Error('Error al cargar solicitud');
      }

      const data = await res.json();
      return data.request;
    },
    enabled: !!solicitudId && !!currentCompany?.id,
  });
}

/**
 * Hook con mutations para solicitudes
 */
export function useSolicitudesMutations() {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['almacen', 'solicitudes'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'solicitud'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'reservas'] });
  };

  // Crear nueva solicitud
  const create = useMutation({
    mutationFn: async (data: {
      tipo: MaterialRequestType;
      urgencia?: string;
      workOrderId?: number;
      productionOrderId?: number;
      proyectoId?: number;
      solicitanteId: number;
      destinatarioId?: number;
      warehouseId?: number;
      fechaNecesidad?: string;
      motivo?: string;
      notas?: string;
      items: Array<{
        itemType: string;
        supplierItemId?: number;
        toolId?: number;
        cantidadSolicitada: number;
        unidad: string;
        notas?: string;
      }>;
    }) => {
      const res = await fetch('/api/almacen/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          companyId: currentCompany?.id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear solicitud');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  // Actualizar estado (submit, approve, reject, cancel)
  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      action,
      userId,
      motivo,
      cantidadesAprobadas,
    }: {
      id: number;
      action: 'submit' | 'approve' | 'reject' | 'cancel';
      userId?: number;
      motivo?: string;
      cantidadesAprobadas?: Record<number, number>;
    }) => {
      const res = await fetch('/api/almacen/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          userId,
          motivo,
          cantidadesAprobadas,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar solicitud');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  // Enviar solicitud (cambiar de BORRADOR a PENDIENTE_APROBACION)
  const submit = useMutation({
    mutationFn: async (id: number) => {
      return updateStatus.mutateAsync({ id, action: 'submit' });
    },
    onSuccess: invalidate,
  });

  // Aprobar solicitud
  const approve = useMutation({
    mutationFn: async ({
      id,
      userId,
      cantidadesAprobadas,
    }: {
      id: number;
      userId: number;
      cantidadesAprobadas?: Record<number, number>;
    }) => {
      return updateStatus.mutateAsync({
        id,
        action: 'approve',
        userId,
        cantidadesAprobadas,
      });
    },
    onSuccess: invalidate,
  });

  // Rechazar solicitud
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

  // Cancelar solicitud
  const cancel = useMutation({
    mutationFn: async ({ id, motivo }: { id: number; motivo?: string }) => {
      return updateStatus.mutateAsync({ id, action: 'cancel', motivo });
    },
    onSuccess: invalidate,
  });

  // Acción batch
  const batchAction = useMutation<BatchActionResult, Error, BatchActionParams>({
    mutationFn: async ({ ids, action, userId, motivo }) => {
      const res = await fetch('/api/almacen/requests/batch', {
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
    submit,
    approve,
    reject,
    cancel,
    batchAction,
  };
}

/**
 * Hook para obtener contadores de solicitudes por estado
 */
export function useSolicitudesCount() {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'solicitudes', 'count', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return {
          total: 0,
          borrador: 0,
          pendiente: 0,
          aprobada: 0,
          parcialmenteDespachada: 0,
          despachada: 0,
        };
      }

      // Obtener conteo por estado (podemos usar el endpoint existente con diferentes filtros)
      const estados: MaterialRequestStatus[] = [
        'BORRADOR',
        'PENDIENTE_APROBACION',
        'APROBADA',
        'PARCIALMENTE_DESPACHADA',
        'DESPACHADA',
      ];

      const counts = await Promise.all(
        estados.map(async (estado) => {
          const res = await fetch(
            `/api/almacen/requests?companyId=${currentCompany.id}&estado=${estado}&pageSize=1`
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
        pendiente: countMap['PENDIENTE_APROBACION'] || 0,
        aprobada: countMap['APROBADA'] || 0,
        parcialmenteDespachada: countMap['PARCIALMENTE_DESPACHADA'] || 0,
        despachada: countMap['DESPACHADA'] || 0,
      };
    },
    enabled: !!currentCompany?.id,
    staleTime: 60 * 1000, // 1 minuto
  });
}
