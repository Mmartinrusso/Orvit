import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const areaId = searchParams.get('areaId');
    const forProduction = searchParams.get('forProduction'); // Filtrar solo sectores habilitados para producción

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 Fetching sectors with params:', { companyId, areaId, forProduction });

    let whereClause: any = {
      companyId: parseInt(companyId)
    };

    if (areaId) {
      whereClause.areaId = parseInt(areaId);
    }

    // Si se solicita para producción, filtrar solo los habilitados
    if (forProduction === 'true') {
      whereClause.enabledForProduction = true;
    }

    const sectors = await prisma.sector.findMany({
      where: whereClause,
      include: {
        area: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`✅ Found ${sectors.length} sectors`);

    return NextResponse.json({
      success: true,
      sectors: sectors
    });

  } catch (error) {
    console.error('❌ Error fetching sectors:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
