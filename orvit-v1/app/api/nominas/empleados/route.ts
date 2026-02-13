import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Listar empleados con sus categorías gremiales y sectores
export async function GET(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const unionId = searchParams.get('unionId');
    const categoryId = searchParams.get('categoryId');
    const sectorId = searchParams.get('sectorId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Base query
    let whereCondition = `e.company_id = ${auth.companyId}`;

    if (!includeInactive) {
      whereCondition += ` AND e.active = true`;
    }

    if (categoryId) {
      whereCondition += ` AND e.union_category_id = ${parseInt(categoryId)}`;
    } else if (unionId) {
      whereCondition += ` AND uc.union_id = ${parseInt(unionId)}`;
    }

    if (sectorId) {
      whereCondition += ` AND e.work_sector_id = ${parseInt(sectorId)}`;
    }

    const employees = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        e.id,
        e.name,
        e.role,
        e.cuil,
        e.gross_salary as "grossSalary",
        e.payroll_taxes as "payrollTaxes",
        e.hire_date as "hireDate",
        e.termination_date as "terminationDate",
        e.active,
        e.union_category_id as "unionCategoryId",
        e.work_sector_id as "workSectorId",
        uc.id as "catId",
        uc.name as "categoryName",
        uc.code as "categoryCode",
        pu.id as "unionId",
        pu.name as "unionName",
        pu.code as "unionCode",
        ws.id as "sectorId",
        ws.name as "sectorName"
      FROM employees e
      LEFT JOIN union_categories uc ON uc.id = e.union_category_id
      LEFT JOIN payroll_unions pu ON pu.id = uc.union_id
      LEFT JOIN work_sectors ws ON ws.id = e.work_sector_id
      WHERE ${whereCondition}
      ORDER BY e.name ASC
    `);

    // Estadísticas
    const stats = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE e.active = true)::int as active,
        COUNT(*) FILTER (WHERE e.union_category_id IS NOT NULL)::int as "withCategory",
        COUNT(*) FILTER (WHERE e.work_sector_id IS NOT NULL)::int as "withSector"
      FROM employees e
      WHERE e.company_id = ${auth.companyId}
    `;

    return NextResponse.json({
      employees: employees.map(e => ({
        ...e,
        grossSalary: Number(e.grossSalary) || 0,
        payrollTaxes: Number(e.payrollTaxes) || 0,
      })),
      stats: stats[0],
      total: employees.length
    });
  } catch (error) {
    console.error('Error obteniendo empleados:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo empleado
export async function POST(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      role,
      cuil,
      grossSalary,
      payrollTaxes,
      hireDate,
      unionCategoryId,
      workSectorId,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Verificar CUIL único si se proporciona
    if (cuil) {
      const existingCuil = await prisma.$queryRaw<any[]>`
        SELECT id FROM employees
        WHERE company_id = ${auth.companyId} AND cuil = ${cuil}
      `;
      if (existingCuil.length > 0) {
        return NextResponse.json(
          { error: 'Ya existe un empleado con ese CUIL' },
          { status: 400 }
        );
      }
    }

    // Verificar que la categoría existe y pertenece a la empresa
    if (unionCategoryId) {
      const categoryExists = await prisma.$queryRaw<any[]>`
        SELECT uc.id FROM union_categories uc
        JOIN payroll_unions pu ON pu.id = uc.union_id
        WHERE uc.id = ${parseInt(unionCategoryId)} AND pu.company_id = ${auth.companyId}
      `;
      if (categoryExists.length === 0) {
        return NextResponse.json(
          { error: 'Categoría no válida' },
          { status: 400 }
        );
      }
    }

    // Verificar que el sector existe y pertenece a la empresa
    if (workSectorId) {
      const sectorExists = await prisma.$queryRaw<any[]>`
        SELECT id FROM work_sectors
        WHERE id = ${parseInt(workSectorId)} AND company_id = ${auth.companyId}
      `;
      if (sectorExists.length === 0) {
        return NextResponse.json(
          { error: 'Sector no válido' },
          { status: 400 }
        );
      }
    }

    const newEmployee = await prisma.$queryRaw<any[]>`
      INSERT INTO employees (
        company_id, name, role, cuil, gross_salary, payroll_taxes,
        hire_date, union_category_id, work_sector_id,
        active, created_at, updated_at
      )
      VALUES (
        ${auth.companyId},
        ${name.trim()},
        ${role || ''},
        ${cuil || null},
        ${parseFloat(grossSalary) || 0},
        ${parseFloat(payrollTaxes) || 0},
        ${hireDate ? new Date(hireDate) : null},
        ${unionCategoryId ? parseInt(unionCategoryId) : null},
        ${workSectorId ? parseInt(workSectorId) : null},
        true,
        NOW(),
        NOW()
      )
      RETURNING id, name
    `;

    return NextResponse.json({
      success: true,
      employee: newEmployee[0],
      message: `Empleado ${name} creado exitosamente`
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando empleado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar empleado
export async function PUT(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      name,
      role,
      cuil,
      grossSalary,
      payrollTaxes,
      hireDate,
      unionCategoryId,
      workSectorId,
      active,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de empleado requerido' },
        { status: 400 }
      );
    }

    // Verificar que el empleado existe y pertenece a la empresa
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM employees
      WHERE id = ${id} AND company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Verificar CUIL único si se proporciona
    if (cuil) {
      const existingCuil = await prisma.$queryRaw<any[]>`
        SELECT id FROM employees
        WHERE company_id = ${auth.companyId} AND cuil = ${cuil} AND id != ${id}
      `;
      if (existingCuil.length > 0) {
        return NextResponse.json(
          { error: 'Ya existe otro empleado con ese CUIL' },
          { status: 400 }
        );
      }
    }

    await prisma.$queryRaw`
      UPDATE employees
      SET
        name = COALESCE(${name?.trim()}, name),
        role = COALESCE(${role}, role),
        cuil = ${cuil || null},
        gross_salary = COALESCE(${grossSalary ? parseFloat(grossSalary) : null}, gross_salary),
        payroll_taxes = COALESCE(${payrollTaxes ? parseFloat(payrollTaxes) : null}, payroll_taxes),
        hire_date = ${hireDate ? new Date(hireDate) : null},
        union_category_id = ${unionCategoryId ? parseInt(unionCategoryId) : null},
        work_sector_id = ${workSectorId ? parseInt(workSectorId) : null},
        active = COALESCE(${active}, active),
        updated_at = NOW()
      WHERE id = ${id} AND company_id = ${auth.companyId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Empleado actualizado'
    });
  } catch (error) {
    console.error('Error actualizando empleado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Desactivar empleado (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID de empleado requerido' },
        { status: 400 }
      );
    }

    // Verificar que el empleado existe y pertenece a la empresa
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id, name FROM employees
      WHERE id = ${id} AND company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Soft delete
    await prisma.$queryRaw`
      UPDATE employees
      SET active = false, termination_date = CURRENT_DATE, updated_at = NOW()
      WHERE id = ${id} AND company_id = ${auth.companyId}
    `;

    return NextResponse.json({
      success: true,
      message: `Empleado ${existing[0].name} desactivado`
    });
  } catch (error) {
    console.error('Error eliminando empleado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
