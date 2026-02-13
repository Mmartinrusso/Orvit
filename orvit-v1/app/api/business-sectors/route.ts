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

// GET - Obtener todos los rubros/sectores de la empresa
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
      const businessSectors = await (prisma as any).businessSector.findMany({
        where: {
          companyId: parseInt(companyId),
          isActive: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return NextResponse.json(businessSectors || []);
    } catch (error: any) {
      // Si la tabla no existe o el modelo no está disponible, usar raw SQL
      if (error.code === 'P2021' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('Unknown model') ||
          error.message?.includes('businessSector is not a function') ||
          error.message?.includes('Cannot read properties of undefined')) {
        console.log('Tabla BusinessSector no existe, intentando raw SQL');
        try {
          const businessSectorsRaw = await prisma.$queryRaw`
            SELECT id, name, description, "companyId", "isActive", "createdAt", "updatedAt"
            FROM "BusinessSector"
            WHERE "companyId" = ${parseInt(companyId)} AND "isActive" = true
            ORDER BY name ASC
          ` as any[];
          return NextResponse.json(businessSectorsRaw || []);
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
    console.error('Error al obtener rubros/sectores:', error);
    return NextResponse.json([]);
  }
}
