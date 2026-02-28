import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/locations - Obtener ubicaciones de la empresa
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const companyIdNum = user!.companyId;

    console.log('📍 [LOCATIONS API] Buscando productos con companyId:', companyIdNum);

    // Obtener ubicaciones únicas de los productos de ventas (tabla Product)
    const ventasProducts = await prisma.product.findMany({
      where: {
        companyId: companyIdNum
      },
      select: {
        location: true
      }
    });

    console.log('📍 [LOCATIONS API] Productos de ventas encontrados:', ventasProducts.length);
    console.log('📍 [LOCATIONS API] Productos de ventas con ubicaciones:', ventasProducts.filter(p => p.location).length);

    // Obtener ubicaciones únicas de los productos de costos (tabla products)
    let costosProducts: any[] = [];
    try {
      costosProducts = await prisma.$queryRaw`
        SELECT DISTINCT location
        FROM products
        WHERE company_id = ${companyIdNum}
        AND location IS NOT NULL
        AND location != ''
      ` as any[];
      console.log('📍 [LOCATIONS API] Productos de costos con ubicaciones encontrados:', costosProducts.length);
    } catch (error: any) {
      // Si falla porque no existe la columna location, continuar sin errores
      if (error.message?.includes('column') && error.message?.includes('location')) {
        console.log('⚠️ [LOCATIONS API] Columna location no existe en products, continuando sin ubicaciones de costos');
      } else {
        console.error('⚠️ [LOCATIONS API] Error obteniendo ubicaciones de costos:', error);
      }
    }

    // Combinar y eliminar duplicados, filtrando valores nulos y vacíos
    const allLocations = new Set<string>();
    
    // Agregar ubicaciones de productos de ventas
    ventasProducts.forEach(p => {
      if (p.location && typeof p.location === 'string' && p.location.trim() !== '') {
        allLocations.add(p.location.trim());
      }
    });

    // Agregar ubicaciones de productos de costos
    costosProducts.forEach((p: any) => {
      if (p.location && typeof p.location === 'string' && p.location.trim() !== '') {
        allLocations.add(p.location.trim());
      }
    });

    const locations = Array.from(allLocations).sort();
    console.log('📍 [LOCATIONS API] Ubicaciones únicas encontradas (ventas + costos):', locations.length);
    console.log('📍 [LOCATIONS API] Ubicaciones:', locations);

    return NextResponse.json(locations);
  } catch (error: any) {
    console.error('❌ [LOCATIONS API] Error in GET /api/locations:', error);
    console.error('❌ [LOCATIONS API] Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code
    });
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}

// POST /api/locations - Crear nueva ubicación (se guarda al crear/editar un producto con esa ubicación)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre de la ubicación es requerido' },
        { status: 400 }
      );
    }

    // Las ubicaciones se guardan automáticamente cuando se crea/edita un producto
    // Este endpoint solo valida que la ubicación sea válida
    return NextResponse.json({ 
      success: true, 
      location: body.name.trim() 
    });
  } catch (error) {
    console.error('Error in POST /api/locations:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

