'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useMaintenanceDashboard } from '@/hooks/use-maintenance-dashboard';
import type { MaintenanceDashboardData } from '@/types/performance';

// ============================================================================
// CONTEXTO
// ============================================================================

interface MaintenanceDashboardContextValue {
  data: MaintenanceDashboardData | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

const MaintenanceDashboardContext = createContext<MaintenanceDashboardContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface MaintenanceDashboardProviderProps {
  companyId: number;
  sectorId: number;
  pageSize?: number;
  children: ReactNode;
}

/**
 * ✨ PROVIDER: Centraliza el dashboard de mantenimiento
 * 
 * USO:
 * - Envolver el panel principal de Mantenimiento con este provider
 * - Dentro, cualquier componente puede usar useMaintenanceDashboardContext()
 * - Garantiza que solo se hace 1 request al dashboard, sin importar cuántos componentes lo usen
 * 
 * BENEFICIOS:
 * - ✅ 1 solo hook call = 1 solo request
 * - ✅ Datos compartidos entre todos los subcomponentes
 * - ✅ Refresh centralizado
 * - ✅ Evita duplicación de requests
 */
export const MaintenanceDashboardProvider: React.FC<MaintenanceDashboardProviderProps> = ({
  companyId,
  sectorId,
  pageSize = 50,
  children
}) => {
  // ✅ UN SOLO hook call para todo el árbol de componentes
  const { data, isLoading, isError, error, refetch } = useMaintenanceDashboard(
    companyId,
    sectorId,
    { pageSize, enabled: true }
  );



  const value: MaintenanceDashboardContextValue = {
    data,
    isLoading,
    isError,
    error,
    refresh: refetch
  };

  return (
    <MaintenanceDashboardContext.Provider value={value}>
      {children}
    </MaintenanceDashboardContext.Provider>
  );
};

// ============================================================================
// HOOK CONSUMIDOR
// ============================================================================

/**
 * ✨ HOOK: Consume el dashboard de mantenimiento desde el contexto
 * 
 * USO:
 * ```tsx
 * const { data, isLoading, refresh } = useMaintenanceDashboardContext();
 * 
 * // Acceder a datos
 * const pending = data?.pending || [];
 * const kpis = data?.kpis;
 * const machines = data?.machines || [];
 * ```
 * 
 * IMPORTANTE:
 * - ✅ Solo puede usarse dentro de MaintenanceDashboardProvider
 * - ✅ No hace fetch, solo lee del contexto
 * - ✅ Múltiples llamadas = 0 requests adicionales
 */
export const useMaintenanceDashboardContext = (): MaintenanceDashboardContextValue => {
  const context = useContext(MaintenanceDashboardContext);
  
  if (!context) {
    throw new Error(
      'useMaintenanceDashboardContext debe usarse dentro de MaintenanceDashboardProvider. ' +
      'Envuelve tu componente con <MaintenanceDashboardProvider>.'
    );
  }
  
  return context;
};

// ============================================================================
// HOOKS DERIVADOS (Backward compatibility)
// ============================================================================

/**
 * ✅ Hooks derivados para facilitar migración desde código existente
 * Extraen datos específicos del dashboard
 */

export const useDashboardPending = () => {
  const { data, isLoading } = useMaintenanceDashboardContext();
  return {
    pending: data?.pending || [],
    isLoading
  };
};

export const useDashboardCompletedToday = () => {
  const { data, isLoading } = useMaintenanceDashboardContext();
  return {
    completedToday: data?.completedToday || [],
    isLoading
  };
};

export const useDashboardMachines = () => {
  const { data, isLoading } = useMaintenanceDashboardContext();
  return {
    machines: data?.machines || [],
    isLoading
  };
};

export const useDashboardMobileUnits = () => {
  const { data, isLoading } = useMaintenanceDashboardContext();
  return {
    mobileUnits: data?.mobileUnits || [],
    isLoading
  };
};

export const useDashboardKPIs = () => {
  const { data, isLoading } = useMaintenanceDashboardContext();
  return {
    kpis: data?.kpis || null,
    isLoading
  };
};

