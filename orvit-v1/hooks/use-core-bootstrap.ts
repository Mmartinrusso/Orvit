'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TIPOS
// ============================================================================

interface BootstrapUser {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  isActive: boolean;
}

interface BootstrapCompany {
  id: number;
  name: string;
  logo?: string;
  isActive: boolean;
  roleId?: number;
  roleName?: string;
}

interface BootstrapArea {
  id: number;
  name: string;
  icon?: string;
  description?: string;
}

interface BootstrapSector {
  id: number;
  name: string;
  description?: string;
  areaId: number;
  area?: {
    id: number;
    name: string;
  };
}

interface BootstrapNotifications {
  unreadCount: number;
  total: number;
}

interface BootstrapSystemSettings {
  systemLogoDark?: string | null;
  systemLogoLight?: string | null;
  timezone: string;
  currency: string;
  dateFormat: string;
}

interface BootstrapData {
  user: BootstrapUser;
  companies: BootstrapCompany[];
  currentCompanyId: number | null;
  areas: BootstrapArea[];
  sectors: BootstrapSector[];
  permissions: string[];
  notifications: BootstrapNotifications;
  systemSettings: BootstrapSystemSettings;
  metadata: {
    timestamp: string;
  };
}

interface UseCoreBootstrapOptions {
  enabled?: boolean;
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * ✨ HOOK OPTIMIZADO: Bootstrap del sistema
 * Carga TODOS los datos de sesión en 1 solo request
 * 
 * ANTES: 5-10 requests (auth/me, companies, areas, sectors, etc.)
 * DESPUÉS: 1 request con React Query
 */
export function useCoreBootstrap(options: UseCoreBootstrapOptions = {}) {
  const { enabled = true } = options;

  return useQuery<BootstrapData>({
    queryKey: ['core-bootstrap'],
    queryFn: async () => {
      const response = await fetch('/api/core/bootstrap', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('NO_AUTH');
        }
        throw new Error(`Error ${response.status}`);
      }

      return response.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000,   // 10 minutos
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // No reintentar si no está autenticado
      if (error.message === 'NO_AUTH') return false;
      return failureCount < 2;
    }
  });
}

// ============================================================================
// HOOKS DERIVADOS - Leen del cache sin hacer requests adicionales
// ============================================================================

export function useCurrentUser() {
  const { data, isLoading, isError } = useCoreBootstrap();
  return {
    user: data?.user || null,
    isLoading,
    isError,
    isAuthenticated: !!data?.user
  };
}

export function useCompanies() {
  const { data, isLoading, refetch } = useCoreBootstrap();
  return {
    companies: data?.companies || [],
    currentCompanyId: data?.currentCompanyId,
    isLoading,
    refetch
  };
}

export function useAreas() {
  const { data, isLoading } = useCoreBootstrap();
  return {
    areas: data?.areas || [],
    isLoading
  };
}

export function useSectorsFromBootstrap() {
  const { data, isLoading } = useCoreBootstrap();
  return {
    sectors: data?.sectors || [],
    isLoading
  };
}

export function usePermissions() {
  const { data, isLoading } = useCoreBootstrap();
  
  const hasPermission = (permission: string) => {
    return data?.permissions?.includes(permission) || false;
  };

  return {
    permissions: data?.permissions || [],
    hasPermission,
    isLoading
  };
}

export function useNotificationsSummary() {
  const { data, isLoading, refetch } = useCoreBootstrap();
  return {
    unreadCount: data?.notifications?.unreadCount || 0,
    total: data?.notifications?.total || 0,
    isLoading,
    refetch
  };
}

export function useSystemSettings() {
  const { data, isLoading } = useCoreBootstrap();
  return {
    settings: data?.systemSettings || null,
    systemLogoDark: data?.systemSettings?.systemLogoDark,
    systemLogoLight: data?.systemSettings?.systemLogoLight,
    timezone: data?.systemSettings?.timezone || 'America/Argentina/Buenos_Aires',
    currency: data?.systemSettings?.currency || 'ARS',
    isLoading
  };
}

// ============================================================================
// UTILIDADES
// ============================================================================

export function useInvalidateBootstrap() {
  const queryClient = useQueryClient();
  
  return {
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['core-bootstrap'] });
    },
    // Útil cuando cambia la empresa seleccionada
    refetchBootstrap: () => {
      queryClient.refetchQueries({ queryKey: ['core-bootstrap'] });
    }
  };
}

// Exportar tipos
export type {
  BootstrapData,
  BootstrapUser,
  BootstrapCompany,
  BootstrapArea,
  BootstrapSector,
  BootstrapNotifications,
  BootstrapSystemSettings
};
