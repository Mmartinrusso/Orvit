import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/products/locations - Obtener ubicaciones de la empresa
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // ✅ OPTIMIZADO: Ejecutar ambas queries en paralelo
    const [locations, costosLocations] = await Promise.all([
      prisma.$queryRaw`
        SELECT DISTINCT location as name
        FROM "Product"
        WHERE "companyId" = ${parseInt(companyId)}
        AND location IS NOT NULL AND location != ''
        ORDER BY location
      ` as Promise<Array<{ name: string }>>,
      prisma.$queryRaw`
        SELECT DISTINCT location as name
        FROM products
        WHERE company_id = ${parseInt(companyId)}
        AND location IS NOT NULL AND location != ''
        ORDER BY location
      ` as Promise<Array<{ name: string }>>
    ]);

    // Combinar y eliminar duplicados
    const allLocations = new Set<string>();
    locations.forEach(loc => allLocations.add(loc.name));
    costosLocations.forEach(loc => allLocations.add(loc.name));

    const uniqueLocations = Array.from(allLocations).map(name => ({ name }));

    return NextResponse.json(uniqueLocations);
  } catch (error) {
    console.error('Error in GET /api/products/locations:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/products/locations - Crear nueva ubicación (se guarda al crear/editar un producto con esa ubicación)
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const body = await request.json();

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre de la ubicación es requerido' },
        { status: 400 }
      );
    }

    // Las ubicaciones se guardan automáticamente cuando se crea/edita un producto con esa ubicación
    // Este endpoint solo valida que la ubicación sea válida
    return NextResponse.json({ 
      success: true, 
      message: 'La ubicación se guardará al crear o editar un producto con esa ubicación',
      location: body.name.trim()
    });
  } catch (error) {
    console.error('Error in POST /api/products/locations:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

