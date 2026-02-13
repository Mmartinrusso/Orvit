import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET - Obtener datos de un empleado
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employeeId = params.id;

    const employee = await prisma.$queryRaw<any[]>`
      SELECT
        e.id,
        e.name,
        e.role,
        e.hire_date as "hireDate",
        e.termination_date as "terminationDate",
        e.cuil,
        e.active,
        e.union_category_id as "unionCategoryId",
        uc.name as "unionCategoryName",
        uc.union_id as "unionId",
        pu.name as "unionName",
        e.work_sector_id as "workSectorId",
        ws.name as "workSectorName"
      FROM employees e
      LEFT JOIN union_categories uc ON uc.id = e.union_category_id
      LEFT JOIN payroll_unions pu ON pu.id = uc.union_id
      LEFT JOIN work_sectors ws ON ws.id = e.work_sector_id
      WHERE e.id = ${employeeId} AND e.company_id = ${auth.companyId}
    `;

    if (employee.length === 0) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      ...employee[0],
      unionCategoryId: employee[0].unionCategoryId ? Number(employee[0].unionCategoryId) : null,
      unionId: employee[0].unionId ? Number(employee[0].unionId) : null,
      workSectorId: employee[0].workSectorId ? Number(employee[0].workSectorId) : null
    });
  } catch (error) {
    console.error('Error obteniendo empleado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar datos de un empleado
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employeeId = params.id;
    const body = await request.json();
    const {
      name,
      role,
      hireDate,
      terminationDate,
      cuil,
      active,
      unionCategoryId,
      workSectorId
    } = body;

    // Verificar que el empleado existe
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM employees
      WHERE id = ${employeeId} AND company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Si se especifica unionCategoryId, verificar que pertenece a la empresa
    if (unionCategoryId !== undefined && unionCategoryId !== null) {
      const category = await prisma.$queryRaw<any[]>`
        SELECT uc.id
        FROM union_categories uc
        JOIN payroll_unions pu ON pu.id = uc.union_id
        WHERE uc.id = ${unionCategoryId} AND pu.company_id = ${auth.companyId}
      `;

      if (category.length === 0) {
        return NextResponse.json(
          { error: 'Categoría no encontrada o no pertenece a la empresa' },
          { status: 400 }
        );
      }
    }

    // Si se especifica workSectorId, verificar que pertenece a la empresa
    if (workSectorId !== undefined && workSectorId !== null) {
      const sector = await prisma.$queryRaw<any[]>`
        SELECT id FROM work_sectors
        WHERE id = ${workSectorId} AND company_id = ${auth.companyId}
      `;

      if (sector.length === 0) {
        return NextResponse.json(
          { error: 'Sector no encontrado o no pertenece a la empresa' },
          { status: 400 }
        );
      }
    }

    // Actualizar empleado
    const result = await prisma.$queryRaw<any[]>`
      UPDATE employees
      SET
        name = COALESCE(${name}, name),
        role = COALESCE(${role}, role),
        hire_date = COALESCE(${hireDate ? new Date(hireDate) : null}::date, hire_date),
        termination_date = ${terminationDate !== undefined ? (terminationDate ? new Date(terminationDate) : null) : null}::date,
        cuil = COALESCE(${cuil}, cuil),
        active = COALESCE(${active}, active),
        union_category_id = ${unionCategoryId !== undefined ? (unionCategoryId ? parseInt(String(unionCategoryId)) : null) : null},
        work_sector_id = ${workSectorId !== undefined ? (workSectorId ? parseInt(String(workSectorId)) : null) : null},
        updated_at = NOW()
      WHERE id = ${employeeId} AND company_id = ${auth.companyId}
      RETURNING
        id,
        name,
        role,
        hire_date as "hireDate",
        termination_date as "terminationDate",
        cuil,
        active,
        union_category_id as "unionCategoryId",
        work_sector_id as "workSectorId",
        updated_at as "updatedAt"
    `;

    const updated = result[0];

    // Obtener nombres de categoría y sector
    const enriched = await prisma.$queryRaw<any[]>`
      SELECT
        e.id,
        e.name,
        e.role,
        e.hire_date as "hireDate",
        e.termination_date as "terminationDate",
        e.cuil,
        e.active,
        e.union_category_id as "unionCategoryId",
        uc.name as "unionCategoryName",
        uc.union_id as "unionId",
        pu.name as "unionName",
        e.work_sector_id as "workSectorId",
        ws.name as "workSectorName"
      FROM employees e
      LEFT JOIN union_categories uc ON uc.id = e.union_category_id
      LEFT JOIN payroll_unions pu ON pu.id = uc.union_id
      LEFT JOIN work_sectors ws ON ws.id = e.work_sector_id
      WHERE e.id = ${employeeId}
    `;

    return NextResponse.json({
      ...enriched[0],
      unionCategoryId: enriched[0].unionCategoryId ? Number(enriched[0].unionCategoryId) : null,
      unionId: enriched[0].unionId ? Number(enriched[0].unionId) : null,
      workSectorId: enriched[0].workSectorId ? Number(enriched[0].workSectorId) : null
    });
  } catch (error) {
    console.error('Error actualizando empleado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
