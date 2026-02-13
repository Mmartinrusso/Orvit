import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// PUT /api/employees/salaries/[id] - Actualizar sueldo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salaryId = params.id;
    const body = await request.json();
    const { grossSalary, payrollTaxes, notes } = body;

    if (!grossSalary) {
      return NextResponse.json(
        { error: 'grossSalary es requerido' },
        { status: 400 }
      );
    }

    // Actualizar sueldo
    await prisma.employeeSalaryHistory.update({
      where: { id: salaryId },
      data: {
        gross_salary: parseFloat(grossSalary),
        payroll_taxes: parseFloat(payrollTaxes || 0),
        updated_at: new Date()
      }
    });

    // Obtener el sueldo actualizado con información del empleado
    const updatedSalary = await prisma.$queryRaw`
      SELECT 
        esh.id,
        esh.employee_id as "employeeId",
        esh.effective_from as "fecha_imputacion",
        esh.gross_salary as "grossSalary",
        esh.payroll_taxes as "payrollTaxes",
        (esh.gross_salary + COALESCE(esh.payroll_taxes, 0)) as "totalCost",
        esh.created_at as "createdAt",
        esh.updated_at as "updatedAt",
        e.name as "employeeName",
        e.role as "employeeRole",
        ec.name as "categoryName",
        esh.company_id as "companyId"
      FROM employee_salary_history esh
      LEFT JOIN employees e ON esh.employee_id = e.id
      LEFT JOIN employee_categories ec ON e.category_id = ec.id
      WHERE esh.id = ${salaryId}
    `;

    const processedSalary = (updatedSalary as any[])[0];
    const result = {
      ...processedSalary,
      id: Number(processedSalary.id),
      grossSalary: Number(processedSalary.grossSalary),
      payrollTaxes: Number(processedSalary.payrollTaxes || 0),
      totalCost: Number(processedSalary.totalCost),
      companyId: Number(processedSalary.companyId),
      fecha_imputacion: processedSalary.fecha_imputacion ? processedSalary.fecha_imputacion.toISOString().slice(0, 7) : '',
      createdAt: processedSalary.createdAt?.toISOString(),
      updatedAt: processedSalary.updatedAt?.toISOString()
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error actualizando sueldo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/salaries/[id] - Eliminar sueldo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salaryId = params.id;
    console.log(`🗑️ [API] Eliminando sueldo con ID: ${salaryId}`);

    // Verificar que el sueldo existe antes de eliminar
    const existingSalary = await prisma.employeeSalaryHistory.findUnique({
      where: { id: salaryId }
    });

    if (!existingSalary) {
      console.log(`❌ [API] Sueldo con ID ${salaryId} no encontrado`);
      return NextResponse.json(
        { error: 'Sueldo no encontrado' },
        { status: 404 }
      );
    }

    console.log(`✅ [API] Sueldo encontrado, procediendo con eliminación`);

    // Eliminar sueldo
    await prisma.employeeSalaryHistory.delete({
      where: { id: salaryId }
    });

    console.log(`✅ [API] Sueldo eliminado exitosamente`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ [API] Error eliminando sueldo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}