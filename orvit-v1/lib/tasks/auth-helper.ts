/**
 * Helper centralizado para autenticación en APIs de tareas
 * Evita duplicación del código getUserFromToken
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  companies: {
    company: {
      id: number;
      name: string;
    };
    companyId: number;
  }[];
  ownedCompanies: {
    id: number;
    name: string;
  }[];
}

/**
 * Obtiene el usuario autenticado desde el token JWT
 * @param request - NextRequest (opcional, para compatibilidad)
 * @returns Usuario autenticado o null si no está autenticado
 */
export async function getUserFromToken(_request?: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        },
        ownedCompanies: true
      }
    });

    if (!user) {
      return null;
    }

    return user as unknown as AuthenticatedUser;
  } catch (error) {
    console.error('[Auth Helper] Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

/**
 * Obtiene el ID de la empresa del usuario
 * @param user - Usuario autenticado
 * @returns ID de la empresa o null
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
 * @param user - Usuario autenticado
 * @returns Array de IDs de empresas
 */
export function getUserCompanyIds(user: AuthenticatedUser): number[] {
  const ids: number[] = [];

  if (user.ownedCompanies) {
    ids.push(...user.ownedCompanies.map(c => c.id));
  }

  if (user.companies) {
    ids.push(...user.companies.map(c => c.company.id));
  }

  return [...new Set(ids)]; // Eliminar duplicados
}

/**
 * Verifica si el usuario tiene acceso a una empresa específica
 * @param user - Usuario autenticado
 * @param companyId - ID de la empresa a verificar
 * @returns true si tiene acceso
 */
export function hasAccessToCompany(user: AuthenticatedUser, companyId: number): boolean {
  return getUserCompanyIds(user).includes(companyId);
}

/**
 * Resultado de autenticación con información de error
 */
export interface AuthResult {
  user: AuthenticatedUser | null;
  companyId: number | null;
  error: string | null;
  status: number;
}

/**
 * Autentica y valida acceso a empresa en un solo paso
 * @param request - NextRequest
 * @returns Resultado de autenticación
 */
export async function authenticateAndGetCompany(request?: NextRequest): Promise<AuthResult> {
  const user = await getUserFromToken(request);

  if (!user) {
    return {
      user: null,
      companyId: null,
      error: 'No autorizado',
      status: 401
    };
  }

  // SUPERADMIN no tiene empresa específica
  if (user.role === 'SUPERADMIN') {
    return {
      user,
      companyId: null,
      error: null,
      status: 200
    };
  }

  const companyId = getUserCompanyId(user);

  if (!companyId) {
    // ADMIN sin empresa - caso especial
    if (user.role === 'ADMIN') {
      return {
        user,
        companyId: null,
        error: null,
        status: 200
      };
    }

    return {
      user,
      companyId: null,
      error: 'Usuario sin empresa',
      status: 403
    };
  }

  return {
    user,
    companyId,
    error: null,
    status: 200
  };
}
