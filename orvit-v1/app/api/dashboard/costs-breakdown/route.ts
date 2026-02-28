import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    console.log(`🔍 Costs Breakdown - Company: ${companyId}, Month: ${month}`);

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // Obtener costos indirectos del mes
    const indirectCosts = await prisma.indirect_costs.findMany({
      where: {
        company_id: parseInt(companyId),
        fecha_imputacion: month
      }
    });

    console.log(`💸 Indirect costs found: ${indirectCosts.length}`);

    // Calcular total y desglose de costos indirectos
    const indirectTotal = indirectCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
    const indirectBreakdown = indirectCosts.map(cost => ({
      description: cost.description,
      amount: Number(cost.amount),
      percentage: indirectTotal > 0 ? (Number(cost.amount) / indirectTotal) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);

    const mostExpensiveIndirect = indirectBreakdown.length > 0 ? indirectBreakdown[0] : { description: 'N/A', amount: 0 };

    // Obtener costos de empleados del mes desde employee_monthly_salaries
    const employeeCosts = await prisma.employee_monthly_salaries.findMany({
      where: {
        company_id: parseInt(companyId),
        fecha_imputacion: month
      },
      include: {
        employees: {
          include: {
            employee_categories: true
          }
        }
      }
    });

    console.log(`👥 Employee costs found: ${employeeCosts.length}`);

    // Calcular total y desglose de costos de empleados
    const employeeTotal = employeeCosts.reduce((sum, cost) => sum + Number(cost.total_cost), 0);
    
    // Agrupar por categoría
    const categoryTotals: { [key: string]: { category: string; amount: number } } = {};
    employeeCosts.forEach(cost => {
      const categoryName = cost.employees?.employee_categories?.name || 'Sin categoría';
      if (!categoryTotals[categoryName]) {
        categoryTotals[categoryName] = { category: categoryName, amount: 0 };
      }
      categoryTotals[categoryName].amount += Number(cost.total_cost);
    });

    const employeeBreakdown = Object.values(categoryTotals).map(category => ({
      category: category.category,
      amount: category.amount,
      percentage: employeeTotal > 0 ? (category.amount / employeeTotal) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);

    const mostExpensiveEmployee = employeeBreakdown.length > 0 ? employeeBreakdown[0] : { category: 'N/A', amount: 0 };

    return NextResponse.json({
      indirectCosts: {
        total: indirectTotal,
        breakdown: indirectBreakdown,
        mostExpensive: mostExpensiveIndirect
      },
      employeeCosts: {
        total: employeeTotal,
        breakdown: employeeBreakdown,
        mostExpensive: mostExpensiveEmployee
      }
    });

  } catch (error) {
    console.error('Error fetching costs breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs breakdown' },
      { status: 500 }
    );
  }
}
