'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarPermissions {
  canViewTasks: boolean;
  canViewUsuarios: boolean;
  canViewPermisos: boolean;
  canViewRoles: boolean;
}

/**
 * ✨ OPTIMIZADO: Hook para permisos del sidebar
 * Ya NO hace fetch - lee directamente de AuthContext
 */
export function useSidebarPermissions() {
  const { user, loading, hasPermission, hasAnyPermission } = useAuth();

  // ✨ OPTIMIZACIÓN: Calcular permisos desde memoria
  const permissions = useMemo<SidebarPermissions>(() => {
    if (!user) {
      return {
        canViewTasks: false,
        canViewUsuarios: false,
        canViewPermisos: false,
        canViewRoles: false,
      };
    }

    return {
      canViewTasks: hasAnyPermission(['tasks.view_all', 'ingresar_tareas']),
      canViewUsuarios: hasPermission('gestionar_usuarios'),
      canViewPermisos: hasPermission('admin.permissions'),
      canViewRoles: hasPermission('admin.roles'),
    };
  }, [user, hasPermission, hasAnyPermission]);

  // No-op function para mantener compatibilidad
  const refreshPermissions = async () => {
    // No hace nada - los permisos se actualizan con el usuario
  };

  return {
    ...permissions,
    isLoading: loading,
    error: null,
    refreshPermissions
  };
}
