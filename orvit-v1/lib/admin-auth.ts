/**
 * Módulo compartido para autenticación y autorización de administración
 * Centraliza helpers duplicados usados en múltiples rutas API
 *
 * NOTA DE MIGRACIÓN:
 * Actualmente hay ~86 archivos con getUserFromToken duplicado.
 * Para migrar una ruta API a usar este módulo:
 *
 * 1. Importar: import { getUserFromToken, requireAdminAccess } from '@/lib/admin-auth'
 * 2. Eliminar la función getUserFromToken local
 * 3. Si la ruta necesita verificar admin: usar requireAdminAccess()
 * 4. Si solo necesita usuario autenticado: usar getUserFromToken()
 *
 * Ejemplo de migración:
 * ```
 * // Antes:
 * async function getUserFromToken(request: NextRequest) { ... } // código duplicado
 * export async function GET(request: NextRequest) {
 *   const user = await getUserFromToken(request);
 *   if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
 *   ...
 * }
 *
 * // Después:
 * import { getUserFromToken } from '@/lib/admin-auth';
 * export async function GET(request: NextRequest) {
 *   const user = await getUserFromToken(request);
 *   if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
 *   ...
 * }
 * ```
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Tipo del usuario autenticado con empresas y roles
export type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getUserFromToken>>>;

/**
 * Obtiene el usuario autenticado desde el token JWT
 * Incluye empresas asociadas y roles
 */
export async function getUserFromToken(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    return await prisma.user.findUnique({
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
  } catch (error) {
    console.error('Error obteniendo usuario desde token:', error);
    return null;
  }
}

/**
 * Obtiene el ID de la empresa del usuario
 * Prioriza empresas propias sobre empresas asociadas
 */
export function getUserCompanyId(user: AuthenticatedUser): number | null {
  if (user.ownedCompanies?.length > 0) {
    return user.ownedCompanies[0].id;
  }
  if (user.companies?.length > 0) {
    return user.companies[0].company.id;
  }
  return null;
}

/**
 * Obtiene el rol del usuario en una empresa específica
 */
export function getUserCompanyRole(
  user: AuthenticatedUser,
  companyId: number
): { name: string | null; displayName: string | null } {
  const userCompany = user.companies?.find(uc => uc.company.id === companyId);
  return {
    name: userCompany?.role?.name || null,
    displayName: userCompany?.role?.displayName || null
  };
}

/**
 * Verifica si un rol es administrativo (sistema o empresa)
 */
export function isAdminRole(
  systemRole: string,
  companyRoleName: string | null | undefined,
  companyRoleDisplayName: string | null | undefined
): boolean {
  // Roles administrativos del sistema
  const systemAdminRoles = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE'];
  if (systemAdminRoles.includes(systemRole)) return true;

  // Si no hay rol de empresa, no es admin
  if (!companyRoleName && !companyRoleDisplayName) return false;

  // Normalizar y verificar keywords administrativas
  const normalizedRoleName = (companyRoleName || '').trim().toUpperCase();
  const normalizedDisplayName = (companyRoleDisplayName || '').trim().toUpperCase();

  const adminKeywords = ['ADMINISTRADOR', 'ADMIN', 'ADMINISTRATOR', 'ADMIN EMPRESA', 'ADMIN_EMPRESA'];

  return adminKeywords.some(keyword =>
    normalizedRoleName.includes(keyword) ||
    normalizedDisplayName.includes(keyword) ||
    normalizedRoleName === keyword ||
    normalizedDisplayName === keyword
  );
}

/**
 * Verifica si el usuario tiene acceso de administrador
 * Retorna el acceso y el ID de la empresa
 */
export function checkAdminAccess(user: AuthenticatedUser): {
  hasAccess: boolean;
  companyId: number | null;
} {
  const companyId = getUserCompanyId(user);
  if (!companyId) {
    return { hasAccess: false, companyId: null };
  }

  const { name: companyRoleName, displayName: companyRoleDisplayName } = getUserCompanyRole(user, companyId);
  const hasAccess = isAdminRole(user.role, companyRoleName, companyRoleDisplayName);

  return { hasAccess, companyId };
}

/**
 * Verifica permisos de administrador y retorna error si no tiene acceso
 * Útil para simplificar validaciones en rutas API
 */
export async function requireAdminAccess(request: NextRequest): Promise<{
  user: AuthenticatedUser;
  companyId: number;
} | { error: string; status: number }> {
  const user = await getUserFromToken(request);

  if (!user) {
    return { error: 'No autorizado', status: 401 };
  }

  const { hasAccess, companyId } = checkAdminAccess(user);

  if (!hasAccess || !companyId) {
    return { error: 'Sin permisos de administrador', status: 403 };
  }

  return { user, companyId };
}
