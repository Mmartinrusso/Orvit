// Sistema de permisos ULTRA optimizado - caché agresivo y consultas mínimas
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

// Cache ultra agresivo con TTL muy largo
const permissionsCache = new Map<string, { permissions: string[]; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos
const QUIET_MODE = true;

// Cache de roles predefinidos para evitar consultas
const ROLE_PERMISSIONS_CACHE = {
  'SUPERADMIN': [
    'users.view', 'users.create', 'users.edit', 'users.delete', 'users.edit_role',
    'tasks.view', 'admin.permissions', 'admin.roles',
    'fixed_tasks.create', 'fixed_tasks.edit', 'fixed_tasks.delete',
    'ver_agenda', 'ver_historial', 'ver_estadisticas'
  ],
  'ADMIN': [
    'users.view', 'users.create', 'users.edit', 'users.delete', 'users.edit_role',
    'tasks.view', 'admin.permissions', 'admin.roles',
    'fixed_tasks.create', 'fixed_tasks.edit', 'fixed_tasks.delete',
    'ver_agenda', 'ver_historial', 'ver_estadisticas'
  ],
  'SUPERVISOR': [
    'tasks.view', 'ver_agenda', 'ver_historial', 'ver_estadisticas'
  ],
  'USER': [
    'tasks.view'
  ]
};

// Función ultra optimizada para obtener permisos de rol
export async function getRolePermissionsUltraOptimized(role: UserRole): Promise<string[]> {
  // Usar cache predefinido para evitar consultas a la BD
  return ROLE_PERMISSIONS_CACHE[role] || [];
}

// Función ultra optimizada para obtener permisos específicos de usuario
export async function getUserSpecificPermissionsUltraOptimized(userId: number): Promise<{ permission: string; isGranted: boolean }[]> {
  const cacheKey = `user_${userId}`;
  const now = Date.now();
  
  // Verificar cache
  const cached = permissionsCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.permissions.map(p => ({ permission: p, isGranted: true }));
  }

  // Por ahora, retornar array vacío para evitar consultas
  return [];
}

// Función principal ultra optimizada
export async function hasPermissionUltraOptimized(permission: Permission, context: PermissionContext): Promise<boolean> {
  try {
    // 1. Verificar permisos específicos del usuario primero
    const userSpecificPermissions = await getUserSpecificPermissionsUltraOptimized(context.userId);
    const userOverride = userSpecificPermissions.find(up => up.permission === permission);
    
    if (userOverride) {
      return userOverride.isGranted;
    }

    // 2. Verificar permisos del rol (usando cache predefinido)
    const rolePermissions = await getRolePermissionsUltraOptimized(context.userRole);
    
    if (!rolePermissions.includes(permission)) {
      return false;
    }

    // 3. Aplicar reglas contextuales (simplificadas)
    return applyContextualRulesUltraOptimized(permission, context);
    
  } catch (error) {
    return false;
  }
}

// Reglas contextuales ultra simplificadas
function applyContextualRulesUltraOptimized(permission: Permission, context: PermissionContext): boolean {
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
export function clearPermissionsCacheUltra(): void {
  permissionsCache.clear();
}

// Función para obtener todos los permisos de una vez (ultra optimizada)
export async function getAllPermissionsUltraOptimized(): Promise<any[]> {
  // Retornar permisos predefinidos para evitar consultas
  const allPermissions = [
    { id: 1, name: 'users.view', description: 'Ver usuarios', category: 'users' },
    { id: 2, name: 'users.create', description: 'Crear usuarios', category: 'users' },
    { id: 3, name: 'users.edit', description: 'Editar usuarios', category: 'users' },
    { id: 4, name: 'users.delete', description: 'Eliminar usuarios', category: 'users' },
    { id: 5, name: 'users.edit_role', description: 'Editar rol de usuario', category: 'users' },
    { id: 6, name: 'tasks.view', description: 'Ver tareas', category: 'tasks' },
    { id: 7, name: 'admin.permissions', description: 'Gestionar permisos', category: 'admin' },
    { id: 8, name: 'admin.roles', description: 'Gestionar roles', category: 'admin' },
    { id: 9, name: 'fixed_tasks.create', description: 'Crear tareas fijas', category: 'fixed_tasks' },
    { id: 10, name: 'fixed_tasks.edit', description: 'Editar tareas fijas', category: 'fixed_tasks' },
    { id: 11, name: 'fixed_tasks.delete', description: 'Eliminar tareas fijas', category: 'fixed_tasks' },
    { id: 12, name: 'ver_agenda', description: 'Ver agenda', category: 'agenda' },
    { id: 13, name: 'ver_historial', description: 'Ver historial', category: 'historial' },
    { id: 14, name: 'ver_estadisticas', description: 'Ver estadísticas', category: 'estadisticas' }
  ];
  
  return allPermissions;
}

// Función para obtener permisos por categoría (ultra optimizada)
export async function getPermissionsByCategoryUltraOptimized(): Promise<Record<string, any[]>> {
  const permissions = await getAllPermissionsUltraOptimized();
  const byCategory: Record<string, any[]> = {};
  
  permissions.forEach(permission => {
    const category = permission.category || 'otros';
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(permission);
  });
  
  return byCategory;
}

// Función para verificar múltiples permisos de una vez
export async function hasAnyPermissionUltraOptimized(permissions: Permission[], context: PermissionContext): Promise<boolean> {
  const rolePermissions = await getRolePermissionsUltraOptimized(context.userRole);
  return permissions.some(permission => rolePermissions.includes(permission));
}

// Función para verificar todos los permisos de una vez
export async function hasAllPermissionsUltraOptimized(permissions: Permission[], context: PermissionContext): Promise<boolean> {
  const rolePermissions = await getRolePermissionsUltraOptimized(context.userRole);
  return permissions.every(permission => rolePermissions.includes(permission));
} 