'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { useGlobalCache, createCacheKey } from '@/hooks/use-global-cache';

export interface PermissionData {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleData {
  name: string;
  displayName: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissions: PermissionData[];
}

export interface RolePermissionMap {
  [role: string]: RoleData;
}

export interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  companies?: any[];
  userSpecificPermissions?: any[];
  rolePermissionCount?: number;
  userSpecificPermissionsCount?: number;
}

export function usePermissionsData() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { hasPermission, user } = useAuth();
  const cache = useGlobalCache();
  const loadingRef = useRef({ permissions: false, roles: false, users: false, sectors: false });

  // Admin check
  const isAdminRole = useMemo(() => {
    if (!user?.role) return false;
    const normalizedRole = user.role.trim().toUpperCase();
    return normalizedRole.startsWith('ADMIN') || normalizedRole === 'SUPERADMIN';
  }, [user?.role]);

  const canViewPermisos = useMemo(() => isAdminRole || hasPermission('admin.permissions'), [isAdminRole, hasPermission]);
  const canViewRoles = useMemo(() => isAdminRole || hasPermission('admin.roles'), [isAdminRole, hasPermission]);
  const canAccessPermisosRoles = useMemo(() => isAdminRole || hasPermission('ingresar_permisos_roles'), [isAdminRole, hasPermission]);

  // Data states
  const [permissions, setPermissions] = useState<PermissionData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionMap>({});
  const [users, setUsers] = useState<UserData[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  // User filter states (needed for debounced fetch)
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const fetchPermissions = useCallback(async () => {
    if (loadingRef.current.permissions) return;

    const cacheKey = createCacheKey('permissions');
    const cached = cache.get<{ permissions: PermissionData[]; categories: string[] }>(cacheKey);
    if (cached) {
      setPermissions(cached.permissions);
      setCategories(cached.categories);
      setLoading(false);
      return;
    }

    loadingRef.current.permissions = true;
    try {
      setLoading(true);
      const response = await fetch('/api/admin/permissions');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const permissionsData = data.permissions || [];
          setPermissions(permissionsData);

          let categoriesData = (data.categories || []) as string[];
          if (categoriesData.length === 0 && permissionsData.length > 0) {
            const unique: string[] = [];
            permissionsData.forEach((p: PermissionData) => {
              if (p.category && p.category.trim() !== '' && !unique.includes(p.category)) {
                unique.push(p.category);
              }
            });
            categoriesData = unique;
          }
          setCategories(categoriesData);
          cache.set(cacheKey, { permissions: permissionsData, categories: categoriesData });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los permisos', variant: 'destructive' });
    } finally {
      setLoading(false);
      loadingRef.current.permissions = false;
    }
  }, [cache, toast]);

  const fetchRolePermissions = useCallback(async () => {
    if (loadingRef.current.roles) return;

    const cacheKey = createCacheKey('role-permissions');
    const cached = cache.get<RolePermissionMap>(cacheKey);
    if (cached) {
      setRolePermissions(cached);
      return;
    }

    loadingRef.current.roles = true;
    try {
      const response = await fetch('/api/admin/roles');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const rolesData = data.roles || {};
          setRolePermissions(rolesData);
          cache.set(cacheKey, rolesData);
        }
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los roles', variant: 'destructive' });
    } finally {
      loadingRef.current.roles = false;
    }
  }, [cache, toast]);

  const fetchUsers = useCallback(async (search?: string, roleFilter?: string) => {
    try {
      setUsersLoading(true);
      const params = new URLSearchParams();
      if (currentCompany?.id) params.append('companyId', currentCompany.id);
      const s = search ?? userSearch;
      const r = roleFilter ?? userRoleFilter;
      if (s) params.append('search', s);
      if (r && r !== 'all') params.append('role', r);

      const response = await fetch(`/api/admin/users-with-roles?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUsers(data.users || []);
        }
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los usuarios', variant: 'destructive' });
    } finally {
      setUsersLoading(false);
    }
  }, [currentCompany?.id, userSearch, userRoleFilter, toast]);

  const fetchSectors = useCallback(async () => {
    if (!currentCompany?.id || loadingRef.current.sectors) return;

    const cacheKey = createCacheKey('sectors', currentCompany.id.toString());
    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      setSectors(cached);
      return;
    }

    loadingRef.current.sectors = true;
    try {
      setLoadingSectors(true);
      const response = await fetch(`/api/sectores?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        const sectorsData = Array.isArray(data) ? data : [];
        setSectors(sectorsData);
        cache.set(cacheKey, sectorsData);
      }
    } catch {
      // Silent error
    } finally {
      setLoadingSectors(false);
      loadingRef.current.sectors = false;
    }
  }, [currentCompany?.id, cache]);

  // Actions
  const toggleRolePermission = useCallback(async (roleName: string, permissionId: number, isGranted: boolean) => {
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName, permissionId, isGranted }),
      });

      if (response.ok) {
        cache.remove(createCacheKey('role-permissions'));
        await fetchRolePermissions();
        toast({
          title: isGranted ? 'Permiso agregado' : 'Permiso removido',
          description: `Permiso ${isGranted ? 'asignado al' : 'quitado del'} rol`,
        });
        return true;
      }
      return false;
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar el permiso', variant: 'destructive' });
      return false;
    }
  }, [cache, fetchRolePermissions, toast]);

  const toggleUserPermission = useCallback(async (userId: number, permissionId: number, isGranted: boolean) => {
    try {
      const response = await fetch('/api/admin/user-specific-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permissionId, isGranted }),
      });

      if (response.ok) {
        toast({
          title: isGranted ? 'Permiso otorgado' : 'Permiso revocado',
          description: `Permiso ${isGranted ? 'agregado' : 'quitado'}`,
        });
        return true;
      }
      return false;
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar el permiso', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  const applyBatchPermissions = useCallback(async (roleName: string, permissionNames: string[], currentRolePermNames: string[]) => {
    const newPermissions = permissionNames.filter(name => !currentRolePermNames.includes(name));

    if (newPermissions.length === 0) {
      toast({ title: 'Sin cambios', description: 'Todos los permisos seleccionados ya están asignados' });
      return;
    }

    try {
      const response = await fetch('/api/admin/roles/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName, permissionNames: newPermissions, isGranted: true }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error aplicando permisos');

      cache.remove(createCacheKey('role-permissions'));
      await fetchRolePermissions();

      toast({
        title: `${data.applied} permisos aplicados`,
        description: data.notFound
          ? `${data.applied} asignados, ${data.notFound.length} no encontrados en BD`
          : `Se asignaron ${data.applied} permisos al rol. El efecto es inmediato.`,
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Error aplicando permisos', variant: 'destructive' });
    }
  }, [cache, fetchRolePermissions, toast]);

  const createRole = useCallback(async (roleData: { name: string; displayName: string; description: string; sectorId: number | null }) => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Rol creado', description: data.message });
        cache.remove(createCacheKey('role-permissions'));
        await fetchRolePermissions();
        return true;
      } else {
        toast({ title: 'Error', description: data.error || 'Error creando rol', variant: 'destructive' });
        return false;
      }
    } catch {
      toast({ title: 'Error', description: 'Error creando rol', variant: 'destructive' });
      return false;
    } finally {
      setIsCreating(false);
    }
  }, [cache, fetchRolePermissions, toast]);

  const cloneRole = useCallback(async (sourceRoleName: string, newName: string, newDisplayName: string, newDescription: string) => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/roles/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceRoleName, newName, newDisplayName, newDescription }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al clonar el rol');

      toast({ title: 'Rol clonado', description: data.message || `El rol "${newDisplayName}" ha sido creado` });
      cache.remove(createCacheKey('role-permissions'));
      await fetchRolePermissions();
      return true;
    } catch (error: any) {
      toast({ title: 'Error al clonar', description: error.message || 'Error al clonar el rol', variant: 'destructive' });
      return false;
    } finally {
      setIsCreating(false);
    }
  }, [cache, fetchRolePermissions, toast]);

  const deleteRole = useCallback(async (roleName: string) => {
    setIsDeletingRole(true);
    try {
      const response = await fetch(`/api/admin/roles?role=${encodeURIComponent(roleName)}`, { method: 'DELETE' });
      const data = await response.json();
      if (response.ok) {
        toast({ title: 'Rol eliminado', description: data.message });
        cache.remove(createCacheKey('role-permissions'));
        await fetchRolePermissions();
        return true;
      } else {
        toast({ title: 'Error', description: data.error || 'Error eliminando el rol', variant: 'destructive' });
        return false;
      }
    } catch {
      toast({ title: 'Error', description: 'Error eliminando el rol', variant: 'destructive' });
      return false;
    } finally {
      setIsDeletingRole(false);
    }
  }, [cache, fetchRolePermissions, toast]);

  const loadUserSpecificPermissions = useCallback(async (userData: UserData): Promise<UserData> => {
    try {
      const response = await fetch(`/api/admin/user-specific-permissions?userId=${userData.id}`);
      if (response.ok) {
        const data = await response.json();
        return { ...userData, userSpecificPermissions: data.specificPermissions || [] };
      }
    } catch {
      // Silent error
    }
    return { ...userData, userSpecificPermissions: [] };
  }, []);

  // Initial load
  useEffect(() => {
    if (!user) return;
    const hasAccess = isAdminRole || canAccessPermisosRoles || canViewPermisos || canViewRoles;
    if (!hasAccess) {
      toast({ title: 'Acceso denegado', description: 'No tienes permisos para acceder a esta sección.', variant: 'destructive' });
      return;
    }
    Promise.all([fetchPermissions(), fetchRolePermissions(), fetchUsers()]);
  }, [user, isAdminRole, canViewPermisos, canViewRoles, canAccessPermisosRoles]);

  // Debounced user search
  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(timeoutId);
  }, [userSearch, userRoleFilter, user]);

  return {
    // Data
    permissions,
    categories,
    rolePermissions,
    users,
    sectors,
    // Loading
    loading,
    usersLoading,
    loadingSectors,
    isCreating,
    isDeletingRole,
    // Access control
    isAdminRole,
    canViewPermisos,
    canViewRoles,
    canAccessPermisosRoles,
    user,
    // User filters
    userSearch,
    setUserSearch,
    userRoleFilter,
    setUserRoleFilter,
    // Actions
    fetchPermissions,
    fetchRolePermissions,
    fetchUsers,
    fetchSectors,
    toggleRolePermission,
    toggleUserPermission,
    applyBatchPermissions,
    createRole,
    cloneRole,
    deleteRole,
    loadUserSpecificPermissions,
    // Cache
    cache,
  };
}
