/**
 * Auth helpers para módulo Payroll
 *
 * Thin wrapper sobre shared-helpers.ts para retrocompatibilidad.
 * Mantiene la interfaz AuthUser original con roleName.
 *
 * Los consumidores existentes siguen usando los mismos imports:
 *   import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';
 */

import { getUserFromToken } from '@/lib/auth/shared-helpers';

// ============================================================================
// TIPOS (retrocompatibles con la interfaz original)
// ============================================================================

export interface AuthUser {
  id: number;
  role: string;
  companyId: number;
  roleName?: string;
}

// ============================================================================
// FUNCIONES
// ============================================================================

/**
 * Obtiene el usuario autenticado de las cookies.
 * Wrapper sobre getUserFromToken() con formato PayrollAuthUser.
 */
export async function getPayrollAuthUser(): Promise<AuthUser | null> {
  const user = await getUserFromToken();
  if (!user) return null;

  return {
    id: user.id,
    role: user.role,
    companyId: user.companyId,
    roleName: user.role,
  };
}
