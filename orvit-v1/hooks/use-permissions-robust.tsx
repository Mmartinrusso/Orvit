'use client';

import { useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface UsePermissionsRobustOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  quiet?: boolean;
}

export interface UsePermissionsRobustReturn {
  // Funciones principales (ahora síncronas - leen de memoria)
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  
  // Estado
  permissions: string[];
  isLoading: boolean;
  error: string | null;
  
  // Utilitarios (no-op para mantener compatibilidad)
  refreshPermissions: () => Promise<void>;
  clearCache: () => void;
}

/**
 * ✨ OPTIMIZADO: Hook para verificar permisos usando AuthContext
 * Ya NO hace fetches - lee directamente de memoria
 * Elimina 40-60 requests por página
 */
export function usePermissionsRobust(options: UsePermissionsRobustOptions = {}): UsePermissionsRobustReturn {
  const { user, loading, hasPermission: authHasPermission, hasAnyPermission: authHasAnyPermission, hasAllPermissions: authHasAllPermissions } = useAuth();
  
  const { quiet = true } = options;
  
  // ✨ OPTIMIZACIÓN: Permisos ya cargados en AuthContext
  const permissions = useMemo(() => {
    return user?.permissions || [];
  }, [user]);

  // ✨ OPTIMIZACIÓN: Funciones síncronas (no async) - leen de memoria
  const hasPermission = useCallback((permission: string): boolean => {
    return authHasPermission(permission);
  }, [authHasPermission]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    return authHasAnyPermission(permissions);
  }, [authHasAnyPermission]);

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    return authHasAllPermissions(permissions);
  }, [authHasAllPermissions]);

  // No-op functions para mantener compatibilidad con código existente
  const refreshPermissions = useCallback(async () => {
    // No hace nada - los permisos se actualizan con el usuario
    if (!quiet) {
      console.log('✅ Permisos ya están en memoria, no es necesario refrescar');
    }
  }, [quiet]);

  const clearCache = useCallback(() => {
    // No hace nada - no hay cache local
    if (!quiet) {
      console.log('✅ No hay cache local, los permisos están en AuthContext');
    }
  }, [quiet]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    permissions,
    isLoading: loading,
    error: null,
    refreshPermissions,
    clearCache
  };
}

/**
 * ✨ OPTIMIZADO: Hook simplificado para un solo permiso
 * Ya NO hace fetch - lee directamente de AuthContext
 */
export function usePermissionRobust(permission: string) {
  const { user, loading, hasPermission } = useAuth();

  const hasAccess = useMemo(() => {
    return hasPermission(permission);
  }, [hasPermission, permission]);

  return {
    hasPermission: hasAccess,
    isLoading: loading,
    error: null
  };
}

/**
 * ✨ OPTIMIZADO: Hook para múltiples permisos
 */
export function useMultiplePermissionsRobust(
  permissions: string[],
  mode: 'any' | 'all' = 'any'
) {
  const { hasAnyPermission, hasAllPermissions, loading } = useAuth();

  const hasAccess = useMemo(() => {
    if (mode === 'any') {
      return hasAnyPermission(permissions);
    } else {
      return hasAllPermissions(permissions);
    }
  }, [hasAnyPermission, hasAllPermissions, permissions, mode]);

  return {
    hasPermission: hasAccess,
    isLoading: loading,
    error: null
  };
}

// HOC para componentes con permisos
export function withPermissionRobust<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  requiredPermission: string | string[],
  options: {
    mode?: 'any' | 'all';
    fallback?: React.ReactNode;
  } = {}
) {
  const { mode = 'any', fallback = null } = options;

  return function PermissionWrapper(props: T) {
    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const { hasPermission, isLoading } = useMultiplePermissionsRobust(permissions, mode);

    if (isLoading) {
      return <div className="animate-pulse bg-muted h-4 w-4 rounded"></div>;
    }

    if (!hasPermission) {
      return fallback;
    }

    return <WrappedComponent {...props} />;
  };
}

// Componente guard para permisos
interface PermissionGuardRobustProps {
  permission: string | string[];
  mode?: 'any' | 'all';
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuardRobust({
  permission,
  mode = 'any',
  fallback = null,
  loading = <div className="animate-pulse bg-muted h-4 w-4 rounded"></div>,
  children
}: PermissionGuardRobustProps) {
  const permissions = Array.isArray(permission) ? permission : [permission];
  const { hasPermission, isLoading } = useMultiplePermissionsRobust(permissions, mode);

  if (isLoading) {
    return loading;
  }

  if (!hasPermission) {
    return fallback;
  }

  return <>{children}</>;
}
