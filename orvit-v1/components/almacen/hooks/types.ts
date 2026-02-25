/**
 * Tipos base para todos los hooks de almacén
 */

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

export interface BaseFilters {
  search?: string;
  warehouseId?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface MutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  reset: () => void;
}

// Filtros específicos para solicitudes
export interface SolicitudesFilters extends BaseFilters {
  estado?: string;
  tipo?: string;
  urgencia?: string;
  solicitanteId?: number;
  workOrderId?: number;
  productionOrderId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
}

// Filtros específicos para despachos
export interface DespachosFilters extends BaseFilters {
  estado?: string;
  tipo?: string;
  despachadorId?: number;
  receptorId?: number;
  materialRequestId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
}

// Filtros específicos para devoluciones
export interface DevolucionesFilters extends BaseFilters {
  estado?: string;
  solicitanteId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
}

// Filtros específicos para reservas
export interface ReservasFilters extends BaseFilters {
  estado?: string;
  tipo?: string;
  supplierItemId?: number;
  materialRequestId?: number;
  productionOrderId?: number;
  workOrderId?: number;
}

// Filtros específicos para inventario
export interface InventarioFilters extends BaseFilters {
  categoryId?: number;
  onlyBelowMinimum?: boolean;
  onlyBelowReorder?: boolean;
  supplierItemId?: number;
}

// Filtros específicos para movimientos/kardex
export interface MovimientosFilters extends BaseFilters {
  tipo?: string;
  supplierItemId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
}

// Filtros específicos para transferencias
export interface TransferenciasFilters extends BaseFilters {
  estado?: string;
  warehouseOrigenId?: number;
  warehouseDestinoId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
}

// Filtros específicos para ajustes
export interface AjustesFilters extends BaseFilters {
  estado?: string;
  tipo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

// Para acciones batch
export interface BatchActionParams {
  ids: number[];
  action: string;
  userId?: number;
  motivo?: string;
}

export interface BatchActionResult {
  results: Array<{ id: number; success: boolean }>;
  errors: Array<{ id: number; error: string }>;
  total: number;
  success: number;
}
