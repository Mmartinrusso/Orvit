import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const { employees } = body;
    const companyId = String(user!.companyId);

    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ error: 'Lista de empleados es requerida' }, { status: 400 });
    }

    const results = {
      success: 0,
      errors: 0,
      details: [] as any[]
    };

    // Procesar cada empleado
    for (const employee of employees) {
      try {
        // Validar datos requeridos
        if (!employee.id || !employee.name || !employee.role || !employee.grossSalary) {
          results.errors++;
          results.details.push({
            id: employee.id,
            name: employee.name,
            error: 'Datos incompletos o inválidos'
          });
          continue;
        }

        // Validar que el salario sea un número positivo
        const grossSalary = Number(employee.grossSalary);
        const payrollTaxes = Number(employee.payrollTaxes || 0);

        if (isNaN(grossSalary) || grossSalary <= 0) {
          results.errors++;
          results.details.push({
            id: employee.id,
            name: employee.name,
            error: 'Salario debe ser un número mayor a 0'
          });
          continue;
        }

        // Actualizar empleado
        await prisma.$executeRaw`
          UPDATE employees 
          SET 
            gross_salary = ${grossSalary},
            payroll_taxes = ${payrollTaxes},
            updated_at = NOW()
          WHERE id = ${employee.id} AND company_id = ${parseInt(companyId)}
        `;

        // Registrar cambio en historial si el salario cambió
        const currentEmployee = await prisma.$queryRaw<any[]>`
          SELECT gross_salary FROM employees WHERE id = ${employee.id}
        `;

        if (currentEmployee.length > 0 && currentEmployee[0].gross_salary !== grossSalary) {
          await prisma.employeeSalaryHistory.create({
            data: {
              employee_id: employee.id,
              company_id: parseInt(companyId),
              effective_from: new Date(),
              gross_salary: grossSalary,
              payroll_taxes: payrollTaxes,
              reason: 'Actualización masiva vía Excel',
              created_at: new Date()
            }
          });
        }

        results.success++;
        results.details.push({
          id: employee.id,
          name: employee.name,
          status: 'Actualizado exitosamente'
        });

      } catch (error) {
        results.errors++;
        results.details.push({
          id: employee.id,
          name: employee.name,
          error: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        });
      }
    }

    return NextResponse.json({
      message: `Importación completada: ${results.success} exitosos, ${results.errors} errores`,
      results
    });

  } catch (error) {
    console.error('Error importando empleados:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
