import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface PayrollAuthUser {
  user: {
    id: number;
    name: string | null;
    email: string;
    role: string;
  };
  companyId: number;
}

/**
 * Obtener usuario autenticado y su empresa para APIs de nóminas
 */
export async function getPayrollAuth(): Promise<PayrollAuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    });

    if (!user) {
      return null;
    }

    // Obtener empresa del usuario
    const userCompanies = await prisma.$queryRaw`
      SELECT c.id FROM "Company" c
      INNER JOIN "UserOnCompany" uc ON c.id = uc."companyId"
      WHERE uc."userId" = ${user.id}
      LIMIT 1
    ` as { id: number }[];

    if (userCompanies.length === 0) {
      return null;
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      companyId: userCompanies[0].id
    };
  } catch (error) {
    console.error('Error en autenticación de nóminas:', error);
    return null;
  }
}

/**
 * Verificar si usuario tiene permisos de nóminas
 * Por ahora solo admins y superadmins
 */
export function hasPayrollAccess(user: PayrollAuthUser['user']): boolean {
  return ['ADMIN', 'ADMIN_ENTERPRISE', 'SUPERADMIN'].includes(user.role);
}
