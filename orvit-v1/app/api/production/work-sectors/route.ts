import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';

export const dynamic = 'force-dynamic';

// GET /api/production/work-sectors
// Obtiene los sectores de trabajo (puestos de trabajo) disponibles
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const workSectors = await prisma.workSector.findMany({
      where: {
        company_id: auth.companyId,
        is_active: activeOnly ? true : undefined,
      },
      include: {
        sourceSector: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = workSectors.map((ws) => ({
      id: ws.id,
      name: ws.name,
      code: ws.code,
      description: ws.description,
      isActive: ws.is_active,
      sector: ws.sourceSector
        ? {
            id: ws.sourceSector.id,
            name: ws.sourceSector.name,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      workSectors: result,
    });
  } catch (error) {
    console.error('Error fetching work sectors:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
