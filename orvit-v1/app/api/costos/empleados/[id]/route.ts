import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT - Actualizar empleado
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    console.log('🔍 Backend: Body completo recibido:', body);
    
    const { name, role, grossSalary, payrollTaxes, categoryId, companyId } = body;
    const employeeId = params.id;

    console.log('🔍 Backend: Datos extraídos:', { 
      name, 
      role, 
      grossSalary, 
      payrollTaxes, 
      categoryId, 
      companyId, 
      employeeId 
    });

    console.log('🔍 Backend: Tipos de datos:', {
      nameType: typeof name,
      roleType: typeof role,
      grossSalaryType: typeof grossSalary,
      companyIdType: typeof companyId
    });

    if (!name || !role || !grossSalary || !companyId) {
      console.error('❌ Backend: Validación fallida:', { 
        hasName: !!name, 
        hasRole: !!role, 
        hasGrossSalary: !!grossSalary, 
        hasCompanyId: !!companyId,
        nameValue: name,
        roleValue: role,
        grossSalaryValue: grossSalary,
        companyIdValue: companyId
      });
      return NextResponse.json(
        { error: 'Nombre, rol, salario bruto y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el empleado existe y pertenece a la empresa
    const existingEmployee = await prisma.$queryRaw`
      SELECT id, gross_salary FROM employees 
      WHERE id = ${employeeId} AND company_id = ${parseInt(companyId)}
    `;

    if (!existingEmployee || (Array.isArray(existingEmployee) && existingEmployee.length === 0)) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    const currentEmployee = Array.isArray(existingEmployee) ? existingEmployee[0] : existingEmployee;
    const oldGrossSalary = currentEmployee.gross_salary;

    // Actualizar el empleado
    const result = await prisma.$queryRaw`
      UPDATE employees 
      SET name = ${name}, role = ${role}, gross_salary = ${parseFloat(grossSalary)}, 
          payroll_taxes = ${parseFloat(payrollTaxes || 0)}, category_id = ${categoryId ? parseInt(categoryId) : null}, 
          updated_at = NOW()
      WHERE id = ${employeeId} AND company_id = ${parseInt(companyId)}
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

    const updatedEmployee = Array.isArray(result) ? result[0] : result;

    // Si el salario cambió, crear entrada en el historial
    if (oldGrossSalary !== parseFloat(grossSalary)) {
      try {
        await prisma.$executeRaw`
          INSERT INTO employee_salary_history (id, employee_id, old_salary, new_salary, change_date, reason, company_id, created_at)
          VALUES (gen_random_uuid()::text, ${employeeId}, ${oldGrossSalary}, ${parseFloat(grossSalary)}, NOW(), 'Actualización manual', ${parseInt(companyId)}, NOW())
        `;
        console.log('Historial de salario creado para empleado:', employeeId);
      } catch (historyError) {
        console.error('Error creando historial de salario:', historyError);
        // No fallar la actualización del empleado si falla el historial
      }
    }

    console.log('Empleado actualizado exitosamente:', updatedEmployee);
    return NextResponse.json(updatedEmployee);
  } catch (error) {
    console.error('Error actualizando empleado:', error);
    
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { companyId } = body;
    const employeeId = params.id;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el empleado existe y pertenece a la empresa
    const existingEmployee = await prisma.$queryRaw`
      SELECT id FROM employees 
      WHERE id = ${employeeId} AND company_id = ${parseInt(companyId)}
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
      WHERE id = ${employeeId} AND company_id = ${parseInt(companyId)}
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
