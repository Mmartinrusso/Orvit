'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGlobalCache, createCacheKey } from './use-global-cache';

export interface Sector {
  id: number;
  name: string;
  companyId?: number;
}

interface UseSectorsOptions {
  enabled?: boolean;
}

/**
 * ✨ HOOK CENTRALIZADO: Sectores de la empresa
 * 
 * ANTES: Cada componente hacía su propio fetch a /api/sectores
 * AHORA: Cache global de 5 minutos + deduplicación automática
 * 
 * USO:
 * ```tsx
 * const { sectors, isLoading, refresh } = useSectors(companyId);
 * ```
 */
export function useSectors(
  companyId: number | null | undefined,
  options: UseSectorsOptions = {}
) {
  const { enabled = true } = options;
  const cache = useGlobalCache();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const fetchedRef = useRef(false);

  const fetchSectors = useCallback(async (force = false) => {
    if (!enabled || !companyId) {
      setIsLoading(false);
      return;
    }

    const cacheKey = createCacheKey('sectors', companyId.toString());
    
    // ✅ Cache primero (5 minutos)
    if (!force) {
      const cached = cache.get<Sector[]>(cacheKey);
      if (cached) {
        setSectors(cached);
        setIsLoading(false);
        setIsError(false);
        return;
      }
    }

    setIsLoading(true);
    setIsError(false);

    try {
      const response = await fetch(`/api/sectores?companyId=${companyId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const sectorsData = Array.isArray(data) ? data : [];
      
      setSectors(sectorsData);
      
      // ✅ Cache por 5 minutos
      cache.set(cacheKey, sectorsData, { ttl: 5 * 60 * 1000 });
      
      setIsError(false);
    } catch (err) {
      console.error('Error fetching sectors:', err);
      setIsError(true);
      setSectors([]);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, enabled, cache]);

  // ✅ Cargar solo una vez al montar
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchSectors();
    }
  }, [fetchSectors]);

  return {
    sectors,
    isLoading,
    isError,
    refetch: () => fetchSectors(true)
  };
}

