/**
 * Auth helpers para módulo Nóminas
 *
 * Thin wrapper sobre shared-helpers.ts para retrocompatibilidad.
 * Mantiene el formato PayrollAuthUser original.
 *
 * Los consumidores existentes siguen usando los mismos imports:
 *   import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';
 */

import { getUserFromToken, isAdminRole } from '@/lib/auth/shared-helpers';

// ============================================================================
// TIPOS (retrocompatibles con la interfaz original)
// ============================================================================

export interface PayrollAuthUser {
  user: {
    id: number;
    name: string | null;
    email: string;
    role: string;
  };
  companyId: number;
}

// ============================================================================
// FUNCIONES
// ============================================================================

/**
 * Obtener usuario autenticado y su empresa para APIs de nóminas.
 * Wrapper sobre getUserFromToken() con formato PayrollAuthUser.
 */
export async function getPayrollAuth(): Promise<PayrollAuthUser | null> {
  const user = await getUserFromToken();
  if (!user) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    companyId: user.companyId,
  };
}

/**
 * Verificar si usuario tiene permisos de nóminas.
 * Wrapper sobre isAdminRole() de shared-helpers.
 */
export function hasPayrollAccess(user: PayrollAuthUser['user']): boolean {
  return isAdminRole(user.role);
}
