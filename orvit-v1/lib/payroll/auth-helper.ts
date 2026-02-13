/**
 * Helper de autenticación para las rutas de Payroll
 * Soporta tanto el nuevo sistema de tokens como el legacy
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface AuthUser {
  id: number;
  role: string;
  companyId: number;
  roleName?: string;
}

/**
 * Obtiene el usuario autenticado de las cookies
 * Soporta tanto accessToken (nuevo) como token (legacy)
 */
export async function getPayrollAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = cookies();

    // Intentar nuevo sistema primero
    let token = cookieStore.get('accessToken')?.value;

    // Fallback a legacy
    if (!token) {
      token = cookieStore.get('token')?.value;
    }

    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        role: true,
        companies: {
          select: {
            companyId: true,
            role: { select: { name: true } }
          },
          take: 1
        }
      }
    });

    if (!user) return null;

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) return null;

    return {
      id: user.id,
      role: String(user.role),
      companyId,
      roleName: user.companies?.[0]?.role?.name,
    };
  } catch {
    return null;
  }
}
