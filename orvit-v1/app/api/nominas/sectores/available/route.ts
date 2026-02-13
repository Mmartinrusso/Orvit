import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Obtener sectores disponibles para importar
export async function GET(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 1. Obtener sectores de mantenimiento existentes
    const maintenanceSectors = await prisma.$queryRaw<any[]>`
      SELECT
        s.id,
        s.name,
        s.description,
        a.name as "areaName"
      FROM "Sector" s
      JOIN "Area" a ON a.id = s."areaId"
      WHERE s."companyId" = ${auth.companyId}
      ORDER BY a.name, s.name
    `;

    // 2. Obtener work_sectors ya creados para saber cuáles ya están importados
    const existingWorkSectors = await prisma.$queryRaw<any[]>`
      SELECT name, source_sector_id as "sourceSectorId"
      FROM work_sectors
      WHERE company_id = ${auth.companyId}
    `;

    const existingNames = new Set(existingWorkSectors.map(ws => ws.name.toLowerCase()));
    const importedSectorIds = new Set(
      existingWorkSectors
        .filter(ws => ws.sourceSectorId)
        .map(ws => Number(ws.sourceSectorId))
    );

    // 3. Sectores predefinidos comunes
    const predefinedSectors = [
      { id: 'admin', name: 'Administración', description: 'Personal administrativo y de oficina', type: 'predefined' },
      { id: 'obras', name: 'Obras', description: 'Personal de obra y construcción', type: 'predefined' },
      { id: 'logistica', name: 'Logística', description: 'Transporte y distribución', type: 'predefined' },
      { id: 'ventas', name: 'Ventas', description: 'Equipo comercial y ventas', type: 'predefined' },
    ];

    // Filtrar predefinidos que ya existen
    const availablePredefined = predefinedSectors.filter(
      s => !existingNames.has(s.name.toLowerCase())
    );

    // Filtrar sectores de mantenimiento que ya fueron importados
    const availableMaintenance = maintenanceSectors
      .filter(s => !importedSectorIds.has(s.id))
      .map(s => ({
        ...s,
        id: Number(s.id),
        type: 'maintenance',
        fullName: s.areaName ? `${s.areaName} - ${s.name}` : s.name
      }));

    return NextResponse.json({
      predefined: availablePredefined,
      maintenance: availableMaintenance,
      totalAvailable: availablePredefined.length + availableMaintenance.length
    });
  } catch (error) {
    console.error('Error obteniendo sectores disponibles:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Importar sectores seleccionados
export async function POST(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { sectors } = body; // Array de { type: 'predefined'|'maintenance', id: string|number, name: string }

    if (!sectors || !Array.isArray(sectors) || sectors.length === 0) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos un sector' },
        { status: 400 }
      );
    }

    let created = 0;
    const errors: string[] = [];

    for (const sector of sectors) {
      try {
        // Verificar que no existe
        const existing = await prisma.$queryRaw<any[]>`
          SELECT id FROM work_sectors
          WHERE company_id = ${auth.companyId} AND LOWER(name) = LOWER(${sector.name})
        `;

        if (existing.length > 0) {
          errors.push(`"${sector.name}" ya existe`);
          continue;
        }

        const sourceSectorId = sector.type === 'maintenance' ? parseInt(sector.id) : null;

        await prisma.$queryRaw`
          INSERT INTO work_sectors (
            company_id, name, description, source_sector_id,
            is_active, created_at, updated_at
          )
          VALUES (
            ${auth.companyId},
            ${sector.name},
            ${sector.description || null},
            ${sourceSectorId},
            true,
            NOW(),
            NOW()
          )
        `;
        created++;
      } catch (e) {
        errors.push(`Error creando "${sector.name}"`);
      }
    }

    return NextResponse.json({
      success: true,
      created,
      errors: errors.length > 0 ? errors : undefined,
      message: `${created} sector(es) creado(s)${errors.length > 0 ? `, ${errors.length} error(es)` : ''}`
    }, { status: 201 });
  } catch (error) {
    console.error('Error importando sectores:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
