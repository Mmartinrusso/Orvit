import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === DEBUG COSTOS DE EMPLEADOS ===');
    console.log('CompanyId:', companyId);

    // 1. Verificar salarios por categoría de empleados
    const employeeSalaries = await prisma.$queryRaw`
      SELECT 
        ec.id as category_id,
        ec.name as category_name,
        COALESCE(SUM(e.salary), 0) as total_salary,
        COUNT(e.id) as employee_count
      FROM employee_categories ec
      LEFT JOIN employees e ON ec.id = e.category_id AND e.company_id = ${parseInt(companyId)}
      WHERE ec.company_id = ${parseInt(companyId)}
      GROUP BY ec.id, ec.name
      ORDER BY ec.name
    ` as any[];

    console.log('💰 Salarios por categoría:', employeeSalaries.length);

    // 2. Verificar distribución de empleados (tabla employee_cost_distribution)
    let employeeDistribution: any[] = [];
    try {
      employeeDistribution = await prisma.$queryRaw`
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
      
      console.log('🎯 Distribución de empleados (employee_cost_distribution):', employeeDistribution.length);
    } catch (error) {
      console.log('❌ Error en employee_cost_distribution:', error);
    }

    // 3. Calcular costos por categoría de productos
    const employeeCostsByCategory: { [categoryId: number]: { total: number, breakdown: any[] } } = {};

    if (employeeDistribution.length > 0) {
      // Agrupar por categoría de producto
      const categoriesMap: { [categoryId: number]: any[] } = {};
      employeeDistribution.forEach((dist: any) => {
        if (!categoriesMap[dist.product_category_id]) {
          categoriesMap[dist.product_category_id] = [];
        }
        categoriesMap[dist.product_category_id].push(dist);
      });

      // Calcular costos para cada categoría de producto
      Object.keys(categoriesMap).forEach(categoryIdStr => {
        const categoryId = parseInt(categoryIdStr);
        const categoryDistributions = categoriesMap[categoryId];
        let totalCategoryEmployeeCost = 0;
        const breakdown: any[] = [];

        categoryDistributions.forEach((dist: any) => {
          const employeeSalary = employeeSalaries.find((salary: any) => salary.category_id === dist.employee_category_id);
          if (employeeSalary) {
            const costAmount = Number(employeeSalary.total_salary) * (Number(dist.percentage) / 100);
            totalCategoryEmployeeCost += costAmount;
            breakdown.push({
              employee_category_name: dist.employee_category_name,
              total_salary: Number(employeeSalary.total_salary),
              percentage: Number(dist.percentage),
              assigned_amount: costAmount
            });
          }
        });

        employeeCostsByCategory[categoryId] = {
          total: totalCategoryEmployeeCost,
          breakdown: breakdown
        };

        console.log(`👥 Categoría ${categoryId}: ${totalCategoryEmployeeCost.toLocaleString('es-AR')}`);
      });
    }

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
    console.error('❌ Error en debug costos de empleados:', error);
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