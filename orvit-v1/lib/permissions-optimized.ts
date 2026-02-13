// Sistema de permisos optimizado - menos logs y consultas más eficientes
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

// Cache optimizado con TTL más largo
const permissionsCache = new Map<string, { permissions: string[]; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos
const QUIET_MODE = true; // Reducir logs

// Función optimizada para obtener permisos de rol
export async function getRolePermissionsOptimized(role: UserRole): Promise<string[]> {
  const cacheKey = `role_${role}`;
  const now = Date.now();
  
  // Verificar cache
  const cached = permissionsCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.permissions;
  }

  try {
    // Buscar el rol y sus permisos en una sola consulta
    const roleWithPermissions = await prisma.role.findFirst({
      where: {
        name: role,
        companyId: 1
      },
      include: {
        permissions: {
          where: {
            isGranted: true,
            permission: {
              isActive: true
            }
          },
          include: {
            permission: true
          }
        }
      }
    });

    const permissions = roleWithPermissions?.permissions.map(rp => rp.permission.name) || [];
    
    // Actualizar cache
    permissionsCache.set(cacheKey, { permissions, timestamp: now });
    
    if (!QUIET_MODE) {
      // console.log(`📋 Permisos cargados para ${role}: ${permissions.length} permisos`) // Log reducido;
    }
    
    return permissions;
  } catch (error) {
    if (!QUIET_MODE) {
      console.error('Error obteniendo permisos del rol:', error);
    }
    return [];
  }
}

// Función optimizada para obtener permisos específicos de usuario
export async function getUserSpecificPermissionsOptimized(userId: number): Promise<{ permission: string; isGranted: boolean }[]> {
  const cacheKey = `user_${userId}`;
  const now = Date.now();
  
  // Verificar cache
  const cached = permissionsCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.permissions.map(p => ({ permission: p, isGranted: true }));
  }

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

    const permissions = userPermissions.map(up => ({
      permission: up.permission.name,
      isGranted: up.isGranted
    }));

    // Cache solo los permisos otorgados
    const grantedPermissions = permissions
      .filter(p => p.isGranted)
      .map(p => p.permission);
    
    permissionsCache.set(cacheKey, { permissions: grantedPermissions, timestamp: now });
    
    return permissions;
  } catch (error) {
    if (!QUIET_MODE) {
      console.error('Error obteniendo permisos específicos del usuario:', error);
    }
    return [];
  }
}

// Función principal optimizada
export async function hasPermissionOptimized(permission: Permission, context: PermissionContext): Promise<boolean> {
  try {
    // 1. Verificar permisos específicos del usuario primero
    const userSpecificPermissions = await getUserSpecificPermissionsOptimized(context.userId);
    const userOverride = userSpecificPermissions.find(up => up.permission === permission);
    
    if (userOverride) {
      return userOverride.isGranted;
    }

    // 2. Verificar permisos del rol
    const rolePermissions = await getRolePermissionsOptimized(context.userRole);
    
    if (!rolePermissions.includes(permission)) {
      return false;
    }

    // 3. Aplicar reglas contextuales (simplificadas)
    return applyContextualRulesOptimized(permission, context);
    
  } catch (error) {
    if (!QUIET_MODE) {
      console.error('Error verificando permiso:', error);
    }
    return false;
  }
}

// Reglas contextuales simplificadas
function applyContextualRulesOptimized(permission: Permission, context: PermissionContext): boolean {
  const { userId, userRole, companyId, targetUserId, targetCompanyId } = context;

  // Reglas básicas para evitar consultas adicionales
  switch (permission) {
    case 'users.edit':
    case 'users.delete':
      if (userRole === 'SUPERADMIN') return targetUserId !== userId;
      if (userRole === 'ADMIN') return companyId === targetCompanyId && targetUserId !== userId;
      return userId === targetUserId;

    case 'users.edit_role':
      if (userRole === 'SUPERADMIN') return targetUserId !== userId;
      if (userRole === 'ADMIN') return companyId === targetCompanyId && targetUserId !== userId;
      return false;

    case 'admin.permissions':
    case 'admin.roles':
      return userRole === 'SUPERADMIN' || userRole === 'ADMIN';

    default:
      return true; // Para la mayoría de permisos, si el rol lo tiene, está permitido
  }
}

// Función para limpiar cache
export function clearPermissionsCache(): void {
  permissionsCache.clear();
  if (!QUIET_MODE) {
    // console.log('🗑️ Cache de permisos limpiado') // Log reducido;
  }
}

// Función para obtener todos los permisos de una vez (optimizada)
export async function getAllPermissionsOptimized(): Promise<any[]> {
  const cacheKey = 'all_permissions';
  const now = Date.now();
  
  const cached = permissionsCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.permissions.map(p => ({ name: p }));
  }

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

    const permissionNames = permissions.map(p => p.name);
    permissionsCache.set(cacheKey, { permissions: permissionNames, timestamp: now });
    
    return permissions;
  } catch (error) {
    if (!QUIET_MODE) {
      console.error('Error obteniendo todos los permisos:', error);
    }
    return [];
  }
}

// Función para obtener permisos por categoría (optimizada)
export async function getPermissionsByCategoryOptimized(): Promise<Record<string, any[]>> {
  try {
    const permissions = await getAllPermissionsOptimized();
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
    if (!QUIET_MODE) {
      console.error('Error agrupando permisos por categoría:', error);
    }
    return {};
  }
}

// Función para verificar múltiples permisos de una vez
export async function hasAnyPermissionOptimized(permissions: Permission[], context: PermissionContext): Promise<boolean> {
  const rolePermissions = await getRolePermissionsOptimized(context.userRole);
  return permissions.some(permission => rolePermissions.includes(permission));
}

// Función para verificar todos los permisos de una vez
export async function hasAllPermissionsOptimized(permissions: Permission[], context: PermissionContext): Promise<boolean> {
  const rolePermissions = await getRolePermissionsOptimized(context.userRole);
  return permissions.every(permission => rolePermissions.includes(permission));
} 