import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET /api/production/sectors
// Obtiene los sectores de la empresa (para transferencias de empleados, etc.)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const forProduction = searchParams.get('forProduction') === 'true';

    const sectors = await prisma.sector.findMany({
      where: {
        companyId: user!.companyId,
        ...(forProduction ? { enabledForProduction: true } : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        enabledForProduction: true,
        area: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      sectors,
    });
  } catch (error) {
    console.error('Error fetching sectors:', error);
    return NextResponse.json({ error: 'Error al obtener sectores' }, { status: 500 });
  }
}
