import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';
import { hasUserPermission } from '@/lib/permissions-helpers';

export const dynamic = 'force-dynamic';

// GET - Listar sectores de trabajo de la empresa
export async function GET(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const activeCondition = !includeInactive
      ? Prisma.sql`AND ws.is_active = true`
      : Prisma.empty;

    const sectors = await prisma.$queryRaw<any[]>`
      SELECT
        ws.id,
        ws.company_id as "companyId",
        ws.name,
        ws.code,
        ws.description,
        ws.cost_center_id as "costCenterId",
        ws.source_sector_id as "sourceSectorId",
        ws.is_active as "isActive",
        ws.created_at as "createdAt",
        ws.updated_at as "updatedAt",
        (
          SELECT COUNT(*)::int
          FROM employees e
          WHERE e.work_sector_id = ws.id AND e.active = true
        ) as "employeeCount"
      FROM work_sectors ws
      WHERE ws.company_id = ${auth.companyId}
        ${activeCondition}
      ORDER BY ws.name ASC
    `;

    const processedSectors = sectors.map((s: any) => ({
      ...s,
      id: Number(s.id),
      companyId: Number(s.companyId),
      costCenterId: s.costCenterId ? Number(s.costCenterId) : null,
      sourceSectorId: s.sourceSectorId ? Number(s.sourceSectorId) : null
    }));

    return NextResponse.json({
      sectors: processedSectors,
      total: processedSectors.length
    });
  } catch (error) {
    console.error('Error obteniendo sectores:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo sector
export async function POST(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Permission check: ingresar_nominas
    const hasPerm = await hasUserPermission(auth.user.id, auth.companyId, 'ingresar_nominas');
    if (!hasPerm) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const body = await request.json();
    const { name, code, description, costCenterId } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Verificar que no exista uno con el mismo nombre
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM work_sectors
      WHERE company_id = ${auth.companyId} AND LOWER(name) = LOWER(${name})
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe un sector con ese nombre' },
        { status: 400 }
      );
    }

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO work_sectors (
        company_id, name, code, description, cost_center_id,
        is_active, created_at, updated_at
      )
      VALUES (
        ${auth.companyId},
        ${name},
        ${code || null},
        ${description || null},
        ${costCenterId ? parseInt(costCenterId) : null},
        true,
        NOW(),
        NOW()
      )
      RETURNING
        id,
        company_id as "companyId",
        name,
        code,
        description,
        cost_center_id as "costCenterId",
        is_active as "isActive",
        created_at as "createdAt"
    `;

    const newSector = result[0];
    return NextResponse.json({
      ...newSector,
      id: Number(newSector.id),
      companyId: Number(newSector.companyId),
      costCenterId: newSector.costCenterId ? Number(newSector.costCenterId) : null
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando sector:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar sector
export async function PUT(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Permission check: ingresar_nominas
    const hasPermPut = await hasUserPermission(auth.user.id, auth.companyId, 'ingresar_nominas');
    if (!hasPermPut) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const body = await request.json();
    const { id, name, code, description, costCenterId, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'El ID es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe y pertenece a la empresa
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM work_sectors
      WHERE id = ${parseInt(id)} AND company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Sector no encontrado' },
        { status: 404 }
      );
    }

    // Si cambia el nombre, verificar que no exista otro con ese nombre
    if (name) {
      const duplicate = await prisma.$queryRaw<any[]>`
        SELECT id FROM work_sectors
        WHERE company_id = ${auth.companyId}
          AND LOWER(name) = LOWER(${name})
          AND id != ${parseInt(id)}
      `;

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: 'Ya existe otro sector con ese nombre' },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$queryRaw<any[]>`
      UPDATE work_sectors
      SET
        name = COALESCE(${name}, name),
        code = ${code !== undefined ? code : null},
        description = ${description !== undefined ? description : null},
        cost_center_id = ${costCenterId !== undefined ? (costCenterId ? parseInt(costCenterId) : null) : null},
        is_active = COALESCE(${isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${parseInt(id)} AND company_id = ${auth.companyId}
      RETURNING
        id,
        company_id as "companyId",
        name,
        code,
        description,
        cost_center_id as "costCenterId",
        is_active as "isActive",
        updated_at as "updatedAt"
    `;

    const updated = result[0];
    return NextResponse.json({
      ...updated,
      id: Number(updated.id),
      companyId: Number(updated.companyId),
      costCenterId: updated.costCenterId ? Number(updated.costCenterId) : null
    });
  } catch (error) {
    console.error('Error actualizando sector:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Desactivar sector (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Permission check: ingresar_nominas
    const hasPermDel = await hasUserPermission(auth.user.id, auth.companyId, 'ingresar_nominas');
    if (!hasPermDel) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'El ID es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM work_sectors
      WHERE id = ${parseInt(id)} AND company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Sector no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que no tiene empleados activos
    const employeeCount = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM employees
      WHERE work_sector_id = ${parseInt(id)} AND status = 'ACTIVE'
    `;

    if (employeeCount[0].count > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${employeeCount[0].count} empleados activos en este sector` },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.$queryRaw`
      UPDATE work_sectors
      SET is_active = false, updated_at = NOW()
      WHERE id = ${parseInt(id)} AND company_id = ${auth.companyId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando sector:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
