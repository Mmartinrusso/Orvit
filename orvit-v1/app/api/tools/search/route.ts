import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: { company: true },
        },
      },
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET /api/tools/search?q=texto&itemType=SPARE_PART&limit=20
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const itemType = searchParams.get('itemType');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const where: any = { companyId };
    if (itemType) where.itemType = itemType;
    if (q.trim()) {
      where.OR = [
        { name: { contains: q.trim(), mode: 'insensitive' } },
        { code: { contains: q.trim(), mode: 'insensitive' } },
        { category: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }

    const tools = await prisma.tool.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        itemType: true,
        stockQuantity: true,
        minStockLevel: true,
        category: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return NextResponse.json(tools);
  } catch (error) {
    console.error('[GET /api/tools/search]', error);
    return NextResponse.json({ error: 'Error al buscar tools' }, { status: 500 });
  }
}
