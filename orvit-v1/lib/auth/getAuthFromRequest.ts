import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface AuthResult {
  userId: number;
  companyId: number;
  role: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

export async function getAuthFromRequest(request: NextRequest): Promise<AuthResult | null> {
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
        companies: {
          select: { companyId: true, isActive: true },
          orderBy: { isActive: 'desc' }  // Priorizar empresas activas
        }
      }
    });

    if (!user) {
      return null;
    }

    // Buscar la empresa activa primero, si no hay usar la primera
    const activeCompany = user.companies?.find(c => c.isActive);
    const companyId = activeCompany?.companyId || user.companies?.[0]?.companyId;
    if (!companyId) {
      return null;
    }

    return {
      userId: user.id,
      companyId,
      role: user.role,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    };
  } catch (error) {
    console.error('Error in getAuthFromRequest:', error);
    return null;
  }
}
