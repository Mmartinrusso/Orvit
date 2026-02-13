// Sistema de permisos dinámico para el frontend
'use client';

export type Permission = string;
export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'ADMIN_ENTERPRISE' | 'SUPERVISOR' | 'USER';

export interface PermissionContext {
  userId: number;
  userRole: UserRole;
  companyId?: number;
  targetUserId?: number;
  targetCompanyId?: number;
  resourceOwnerId?: number;
  isOwner?: boolean;
}

// Cache en memoria para permisos (mejora performance)
const permissionCache = new Map<string, boolean>();
const userPermissionsCache = new Map<number, { permissions: string[]; timestamp: number }>();
const cacheExpiry = 5 * 60 * 1000; // 5 minutos

// Función para obtener permisos del usuario desde la API
export async function getUserPermissions(userId: number, userRole: UserRole): Promise<string[]> {
  const cacheKey = userId;
  const now = Date.now();
  
  // Verificar cache
  const cached = userPermissionsCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cacheExpiry) {
    return cached.permissions;
  }

  try {
    // Llamar a la API para obtener permisos del usuario
    const response = await fetch('/api/admin/user-permissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ userId, userRole })
    });

    if (!response.ok) {
      console.error('Error obteniendo permisos del usuario:', response.status);
      // Si es 401, el usuario no está autenticado, devolver permisos básicos según rol
      if (response.status === 401) {
        console.log('Usuario no autenticado, devolviendo permisos básicos según rol');
        const basicPermissions = getBasicPermissionsByRole(userRole);
        return basicPermissions;
      }
      return [];
    }

    const data = await response.json();
    // Extraer solo los nombres de los permisos otorgados
    const permissions = Array.isArray(data.permissions)
      ? data.permissions.filter((p: any) => p.isGranted).map((p: any) => p.name)
      : [];
    
    // Actualizar cache
    userPermissionsCache.set(cacheKey, {
      permissions,
      timestamp: now
    });
    
    return permissions;
  } catch (error) {
    console.error('Error obteniendo permisos del usuario:', error);
    // En caso de error, devolver permisos básicos según rol
    const basicPermissions = getBasicPermissionsByRole(userRole);
    return basicPermissions;
  }
}

// Función para obtener permisos básicos según el rol (fallback)
function getBasicPermissionsByRole(userRole: UserRole): string[] {
  switch (userRole) {
    case 'SUPERADMIN':
      return [
        'users.view_all_companies',
        'users.edit',
        'users.delete',
        'users.edit_role',
        'companies.edit',
        'companies.delete',
        'companies.manage_users',
        'tasks.view_all',
        'tasks.edit',
        'tasks.complete',
        'admin.dashboard',
        'admin.users',
        'admin.permissions',
        'admin.roles',
        'admin.reports',
        'admin.configuration',
        'admin.audit',
        'admin.scheduler',
        'agenda.view',
        'agenda.edit',
        'agenda.delete',
        'agenda.manage_contacts',
        'agenda.manage_reminders'
      ];
    case 'ADMIN':
      return [
        'users.edit',
        'users.delete',
        'companies.edit',
        'companies.manage_users',
        'tasks.view_all',
        'tasks.edit',
        'tasks.complete',
        'admin.dashboard',
        'admin.users',
        'admin.permissions',
        'admin.roles',
        'admin.reports',
        'admin.configuration',
        'admin.audit',
        'admin.scheduler',
        'agenda.view',
        'agenda.edit',
        'agenda.delete',
        'agenda.manage_contacts',
        'agenda.manage_reminders'
      ];
    case 'SUPERVISOR':
      return [
        'tasks.view_all',
        'tasks.edit',
        'tasks.complete',
        'agenda.view',
        'agenda.edit'
      ];
    case 'USER':
      return [
        'tasks.view',
        'tasks.edit',
        'tasks.complete',
        'agenda.view'
      ];
    default:
      return [];
  }
}

// Función principal para verificar permisos (compatible con la versión anterior)
export async function hasPermission(permission: Permission, context: PermissionContext): Promise<boolean> {
  const cacheKey = `${context.userId}-${context.userRole}-${permission}`;
  const now = Date.now();
  
  // Verificar cache básico
  if (permissionCache.has(cacheKey)) {
    return permissionCache.get(cacheKey) || false;
  }

  try {
    // Obtener permisos del usuario
    const userPermissions = await getUserPermissions(context.userId, context.userRole);
    
    // Si el usuario no tiene el permiso base, denegar
    if (!userPermissions.includes(permission)) {
      permissionCache.set(cacheKey, false);
      return false;
    }

    // Aplicar lógica contextual específica
    const hasAccess = applyContextualRules(permission, context);
    
    // Cache el resultado por un corto período
    permissionCache.set(cacheKey, hasAccess);
    setTimeout(() => permissionCache.delete(cacheKey), 60000); // 1 minuto
    
    return hasAccess;
    
  } catch (error) {
    console.error('Error verificando permiso:', error);
    return false;
  }
}

// Función para aplicar reglas contextuales específicas (igual que la versión anterior)
function applyContextualRules(permission: Permission, context: PermissionContext): boolean {
  const { userId, userRole, companyId, targetUserId, targetCompanyId, resourceOwnerId, isOwner } = context;

  switch (permission) {
    // Reglas para usuarios
    case 'users.edit':
    case 'users.delete':
      if (userRole === 'SUPERADMIN') {
        return targetUserId !== userId;
      }
      if (userRole === 'ADMIN') {
        return companyId === targetCompanyId && targetUserId !== userId;
      }
      if (userRole === 'USER' || userRole === 'SUPERVISOR') {
        return userId === targetUserId;
      }
      return false;

    case 'users.edit_role':
      if (userRole === 'SUPERADMIN') {
        return targetUserId !== userId;
      }
      if (userRole === 'ADMIN') {
        return companyId === targetCompanyId && targetUserId !== userId;
      }
      return false;

    case 'users.view_all_companies':
      return userRole === 'SUPERADMIN';

    // Reglas para empresas
    case 'companies.edit':
    case 'companies.delete':
      if (userRole === 'SUPERADMIN') return true;
      if (userRole === 'ADMIN') {
        return isOwner || companyId === targetCompanyId;
      }
      return false;

    case 'companies.manage_users':
      if (userRole === 'SUPERADMIN') return true;
      if (userRole === 'ADMIN') {
        return companyId === targetCompanyId;
      }
      return false;

    // Reglas para tareas
    case 'tasks.view':
    case 'tasks.edit':
    case 'tasks.complete':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      if (userRole === 'SUPERVISOR') {
        return companyId === targetCompanyId;
      }
      if (userRole === 'USER') {
        return userId === resourceOwnerId || userId === targetUserId;
      }
      return false;

    case 'tasks.view_all':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      if (userRole === 'SUPERVISOR') {
        return companyId === targetCompanyId;
      }
      return false;

    default:
      return true;
  }
}

// === FUNCIONES DE UTILIDAD ===

// Función utilitaria para verificar múltiples permisos
export async function hasAnyPermission(permissions: Permission[], context: PermissionContext): Promise<boolean> {
  const results = await Promise.all(
    permissions.map(permission => hasPermission(permission, context))
  );
  return results.some(result => result);
}

// Función utilitaria para verificar todos los permisos
export async function hasAllPermissions(permissions: Permission[], context: PermissionContext): Promise<boolean> {
  const results = await Promise.all(
    permissions.map(permission => hasPermission(permission, context))
  );
  return results.every(result => result);
}

// === FUNCIONES DE COMPATIBILIDAD ===

// Funciones que mantienen compatibilidad con el código existente
export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  if (managerRole === 'SUPERADMIN') {
    return targetRole !== 'SUPERADMIN';
  }
  
  if (managerRole === 'ADMIN') {
    return ['USER', 'SUPERVISOR'].includes(targetRole);
  }
  
  return false;
}

export function getAssignableRoles(userRole: UserRole): UserRole[] {
  switch (userRole) {
    case 'SUPERADMIN':
      return ['USER', 'SUPERVISOR', 'ADMIN', 'ADMIN_ENTERPRISE'];
    case 'ADMIN':
      return ['USER', 'SUPERVISOR', 'ADMIN_ENTERPRISE'];
    case 'ADMIN_ENTERPRISE':
      return ['USER', 'SUPERVISOR', 'ADMIN_ENTERPRISE', 'ADMIN'];
    default:
      return [];
  }
}

export function isHigherRole(role1: UserRole, role2: UserRole): boolean {
  const hierarchy = {
    'SUPERADMIN': 5,
    'ADMIN': 4,
    'ADMIN_ENTERPRISE': 3,
    'SUPERVISOR': 2,
    'USER': 1
  };
  
  return hierarchy[role1] > hierarchy[role2];
}

// Función para generar contexto desde usuario
export function createPermissionContext(
  user: { id: number; role: UserRole },
  options: Partial<PermissionContext> = {}
): PermissionContext {
  return {
    userId: user.id,
    userRole: user.role,
    ...options
  };
}

// Función para limpiar cache (útil para cuando se actualizan permisos)
export function clearPermissionCache(): void {
  permissionCache.clear();
  userPermissionsCache.clear();
}

// === FUNCIONES SÍNCRONAS PARA COMPATIBILIDAD ===

// Versión síncrona usando el cache (fallback para uso en lugares que requieren sync)
export function hasPermissionSync(permission: Permission, context: PermissionContext): boolean {
  const cacheKey = `${context.userId}-${context.userRole}-${permission}`;
  
  // Solo devolver resultado si está en cache
  if (permissionCache.has(cacheKey)) {
    return permissionCache.get(cacheKey) || false;
  }
  
  // Fallback: usar lógica básica por rol para compatibilidad
  return hasPermissionFallback(permission, context);
}

// Función de fallback que usa lógica básica por rol
function hasPermissionFallback(permission: Permission, context: PermissionContext): boolean {
  const { userRole } = context;
  
  // Lógica básica por rol como fallback
  const roleHierarchy = {
    'SUPERADMIN': ['*'], // Todos los permisos
    'ADMIN': [
      'users.view', 'users.create', 'users.edit', 'users.delete', 'users.edit_role', 'users.activate_deactivate',
      'companies.view', 'companies.edit', 'companies.manage_users',
      'machines.view', 'machines.create', 'machines.edit', 'machines.delete', 'machines.maintain',
      'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.complete', 'tasks.view_all',
      'work_orders.view', 'work_orders.create', 'work_orders.edit', 'work_orders.delete', 'work_orders.assign', 'work_orders.approve',
      'tools.view', 'tools.create', 'tools.edit', 'tools.delete', 'tools.manage_stock', 'tools.manage_loans', 'tools.approve_requests',
      'reports.view', 'reports.export', 'reports.advanced',
      'settings.view', 'settings.edit',
      'fixed_tasks.create', 'fixed_tasks.edit', 'fixed_tasks.delete'
    ],
    'ADMIN_ENTERPRISE': [
      'users.view', 'users.create', 'users.edit', 'users.delete', 'users.edit_role', 'users.activate_deactivate',
      'companies.view', 'companies.edit', 'companies.manage_users',
      'machines.view', 'machines.create', 'machines.edit', 'machines.delete', 'machines.maintain',
      'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.complete', 'tasks.view_all',
      'work_orders.view', 'work_orders.create', 'work_orders.edit', 'work_orders.delete', 'work_orders.assign', 'work_orders.approve',
      'tools.view', 'tools.create', 'tools.edit', 'tools.delete', 'tools.manage_stock', 'tools.manage_loans', 'tools.approve_requests',
      'reports.view', 'reports.export', 'reports.advanced',
      'settings.view', 'settings.edit',
      'fixed_tasks.create', 'fixed_tasks.edit', 'fixed_tasks.delete'
    ],
    'SUPERVISOR': [
      'users.view',
      'machines.view', 'machines.edit', 'machines.maintain',
      'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.assign', 'tasks.complete', 'tasks.view_all',
      'work_orders.view', 'work_orders.create', 'work_orders.edit', 'work_orders.assign', 'work_orders.approve',
      'tools.view', 'tools.edit', 'tools.manage_loans', 'tools.approve_requests',
      'reports.view', 'reports.export',
      'settings.view',
      'fixed_tasks.create', 'fixed_tasks.edit', 'fixed_tasks.delete'
    ],
    'USER': [
      'machines.view',
      'tasks.view', 'tasks.edit', 'tasks.complete',
      'work_orders.view', 'work_orders.edit',
      'tools.view', 'tools.manage_loans',
      'reports.view',
      'settings.view'
    ]
  };

  const rolePermissions = roleHierarchy[userRole] || [];
  
  // SUPERADMIN tiene todos los permisos
  if (userRole === 'SUPERADMIN') {
    return true;
  }
  
  return rolePermissions.includes(permission);
} 