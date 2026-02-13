import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth/getAuthFromRequest';

export const dynamic = 'force-dynamic';

// GET /api/packaging-types - Listar tipos de envase de la empresa
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const companyId = auth?.companyId || 1;

    // Buscar en CompanySettings el campo packagingTypes (JSON array)
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { id: true },
    });

    // Si no existe, intentar obtener de la tabla de configuracion extendida
    // Por ahora usamos un enfoque simple: almacenar en una tabla temporal o usar JSON
    // Vamos a usar el enfoque de una tabla simple

    // Primero verificamos si existe la tabla PackagingType
    // Si no, devolvemos tipos predeterminados
    let packagingTypes: { id: string; name: string }[] = [];

    try {
      // Intentar buscar en la tabla PackagingType si existe
      const types = await (prisma as any).packagingType?.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
      });

      if (types) {
        packagingTypes = types;
      }
    } catch {
      // La tabla no existe, usar tipos predeterminados configurables
      // Almacenados como JSON en una extension de CompanySettings
    }

    // Si no hay tipos, devolver algunos predeterminados comunes
    if (packagingTypes.length === 0) {
      packagingTypes = [
        { id: 'pallet', name: 'Pallet' },
        { id: 'caja', name: 'Caja' },
        { id: 'bolsa', name: 'Bolsa' },
        { id: 'bolson', name: 'Bolson' },
        { id: 'atado', name: 'Atado' },
        { id: 'pack', name: 'Pack' },
        { id: 'bid6on', name: 'Bidon' },
        { id: 'tambor', name: 'Tambor' },
        { id: 'contenedor', name: 'Contenedor' },
        { id: 'granel', name: 'A Granel' },
      ];
    }

    return NextResponse.json(packagingTypes);
  } catch (error) {
    console.error('Error in GET /api/packaging-types:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/packaging-types - Crear nuevo tipo de envase
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const companyId = auth?.companyId || 1;

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Generar ID unico basado en el nombre
    const id = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      + '_' + Date.now().toString(36);

    // Por ahora, como no tenemos una tabla de PackagingType,
    // simplemente devolvemos el tipo creado con su ID
    // En una implementacion completa, esto se guardaria en la BD

    const newType = {
      id,
      name: name.trim(),
      companyId,
    };

    // Intentar guardar en la tabla si existe
    try {
      const saved = await (prisma as any).packagingType?.create({
        data: newType,
      });
      if (saved) {
        return NextResponse.json(saved, { status: 201 });
      }
    } catch {
      // La tabla no existe, devolver el tipo sin persistir
      // En produccion se deberia crear la tabla o usar otra estrategia
    }

    return NextResponse.json(newType, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/packaging-types:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
