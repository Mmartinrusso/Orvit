'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TruckData, Load } from '@/lib/cargas/types';

interface CargasBootstrapData {
  trucks: TruckData[];
  loads: Load[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface CargasBootstrapResponse {
  success: boolean;
  data: CargasBootstrapData;
  pagination?: PaginationInfo;
}

interface CargasBootstrapFilters {
  page?: number;
  limit?: number;
  truckType?: 'CHASIS' | 'EQUIPO' | 'SEMI';
  truckId?: number;
  dateFrom?: string;
  dateTo?: string;
  client?: string;
  search?: string;
}

interface UseCargasBootstrapResult {
  data: CargasBootstrapData | undefined;
  pagination: PaginationInfo | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<any>;
  invalidate: () => void;
}

/**
 * ✨ HOOK OPTIMIZADO: Bootstrap de datos de cargas
 *
 * Consolida trucks + loads en una sola request usando React Query
 * - Caché compartido entre componentes (evita duplicados)
 * - Request único en lugar de múltiples requests separadas
 * - Soporte para paginación y filtros server-side
 * - staleTime: 30 segundos (cargas pueden cambiar frecuentemente)
 */
export function useCargasBootstrap(
  companyId: number | null | undefined,
  filters: CargasBootstrapFilters = {}
): UseCargasBootstrapResult {
  const queryClient = useQueryClient();

  // Construir query key que incluya filtros para cache correcto
  const queryKey = ['cargas-bootstrap', companyId, filters];

  const query = useQuery<CargasBootstrapResponse, Error>({
    queryKey,
    queryFn: async (): Promise<CargasBootstrapResponse> => {
      if (!companyId) {
        throw new Error('companyId es requerido');
      }

      // Construir URL con parámetros de filtro
      const params = new URLSearchParams();

      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.truckType) params.append('truckType', filters.truckType);
      if (filters.truckId) params.append('truckId', filters.truckId.toString());
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.client) params.append('client', filters.client);
      if (filters.search) params.append('search', filters.search);

      const queryString = params.toString();
      const url = `/api/admin/cargas/bootstrap${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: CargasBootstrapResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Respuesta inválida del servidor');
      }

      return result;
    },
    enabled: !!companyId,
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos en cache
  });

  // Función para invalidar el cache
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cargas-bootstrap', companyId] });
  };

  return {
    data: query.data?.data,
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}

/**
 * Hook para obtener solo los trucks (sin loads)
 * Útil cuando solo necesitas la lista de camiones
 */
export function useTrucks(companyId: number | null | undefined) {
  const { data, isLoading, refetch } = useCargasBootstrap(companyId);
  return {
    trucks: data?.trucks || [],
    isLoading,
    refetch,
  };
}

/**
 * Hook para obtener solo los loads (sin trucks separados)
 * Útil cuando solo necesitas la lista de cargas
 */
export function useLoads(
  companyId: number | null | undefined,
  filters: CargasBootstrapFilters = {}
) {
  const result = useCargasBootstrap(companyId, filters);
  return {
    loads: result.data?.loads || [],
    trucks: result.data?.trucks || [],
    pagination: result.pagination,
    isLoading: result.isLoading,
    refetch: result.refetch,
    invalidate: result.invalidate,
  };
}

export default useCargasBootstrap;
