import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === TEST COSTOS DE EMPLEADOS ===');
    console.log('CompanyId:', companyId);

    // 1. Obtener categorías de empleados primero
    const employeeCategories = await prisma.$queryRaw`
      SELECT 
        id as category_id,
        name as category_name
      FROM employee_categories
      WHERE company_id = ${parseInt(companyId)}
      ORDER BY name
    ` as any[];

    console.log('👥 Categorías de empleados:', employeeCategories.length);

    // 2. Obtener salarios por categoría
    const employeeSalaries: any[] = [];
    for (const category of employeeCategories) {
      try {
        const salaryData = await prisma.$queryRaw`
          SELECT 
            COALESCE(SUM(salary), 0) as total_salary,
            COUNT(id) as employee_count
          FROM employees
          WHERE category_id = ${category.category_id}
          AND company_id = ${parseInt(companyId)}
        ` as any[];

        employeeSalaries.push({
          category_id: category.category_id,
          category_name: category.category_name,
          total_salary: salaryData[0]?.total_salary || 0,
          employee_count: salaryData[0]?.employee_count || 0
        });
      } catch (error) {
        console.log(`Error obteniendo salarios para categoría ${category.category_name}:`, error);
        employeeSalaries.push({
          category_id: category.category_id,
          category_name: category.category_name,
          total_salary: 0,
          employee_count: 0
        });
      }
    }

    console.log('💰 Salarios por categoría:', employeeSalaries.length);
    employeeSalaries.forEach((salary: any) => {
      console.log(`  - ${salary.category_name}: ${Number(salary.total_salary).toLocaleString('es-AR')} (${salary.employee_count} empleados)`);
    });

    // 2. Obtener distribución de empleados
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

    console.log('🎯 Distribución de empleados:', employeeDistribution.length);
    employeeDistribution.forEach((dist: any) => {
      console.log(`  - ${dist.employee_category_name} -> ${dist.product_category_name}: ${dist.percentage}%`);
    });

    // 3. Calcular costos por categoría de productos
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
        employee_categories: employeeSalaries.length,
        distribution_rules: employeeDistribution.length,
        categories_with_costs: Object.keys(employeeCostsByCategory).length,
        total_employee_costs: Object.values(employeeCostsByCategory).reduce((sum, cat) => sum + cat.total, 0)
      }
    });

  } catch (error) {
    console.error('❌ Error en test costos de empleados:', error);
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