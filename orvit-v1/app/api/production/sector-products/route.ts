import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET /api/production/sector-products - Get active products for a production sector
export async function GET(request: Request) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.VIEW);
    if (error) return error;
    const companyId = user!.companyId;
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
