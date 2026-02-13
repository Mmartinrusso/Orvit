// Sistema de permisos robusto que consulta la base de datos real
import { prisma } from './prisma';

export type Permission = string;
export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'SUPERVISOR' | 'USER';

export interface PermissionContext {
  userId: number;
  userRole: UserRole;
  companyId?: number;
  targetUserId?: number;
  targetCompanyId?: number;
  resourceOwnerId?: number;
  isOwner?: boolean;
}

// Cache para mejorar rendimiento
const permissionsCache = new Map<string, { permissions: string[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Función para obtener permisos reales del usuario desde la base de datos
export async function getUserPermissions(userId: number, userRole: UserRole, companyId?: number): Promise<string[]> {
  const cacheKey = `user_${userId}_${userRole}_${companyId || 'no_company'}`;
  const now = Date.now();
  
  // Verificar cache
  const cached = permissionsCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.permissions;
  }

  try {
    const permissions = new Set<string>();

    // 1. Obtener permisos específicos del usuario
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

    // Agregar permisos específicos del usuario
    userPermissions.forEach(up => {
      if (up.isGranted) {
        permissions.add(up.permission.name);
      } else {
        // Si está explícitamente denegado, lo removemos del set
        permissions.delete(up.permission.name);
      }
    });

    // 2. Obtener permisos del rol (solo si hay empresa)
    if (companyId) {
      const rolePermissions = await prisma.rolePermission.findMany({
        where: {
          role: {
            name: userRole,
            companyId: companyId
          },
          isGranted: true,
          permission: {
            isActive: true
          }
        },
        include: {
          permission: true
        }
      });

      // Agregar permisos del rol (solo si no están explícitamente denegados por el usuario)
      rolePermissions.forEach(rp => {
        const isExplicitlyDenied = userPermissions.some(up => 
          up.permission.name === rp.permission.name && !up.isGranted
        );
        
        if (!isExplicitlyDenied) {
          permissions.add(rp.permission.name);
        }
      });
    }

    // 3. Permisos especiales para SUPERADMIN
    if (userRole === 'SUPERADMIN') {
      // SUPERADMIN tiene acceso a todo por defecto
      const allPermissions = await prisma.permission.findMany({
        where: { isActive: true },
        select: { name: true }
      });
      
      allPermissions.forEach(p => permissions.add(p.name));
    }

    const finalPermissions = Array.from(permissions);
    
    // Actualizar cache
    permissionsCache.set(cacheKey, { permissions: finalPermissions, timestamp: now });
    
    return finalPermissions;

  } catch (error) {
    console.error('Error obteniendo permisos del usuario:', error);
    return [];
  }
}

// Función principal para verificar permisos
export async function hasPermissionDatabase(permission: Permission, context: PermissionContext): Promise<boolean> {
  try {
    // Obtener todos los permisos del usuario
    const userPermissions = await getUserPermissions(context.userId, context.userRole, context.companyId);
    
    // Verificar si tiene el permiso base
    if (!userPermissions.includes(permission)) {
      return false;
    }

    // Aplicar reglas contextuales específicas
    return applyContextualRules(permission, context);
    
  } catch (error) {
    console.error('Error verificando permiso:', error);
    return false;
  }
}

// Función para verificar múltiples permisos (ANY)
export async function hasAnyPermissionDatabase(permissions: Permission[], context: PermissionContext): Promise<boolean> {
  try {
    for (const permission of permissions) {
      if (await hasPermissionDatabase(permission, context)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error verificando permisos múltiples:', error);
    return false;
  }
}

// Función para verificar múltiples permisos (ALL)
export async function hasAllPermissionsDatabase(permissions: Permission[], context: PermissionContext): Promise<boolean> {
  try {
    for (const permission of permissions) {
      if (!(await hasPermissionDatabase(permission, context))) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error verificando todos los permisos:', error);
    return false;
  }
}

// Función para aplicar reglas contextuales específicas
function applyContextualRules(permission: Permission, context: PermissionContext): boolean {
  const { userId, userRole, companyId, targetUserId, targetCompanyId, resourceOwnerId, isOwner } = context;

  // Reglas especiales para SUPERADMIN
  if (userRole === 'SUPERADMIN') {
    return true; // SUPERADMIN tiene todos los permisos
  }

  switch (permission) {
    // Reglas para usuarios
    case 'users.edit':
    case 'users.delete':
      if (userRole === 'ADMIN') {
        // ADMIN puede editar usuarios de su empresa (excepto otros ADMIN y SUPERADMIN)
        return companyId === targetCompanyId && targetUserId !== userId;
      }
      if (userRole === 'SUPERVISOR') {
        // SUPERVISOR solo puede editar usuarios USER de su empresa
        return companyId === targetCompanyId && targetUserId !== userId;
      }
      return false;

    // Reglas para tareas
    case 'tasks.edit':
    case 'tasks.delete':
      if (userRole === 'USER') {
        // USER solo puede editar sus propias tareas
        return resourceOwnerId === userId || isOwner === true;
      }
      return true; // ADMIN y SUPERVISOR pueden editar todas las tareas

    // Reglas para empresas
    case 'companies.edit':
    case 'companies.delete':
      if (userRole === 'ADMIN') {
        // ADMIN solo puede editar su propia empresa
        return companyId === targetCompanyId;
      }
             return false;

    // Reglas para órdenes de trabajo
    case 'work_orders.delete':
      // ADMIN, ADMIN_ENTERPRISE y SUPERADMIN siempre pueden eliminar órdenes de trabajo
      if (userRole === 'ADMIN' || userRole === 'ADMIN_ENTERPRISE') return true;
      // También el creador de la orden
      if (userId === resourceOwnerId) return true;
      return false;

    // Para la mayoría de permisos, si el rol lo tiene, el usuario también
    default:
      return true;
  }
}

// Función para limpiar cache
export function clearPermissionsCacheDatabase() {
  permissionsCache.clear();
}

// Función para obtener todos los permisos disponibles
export async function getAllPermissionsDatabase(): Promise<Array<{id: number, name: string, description: string, category: string}>> {
  try {
    const permissions = await prisma.permission.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        description: true,
        category: true
      }
    });

    return permissions.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      category: p.category || ''
    }));
  } catch (error) {
    console.error('Error obteniendo todos los permisos:', error);
    return [];
  }
}

// Función para crear contexto de permisos
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

// Función para verificar si un usuario puede gestionar un rol
export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  const roleHierarchy = {
    'SUPERADMIN': 4,
    'ADMIN': 3,
    'SUPERVISOR': 2,
    'USER': 1
  };

  return roleHierarchy[managerRole] > roleHierarchy[targetRole];
}

// Función para obtener roles asignables por un usuario
export function getAssignableRoles(userRole: UserRole): UserRole[] {
  switch (userRole) {
    case 'SUPERADMIN':
      return ['ADMIN', 'SUPERVISOR', 'USER'];
    case 'ADMIN':
      return ['SUPERVISOR', 'USER'];
    case 'SUPERVISOR':
      return ['USER'];
    case 'USER':
      return [];
    default:
      return [];
  }
} 