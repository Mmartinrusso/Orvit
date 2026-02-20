/**
 * Auth helpers para módulo Tareas
 *
 * Thin wrapper sobre shared-helpers.ts para retrocompatibilidad.
 * Re-exporta funciones centralizadas + helpers específicos del módulo.
 *
 * Los consumidores existentes siguen usando los mismos imports:
 *   import { getUserFromToken, getUserCompanyId } from '@/lib/tasks/auth-helper';
 */

import { getUserFromTokenFull } from '@/lib/auth/shared-helpers';

// ============================================================================
// TIPOS (retrocompatibles con la interfaz original)
// ============================================================================

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  companies: {
    company: { id: number; name: string };
    companyId: number;
  }[];
  ownedCompanies: { id: number; name: string }[];
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  companyId: number | null;
  error: string | null;
  status: number;
}

// ============================================================================
// FUNCIONES RE-EXPORTADAS DESDE SHARED-HELPERS
// ============================================================================

/**
 * Obtiene el usuario autenticado desde el token JWT (formato completo con empresas).
 * Wrapper sobre getUserFromTokenFull() para retrocompatibilidad.
 */
export async function getUserFromToken(): Promise<AuthenticatedUser | null> {
  const user = await getUserFromTokenFull();
  if (!user) return null;
  return user as unknown as AuthenticatedUser;
}

// ============================================================================
// HELPERS ESPECÍFICOS DEL MÓDULO
// ============================================================================

/**
 * Obtiene el ID de la empresa del usuario
 */
export function getUserCompanyId(user: AuthenticatedUser): number | null {
  if (user.ownedCompanies && user.ownedCompanies.length > 0) {
    return user.ownedCompanies[0].id;
  } else if (user.companies && user.companies.length > 0) {
    return user.companies[0].company.id;
  }
  return null;
}

/**
 * Obtiene todos los IDs de empresas a las que el usuario tiene acceso
 */
export function getUserCompanyIds(user: AuthenticatedUser): number[] {
  const ids: number[] = [];
  if (user.ownedCompanies) {
    ids.push(...user.ownedCompanies.map(c => c.id));
  }
  if (user.companies) {
    ids.push(...user.companies.map(c => c.company.id));
  }
  return [...new Set(ids)];
}

/**
 * Verifica si el usuario tiene acceso a una empresa específica
 */
export function hasAccessToCompany(user: AuthenticatedUser, companyId: number): boolean {
  return getUserCompanyIds(user).includes(companyId);
}

/**
 * Autentica y valida acceso a empresa en un solo paso.
 * Wrapper sobre getUserFromTokenFull() con lógica de SUPERADMIN/ADMIN.
 */
export async function authenticateAndGetCompany(): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return { user: null, companyId: null, error: 'No autorizado', status: 401 };
  }

  // SUPERADMIN no tiene empresa específica
  if (user.role === 'SUPERADMIN') {
    return { user, companyId: null, error: null, status: 200 };
  }

  const companyId = getUserCompanyId(user);

  if (!companyId) {
    // ADMIN sin empresa - caso especial
    if (user.role === 'ADMIN') {
      return { user, companyId: null, error: null, status: 200 };
    }
    return { user, companyId: null, error: 'Usuario sin empresa', status: 403 };
  }

  return { user, companyId, error: null, status: 200 };
}
