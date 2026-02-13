// Sistema de permisos dinámico usando base de datos
import { prisma } from './prisma';

export type Permission = string; // Los permisos ahora vienen de la BD

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'SUPERVISOR' | 'USER';

// Contexto para verificación de permisos (igual que antes)
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
const rolePermissionsCache = new Map<UserRole, string[]>();
const cacheExpiry = 5 * 60 * 1000; // 5 minutos
let lastCacheUpdate = 0;

// Función para obtener permisos de un rol desde la BD
export async function getRolePermissionsFromDB(role: UserRole): Promise<string[]> {
  const cacheKey = role;
  const now = Date.now();
  
  // Verificar cache
  if (rolePermissionsCache.has(cacheKey) && (now - lastCacheUpdate) < cacheExpiry) {
    return rolePermissionsCache.get(cacheKey) || [];
  }

  try {
    // Buscar el rol en la tabla Role
    const roleRecord = await prisma.role.findFirst({
      where: {
        name: role,
        companyId: 1 // Por ahora hardcodeado
      }
    });

    if (!roleRecord) {
      console.warn(`Rol ${role} no encontrado en la base de datos`);
      return [];
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        roleId: roleRecord.id,
        isGranted: true,
        permission: {
          isActive: true
        }
      },
      include: {
        permission: true
      }
    });

    const permissions = rolePermissions.map(rp => rp.permission.name);
    
    // Actualizar cache
    rolePermissionsCache.set(cacheKey, permissions);
    lastCacheUpdate = now;
    
    return permissions;
  } catch (error) {
    console.error('Error obteniendo permisos del rol:', error);
    return [];
  }
}

// Función para obtener permisos específicos de usuario desde la BD
export async function getUserSpecificPermissions(userId: number): Promise<{ permission: string; isGranted: boolean }[]> {
  try {
    const userPermissions = await prisma.userPermission.findMany({
      where: {
        userId: userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ],
        permission: {
          isActive: true
        }
      },
      include: {
        permission: true
      }
    });

    return userPermissions.map(up => ({
      permission: up.permission.name,
      isGranted: up.isGranted
    }));
  } catch (error) {
    console.error('Error obteniendo permisos específicos del usuario:', error);
    return [];
  }
}

// Función principal para verificar permisos
export async function hasPermission(permission: Permission, context: PermissionContext): Promise<boolean> {
  try {
    // 1. Verificar permisos específicos del usuario primero (override)
    const userSpecificPermissions = await getUserSpecificPermissions(context.userId);
    const userOverride = userSpecificPermissions.find(up => up.permission === permission);
    
    if (userOverride) {
      return userOverride.isGranted;
    }

    // 2. Verificar permisos del rol
    const rolePermissions = await getRolePermissionsFromDB(context.userRole);
    
    // Si el rol no tiene el permiso base, denegar
    if (!rolePermissions.includes(permission)) {
      return false;
    }

    // 3. Aplicar lógica contextual específica
    return applyContextualRules(permission, context);
    
  } catch (error) {
    console.error('Error verificando permiso:', error);
    return false;
  }
}

// Función para aplicar reglas contextuales específicas
function applyContextualRules(permission: Permission, context: PermissionContext): boolean {
  const { userId, userRole, companyId, targetUserId, targetCompanyId, resourceOwnerId, isOwner } = context;

  switch (permission) {
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

    // Reglas para órdenes de trabajo
    case 'work_orders.view':
    case 'work_orders.edit':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN' || userRole === 'SUPERVISOR') return true;
      if (userRole === 'USER') {
        return userId === targetUserId;
      }
      return false;

    case 'work_orders.delete':
      // ADMIN, ADMIN_ENTERPRISE y SUPERADMIN siempre pueden eliminar órdenes de trabajo
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN' || userRole === 'ADMIN_ENTERPRISE') return true;
      // También el creador de la orden
      if (userId === resourceOwnerId) return true;
      return false;

    case 'work_orders.approve':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      if (userRole === 'SUPERVISOR') {
        return companyId === targetCompanyId;
      }
      return false;

    // Reglas para herramientas
    case 'tools.manage_loans':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN' || userRole === 'SUPERVISOR') return true;
      if (userRole === 'USER') {
        return userId === resourceOwnerId;
      }
      return false;

    case 'tools.approve_requests':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      if (userRole === 'SUPERVISOR') {
        return companyId === targetCompanyId;
      }
      return false;

    // Reglas para reportes
    case 'reports.advanced':
      return userRole === 'SUPERADMIN' || userRole === 'ADMIN';

    // Reglas para configuración
    case 'settings.edit':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      return false;

    case 'settings.system':
      return userRole === 'SUPERADMIN';

    // Reglas para auditoría
    case 'audit.view':
    case 'audit.export':
      return userRole === 'SUPERADMIN' || userRole === 'ADMIN';

    // Reglas para notificaciones
    case 'notifications.manage':
      return userRole === 'SUPERADMIN' || userRole === 'ADMIN';

    case 'notifications.system':
      return userRole === 'SUPERADMIN';

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

// Función para obtener todos los permisos de un rol
export async function getRolePermissions(role: UserRole): Promise<Permission[]> {
  return getRolePermissionsFromDB(role);
}

// === FUNCIONES DE GESTIÓN DE PERMISOS ===

// Función para crear un nuevo permiso
export async function createPermission(data: {
  name: string;
  description?: string;
  category?: string;
}): Promise<any> {
  try {
    return await prisma.permission.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        isActive: true
      }
    });
  } catch (error) {
    console.error('Error creando permiso:', error);
    throw error;
  }
}

// Función para asignar permiso a rol
export async function assignPermissionToRole(roleName: UserRole, permissionName: string, isGranted: boolean = true): Promise<any> {
  try {
    // Buscar el rol en la tabla Role
    const role = await prisma.role.findFirst({
      where: {
        name: roleName,
        companyId: 1 // Por ahora hardcodeado
      }
    });

    if (!role) {
      throw new Error(`Rol no encontrado: ${roleName}`);
    }

    const permission = await prisma.permission.findUnique({
      where: { name: permissionName }
    });

    if (!permission) {
      throw new Error(`Permiso no encontrado: ${permissionName}`);
    }

    return await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id
        }
      },
      update: {
        isGranted
      },
      create: {
        roleId: role.id,
        permissionId: permission.id,
        isGranted
      }
    });
  } catch (error) {
    console.error('Error asignando permiso a rol:', error);
    throw error;
  }
}

// Función para asignar permiso específico a usuario
export async function assignPermissionToUser(
  userId: number, 
  permissionName: string, 
  isGranted: boolean,
  grantedById?: number,
  reason?: string,
  expiresAt?: Date
): Promise<any> {
  try {
    const permission = await prisma.permission.findUnique({
      where: { name: permissionName }
    });

    if (!permission) {
      throw new Error(`Permiso no encontrado: ${permissionName}`);
    }

    return await prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId: permission.id
        }
      },
      update: {
        isGranted,
        reason,
        expiresAt
      },
      create: {
        userId,
        permissionId: permission.id,
        isGranted,
        grantedById,
        reason,
        expiresAt
      }
    });
  } catch (error) {
    console.error('Error asignando permiso a usuario:', error);
    throw error;
  }
}

// Función para obtener todos los permisos disponibles
export async function getAllPermissions(): Promise<any[]> {
  try {
    return await prisma.permission.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });
  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    return [];
  }
}

// Función para obtener permisos por categoría
export async function getPermissionsByCategory(): Promise<Record<string, any[]>> {
  try {
    const permissions = await getAllPermissions();
    const byCategory: Record<string, any[]> = {};
    
    permissions.forEach(permission => {
      const category = permission.category || 'otros';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(permission);
    });
    
    return byCategory;
  } catch (error) {
    console.error('Error agrupando permisos por categoría:', error);
    return {};
  }
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
      return ['USER', 'SUPERVISOR', 'ADMIN'];
    case 'ADMIN':
      return ['USER', 'SUPERVISOR'];
    default:
      return [];
  }
}

export function isHigherRole(role1: UserRole, role2: UserRole): boolean {
  const hierarchy = {
    'SUPERADMIN': 4,
    'ADMIN': 3,
    'SUPERVISOR': 2,
    'USER': 1
  };
  
  return hierarchy[role1] > hierarchy[role2];
}

// Función para generar contexto desde request
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

// Función para limpiar cache (útil para testing o cuando se actualizan permisos)
export function clearPermissionCache(): void {
  rolePermissionsCache.clear();
  lastCacheUpdate = 0;
}

// === MIDDLEWARE HELPERS ===

// Middleware helper para API routes
export function requirePermissionDB(permission: Permission) {
  return async (context: PermissionContext) => {
    const hasAccess = await hasPermission(permission, context);
    if (!hasAccess) {
      throw new Error(`Permiso requerido: ${permission}`);
    }
    return true;
  };
}

// Función para verificar permisos en componentes de React (hook-like)
export async function usePermission(permission: Permission, context: PermissionContext): Promise<boolean> {
  return hasPermission(permission, context);
} 