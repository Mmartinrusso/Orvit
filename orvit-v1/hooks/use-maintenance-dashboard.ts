'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGlobalCache, createCacheKey } from './use-global-cache';
import type {
  MaintenanceDashboardData,
  MaintenanceSummary,
  MachineSummary,
  MobileUnitSummary,
  MaintenanceKPIs,
  UseOptimizedDataReturn
} from '@/types/performance';

interface UseMaintenanceDashboardOptions {
  pageSize?: number;
  enabled?: boolean;
  refetchInterval?: number;
}

type UseMaintenanceDashboardReturn = UseOptimizedDataReturn<MaintenanceDashboardData>;

// ✅ Sistema de deduplicación global para evitar múltiples fetches simultáneos
const pendingRequests = new Map<string, Promise<MaintenanceDashboardData>>();

// ============================================================================
// HOOK OPTIMIZADO
// ============================================================================

/**
 * ✨ HOOK OPTIMIZADO: Dashboard unificado de mantenimiento
 * Reemplaza múltiples hooks individuales con uno solo
 * Usa el endpoint /api/maintenance/dashboard que consolida datos
 * 
 * ✅ DEDUPLICACIÓN: Múltiples llamadas con mismos params = 1 solo request
 * ✅ CACHE: TTL de 2 minutos para evitar requests innecesarios
 * ✅ ESTABLE: Key basada en companyId + sectorId + pageSize
 * 
 * ANTES: 8-10 hooks diferentes haciendo requests por separado
 * DESPUÉS: 1 hook - 1 request
 * 
 * @param companyId - ID de la empresa
 * @param sectorId - ID del sector (opcional)
 * @param options - Opciones de configuración
 */
export function useMaintenanceDashboard(
  companyId: number | null | undefined,
  sectorId?: number | null,
  options: UseMaintenanceDashboardOptions = {}
): UseMaintenanceDashboardReturn {
  const {
    pageSize = 50,
    enabled = true,
    refetchInterval
  } = options;

  const cache = useGlobalCache();
  const [data, setData] = useState<MaintenanceDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // ✅ Ref para evitar múltiples fetches por el mismo componente
  const fetchedRef = useRef(false);

  // ✅ Función de fetch con deduplicación
  const fetchDashboard = useCallback(async (force = false) => {
    if (!enabled || !companyId) {
      setIsLoading(false);
      return;
    }

    // Cache key estable
    const cacheKey = createCacheKey('maintenance-dashboard', companyId.toString(), sectorId?.toString() || 'all', pageSize.toString());
    
    // ✅ Verificar cache primero (excepto si es force)
    if (!force) {
      const cached = cache.get<MaintenanceDashboardData>(cacheKey);
      if (cached) {
        setData(cached);
        setIsLoading(false);
        setIsError(false);
        setError(null);
        return;
      }
    }

    // ✅ Deduplicación: Si ya hay un request en curso con estos params, esperar ese
    const requestKey = cacheKey;
    if (pendingRequests.has(requestKey)) {
      try {
        const cachedData = await pendingRequests.get(requestKey)!;
        setData(cachedData);
        setIsLoading(false);
        setIsError(false);
        setError(null);
        return;
      } catch (err) {
        // El request falló, intentaremos de nuevo
      }
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    // ✅ Crear promise de fetch y guardarla para deduplicación
    const fetchPromise = (async () => {
      try {
        // Construir URL
        const params = new URLSearchParams({
          companyId: companyId.toString(),
          pageSize: pageSize.toString()
        });

        if (sectorId) {
          params.append('sectorId', sectorId.toString());
        }

        const response = await fetch(`/api/maintenance/dashboard?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const dashboardData = await response.json();
        
        // ✅ Validar datos antes de guardar
        if (!dashboardData || typeof dashboardData !== 'object') {
          throw new Error('Respuesta del dashboard inválida');
        }

        // ✅ Log claro de datos cargados (solo en dev)
        // Guardar en cache (TTL de 2 minutos)
        cache.set(cacheKey, dashboardData, { ttl: 2 * 60 * 1000 });

        return dashboardData;
      } finally {
        // Limpiar el request pendiente
        pendingRequests.delete(requestKey);
      }
    })();

    // Guardar el promise para deduplicación
    pendingRequests.set(requestKey, fetchPromise);

    try {
      const dashboardData = await fetchPromise;
      setData(dashboardData);
      setIsError(false);
      setError(null);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, sectorId, pageSize, enabled, cache]);

  // Effect para cargar datos inicial (solo una vez)
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchDashboard();
    }
  }, [fetchDashboard]);

  // Effect para refetch automático (opcional)
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(() => {
      fetchDashboard(true); // Force para ignorar cache
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchDashboard]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: () => fetchDashboard(true) // Force refetch
  };
}

/**
 * ✨ HOOKS DERIVADOS: Para mantener compatibilidad con código existente
 * Extraen datos específicos del dashboard unificado
 */

export function usePendingMaintenances(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  
  return {
    data: data?.pending || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useCompletedTodayMaintenances(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  
  return {
    data: data?.completedToday || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useMaintenanceMachines(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  
  return {
    data: data?.machines || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useMaintenanceMobileUnits(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  
  return {
    data: data?.mobileUnits || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useMaintenanceKPIs(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  
  return {
    data: data?.kpis || null,
    isLoading,
    isError,
    error,
    refetch
  };
}



export function useMaintenanceChecklists(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  
  return {
    data: data?.checklists || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useMaintenanceRecentHistory(companyId: number | null | undefined, sectorId?: number | null) {
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(companyId, sectorId);
  
  return {
    data: data?.recentHistory || [],
    isLoading,
    isError,
    error,
    refetch
  };
}
