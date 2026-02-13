import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;

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
        }
      }
    });

    if (!user || !user.companies || user.companies.length === 0) {
      return null;
    }

    return {
      userId: user.id,
      companyId: user.companies[0].companyId,
    };
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET - Obtener todas las empresas de transporte de la empresa
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || auth.companyId.toString();

    try {
      // Intentar usar Prisma primero
      const transportCompanies = await (prisma as any).transportCompany.findMany({
        where: {
          companyId: parseInt(companyId),
          isActive: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return NextResponse.json(transportCompanies || []);
    } catch (error: any) {
      // Si la tabla no existe o el modelo no está disponible, usar raw SQL
      if (error.code === 'P2021' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('Unknown model') ||
          error.message?.includes('transportCompany is not a function') ||
          error.message?.includes('Cannot read properties of undefined')) {
        console.log('Tabla TransportCompany no existe, intentando raw SQL');
        try {
          const transportCompaniesRaw = await prisma.$queryRaw`
            SELECT id, name, description, phone, email, "companyId", "isActive", "createdAt", "updatedAt"
            FROM "TransportCompany"
            WHERE "companyId" = ${parseInt(companyId)} AND "isActive" = true
            ORDER BY name ASC
          ` as any[];
          return NextResponse.json(transportCompaniesRaw || []);
        } catch (rawError: any) {
          if (rawError.code === '42P01' || rawError.message?.includes('does not exist')) {
            return NextResponse.json([]);
          }
          throw rawError;
        }
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al obtener empresas de transporte:', error);
    return NextResponse.json([]);
  }
}
