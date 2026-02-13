import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === DEBUG CÁLCULO DE EMPLEADOS ===');

    // 1. Verificar salarios usando la API correcta
    const employeeSalaries = await prisma.$queryRaw`
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
    ` as any[];

    console.log('💰 Salarios encontrados:', employeeSalaries.length);
    employeeSalaries.forEach((salary: any) => {
      console.log(`  - ${salary.category_name}: ${Number(salary.total_salary).toLocaleString('es-AR')}`);
    });

    // 2. Verificar distribución de empleados
    const employeeDistribution = await prisma.$queryRaw`
      SELECT 
        ecd.employee_category_id,
        ecd.product_category_id,
        ecd.percentage,
        ec.name as employee_category_name,
        pc.name as product_category_name
      FROM employee_cost_distribution ecd
      LEFT JOIN employee_categories ec ON ecd.employee_category_id = ec.id
      LEFT JOIN product_categories pc ON ecd.product_category_id = pc.id
      WHERE ecd.company_id = ${parseInt(companyId)}
      ORDER BY ec.name, pc.name
    ` as any[];

    console.log('🎯 Distribución encontrada:', employeeDistribution.length);
    employeeDistribution.forEach((dist: any) => {
      console.log(`  - ${dist.employee_category_name} -> ${dist.product_category_name}: ${dist.percentage}%`);
    });

    // 3. Calcular costos por categoría
    const employeeCostsByCategory: { [categoryId: number]: { total: number, breakdown: any[] } } = {};

    // Agrupar por categoría de producto
    const categoriesMap: { [categoryId: number]: any[] } = {};
    employeeDistribution.forEach((dist: any) => {
      if (!categoriesMap[dist.product_category_id]) {
        categoriesMap[dist.product_category_id] = [];
      }
      categoriesMap[dist.product_category_id].push(dist);
    });

    console.log('📊 Categorías con distribución:', Object.keys(categoriesMap));

    // Calcular costos para cada categoría de producto
    Object.keys(categoriesMap).forEach(categoryIdStr => {
      const categoryId = parseInt(categoryIdStr);
      const categoryDistributions = categoriesMap[categoryId];
      let totalCategoryEmployeeCost = 0;
      const breakdown: any[] = [];

      console.log(`\n🎯 Calculando para categoría ${categoryId}:`);

      categoryDistributions.forEach((dist: any) => {
        const employeeSalary = employeeSalaries.find((salary: any) => salary.category_id === dist.employee_category_id);
        if (employeeSalary) {
          const baseSalary = Number(employeeSalary.total_salary);
          const percentage = Number(dist.percentage);
          const costAmount = baseSalary * (percentage / 100);
          totalCategoryEmployeeCost += costAmount;
          
          console.log(`  - ${dist.employee_category_name}: ${baseSalary.toLocaleString('es-AR')} × ${percentage}% = ${costAmount.toLocaleString('es-AR')}`);
          
          breakdown.push({
            employee_category_name: dist.employee_category_name,
            total_salary: baseSalary,
            percentage: percentage,
            assigned_amount: costAmount
          });
        } else {
          console.log(`  - ${dist.employee_category_name}: NO ENCONTRADO en salarios`);
        }
      });

      employeeCostsByCategory[categoryId] = {
        total: totalCategoryEmployeeCost,
        breakdown: breakdown
      };

      console.log(`💰 Total categoría ${categoryId}: ${totalCategoryEmployeeCost.toLocaleString('es-AR')}`);
    });

    return NextResponse.json({
      companyId: parseInt(companyId),
      employee_salaries: employeeSalaries,
      employee_distribution: employeeDistribution,
      costs_by_category: employeeCostsByCategory,
      summary: {
        salaries_found: employeeSalaries.length,
        distribution_rules: employeeDistribution.length,
        categories_with_costs: Object.keys(employeeCostsByCategory).length,
        total_employee_costs: Object.values(employeeCostsByCategory).reduce((sum, cat) => sum + cat.total, 0)
      }
    });

  } catch (error) {
    console.error('❌ Error en debug empleados:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}