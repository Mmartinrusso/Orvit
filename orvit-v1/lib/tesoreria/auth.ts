import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions-helpers';
import { NextResponse } from 'next/server';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface TesoreriaUser {
  id: number;
  name: string | null;
  email: string;
  role: string;
  companyId: number;
}

export interface AuthResult {
  user: TesoreriaUser | null;
  error: NextResponse | null;
}

/**
 * Get authenticated user from JWT token with company context
 * Returns user object or null if not authenticated
 */
export async function getUserFromToken(): Promise<TesoreriaUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const userId = payload.userId as number;
    const companyId = payload.companyId as number | undefined;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companies: {
          select: { companyId: true, role: { select: { name: true } } },
          ...(companyId ? { where: { companyId } } : { take: 1 }),
        }
      }
    });

    if (!user || !user.companies?.[0]?.companyId) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.companies[0].role?.name || user.role || 'USER',
      companyId: user.companies[0].companyId
    };
  } catch {
    return null;
  }
}

/**
 * Verify authentication and return user or error response
 */
export async function requireAuth(): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    };
  }

  return { user, error: null };
}

/**
 * Verify authentication AND specific permission
 * Returns user if authorized, or error response if not
 */
export async function requirePermission(permission: string): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    };
  }

  const hasPermission = await hasUserPermission(user.id, user.companyId, permission);

  if (!hasPermission) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Sin permisos para esta acción', requiredPermission: permission },
        { status: 403 }
      )
    };
  }

  return { user, error: null };
}

/**
 * Verify authentication AND any of the specified permissions
 * Returns user if authorized with at least one permission, or error response if not
 */
export async function requireAnyPermission(permissions: string[]): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    };
  }

  // Check if user has any of the required permissions
  for (const permission of permissions) {
    const hasPermission = await hasUserPermission(user.id, user.companyId, permission);
    if (hasPermission) {
      return { user, error: null };
    }
  }

  return {
    user: null,
    error: NextResponse.json(
      { error: 'Sin permisos para esta acción', requiredPermissions: permissions },
      { status: 403 }
    )
  };
}

/**
 * Check if user has a specific permission (non-blocking)
 * Useful when you need to check permission without returning error
 */
export async function checkPermission(userId: number, companyId: number, permission: string): Promise<boolean> {
  return hasUserPermission(userId, companyId, permission);
}

// Permission constants for tesoreria module
export const TESORERIA_PERMISSIONS = {
  // Dashboard / Posición
  POSICION_VIEW: 'tesoreria.posicion.view',

  // Cajas
  CAJAS_VIEW: 'tesoreria.cajas.view',
  CAJAS_CREATE: 'tesoreria.cajas.create',
  CAJAS_EDIT: 'tesoreria.cajas.edit',
  CAJAS_DELETE: 'tesoreria.cajas.delete',

  // Bancos
  BANCOS_VIEW: 'tesoreria.bancos.view',
  BANCOS_CREATE: 'tesoreria.bancos.create',
  BANCOS_EDIT: 'tesoreria.bancos.edit',
  BANCOS_DELETE: 'tesoreria.bancos.delete',

  // Movimientos
  MOVIMIENTOS_VIEW: 'tesoreria.movimientos.view',
  MOVIMIENTOS_CREATE: 'tesoreria.movimientos.create',
  MOVIMIENTOS_EDIT: 'tesoreria.movimientos.edit',
  MOVIMIENTOS_REVERSE: 'tesoreria.movimientos.reverse',

  // Cheques
  CHEQUES_VIEW: 'tesoreria.cheques.view',
  CHEQUES_CREATE: 'tesoreria.cheques.create',
  CHEQUES_EDIT: 'tesoreria.cheques.edit',
  CHEQUES_DEPOSIT: 'tesoreria.cheques.deposit',
  CHEQUES_ENDORSE: 'tesoreria.cheques.endorse',
  CHEQUES_REJECT: 'tesoreria.cheques.reject',
  CHEQUES_VOID: 'tesoreria.cheques.void',

  // Transferencias
  TRANSFERENCIAS_VIEW: 'tesoreria.transferencias.view',
  TRANSFERENCIAS_CREATE: 'tesoreria.transferencias.create',
  TRANSFERENCIAS_CONFIRM: 'tesoreria.transferencias.confirm',
  TRANSFERENCIAS_REVERSE: 'tesoreria.transferencias.reverse',

  // Depósitos
  DEPOSITOS_VIEW: 'tesoreria.depositos.view',
  DEPOSITOS_CREATE: 'tesoreria.depositos.create',
  DEPOSITOS_CONFIRM: 'tesoreria.depositos.confirm',
  DEPOSITOS_REJECT: 'tesoreria.depositos.reject',

  // Cierres de caja
  CIERRES_VIEW: 'tesoreria.cierres.view',
  CIERRES_CREATE: 'tesoreria.cierres.create',
  CIERRES_APPROVE: 'tesoreria.cierres.approve',

  // Conciliación bancaria
  CONCILIACION_VIEW: 'tesoreria.conciliacion.view',
  CONCILIACION_IMPORT: 'tesoreria.conciliacion.import',
  CONCILIACION_MATCH: 'tesoreria.conciliacion.match',
  CONCILIACION_CLOSE: 'tesoreria.conciliacion.close',

  // Reportes
  REPORTES_VIEW: 'tesoreria.reportes.view',
  REPORTES_EXPORT: 'tesoreria.reportes.export',

  // Configuración
  CONFIG_VIEW: 'tesoreria.config.view',
  CONFIG_EDIT: 'tesoreria.config.edit',
} as const;
