'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGlobalCache, createCacheKey } from './use-global-cache';
import type {
  AdminCatalogsData,
  ProductSummary,
  CategorySummary,
  SupplySummary,
  EmployeeSummary,
  ClientSummary,
  SupplierSummary,
  UseOptimizedDataReturn
} from '@/types/performance';

interface UseAdminCatalogsOptions {
  enabled?: boolean;
}

type UseAdminCatalogsReturn = UseOptimizedDataReturn<AdminCatalogsData>;

// ============================================================================
// HOOK
// ============================================================================

/**
 * ✨ HOOK OPTIMIZADO: Catálogos unificados de administración
 * Reemplaza múltiples hooks individuales con uno solo
 * Usa el endpoint /api/admin/catalogs que consolida datos
 * 
 * ANTES: 10-15 hooks diferentes haciendo requests por separado
 * DESPUÉS: 1 hook - 1 request
 * 
 * @param companyId - ID de la empresa
 * @param options - Opciones de configuración
 */
export function useAdminCatalogs(
  companyId: number | null | undefined,
  options: UseAdminCatalogsOptions = {}
): UseAdminCatalogsReturn {
  const { enabled = true } = options;

  const cache = useGlobalCache();
  const [data, setData] = useState<AdminCatalogsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // ✨ FIX: Flags para evitar múltiples fetches
  const isFetchingRef = useRef(false);
  const lastCompanyIdRef = useRef<number | null | undefined>(null);
  
  // Función para fetch de datos
  const fetchCatalogs = useCallback(async () => {
    if (!enabled || !companyId) {
      setIsLoading(false);
      return;
    }
    
    // ✨ FIX: Evitar múltiples fetches simultáneos
    if (isFetchingRef.current) return;
    
    // ✨ FIX: Solo hacer fetch si cambió el companyId
    if (lastCompanyIdRef.current === companyId && data) {
      return; // Ya tenemos datos para este companyId
    }

    // Cache key
    const cacheKey = createCacheKey('admin-catalogs', companyId.toString());
    
    // Verificar cache primero
    const cached = cache.get<AdminCatalogsData>(cacheKey);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      lastCompanyIdRef.current = companyId;
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const response = await fetch(`/api/admin/catalogs?companyId=${companyId}`, {
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

      const catalogsData = await response.json();
      
      setData(catalogsData);
      lastCompanyIdRef.current = companyId;
      
      // Guardar en cache (TTL de 5 minutos - los catálogos cambian con menos frecuencia)
      cache.set(cacheKey, catalogsData, { ttl: 5 * 60 * 1000 });

      setIsError(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching admin catalogs:', err);
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [companyId, enabled, cache, data]);

  // Effect para cargar datos inicial
  useEffect(() => {
    fetchCatalogs();
  }, [companyId, enabled]); // ✨ FIX: Solo depender de companyId y enabled, no de fetchCatalogs

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: fetchCatalogs
  };
}

/**
 * ✨ HOOKS DERIVADOS: Para mantener compatibilidad con código existente
 * Extraen datos específicos de los catálogos unificados
 */

export function useProducts(companyId: number | null | undefined) {
  const { data, isLoading, isError, error, refetch } = useAdminCatalogs(companyId);
  
  return {
    data: data?.products || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useProductCategories(companyId: number | null | undefined) {
  const { data, isLoading, isError, error, refetch } = useAdminCatalogs(companyId);
  
  return {
    data: data?.categories || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useSupplies(companyId: number | null | undefined) {
  const { data, isLoading, isError, error, refetch } = useAdminCatalogs(companyId);
  
  return {
    data: data?.supplies || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useEmployeesFromCatalog(companyId: number | null | undefined) {
  const { data, isLoading, isError, error, refetch } = useAdminCatalogs(companyId);
  
  return {
    data: data?.employees || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useClientsFromCatalog(companyId: number | null | undefined) {
  const { data, isLoading, isError, error, refetch } = useAdminCatalogs(companyId);
  
  return {
    data: data?.clients || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

export function useSuppliersFromCatalog(companyId: number | null | undefined) {
  const { data, isLoading, isError, error, refetch } = useAdminCatalogs(companyId);
  
  return {
    data: data?.suppliers || [],
    isLoading,
    isError,
    error,
    refetch
  };
}

