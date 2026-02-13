import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  const token = cookies().get('token')?.value;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return { userId: payload.userId as number, companyId: payload.companyId as number };
  } catch {
    throw new Error('Invalid token');
  }
}

// GET /api/production/sector-products - Get active products for a production sector
export async function GET(request: Request) {
  try {
    const { companyId } = await getUserFromToken();
    const { searchParams } = new URL(request.url);

    const sectorId = searchParams.get('sectorId');

    if (!sectorId) {
      return NextResponse.json(
        { success: false, error: 'sectorId es requerido' },
        { status: 400 }
      );
    }

    const products = await prisma.product.findMany({
      where: {
        companyId,
        productionSectorId: parseInt(sectorId),
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        unit: true,
        image: true,
        recipeId: true,
        recipe: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching sector products:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener productos del sector' },
      { status: 500 }
    );
  }
}
