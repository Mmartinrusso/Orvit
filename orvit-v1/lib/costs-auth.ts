import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';

// Usar el mismo secret que el módulo principal de auth
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface AuthenticatedUser {
  user: {
    id: number;
    name: string | null;
    email: string;
  };
  companyId?: number; // Optional since cost tables don't have companyId yet
}

export async function getUserAndCompany(): Promise<AuthenticatedUser | null> {
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
      }
    });

    if (!user) {
      return null;
    }

    // Obtener empresa del usuario
    const userCompanies = await prisma.$queryRaw`
      SELECT c.* FROM "Company" c 
      INNER JOIN "UserOnCompany" uc ON c.id = uc."companyId" 
      WHERE uc."userId" = ${user.id} 
      LIMIT 1
    ` as any[];
    
    if (userCompanies.length === 0) {
      return null;
    }

    return {
      user,
      companyId: userCompanies[0].id
    };
  } catch (error) {
    console.error('Error obteniendo usuario y empresa:', error);
    return null;
  }
}
