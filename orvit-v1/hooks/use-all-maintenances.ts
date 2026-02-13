'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface MaintenanceItem {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  type: string;
  machineId?: number;
  componentId?: number;
  unidadMovilId?: number;
  estimatedHours?: number;
  timeValue?: number;
  timeUnit?: string;
  machine?: { id: number; name: string };
  component?: { id: number; name: string };
  unidadMovil?: { id: number; nombre: string };
  [key: string]: any;
}

interface UseAllMaintenancesOptions {
  enabled?: boolean;
  sectorId?: number | null;
}

interface UseAllMaintenancesReturn {
  data: MaintenanceItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Cache global para evitar múltiples fetches
const maintenancesCache = new Map<string, { data: MaintenanceItem[]; timestamp: number }>();
const pendingRequests = new Map<string, Promise<MaintenanceItem[]>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de cache (optimizado)

/**
 * Hook optimizado para obtener todos los mantenimientos
 * Con cache y deduplicación de requests
 */
export function useAllMaintenances(
  companyId: number | null | undefined,
  options: UseAllMaintenancesOptions = {}
): UseAllMaintenancesReturn {
  const { enabled = true, sectorId } = options;
  
  const [data, setData] = useState<MaintenanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchedRef = useRef(false);

  const fetchMaintenances = useCallback(async (force = false) => {
    if (!enabled || !companyId) {
      setIsLoading(false);
      return;
    }

    const cacheKey = `all-maintenances-${companyId}-${sectorId || 'all'}`;

    // Verificar cache
    if (!force) {
      const cached = maintenancesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setData(cached.data);
        setIsLoading(false);
        setIsError(false);
        return;
      }
    }

    // Deduplicación: si ya hay un request en curso, esperar ese
    if (pendingRequests.has(cacheKey)) {
      try {
        const result = await pendingRequests.get(cacheKey)!;
        setData(result);
        setIsLoading(false);
        setIsError(false);
        return;
      } catch (err) {
        // El request falló, intentar de nuevo
      }
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    const fetchPromise = (async () => {
      try {
        let url = `/api/maintenance/all?companyId=${companyId}`;
        if (sectorId) {
          url += `&sectorId=${sectorId}`;
        }

        const response = await fetch(url, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const maintenances = Array.isArray(result) ? result : result.maintenances || [];

        // Guardar en cache
        maintenancesCache.set(cacheKey, { data: maintenances, timestamp: Date.now() });

        return maintenances;
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    pendingRequests.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;
      setData(result);
      setIsError(false);
    } catch (err) {
      console.error('Error fetching all maintenances:', err);
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, sectorId, enabled]);

  useEffect(() => {
    if (!fetchedRef.current && enabled && companyId) {
      fetchedRef.current = true;
      fetchMaintenances();
    }
  }, [fetchMaintenances, enabled, companyId]);

  // Reset cuando cambian los parámetros
  useEffect(() => {
    fetchedRef.current = false;
  }, [companyId, sectorId]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: () => fetchMaintenances(true)
  };
}

/**
 * Función para obtener mantenimientos con cache (para uso fuera de componentes)
 */
export async function fetchAllMaintenancesCached(
  companyId: number,
  sectorId?: number | null
): Promise<MaintenanceItem[]> {
  const cacheKey = `all-maintenances-${companyId}-${sectorId || 'all'}`;

  // Verificar cache
  const cached = maintenancesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Deduplicación
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      let url = `/api/maintenance/all?companyId=${companyId}`;
      if (sectorId) {
        url += `&sectorId=${sectorId}`;
      }

      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const maintenances = Array.isArray(result) ? result : result.maintenances || [];

      maintenancesCache.set(cacheKey, { data: maintenances, timestamp: Date.now() });

      return maintenances;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidar cache de mantenimientos
 */
export function invalidateMaintenancesCache(companyId?: number, sectorId?: number | null) {
  if (companyId) {
    const cacheKey = `all-maintenances-${companyId}-${sectorId || 'all'}`;
    maintenancesCache.delete(cacheKey);
  } else {
    maintenancesCache.clear();
  }
}
