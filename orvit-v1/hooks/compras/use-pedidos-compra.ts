'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

interface PedidoCompra {
  id: number;
  numero: string;
  titulo: string;
  descripcion?: string;
  estado: string;
  prioridad: string;
  solicitante: { id: number; name: string };
  departamento?: string;
  fechaNecesidad?: string;
  fechaLimite?: string;
  presupuestoEstimado?: number;
  moneda: string;
  createdAt: string;
  items: any[];
  quotations: any[];
  purchaseOrders: any[];
  _count?: { quotations: number };
}

interface KPIs {
  borradores: number;
  enviadas: number;
  enCotizacion: number;
  cotizadas: number;
  enAprobacion: number;
  aprobadas: number;
  enProceso: number;
  completadas: number;
  rechazadas: number;
  canceladas: number;
}

interface PedidosFilters {
  page: number;
  statusFilter?: string;
  prioridadFilter?: string;
  searchTerm?: string;
  quickFilter?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PedidosResponse {
  pedidos: PedidoCompra[];
  total: number;
  totalPages: number;
  kpis: KPIs;
}

const PEDIDOS_KEY = 'pedidos-compra';

const EMPTY_KPIS: KPIs = {
  borradores: 0, enviadas: 0, enCotizacion: 0, cotizadas: 0,
  enAprobacion: 0, aprobadas: 0, enProceso: 0, completadas: 0,
  rechazadas: 0, canceladas: 0,
};

async function fetchPedidos(filters: PedidosFilters): Promise<PedidosResponse> {
  const params = new URLSearchParams({
    page: filters.page.toString(),
    limit: '20',
    sortBy: filters.sortBy || 'createdAt',
    sortOrder: filters.sortOrder || 'desc',
  });

  if (filters.statusFilter && filters.statusFilter !== 'all') params.append('estado', filters.statusFilter);
  if (filters.prioridadFilter && filters.prioridadFilter !== 'all') params.append('prioridad', filters.prioridadFilter);
  if (filters.searchTerm) params.append('search', filters.searchTerm);
  if (filters.quickFilter) params.append('quickFilter', filters.quickFilter);

  const response = await fetch(`/api/compras/pedidos?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  return {
    pedidos: data.data || [],
    total: data.pagination?.total || 0,
    totalPages: data.pagination?.totalPages || 1,
    kpis: data.kpis || EMPTY_KPIS,
  };
}

export function usePedidosCompra(filters: PedidosFilters, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [PEDIDOS_KEY, filters],
    queryFn: () => fetchPedidos(filters),
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  return {
    pedidos: query.data?.pedidos ?? [],
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    kpis: query.data?.kpis ?? EMPTY_KPIS,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    invalidate: () => queryClient.invalidateQueries({ queryKey: [PEDIDOS_KEY] }),
  };
}

export type { PedidoCompra, KPIs as PedidoKPIs };
