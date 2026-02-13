'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { ReservasFilters, PaginationParams, BatchActionParams, BatchActionResult } from './types';
import { ReservaType, ReservaStatus } from '@/lib/almacen/types';

interface UseReservasParams {
  filters?: ReservasFilters;
  pagination?: PaginationParams;
  enabled?: boolean;
}

interface ReservaItem {
  id: number;
  tipo: ReservaType;
  estado: ReservaStatus;
  cantidad: number;
  cantidadConsumida: number;
  cantidadPendiente: number;
  fechaReserva: string;
  fechaExpiracion?: string;
  motivo?: string;
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
  materialRequest?: {
    id: number;
    numero: string;
  };
  productionOrder?: {
    id: number;
    orderNumber: string;
  };
  workOrder?: {
    id: number;
    orderNumber: string;
  };
  createdByUser?: {
    id: number;
    name: string;
  };
}

interface ReservasResponse {
  reservations: ReservaItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Hook para obtener lista de reservas
 */
export function useReservas(params: UseReservasParams = {}) {
  const { currentCompany } = useCompany();
  const { filters = {}, pagination = { page: 1, pageSize: 50 }, enabled = true } = params;

  const queryKey = ['almacen', 'reservas', currentCompany?.id, filters, pagination];

  return useQuery<ReservasResponse>({
    queryKey,
    queryFn: async () => {
      if (!currentCompany?.id) {
        return { reservations: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      }

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
      });

      if (filters.warehouseId) {
        searchParams.append('warehouseId', String(filters.warehouseId));
      }
      if (filters.supplierItemId) {
        searchParams.append('supplierItemId', String(filters.supplierItemId));
      }
      if (filters.estado && filters.estado !== 'all') {
        searchParams.append('estado', filters.estado);
      }
      if (filters.tipo && filters.tipo !== 'all') {
        searchParams.append('tipo', filters.tipo);
      }
      if (filters.materialRequestId) {
        searchParams.append('materialRequestId', String(filters.materialRequestId));
      }
      if (filters.productionOrderId) {
        searchParams.append('productionOrderId', String(filters.productionOrderId));
      }
      if (filters.workOrderId) {
        searchParams.append('workOrderId', String(filters.workOrderId));
      }

      const res = await fetch(`/api/almacen/reservations?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar reservas');
      }

      const data = await res.json();
      return {
        reservations: data.reservations || [],
        total: data.reservations?.length || 0,
        page: 1,
        pageSize: 100,
        totalPages: 1,
      };
    },
    enabled: enabled && !!currentCompany?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook para obtener resumen de reservas
 */
export function useReservasSummary(warehouseId?: number) {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'reservas', 'summary', currentCompany?.id, warehouseId],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return null;
      }

      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
        summary: 'true',
      });

      if (warehouseId) {
        searchParams.append('warehouseId', String(warehouseId));
      }

      const res = await fetch(`/api/almacen/reservations?${searchParams}`);
      if (!res.ok) {
        throw new Error('Error al cargar resumen de reservas');
      }

      const data = await res.json();
      return data.summary;
    },
    enabled: !!currentCompany?.id,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook con mutations para reservas
 */
export function useReservasMutations() {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['almacen', 'reservas'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'inventario'] });
    queryClient.invalidateQueries({ queryKey: ['almacen', 'stats'] });
  };

  // Crear nueva reserva
  const create = useMutation({
    mutationFn: async (data: {
      supplierItemId: number;
      warehouseId: number;
      cantidad: number;
      tipo: ReservaType;
      materialRequestId?: number;
      productionOrderId?: number;
      workOrderId?: number;
      motivo?: string;
      fechaExpiracion?: string;
      createdBy: number;
    }) => {
      const res = await fetch('/api/almacen/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          companyId: currentCompany?.id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear reserva');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  // Crear reservas bulk
  const createBulk = useMutation({
    mutationFn: async (data: {
      items: Array<{
        supplierItemId: number;
        warehouseId: number;
        cantidad: number;
      }>;
      tipo: ReservaType;
      materialRequestId?: number;
      productionOrderId?: number;
      workOrderId?: number;
      motivo?: string;
      fechaExpiracion?: string;
      createdBy: number;
      allowPartial?: boolean;
    }) => {
      const res = await fetch('/api/almacen/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          companyId: currentCompany?.id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear reservas');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  // Liberar reserva
  const release = useMutation({
    mutationFn: async ({ id, motivo }: { id: number; motivo?: string }) => {
      const params = new URLSearchParams({ id: String(id) });
      if (motivo) params.append('motivo', motivo);

      const res = await fetch(`/api/almacen/reservations?${params}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al liberar reserva');
      }

      return res.json();
    },
    onSuccess: invalidate,
  });

  // Acción batch (liberar múltiples)
  const batchAction = useMutation<BatchActionResult, Error, BatchActionParams>({
    mutationFn: async ({ ids, action, motivo }) => {
      const res = await fetch('/api/almacen/reservations/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          action,
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
    createBulk,
    release,
    batchAction,
  };
}

/**
 * Hook para obtener contadores de reservas por estado
 */
export function useReservasCount() {
  const { currentCompany } = useCompany();

  return useQuery({
    queryKey: ['almacen', 'reservas', 'count', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return {
          total: 0,
          activas: 0,
          consumidasParcial: 0,
          consumidas: 0,
          liberadas: 0,
          expiradas: 0,
        };
      }

      // Obtener todas las reservas activas para contar
      const searchParams = new URLSearchParams({
        companyId: String(currentCompany.id),
      });

      const res = await fetch(`/api/almacen/reservations?${searchParams}`);
      const data = await res.json();
      const reservations = data.reservations || [];

      const counts = {
        total: reservations.length,
        activas: reservations.filter((r: any) => r.estado === 'ACTIVA').length,
        consumidasParcial: reservations.filter((r: any) => r.estado === 'CONSUMIDA_PARCIAL').length,
        consumidas: reservations.filter((r: any) => r.estado === 'CONSUMIDA').length,
        liberadas: reservations.filter((r: any) => r.estado === 'LIBERADA').length,
        expiradas: reservations.filter((r: any) => r.estado === 'EXPIRADA').length,
      };

      return counts;
    },
    enabled: !!currentCompany?.id,
    staleTime: 60 * 1000,
  });
}
