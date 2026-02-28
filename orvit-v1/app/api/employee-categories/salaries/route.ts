import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const companyId = String(user!.companyId);

    // Obtener el salario total por categoría de empleado usando employee_salary_history
    const categorySalaries = await prisma.$queryRaw`
      SELECT 
        ec.id as category_id,
        ec.name as category_name,
        COALESCE(SUM(esh.gross_salary + esh.payroll_taxes), 0) as total_salary
      FROM employee_categories ec
      INNER JOIN employees e ON ec.id = e.category_id AND e.company_id = ${parseInt(companyId)} AND e.active = true
      LEFT JOIN employee_salary_history esh ON e.id = esh.employee_id 
        AND esh.effective_from = (
          SELECT MAX(esh2.effective_from) 
          FROM employee_salary_history esh2 
          WHERE esh2.employee_id = e.id
        )
      WHERE ec.company_id = ${parseInt(companyId)} AND ec.is_active = true
      GROUP BY ec.id, ec.name
      ORDER BY ec.name ASC
    `;

    return NextResponse.json(categorySalaries || []);

  } catch (error) {
    console.error('Error obteniendo salarios de categorías de empleados:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}