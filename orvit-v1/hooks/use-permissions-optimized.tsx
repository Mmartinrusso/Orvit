'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { 
  hasPermissionOptimized, 
  hasAnyPermissionOptimized, 
  hasAllPermissionsOptimized,
  clearPermissionsCache,
  type Permission, 
  type PermissionContext 
} from '@/lib/permissions-optimized';

export interface UsePermissionsOptimizedOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  quiet?: boolean; // Reducir logs
}

export interface UsePermissionsOptimizedReturn {
  // Funciones principales
  hasPermission: (permission: Permission, context?: Partial<PermissionContext>) => Promise<boolean>;
  hasAnyPermission: (permissions: Permission[], context?: Partial<PermissionContext>) => Promise<boolean>;
  hasAllPermissions: (permissions: Permission[], context?: Partial<PermissionContext>) => Promise<boolean>;
  
  // Estado
  permissions: string[];
  isLoading: boolean;
  error: string | null;
  
  // Utilitarios
  refreshPermissions: () => Promise<void>;
  clearCache: () => void;
  
  // Contexto generado
  context: PermissionContext | null;
}

export function usePermissionsOptimized(options: UsePermissionsOptimizedOptions = {}): UsePermissionsOptimizedReturn {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  
  const { autoRefresh = false, refreshInterval = 10 * 60 * 1000, quiet = true } = options;
  
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crear contexto base
  const context = useMemo((): PermissionContext | null => {
    if (!user) return null;
    
    const userRole = user.role.toUpperCase() as any;
    // console.log('🔍 [OPTIMIZED] Rol del usuario:', { originalRole: user.role, normalizedRole: userRole, userId: user.id }); // Log reducido
    
    return {
      userId: parseInt(user.id),
      userRole: userRole,
      companyId: currentCompany?.id ? parseInt(currentCompany.id) : undefined
    };
  }, [user, currentCompany]);

  // Función para cargar permisos (simplificada)
  const loadPermissions = useCallback(async () => {
    if (!user || !context) {
      setPermissions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Usar permisos básicos según rol para evitar consultas innecesarias
      const basicPermissions = getBasicPermissionsByRole(context.userRole);
      // console.log('🔍 [OPTIMIZED] Permisos cargados:', { role: context.userRole, permissions: basicPermissions, count: basicPermissions.length }); // Log reducido
      setPermissions(basicPermissions);
      
      if (!quiet) {
        // console.log(`📋 Permisos cargados para ${context.userRole}: ${basicPermissions.length} permisos`) // Log reducido;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error cargando permisos';
      setError(errorMessage);
      
      if (!quiet) {
        console.error('Error cargando permisos:', err);
      }
      
      // Si hay error, usar permisos básicos
      if (context) {
        const basicPermissions = getBasicPermissionsByRole(context.userRole);
        setPermissions(basicPermissions);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, context, quiet]);

  // Función auxiliar para obtener permisos básicos según rol
  const getBasicPermissionsByRole = (userRole: string): string[] => {
    switch (userRole) {
      case 'SUPERADMIN':
        return [
          'users.view', 'users.create', 'users.edit', 'users.delete', 'users.edit_role', 'gestionar_usuarios',
          'ingresar_tareas', 'admin.permissions', 'admin.roles',
          'fixed_tasks.create', 'fixed_tasks.edit', 'fixed_tasks.delete',
          'ver_agenda', 'ver_historial', 'ver_estadisticas',
          'machines.create', 'machines.delete', 'machines.delete_component', 'machines.add_document', 'machines.edit'
        ];
      case 'ADMIN':
        return [
          'users.view', 'users.create', 'users.edit', 'users.delete', 'users.edit_role', 'gestionar_usuarios',
          'ingresar_tareas', 'admin.permissions', 'admin.roles',
          'fixed_tasks.create', 'fixed_tasks.edit', 'fixed_tasks.delete',
          'ver_agenda', 'ver_historial', 'ver_estadisticas',
          'machines.create', 'machines.delete', 'machines.delete_component', 'machines.add_document', 'machines.edit'
        ];
      case 'ADMIN_ENTERPRISE':
        return [
          'users.view', 'users.create', 'users.edit', 'users.delete', 'users.edit_role', 'gestionar_usuarios',
          'ingresar_tareas', 'admin.permissions', 'admin.roles',
          'fixed_tasks.create', 'fixed_tasks.edit', 'fixed_tasks.delete',
          'ver_agenda', 'ver_historial', 'ver_estadisticas',
          'machines.create', 'machines.delete', 'machines.delete_component', 'machines.add_document', 'machines.edit',
          'companies.create'
        ];
      case 'SUPERVISOR':
        return [
          'ingresar_tareas', 'ver_agenda', 'ver_historial', 'ver_estadisticas',
          'machines.edit', 'machines.add_document'
        ];
      case 'USER':
        return [
          'ingresar_tareas'
        ];
      default:
        return [];
    }
  };

  // Cargar permisos al montar y cuando cambie el usuario/empresa
  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Auto-refresh de permisos (menos frecuente)
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      loadPermissions();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadPermissions]);

  // Función para verificar un permiso (usando permisos básicos predefinidos)
  const checkPermission = useCallback(async (
    permission: Permission, 
    contextOverride?: Partial<PermissionContext>
  ): Promise<boolean> => {
    if (!context) return false;
    
    const finalContext = { ...context, ...contextOverride };
    
    // Usar permisos básicos predefinidos en lugar de consultar la BD
    const basicPermissions = getBasicPermissionsByRole(finalContext.userRole);
    const hasPermission = basicPermissions.includes(permission);
    

    
    return hasPermission;
  }, [context]);

  // Función para verificar múltiples permisos (usando permisos básicos)
  const checkAnyPermission = useCallback(async (
    permissions: Permission[], 
    contextOverride?: Partial<PermissionContext>
  ): Promise<boolean> => {
    if (!context) return false;
    
    const finalContext = { ...context, ...contextOverride };
    const basicPermissions = getBasicPermissionsByRole(finalContext.userRole);
    return permissions.some(permission => basicPermissions.includes(permission));
  }, []);

  // Función para verificar todos los permisos (usando permisos básicos)
  const checkAllPermissions = useCallback(async (
    permissions: Permission[], 
    contextOverride?: Partial<PermissionContext>
  ): Promise<boolean> => {
    if (!context) return false;
    
    const finalContext = { ...context, ...contextOverride };
    const basicPermissions = getBasicPermissionsByRole(finalContext.userRole);
    return permissions.every(permission => basicPermissions.includes(permission));
  }, []);

  // Función para refrescar permisos
  const refreshPermissions = useCallback(async () => {
    await loadPermissions();
  }, [loadPermissions]);

  // Función para limpiar cache
  const clearCache = useCallback(() => {
    clearPermissionsCache();
    if (!quiet) {
      // console.log('🗑️ Cache de permisos limpiado') // Log reducido;
    }
  }, [quiet]);

  return {
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
    permissions,
    isLoading,
    error,
    refreshPermissions,
    clearCache,
    context
  };
}

// Hook simplificado para un solo permiso
export function usePermissionOptimized(
  permission: Permission, 
  contextOverride?: Partial<PermissionContext>
) {
  const { hasPermission, isLoading, error } = usePermissionsOptimized({ quiet: true });
  const [hasAccess, setHasAccess] = useState<boolean>(false);

  useEffect(() => {
    const checkPermission = async () => {
      const result = await hasPermission(permission, contextOverride);
      setHasAccess(result);
    };

    checkPermission();
  }, [hasPermission, permission, contextOverride]);

  return {
    hasPermission: hasAccess,
    isLoading,
    error
  };
}

// Hook para múltiples permisos
export function useMultiplePermissionsOptimized(
  permissions: Permission[],
  mode: 'any' | 'all' = 'any',
  contextOverride?: Partial<PermissionContext>
) {
  const { hasAnyPermission, hasAllPermissions, isLoading, error } = usePermissionsOptimized({ quiet: true });
  const [hasAccess, setHasAccess] = useState<boolean>(false);

  useEffect(() => {
    const checkPermissions = async () => {
      let result: boolean;
      
      if (mode === 'any') {
        result = await hasAnyPermission(permissions, contextOverride);
      } else {
        result = await hasAllPermissions(permissions, contextOverride);
      }
      
      setHasAccess(result);
    };

    checkPermissions();
  }, [hasAnyPermission, hasAllPermissions, permissions, mode, contextOverride]);

  return {
    hasPermission: hasAccess,
    isLoading,
    error
  };
}

// HOC para componentes con permisos
export function withPermissionOptimized<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  requiredPermission: Permission | Permission[],
  options: {
    mode?: 'any' | 'all';
    fallback?: React.ReactNode;
    contextOverride?: Partial<PermissionContext>;
  } = {}
) {
  const { mode = 'any', fallback = null, contextOverride } = options;

  return function PermissionWrapper(props: T) {
    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const { hasPermission, isLoading } = useMultiplePermissionsOptimized(permissions, mode, contextOverride);

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
interface PermissionGuardOptimizedProps {
  permission: Permission | Permission[];
  mode?: 'any' | 'all';
  contextOverride?: Partial<PermissionContext>;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuardOptimized({
  permission,
  mode = 'any',
  contextOverride,
  fallback = null,
  loading = <div className="animate-pulse bg-muted h-4 w-4 rounded"></div>,
  children
}: PermissionGuardOptimizedProps) {
  const permissions = Array.isArray(permission) ? permission : [permission];
  const { hasPermission, isLoading } = useMultiplePermissionsOptimized(permissions, mode, contextOverride);

  if (isLoading) {
    return loading;
  }

  if (!hasPermission) {
    return fallback;
  }

  return <>{children}</>;
} 