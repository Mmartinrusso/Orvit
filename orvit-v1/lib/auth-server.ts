/**
 * SERVER-SIDE AUTH UTILITIES
 * 
 * Funciones para obtener usuario y permisos en Server Components
 * SIN hacer requests HTTP (acceso directo a BD)
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from './prisma';
import { getUserPermissions } from './permissions-helpers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'tu-clave-secreta-super-segura'
);

export interface ServerUser {
  id: number;
  name: string;
  email: string;
  role: string;
  sectorId?: number | null;
  avatar?: string | null;
  permissions: string[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/**
 * ✨ Obtener usuario con permisos en Server Components
 * SIN hacer requests HTTP - acceso directo a BD
 * 
 * @returns Usuario con permisos o null si no está autenticado
 */
export async function getUserWithPermissions(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    // Verificar JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Buscar usuario en BD
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true,
            role: true
          }
        },
        ownedCompanies: true
      }
    });

    if (!user) {
      return null;
    }

    const role = user.role || 'USER';

    // Obtener sectorId
    let userSectorId: number | null = null;
    if (user.companies && user.companies.length > 0) {
      const userOnCompany = user.companies[0];
      if (userOnCompany.role?.sectorId) {
        userSectorId = userOnCompany.role.sectorId;
      }
    }

    // Obtener companyId
    let companyId: number = 1;
    if (user.ownedCompanies && user.ownedCompanies.length > 0) {
      companyId = user.ownedCompanies[0].id;
    } else if (user.companies && user.companies.length > 0) {
      companyId = user.companies[0].company.id;
    }

    // ✨ Obtener permisos (misma lógica que /api/auth/me)
    const permissions = await getUserPermissions(user.id, role, companyId);

    const isAdmin = role === 'ADMIN' || role === 'ADMIN_ENTERPRISE';
    const isSuperAdmin = role === 'SUPERADMIN';

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: role,
      sectorId: userSectorId,
      avatar: user.avatar,
      permissions: permissions,
      isAdmin: isAdmin,
      isSuperAdmin: isSuperAdmin
    };
  } catch (error) {
    console.error('Error getting user with permissions (server):', error);
    return null;
  }
}

/**
 * Verificar si usuario tiene un permiso específico
 * Para usar en Server Components
 */
export async function hasPermissionServer(permission: string): Promise<boolean> {
  const user = await getUserWithPermissions();
  
  if (!user) return false;
  if (user.isSuperAdmin || user.isAdmin) return true;
  
  return user.permissions.includes(permission);
}

/**
 * Verificar si usuario tiene al menos uno de los permisos
 */
export async function hasAnyPermissionServer(permissions: string[]): Promise<boolean> {
  const user = await getUserWithPermissions();
  
  if (!user) return false;
  if (user.isSuperAdmin || user.isAdmin) return true;
  
  return permissions.some(p => user.permissions.includes(p));
}

/**
 * Verificar si usuario tiene todos los permisos
 */
export async function hasAllPermissionsServer(permissions: string[]): Promise<boolean> {
  const user = await getUserWithPermissions();
  
  if (!user) return false;
  if (user.isSuperAdmin || user.isAdmin) return true;
  
  return permissions.every(p => user.permissions.includes(p));
}

/**
 * Obtener solo el usuario actual (sin permisos)
 * Más rápido si solo necesitas datos básicos
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

