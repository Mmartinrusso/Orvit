/**
 * Auth Helper Centralizado para APIs de Compras
 *
 * Elimina duplicación de código de autenticación JWT en todos los endpoints.
 * Incluye verificación de roles y extracción de companyId.
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Roles que pueden aprobar operaciones sensibles
export const APPROVAL_ROLES = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERVISOR'] as const;

// Roles que pueden crear operaciones
export const CREATOR_ROLES = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERVISOR', 'USER'] as const;

export interface AuthenticatedUser {
  id: number;
  name: string;
  role: string;
  email?: string;
}

export interface AuthResult {
  success: true;
  user: AuthenticatedUser;
  companyId: number;
}

export interface AuthError {
  success: false;
  error: string;
  status: number;
}

export type GetUserResult = AuthResult | AuthError;

/**
 * Obtiene el usuario autenticado y su companyId desde el token JWT
 *
 * @param requiredRoles - Roles permitidos para esta operación (opcional)
 * @returns AuthResult si éxito, AuthError si falla
 *
 * @example
 * ```typescript
 * const auth = await getUserAndCompany();
 * if (!auth.success) {
 *   return NextResponse.json({ error: auth.error }, { status: auth.status });
 * }
 * const { user, companyId } = auth;
 * ```
 *
 * @example Con verificación de roles
 * ```typescript
 * const auth = await getUserAndCompany(APPROVAL_ROLES);
 * if (!auth.success) {
 *   return NextResponse.json({ error: auth.error }, { status: auth.status });
 * }
 * ```
 */
export async function getUserAndCompany(
  requiredRoles?: readonly string[]
): Promise<GetUserResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return { success: false, error: 'No autorizado', status: 401 };
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        companies: {
          select: { companyId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return { success: false, error: 'Usuario no encontrado', status: 401 };
    }

    // Verificar roles si se especificaron
    if (requiredRoles && !requiredRoles.includes(user.role)) {
      return {
        success: false,
        error: `No tiene permisos para esta operación. Roles requeridos: ${requiredRoles.join(', ')}`,
        status: 403,
      };
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return {
        success: false,
        error: 'Usuario no tiene empresa asignada',
        status: 400,
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email || undefined,
      },
      companyId,
    };
  } catch (error) {
    console.error('[AUTH HELPER] Error verificando token:', error);
    return { success: false, error: 'Token inválido o expirado', status: 401 };
  }
}

/**
 * Helper para verificar si el usuario tiene un rol específico
 */
export function hasRole(userRole: string, allowedRoles: readonly string[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Helper para verificar si el usuario puede aprobar operaciones
 */
export function canApprove(userRole: string): boolean {
  return hasRole(userRole, APPROVAL_ROLES);
}

/**
 * Helper para crear respuesta de error estándar
 */
export function createErrorResponse(auth: AuthError) {
  return { error: auth.error, status: auth.status };
}
