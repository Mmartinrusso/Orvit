import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID es requerido' }, { status: 400 });
    }

    // Obtener todos los empleados activos con sus categorías
    const employees = await prisma.$queryRaw<any[]>`
      SELECT 
        e.id,
        e.name,
        e.role,
        e.gross_salary as "grossSalary",
        e.payroll_taxes as "payrollTaxes",
        e.active,
        ec.name as "categoryName",
        e.created_at as "createdAt",
        e.updated_at as "updatedAt"
      FROM employees e
      LEFT JOIN employee_categories ec ON e.category_id = ec.id
      WHERE e.company_id = ${parseInt(companyId)} 
        AND e.active = true
      ORDER BY e.name ASC
    `;

    // Convertir BigInt a Number para evitar errores de serialización
    const processedEmployees = employees.map((emp: any) => ({
      ...emp,
      id: emp.id.toString(),
      grossSalary: Number(emp.grossSalary),
      payrollTaxes: Number(emp.payrollTaxes),
      createdAt: emp.createdAt?.toISOString(),
      updatedAt: emp.updatedAt?.toISOString()
    }));

    return NextResponse.json(processedEmployees);
  } catch (error) {
    console.error('Error exportando empleados:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
