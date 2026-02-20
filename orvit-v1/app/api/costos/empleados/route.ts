import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';


// GET - Obtener empleados usando SQL directo con paginación
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

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const companyIdNum = parseInt(companyId);

    const [employees, countResult] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          e.id,
          e.name,
          e.role,
          COALESCE(latest_salary.gross_salary, e.gross_salary) as "grossSalary",
          COALESCE(latest_salary.payroll_taxes, e.payroll_taxes) as "payrollTaxes",
          e.active,
          e.category_id as "categoryId",
          e.company_id as "companyId",
          e.created_at as "createdAt",
          e.updated_at as "updatedAt",
          ec.name as "categoryName",
          COALESCE(latest_salary.gross_salary + COALESCE(latest_salary.payroll_taxes, 0),
                   e.gross_salary + COALESCE(e.payroll_taxes, 0)) as "totalCost",
          e.created_at::date as "startDate"
        FROM employees e
        LEFT JOIN employee_categories ec ON e.category_id = ec.id
        LEFT JOIN LATERAL (
          SELECT esh.gross_salary, esh.payroll_taxes
          FROM employee_salary_history esh
          WHERE esh.employee_id = e.id
          ORDER BY esh.effective_from DESC
          LIMIT 1
        ) latest_salary ON true
        WHERE e.company_id = ${companyIdNum}
          AND e.active = true
        ORDER BY e.name ASC
        LIMIT ${limit} OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM employees
        WHERE company_id = ${companyIdNum} AND active = true
      `,
    ]);

    const total = Number(countResult[0].count);

    return NextResponse.json({
      items: employees,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, s-maxage=60',
      }
    });
  } catch (error) {
    console.error('Error obteniendo empleados:', error);
    
    let errorMessage = 'Error interno del servidor';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo empleado usando SQL directo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, grossSalary, payrollTaxes, categoryId, companyId, startDate } = body;

    // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('Datos recibidos:', { name, role, grossSalary, payrollTaxes, categoryId, companyId, startDate });
    }

    if (!name || !role || !companyId) {
      return NextResponse.json(
        { error: 'Nombre, rol y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Usar SQL directo para crear el empleado
    const result = await prisma.$queryRaw`
      INSERT INTO employees (id, name, role, gross_salary, payroll_taxes, active, category_id, company_id, created_at, updated_at)
      VALUES (gen_random_uuid()::text, ${name}, ${role}, ${parseFloat(grossSalary || 0)}, ${parseFloat(payrollTaxes || 0)}, true, ${categoryId ? parseInt(categoryId) : null}, ${parseInt(companyId)}, NOW(), NOW())
      RETURNING 
        id,
        name,
        role,
        gross_salary as "grossSalary",
        payroll_taxes as "payrollTaxes",
        active,
        category_id as "categoryId",
        company_id as "companyId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const newEmployee = Array.isArray(result) ? result[0] : result;
    
    // Agregar startDate al objeto de respuesta
    const employeeWithStartDate = {
      ...newEmployee,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      totalCost: 0 // Los sueldos se registrarán por separado
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Empleado creado exitosamente:', employeeWithStartDate);
    }
    return NextResponse.json(employeeWithStartDate, { status: 201 });
  } catch (error) {
    console.error('Error creando empleado:', error);
    
    let errorMessage = 'Error interno del servidor';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar empleado (marcar como inactivo)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, companyId } = body;

    if (!id || !companyId) {
      return NextResponse.json(
        { error: 'ID del empleado y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el empleado existe y pertenece a la empresa
    const existingEmployee = await prisma.$queryRaw`
      SELECT id FROM employees 
      WHERE id = ${id} AND company_id = ${parseInt(companyId)}
    `;

    if (!existingEmployee || (Array.isArray(existingEmployee) && existingEmployee.length === 0)) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Marcar el empleado como inactivo en lugar de eliminarlo físicamente
    await prisma.$executeRaw`
      UPDATE employees 
      SET active = false, updated_at = NOW()
      WHERE id = ${id} AND company_id = ${parseInt(companyId)}
    `;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando empleado:', error);
    
    let errorMessage = 'Error interno del servidor';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}
