'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

// === Tipos ===

interface StockKPIs {
  totalItems: number;
  valorTotal: number;
  itemsBajoStock: number;
  itemsSinStock: number;
  valorEnTransito: number;
  porWarehouse: Array<{
    warehouseId: number;
    codigo: string;
    nombre: string;
    totalItems: number;
    valorTotal: number;
    bajoStock: number;
  }>;
}

interface Warehouse {
  id: number;
  codigo: string;
  nombre: string;
  isTransit: boolean;
}

interface StockFilters {
  page: number;
  warehouseFilter?: string;
  alertaFilter?: string;
  searchTerm?: string;
}

interface StockSinDeposito {
  id: number;
  supplierItemId: number;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  ultimaActualizacion: string;
  supplierItem: {
    id: number;
    nombre: string;
    unidad: string;
    codigoProveedor: string | null;
    supplier: { id: number; name: string };
  } | null;
}

// === Fetchers ===

async function fetchWarehouses(): Promise<Warehouse[]> {
  const res = await fetch('/api/compras/depositos');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  const data = result.data || result;
  return Array.isArray(data) ? data.filter((w: Warehouse) => !w.isTransit) : [];
}

async function fetchStockKPIs(): Promise<StockKPIs> {
  const res = await fetch('/api/compras/stock/kpis');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchStockItems(filters: StockFilters) {
  const params = new URLSearchParams();
  params.set('page', filters.page.toString());
  params.set('limit', '50');

  if (filters.warehouseFilter && filters.warehouseFilter !== 'all') {
    params.set('warehouseId', filters.warehouseFilter);
  }
  if (filters.alertaFilter === 'bajo') {
    params.set('stockBajo', 'true');
  }
  if (filters.searchTerm) {
    params.set('search', filters.searchTerm);
  }

  const res = await fetch(`/api/compras/stock/ubicaciones?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  return {
    items: result.data || [],
    totalPages: result.pagination?.totalPages || 1,
  };
}

async function fetchStockSinDeposito(): Promise<StockSinDeposito[]> {
  const res = await fetch('/api/compras/stock/sin-deposito');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  return result.data || [];
}

// === Hooks ===

const STOCK_KEY = 'compras-stock';
const STOCK_KPIS_KEY = 'compras-stock-kpis';
const WAREHOUSES_KEY = 'compras-warehouses';
const STOCK_SIN_DEPOSITO_KEY = 'compras-stock-sin-deposito';

export function useWarehouses(enabled = true) {
  return useQuery({
    queryKey: [WAREHOUSES_KEY],
    queryFn: fetchWarehouses,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStockKPIs(enabled = true) {
  return useQuery({
    queryKey: [STOCK_KPIS_KEY],
    queryFn: fetchStockKPIs,
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useStockItems(filters: StockFilters, enabled = true) {
  return useQuery({
    queryKey: [STOCK_KEY, filters],
    queryFn: () => fetchStockItems(filters),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useStockSinDeposito(enabled = true) {
  return useQuery({
    queryKey: [STOCK_SIN_DEPOSITO_KEY],
    queryFn: fetchStockSinDeposito,
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useStockData(filters: StockFilters, enabled = true) {
  const queryClient = useQueryClient();

  const warehouses = useWarehouses(enabled);
  const kpis = useStockKPIs(enabled);
  const stock = useStockItems(filters, enabled);
  const sinDeposito = useStockSinDeposito(enabled);

  const isLoading = warehouses.isLoading || stock.isLoading;

  return {
    warehouses: warehouses.data ?? [],
    kpis: kpis.data ?? null,
    stockItems: stock.data?.items ?? [],
    totalPages: stock.data?.totalPages ?? 1,
    stockSinDeposito: sinDeposito.data ?? [],
    loadingSinDeposito: sinDeposito.isLoading,
    isLoading,
    isFetching: stock.isFetching || kpis.isFetching,
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_KEY] });
      queryClient.invalidateQueries({ queryKey: [STOCK_KPIS_KEY] });
      queryClient.invalidateQueries({ queryKey: [STOCK_SIN_DEPOSITO_KEY] });
    },
    invalidateStock: () => queryClient.invalidateQueries({ queryKey: [STOCK_KEY] }),
    invalidateKPIs: () => queryClient.invalidateQueries({ queryKey: [STOCK_KPIS_KEY] }),
    invalidateSinDeposito: () => queryClient.invalidateQueries({ queryKey: [STOCK_SIN_DEPOSITO_KEY] }),
  };
}

export type { StockKPIs, Warehouse, StockSinDeposito, StockFilters };
