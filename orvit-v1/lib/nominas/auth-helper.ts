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
import { prisma } from '@/lib/prisma';

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

  // getUserFromToken() devuelve el nombre del rol de empresa (puede ser custom).
  // Para nóminas necesitamos el rol del sistema (User.role: ADMIN, ADMIN_ENTERPRISE, etc.)
  // ya que hasPayrollAccess hace un check de rol de sistema.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: dbUser?.role || user.role,
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
