'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * ✨ OPTIMIZADO: Hook de permisos que lee de AuthContext
 * Ya NO hace fetch a /api/admin/permissions
 * 
 * @deprecated Usar directamente useAuth().hasPermission() es más simple
 * Este hook queda para compatibilidad con código existente
 */

export interface Permission {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

export const usePermissions = () => {
  const { user, loading: isLoading, hasPermission } = useAuth();

  // ✅ Convertir array de strings a objetos Permission para compatibilidad
  const permissions = useMemo<Permission[]>(() => {
    if (!user || !user.permissions) {
      return [];
    }

    // Mapear permisos del usuario a formato Permission
    return user.permissions.map((perm, index) => ({
      id: index + 1, // ID dummy para compatibilidad
      name: perm,
      description: undefined,
      isActive: true
    }));
  }, [user]);

  // Helper síncrono (compatible con código existente)
  const hasPermissionSync = (permissionName: string): boolean => {
    return hasPermission(permissionName);
  };

  // No-op para compatibilidad
  const refetch = async () => {
    // No hace nada - permisos se actualizan con el usuario
    console.log('✅ Permisos ya están en memoria, no es necesario refetch');
  };

  return {
    permissions,
    isLoading,
    error: null,
    refetch,
    hasPermissionSync,
  };
};

/**
 * ✨ OPTIMIZADO: Hook simple para verificar un permiso
 * Ya NO hace fetch
 * 
 * @deprecated Usar directamente useAuth().hasPermission() es más simple
 */
export const usePermission = (permissionName: string) => {
  const { hasPermission, loading: isLoading } = useAuth();
  
  const hasAccess = hasPermission(permissionName);

  return {
    hasPermission: hasAccess,
    isLoading
  };
};
