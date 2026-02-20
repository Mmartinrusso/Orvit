'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

interface OrdenCompraItem {
  id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
  supplierItem?: { id: number; nombre: string };
}

interface OrdenCompra {
  id: number;
  numero: string;
  proveedor: { id: number; name: string; cuit?: string };
  fechaEmision: string;
  fechaEntregaEsperada: string | null;
  estado: string;
  moneda: string;
  subtotal: number;
  impuestos: number;
  total: number;
  esEmergencia: boolean;
  docType?: 'T1' | 'T2';
  items?: OrdenCompraItem[];
  _count: { items: number; goodsReceipts: number };
  createdByUser?: { id: number; name: string };
}

interface KPIs {
  borradores: number;
  pendientesAprobacion: number;
  enCurso: number;
  completadas: number;
  atrasadas: number;
}

interface OrdenesFilters {
  page: number;
  limit: number;
  proveedorId?: number;
  statusFilter?: string;
  searchTerm?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  soloEmergencias?: boolean;
}

interface OrdenesResponse {
  ordenes: OrdenCompra[];
  total: number;
  totalPages: number;
}

const ORDENES_KEY = 'ordenes-compra';
const ORDENES_KPIS_KEY = 'ordenes-compra-kpis';

async function fetchOrdenes(filters: OrdenesFilters): Promise<OrdenesResponse> {
  const params = new URLSearchParams({
    page: filters.page.toString(),
    limit: filters.limit.toString(),
  });

  if (filters.proveedorId) params.append('proveedorId', filters.proveedorId.toString());
  if (filters.statusFilter && filters.statusFilter !== 'all') params.append('estado', filters.statusFilter);
  if (filters.searchTerm) params.append('search', filters.searchTerm);
  if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
  if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);
  if (filters.soloEmergencias) params.append('esEmergencia', 'true');

  const response = await fetch(`/api/compras/ordenes-compra?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  return {
    ordenes: data.data || [],
    total: data.pagination?.total || 0,
    totalPages: data.pagination?.totalPages || 1,
  };
}

async function fetchOrdenesKPIs(proveedorId?: number): Promise<KPIs> {
  const provParam = proveedorId ? `&proveedorId=${proveedorId}` : '';

  const [borradoresRes, pendientesRes, enCursoRes, completadasRes, atrasadasRes] = await Promise.all([
    fetch(`/api/compras/ordenes-compra?estado=BORRADOR&limit=1${provParam}`),
    fetch(`/api/compras/ordenes-compra?estado=PENDIENTE_APROBACION&limit=1${provParam}`),
    fetch(`/api/compras/ordenes-compra?estado=CONFIRMADA&limit=1${provParam}`),
    fetch(`/api/compras/ordenes-compra?estado=COMPLETADA&limit=1${provParam}`),
    fetch(`/api/compras/ordenes-compra?countAtrasadas=true${provParam}`),
  ]);

  const [borradores, pendientes, enCurso, completadas, atrasadasData] = await Promise.all([
    borradoresRes.json(),
    pendientesRes.json(),
    enCursoRes.json(),
    completadasRes.json(),
    atrasadasRes.json(),
  ]);

  return {
    borradores: borradores.pagination?.total || 0,
    pendientesAprobacion: pendientes.pagination?.total || 0,
    enCurso: enCurso.pagination?.total || 0,
    completadas: completadas.pagination?.total || 0,
    atrasadas: atrasadasData.atrasadas || 0,
  };
}

export function useOrdenesCompra(filters: OrdenesFilters, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [ORDENES_KEY, filters],
    queryFn: () => fetchOrdenes(filters),
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  return {
    ordenes: query.data?.ordenes ?? [],
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    isLoading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: [ORDENES_KEY] }),
  };
}

export function useOrdenesCompraKPIs(proveedorId?: number, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [ORDENES_KPIS_KEY, proveedorId],
    queryFn: () => fetchOrdenesKPIs(proveedorId),
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  return {
    kpis: query.data ?? { borradores: 0, pendientesAprobacion: 0, enCurso: 0, completadas: 0, atrasadas: 0 },
    isLoading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: [ORDENES_KPIS_KEY] }),
  };
}

export type { OrdenCompra, OrdenCompraItem, KPIs };
