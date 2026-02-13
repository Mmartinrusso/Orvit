import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

// GET /api/tools/locations - Obtener todas las ubicaciones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Obtener ubicaciones de la base de datos con conteo de herramientas
    const locations = await prisma.$queryRaw`
      SELECT 
        tl.*,
        COALESCE(t.tool_count, 0) as "toolCount"
      FROM "ToolLocation" tl
      LEFT JOIN (
        SELECT 
          location,
          COUNT(*)::integer as tool_count
        FROM "Tool" 
        WHERE "companyId" = ${parseInt(companyId)}
        GROUP BY location
      ) t ON tl.name = t.location
      WHERE tl."companyId" = ${parseInt(companyId)}
      ORDER BY tl.name ASC
    ` as any[];

    return NextResponse.json({
      success: true,
      locations,
      total: locations.length
    });

  } catch (error) {
    console.error('Error en GET /api/tools/locations:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
}

// POST /api/tools/locations - Crear nueva ubicación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, type, companyId } = body;

    // Validaciones básicas
    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'El nombre y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar si ya existe una ubicación con el mismo nombre
    const existingLocation = await prisma.toolLocation.findFirst({
      where: {
        name: name,
        companyId: parseInt(companyId)
      }
    });

    if (existingLocation) {
      return NextResponse.json(
        { error: 'Ya existe una ubicación con ese nombre' },
        { status: 400 }
      );
    }

    // Crear nueva ubicación usando Prisma ORM
    const newLocation = await prisma.toolLocation.create({
      data: {
        name: name,
        description: description || '',
        type: type || 'SHELF',
        companyId: parseInt(companyId)
      }
    });

    return NextResponse.json({
      success: true,
      location: newLocation,
      message: 'Ubicación creada exitosamente'
    });

  } catch (error) {
    console.error('Error en POST /api/tools/locations:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
} 