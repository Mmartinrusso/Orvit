'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// CACHE GLOBAL COMPARTIDO ENTRE TODOS LOS COMPONENTES
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Cache global singleton
const sharedCache = new Map<string, CacheEntry<any>>();
const pendingRequests = new Map<string, Promise<any>>();
const subscribers = new Map<string, Set<(data: any) => void>>();

// TTLs por tipo de dato
const CACHE_TTLS = {
  maintenances: 2 * 60 * 1000,      // 2 minutos
  machines: 3 * 60 * 1000,          // 3 minutos
  dashboard: 1 * 60 * 1000,         // 1 minuto
  areas: 5 * 60 * 1000,             // 5 minutos
  sectors: 5 * 60 * 1000,           // 5 minutos
  users: 5 * 60 * 1000,             // 5 minutos
  checklists: 2 * 60 * 1000,        // 2 minutos
  workOrders: 1 * 60 * 1000,        // 1 minuto
  default: 2 * 60 * 1000            // 2 minutos
};

/**
 * Obtener datos del cache
 */
function getCached<T>(key: string): T | null {
  const entry = sharedCache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > entry.ttl) {
    sharedCache.delete(key);
    return null;
  }
  
  return entry.data as T;
}

/**
 * Guardar datos en cache y notificar suscriptores
 */
function setCached<T>(key: string, data: T, ttl?: number): void {
  const finalTtl = ttl || CACHE_TTLS.default;
  sharedCache.set(key, { data, timestamp: Date.now(), ttl: finalTtl });
  
  // Notificar a todos los suscriptores
  const subs = subscribers.get(key);
  if (subs) {
    subs.forEach(callback => callback(data));
  }
}

/**
 * Suscribirse a cambios en una key
 */
function subscribe(key: string, callback: (data: any) => void): () => void {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key)!.add(callback);
  
  return () => {
    const subs = subscribers.get(key);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        subscribers.delete(key);
      }
    }
  };
}

/**
 * Fetch con deduplicación y cache
 */
async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 1. Verificar cache
  const cached = getCached<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  // 2. Verificar si ya hay un request en curso
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  
  // 3. Crear nuevo request
  const promise = (async () => {
    try {
      const data = await fetcher();
      setCached(key, data, ttl);
      return data;
    } finally {
      pendingRequests.delete(key);
    }
  })();
  
  pendingRequests.set(key, promise);
  return promise;
}

// ============================================================================
// HOOKS COMPARTIDOS
// ============================================================================

/**
 * Hook para mantenimientos compartidos
 */
export function useSharedMaintenances(companyId: number | null | undefined) {
  const [data, setData] = useState<any[]>(() => {
    if (!companyId) return [];
    return getCached<any[]>(`maintenances-${companyId}`) || [];
  });
  const [isLoading, setIsLoading] = useState(!getCached(`maintenances-${companyId}`));
  
  useEffect(() => {
    if (!companyId) return;
    
    const key = `maintenances-${companyId}`;
    
    // Suscribirse a cambios
    const unsubscribe = subscribe(key, setData);
    
    // Cargar datos si no están en cache
    const cached = getCached<any[]>(key);
    if (cached) {
      setData(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      fetchWithCache(
        key,
        async () => {
          const response = await fetch(`/api/maintenance/all?companyId=${companyId}`);
          if (!response.ok) throw new Error('Error fetching maintenances');
          return response.json();
        },
        CACHE_TTLS.maintenances
      ).then(result => {
        setData(result);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    }
    
    return unsubscribe;
  }, [companyId]);
  
  const refetch = useCallback(async () => {
    if (!companyId) return;
    const key = `maintenances-${companyId}`;
    sharedCache.delete(key);
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/maintenance/all?companyId=${companyId}`);
      if (!response.ok) throw new Error('Error fetching maintenances');
      const result = await response.json();
      setCached(key, result, CACHE_TTLS.maintenances);
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  return { data, isLoading, refetch };
}

/**
 * Hook para dashboard de mantenimiento compartido
 */
export function useSharedDashboard(companyId: number | null | undefined, sectorId?: number | null) {
  const key = `dashboard-${companyId}-${sectorId || 'all'}`;
  const [data, setData] = useState<any>(() => getCached(key));
  const [isLoading, setIsLoading] = useState(!getCached(key));
  
  useEffect(() => {
    if (!companyId) return;
    
    const unsubscribe = subscribe(key, setData);
    
    const cached = getCached(key);
    if (cached) {
      setData(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      const params = new URLSearchParams({ companyId: companyId.toString() });
      if (sectorId) params.append('sectorId', sectorId.toString());
      
      fetchWithCache(
        key,
        async () => {
          const response = await fetch(`/api/maintenance/dashboard?${params}`);
          if (!response.ok) throw new Error('Error fetching dashboard');
          return response.json();
        },
        CACHE_TTLS.dashboard
      ).then(result => {
        setData(result);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    }
    
    return unsubscribe;
  }, [companyId, sectorId, key]);
  
  return { data, isLoading };
}

/**
 * Prefetch de datos comunes al cargar la app
 */
export async function prefetchCommonData(companyId: number, sectorId?: number) {
  const promises: Promise<any>[] = [];
  
  // Prefetch maintenances
  const maintKey = `maintenances-${companyId}`;
  if (!getCached(maintKey)) {
    promises.push(
      fetchWithCache(maintKey, async () => {
        const response = await fetch(`/api/maintenance/all?companyId=${companyId}`);
        return response.json();
      }, CACHE_TTLS.maintenances)
    );
  }
  
  // Prefetch dashboard
  const dashKey = `dashboard-${companyId}-${sectorId || 'all'}`;
  if (!getCached(dashKey)) {
    const params = new URLSearchParams({ companyId: companyId.toString() });
    if (sectorId) params.append('sectorId', sectorId.toString());
    
    promises.push(
      fetchWithCache(dashKey, async () => {
        const response = await fetch(`/api/maintenance/dashboard?${params}`);
        return response.json();
      }, CACHE_TTLS.dashboard)
    );
  }
  
  await Promise.allSettled(promises);
}

/**
 * Invalidar cache por patrón
 */
export function invalidateCache(pattern?: string) {
  if (!pattern) {
    sharedCache.clear();
    return;
  }
  
  for (const key of sharedCache.keys()) {
    if (key.includes(pattern)) {
      sharedCache.delete(key);
    }
  }
}

/**
 * Obtener estadísticas del cache
 */
export function getCacheStats() {
  return {
    size: sharedCache.size,
    keys: Array.from(sharedCache.keys()),
    pendingRequests: pendingRequests.size
  };
}

// Exportar funciones de bajo nivel para uso avanzado
export { getCached, setCached, fetchWithCache, subscribe };
