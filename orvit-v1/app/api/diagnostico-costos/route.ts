import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '1';

    console.log('🔍 === DIAGNÓSTICO DE COSTOS ===');
    console.log('CompanyId:', companyId);

    // 1. Verificar productos
    const productos = await prisma.$queryRaw`
      SELECT id, name, unit_cost, category_id FROM products 
      WHERE company_id = ${parseInt(companyId)} AND is_active = true 
      LIMIT 5
    `;
    console.log('📦 Productos (muestra):', productos);

    // 2. Verificar recetas
    const recetas = await prisma.$queryRaw`
      SELECT id, name, product_id, subcategory_id FROM recipes 
      WHERE company_id = ${parseInt(companyId)} AND is_active = true 
      LIMIT 5
    `;
    console.log('📋 Recetas (muestra):', recetas);

    // 3. Verificar insumos
    const insumos = await prisma.$queryRaw`
      SELECT id, name FROM supplies 
      WHERE company_id = ${parseInt(companyId)} AND is_active = true 
      LIMIT 5
    `;
    console.log('🧪 Insumos (muestra):', insumos);

    // 4. Verificar precios de insumos
    const precios = await prisma.$queryRaw`
      SELECT supply_id, price_per_unit, month_year FROM supply_monthly_prices 
      WHERE company_id = ${parseInt(companyId)} 
      ORDER BY month_year DESC 
      LIMIT 5
    `;
    console.log('💰 Precios de insumos (muestra):', precios);

    // 5. Verificar items de recetas
    const recipeItems = await prisma.$queryRaw`
      SELECT ri.recipe_id, ri.supply_id, ri.quantity, s.name as supply_name
      FROM recipe_items ri
      LEFT JOIN supplies s ON ri.supply_id = s.id
      WHERE ri.company_id = ${parseInt(companyId)}
      LIMIT 5
    `;
    console.log('🧩 Items de recetas (muestra):', recipeItems);

    // 6. Verificar costos indirectos
    const costosIndirectos = await prisma.$queryRaw`
      SELECT ii.label, ii.current_price FROM "IndirectItem" ii
      WHERE ii."companyId" = ${parseInt(companyId)}
      LIMIT 5
    `;
    console.log('💼 Costos indirectos (muestra):', costosIndirectos);

    // 7. Verificar distribución de costos
    const distribucionCostos = await prisma.$queryRaw`
      SELECT cost_name, product_category_id, percentage FROM cost_distribution_config
      WHERE company_id = ${parseInt(companyId)} AND is_active = true
      LIMIT 5
    `;
    console.log('📊 Distribución de costos (muestra):', distribucionCostos);

    // 8. Verificar empleados y salarios
    const empleados = await prisma.$queryRaw`
      SELECT e.id, e.name, ec.name as category_name FROM employees e
      LEFT JOIN employee_categories ec ON e.category_id = ec.id
      WHERE e.company_id = ${parseInt(companyId)}
      LIMIT 5
    `;
    console.log('👥 Empleados (muestra):', empleados);

    const salarios = await prisma.$queryRaw`
      SELECT employee_id, gross_salary, month_year FROM employee_monthly_salaries
      WHERE company_id = ${parseInt(companyId)}
      ORDER BY month_year DESC
      LIMIT 5
    `;
    console.log('💵 Salarios (muestra):', salarios);

    // 9. Verificar distribución de empleados
    const distribucionEmpleados = await prisma.$queryRaw`
      SELECT employee_id, product_category_id, percentage FROM employee_distribution_config
      WHERE company_id = ${parseInt(companyId)}
      LIMIT 5
    `;
    console.log('👥 Distribución empleados (muestra):', distribucionEmpleados);

    // Conteos totales
    const conteos = {
      productos: await prisma.$queryRaw`SELECT COUNT(*) as count FROM products WHERE company_id = ${parseInt(companyId)} AND is_active = true`,
      recetas: await prisma.$queryRaw`SELECT COUNT(*) as count FROM recipes WHERE company_id = ${parseInt(companyId)} AND is_active = true`,
      insumos: await prisma.$queryRaw`SELECT COUNT(*) as count FROM supplies WHERE company_id = ${parseInt(companyId)} AND is_active = true`,
      precios: await prisma.$queryRaw`SELECT COUNT(*) as count FROM supply_monthly_prices WHERE company_id = ${parseInt(companyId)}`,
      recipeItems: await prisma.$queryRaw`SELECT COUNT(*) as count FROM recipe_items WHERE company_id = ${parseInt(companyId)}`,
      costosIndirectos: await prisma.$queryRaw`SELECT COUNT(*) as count FROM "IndirectItem" WHERE "companyId" = ${parseInt(companyId)}`,
      distribucionCostos: await prisma.$queryRaw`SELECT COUNT(*) as count FROM cost_distribution_config WHERE company_id = ${parseInt(companyId)} AND is_active = true`,
      empleados: await prisma.$queryRaw`SELECT COUNT(*) as count FROM employees WHERE company_id = ${parseInt(companyId)}`,
      salarios: await prisma.$queryRaw`SELECT COUNT(*) as count FROM employee_monthly_salaries WHERE company_id = ${parseInt(companyId)}`,
      distribucionEmpleados: await prisma.$queryRaw`SELECT COUNT(*) as count FROM employee_distribution_config WHERE company_id = ${parseInt(companyId)}`
    };

    return NextResponse.json({
      diagnostico: {
        productos: (productos as any[]),
        recetas: (recetas as any[]),
        insumos: (insumos as any[]),
        precios: (precios as any[]),
        recipeItems: (recipeItems as any[]),
        costosIndirectos: (costosIndirectos as any[]),
        distribucionCostos: (distribucionCostos as any[]),
        empleados: (empleados as any[]),
        salarios: (salarios as any[]),
        distribucionEmpleados: (distribucionEmpleados as any[])
      },
      conteos: {
        productos: (conteos.productos as any[])[0].count,
        recetas: (conteos.recetas as any[])[0].count,
        insumos: (conteos.insumos as any[])[0].count,
        precios: (conteos.precios as any[])[0].count,
        recipeItems: (conteos.recipeItems as any[])[0].count,
        costosIndirectos: (conteos.costosIndirectos as any[])[0].count,
        distribucionCostos: (conteos.distribucionCostos as any[])[0].count,
        empleados: (conteos.empleados as any[])[0].count,
        salarios: (conteos.salarios as any[])[0].count,
        distribucionEmpleados: (conteos.distribucionEmpleados as any[])[0].count
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}