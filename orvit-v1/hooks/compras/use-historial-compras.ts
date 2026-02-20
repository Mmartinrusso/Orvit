'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

interface HistorialFilters {
  search: string;
  entidad: string;
  accion: string;
  fechaDesde: string;
  fechaHasta: string;
  quickFilter: string | null;
}

interface HistorialEvento {
  id: string;
  entidad: string;
  accion: string;
  fecha: string;
  usuario: string;
  descripcion: string;
  detalle?: any;
}

interface HistorialResponse {
  eventos: HistorialEvento[];
  nextCursor?: string;
  total: number;
}

const HISTORIAL_KEY = 'compras-historial';
const HISTORIAL_STATS_KEY = 'compras-historial-stats';

function buildHistorialParams(filters: HistorialFilters, cursor?: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set('limit', '25');
  if (cursor) params.set('cursor', cursor);
  if (filters.entidad !== 'all') params.set('entidad', filters.entidad);
  if (filters.accion !== 'all') params.set('accion', filters.accion);
  if (filters.fechaDesde) params.set('fechaDesde', filters.fechaDesde);
  if (filters.fechaHasta) params.set('fechaHasta', filters.fechaHasta);
  if (filters.search) params.set('search', filters.search);
  return params;
}

async function fetchHistorial(filters: HistorialFilters, cursor?: string): Promise<HistorialResponse> {
  const params = buildHistorialParams(filters, cursor);
  const res = await fetch(`/api/compras/historial?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchHistorialStats(): Promise<{ aprobaciones: number; rechazos: number; hoy: number }> {
  const todayStr = new Date().toISOString().split('T')[0];
  const [aprobacionesRes, rechazosRes, hoyRes] = await Promise.all([
    fetch(`/api/compras/historial?accion=APPROVE&fechaDesde=${todayStr}&limit=100`),
    fetch(`/api/compras/historial?accion=REJECT&fechaDesde=${todayStr}&limit=100`),
    fetch(`/api/compras/historial?fechaDesde=${todayStr}&limit=100`),
  ]);

  const [aprobaciones, rechazos, hoy] = await Promise.all([
    aprobacionesRes.json(),
    rechazosRes.json(),
    hoyRes.json(),
  ]);

  return {
    aprobaciones: aprobaciones.eventos?.length || 0,
    rechazos: rechazos.eventos?.length || 0,
    hoy: hoy.eventos?.length || 0,
  };
}

export function useHistorialCompras(filters: HistorialFilters, enabled = true) {
  const queryClient = useQueryClient();

  const historial = useInfiniteQuery({
    queryKey: [HISTORIAL_KEY, filters],
    queryFn: ({ pageParam }) => fetchHistorial(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const stats = useQuery({
    queryKey: [HISTORIAL_STATS_KEY],
    queryFn: fetchHistorialStats,
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  // Aplanar las páginas en un solo array de eventos
  const eventos = historial.data?.pages.flatMap(p => p.eventos) ?? [];
  const total = historial.data?.pages[0]?.total ?? 0;

  return {
    eventos,
    total,
    stats: stats.data ?? { aprobaciones: 0, rechazos: 0, hoy: 0 },
    isLoading: historial.isLoading,
    isInitialLoad: historial.isLoading && !historial.data,
    isFetchingNextPage: historial.isFetchingNextPage,
    hasNextPage: historial.hasNextPage,
    loadMore: () => historial.fetchNextPage(),
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: [HISTORIAL_KEY] });
      queryClient.invalidateQueries({ queryKey: [HISTORIAL_STATS_KEY] });
    },
  };
}

export type { HistorialFilters, HistorialEvento };
