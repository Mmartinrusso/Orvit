import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/employees/export-salaries - Exportar empleados con sus últimos sueldos
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    console.log('🔍 Iniciando exportación de sueldos...');

    const companyId = String(user!.companyId);

    console.log('Company ID:', companyId);

    // Obtener empleados activos con sus categorías
    console.log('Buscando empleados...');
    const employees = await prisma.employee.findMany({
      where: {
        company_id: parseInt(companyId),
        active: true
      },
      include: {
        employee_categories: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log('Empleados encontrados:', employees.length);

    // Obtener el último sueldo de cada empleado
    const employeesWithLastSalary = await Promise.all(
      employees.map(async (employee) => {
        const lastSalary = await prisma.employeeSalaryHistory.findFirst({
          where: {
            employee_id: employee.id
          },
          orderBy: {
            effective_from: 'desc'
          }
        });

        return {
          id: employee.id,
          name: employee.name,
          role: employee.role,
          category: employee.employee_categories?.name || 'Sin categoría',
          lastSalary: lastSalary?.gross_salary || null,
          lastSalaryMonth: lastSalary?.effective_from ? lastSalary.effective_from.toISOString().slice(0, 7) : null
        };
      })
    );

    // Generar CSV
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const csvHeader = 'nombre_empleado;sueldo;mes_imputacion\n';
    
    const csvRows = employeesWithLastSalary.map(emp => {
      const sueldo = emp.lastSalary ? emp.lastSalary.toString() : '';
      return `${emp.name};${sueldo};${currentMonth}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    console.log('CSV generado con sueldos:', csvContent);

    // Crear respuesta con archivo CSV
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="plantilla_sueldos_mensuales.csv"'
      }
    });

  } catch (error) {
    console.error('Error exportando empleados con sueldos:', error);
    return NextResponse.json(
      { error: `Error interno del servidor: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
