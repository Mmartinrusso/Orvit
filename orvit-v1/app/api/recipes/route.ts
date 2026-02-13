import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth/getAuthFromRequest';

export const dynamic = 'force-dynamic';

// GET /api/recipes - Listar recetas
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const companyId = auth?.companyId || 1; // Fallback para desarrollo

    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const search = searchParams.get('search');

    const where: any = {
      companyId,
    };

    // Filtrar solo activas si se solicita
    if (active === 'true') {
      where.isActive = true;
    }

    // Búsqueda por nombre
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const recipes = await prisma.recipe.findMany({
      where,
      select: {
        id: true,
        name: true,
        base: true,
        scopeType: true,
        scopeId: true,
        isActive: true,
        description: true,
        status: true,
        outputQuantity: true,
        outputUnitLabel: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      recipes,
      total: recipes.length,
    });
  } catch (error) {
    console.error('Error in GET /api/recipes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
