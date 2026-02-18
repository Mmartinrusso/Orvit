/**
 * Auth helpers para módulo Compras
 *
 * Thin wrapper sobre shared-helpers.ts para retrocompatibilidad.
 * Mantiene el patrón discriminated union (success/error) usado en compras.
 *
 * Los consumidores existentes siguen usando los mismos imports:
 *   import { getUserAndCompany, APPROVAL_ROLES } from '@/lib/compras/auth-helper';
 */

import {
  getUserFromToken,
  APPROVAL_ROLES as SHARED_APPROVAL_ROLES,
  ALL_ROLES,
} from '@/lib/auth/shared-helpers';

// ============================================================================
// CONSTANTES (re-exportadas desde shared-helpers + específicas del módulo)
// ============================================================================

/** Roles que pueden aprobar operaciones sensibles */
export const APPROVAL_ROLES = SHARED_APPROVAL_ROLES;

/** Roles que pueden crear operaciones */
export const CREATOR_ROLES = ALL_ROLES;

// ============================================================================
// TIPOS (retrocompatibles con la interfaz original)
// ============================================================================

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

// ============================================================================
// FUNCIONES
// ============================================================================

/**
 * Obtiene el usuario autenticado y su companyId desde el token JWT.
 * Wrapper sobre getUserFromToken() con patrón discriminated union.
 *
 * @param requiredRoles - Roles permitidos para esta operación (opcional)
 */
export async function getUserAndCompany(
  requiredRoles?: readonly string[]
): Promise<GetUserResult> {
  try {
    const user = await getUserFromToken();

    if (!user) {
      return { success: false, error: 'No autorizado', status: 401 };
    }

    // Verificar roles si se especificaron
    if (requiredRoles && !requiredRoles.includes(user.role)) {
      return {
        success: false,
        error: `No tiene permisos para esta operación. Roles requeridos: ${requiredRoles.join(', ')}`,
        status: 403,
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name || '',
        role: user.role,
        email: user.email,
      },
      companyId: user.companyId,
    };
  } catch {
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
