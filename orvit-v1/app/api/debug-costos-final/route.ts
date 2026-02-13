import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';
    const productionMonth = searchParams.get('productionMonth') || '2025-08';

    console.log('🔍 === DEBUG COSTOS FINAL ===');
    console.log('CompanyId:', companyId);
    console.log('Mes:', productionMonth);

    // Test 1: Productos
    try {
      const products = await prisma.$queryRaw`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.sku,
          p.unit_cost,
          p.unit_price,
          p.stock_quantity,
          pc.id as category_id,
          pc.name as category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.company_id = ${parseInt(companyId)}
        ORDER BY pc.name, p.name
        LIMIT 5
      ` as any[];
      
      console.log('✅ Test 1 - Productos:', products.length);
    } catch (error) {
      console.error('❌ Test 1 - Error productos:', error);
      return NextResponse.json({ error: 'Error en productos', details: error });
    }

    // Test 2: Costos indirectos
    try {
      const monthlyIndirectCosts = await prisma.$queryRaw`
        SELECT 
          icmr.id,
          icmr.amount,
          icb.name as cost_name
        FROM indirect_cost_monthly_records icmr
        JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
        WHERE icmr.company_id = ${parseInt(companyId)}
        AND icmr.fecha_imputacion = ${productionMonth}
        LIMIT 5
      ` as any[];
      
      console.log('✅ Test 2 - Costos indirectos:', monthlyIndirectCosts.length);
    } catch (error) {
      console.error('❌ Test 2 - Error costos indirectos:', error);
      return NextResponse.json({ error: 'Error en costos indirectos', details: error });
    }

    // Test 3: Salarios
    try {
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
        LIMIT 5
      ` as any[];
      
      console.log('✅ Test 3 - Salarios:', employeeSalaries.length);
    } catch (error) {
      console.error('❌ Test 3 - Error salarios:', error);
      return NextResponse.json({ error: 'Error en salarios', details: error });
    }

    // Test 4: Ventas
    try {
      const salesRecords = await prisma.$queryRaw`
        SELECT product_id, SUM(quantity_sold) as total_sales
        FROM monthly_sales
        WHERE company_id = ${parseInt(companyId)}
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', ${productionMonth + '-01'}::date)
        GROUP BY product_id
        LIMIT 5
      ` as any[];
      
      console.log('✅ Test 4 - Ventas:', salesRecords.length);
    } catch (error) {
      console.error('❌ Test 4 - Error ventas:', error);
      return NextResponse.json({ error: 'Error en ventas', details: error });
    }

    return NextResponse.json({
      success: true,
      message: 'Todos los tests pasaron correctamente'
    });

  } catch (error) {
    console.error('❌ Error general:', error);
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