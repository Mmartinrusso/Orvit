/**
 * Helpers compartidos de autenticación y autorización
 *
 * Este módulo centraliza las funciones de auth duplicadas en ~86 archivos del proyecto.
 * Todas las funciones extraen el token JWT de cookies, verifican el usuario,
 * y opcionalmente comprueban permisos/roles.
 *
 * GUÍA DE MIGRACIÓN:
 * En lugar de definir getUserFromToken() localmente en cada API route,
 * importar desde aquí:
 *
 *   import { getUserFromToken, requireAuth, requirePermission } from '@/lib/auth/shared-helpers';
 *
 * Ver docs/AUTH_CONSOLIDATION.md para la guía completa.
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { hasUserPermission } from '@/lib/permissions-helpers';
import { NextResponse } from 'next/server';

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET no está definido o es demasiado corto. ' +
      'Debe tener al menos 32 caracteres.'
    );
  }
  return new TextEncoder().encode(secret);
}

// ============================================================================
// TIPOS
// ============================================================================

/** Usuario autenticado con contexto de empresa (formato liviano) */
export interface AuthUser {
  id: number;
  name: string | null;
  email: string;
  role: string;
  companyId: number;
}

/** Usuario autenticado con datos extendidos (empresas, ownedCompanies) */
export interface AuthUserFull {
  id: number;
  name: string;
  email: string;
  role: string;
  companies: {
    company: { id: number; name: string };
    companyId: number;
    role?: { name: string; displayName?: string | null; sectorId?: number | null } | null;
  }[];
  ownedCompanies: { id: number; name: string }[];
}

/** Resultado de auth que incluye usuario o error */
export interface AuthResult<T = AuthUser> {
  user: T | null;
  error: NextResponse | null;
}

/** Resultado de auth con discriminante de éxito (patrón compras) */
export type AuthResultDiscriminated =
  | { success: true; user: AuthUser; companyId: number }
  | { success: false; error: string; status: number };

// ============================================================================
// FUNCIONES CORE
// ============================================================================

/**
 * Obtiene el usuario autenticado desde el token JWT (formato liviano).
 * Incluye userId, email, role y companyId resuelto.
 *
 * @returns AuthUser o null si no está autenticado
 */
export async function getUserFromToken(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecretKey());
    const userId = payload.userId as number;
    const tokenCompanyId = payload.companyId as number | undefined;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companies: {
          select: { companyId: true, role: { select: { name: true } } },
          ...(tokenCompanyId ? { where: { companyId: tokenCompanyId } } : { take: 1 }),
        },
      },
    });

    if (!user || !user.companies?.[0]?.companyId) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.companies[0].role?.name || user.role || 'USER',
      companyId: user.companies[0].companyId,
    };
  } catch {
    return null;
  }
}

/**
 * Obtiene el usuario autenticado con datos extendidos (empresas, owned).
 * Compatible con el patrón de admin-auth.ts y tasks/auth-helper.ts.
 *
 * @returns AuthUserFull o null si no está autenticado
 */
export async function getUserFromTokenFull(): Promise<AuthUserFull | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecretKey());

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true,
            role: true,
          },
        },
        ownedCompanies: true,
      },
    });

    if (!user) return null;

    return user as unknown as AuthUserFull;
  } catch {
    return null;
  }
}

/**
 * Obtiene companyId desde el token JWT sin hacer lookup de BD.
 * Útil para validaciones rápidas donde solo se necesita el companyId.
 *
 * @returns { userId, companyId, role } o null
 */
export async function getCompanyFromToken(): Promise<{
  userId: number;
  companyId: number;
  role: string;
} | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecretKey());
    const userId = payload.userId as number;
    const companyId = payload.companyId as number | undefined;

    if (!companyId) {
      // Fallback: buscar en BD
      const userCompany = await prisma.userOnCompany.findFirst({
        where: { userId },
        select: { companyId: true },
        orderBy: { isActive: 'desc' },
      });
      if (!userCompany) return null;
      return {
        userId,
        companyId: userCompany.companyId,
        role: (payload.role as string) || 'USER',
      };
    }

    return {
      userId,
      companyId,
      role: (payload.role as string) || 'USER',
    };
  } catch {
    return null;
  }
}

// ============================================================================
// FUNCIONES DE AUTORIZACIÓN (require*)
// ============================================================================

/**
 * Verifica autenticación y retorna usuario o error 401.
 * Patrón recomendado para rutas API:
 *
 * ```ts
 * const { user, error } = await requireAuth();
 * if (error) return error;
 * // user está garantizado no-null aquí
 * ```
 */
export async function requireAuth(): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  return { user, error: null };
}

/**
 * Verifica autenticación Y un permiso específico.
 * Retorna 401 si no autenticado, 403 si no tiene el permiso.
 */
export async function requirePermission(permission: string): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  const has = await hasUserPermission(user.id, user.companyId, permission);

  if (!has) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Sin permisos para esta acción', requiredPermission: permission },
        { status: 403 },
      ),
    };
  }

  return { user, error: null };
}

/**
 * Verifica autenticación Y que tenga AL MENOS UNO de los permisos.
 */
export async function requireAnyPermission(permissions: string[]): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  for (const permission of permissions) {
    const has = await hasUserPermission(user.id, user.companyId, permission);
    if (has) {
      return { user, error: null };
    }
  }

  return {
    user: null,
    error: NextResponse.json(
      { error: 'Sin permisos para esta acción', requiredPermissions: permissions },
      { status: 403 },
    ),
  };
}

/**
 * Verifica autenticación Y que tenga TODOS los permisos.
 */
export async function requireAllPermissions(permissions: string[]): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  for (const permission of permissions) {
    const has = await hasUserPermission(user.id, user.companyId, permission);
    if (!has) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Sin permisos para esta acción', requiredPermission: permission },
          { status: 403 },
        ),
      };
    }
  }

  return { user, error: null };
}

/**
 * Verifica autenticación Y que el usuario tenga uno de los roles especificados.
 * Los roles se comparan contra el role del sistema (user.role).
 */
export async function requireRole(allowedRoles: readonly string[]): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  const normalizedRole = user.role.trim().toUpperCase();
  const matches = allowedRoles.some((r) => r.toUpperCase() === normalizedRole);

  if (!matches) {
    return {
      user: null,
      error: NextResponse.json(
        {
          error: `No tiene permisos para esta operación. Roles requeridos: ${allowedRoles.join(', ')}`,
        },
        { status: 403 },
      ),
    };
  }

  return { user, error: null };
}

/**
 * Verifica que el usuario tenga acceso a una empresa específica.
 * Útil cuando el companyId viene del request (ej: /api/companies/:id/...).
 */
export async function requireCompanyAccess(targetCompanyId: number): Promise<AuthResult> {
  const user = await getUserFromTokenFull();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  // SUPERADMIN tiene acceso a todas las empresas
  if (user.role === 'SUPERADMIN') {
    const companyId =
      user.ownedCompanies?.[0]?.id || user.companies?.[0]?.companyId || targetCompanyId;
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId,
      },
      error: null,
    };
  }

  // Verificar acceso a la empresa
  const allCompanyIds = new Set<number>();
  user.ownedCompanies?.forEach((c) => allCompanyIds.add(c.id));
  user.companies?.forEach((c) => allCompanyIds.add(c.companyId));

  if (!allCompanyIds.has(targetCompanyId)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Sin acceso a esta empresa' },
        { status: 403 },
      ),
    };
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: targetCompanyId,
    },
    error: null,
  };
}

// ============================================================================
// HELPERS UTILITARIOS
// ============================================================================

/**
 * Verifica si un permiso se cumple sin bloquear (no retorna error).
 * Útil para lógica condicional dentro de un handler ya autenticado.
 */
export async function checkPermission(
  userId: number,
  companyId: number,
  permission: string,
): Promise<boolean> {
  return hasUserPermission(userId, companyId, permission);
}

/**
 * Obtiene el companyId del usuario (prioriza owned > associated).
 */
export function resolveCompanyId(user: AuthUserFull): number | null {
  if (user.ownedCompanies?.length > 0) {
    return user.ownedCompanies[0].id;
  }
  if (user.companies?.length > 0) {
    return user.companies[0].companyId;
  }
  return null;
}

/**
 * Verifica si un rol del sistema es administrativo.
 */
export function isAdminRole(role: string): boolean {
  const adminRoles = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE'];
  return adminRoles.includes(role.trim().toUpperCase());
}

/** Roles que pueden aprobar operaciones sensibles */
export const APPROVAL_ROLES = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERVISOR'] as const;

/** Todos los roles del sistema */
export const ALL_ROLES = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERVISOR', 'USER'] as const;
