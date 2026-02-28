import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '1';

    console.log('🔍 === VERIFICACIÓN DE DATOS PARA COSTOS ===');
    console.log('CompanyId:', companyId);

    // 1. Verificar productos
    const productos = await prisma.$queryRaw`
      SELECT p.id, p.name, p.unit_cost, p.category_id, pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.company_id = ${parseInt(companyId)} AND p.is_active = true 
      ORDER BY p.name
      LIMIT 10
    `;
    console.log('📦 Productos encontrados:', (productos as any[]).length);

    // 2. Verificar recetas y su asociación con productos
    const recetas = await prisma.$queryRaw`
      SELECT r.id, r.name, r.product_id, r.subcategory_id, p.name as product_name
      FROM recipes r
      LEFT JOIN products p ON r.product_id = p.id::text
      WHERE r.company_id = ${parseInt(companyId)} AND r.is_active = true 
      ORDER BY r.name
      LIMIT 10
    `;
    console.log('📋 Recetas encontradas:', (recetas as any[]).length);

    // 3. Verificar items de recetas con precios
    const recipeItemsConPrecios = await prisma.$queryRaw`
      SELECT 
        ri.recipe_id,
        ri.supply_id,
        ri.quantity,
        s.name as supply_name,
        smp.price_per_unit,
        smp.month_year,
        (ri.quantity * COALESCE(smp.price_per_unit, 0)) as total_cost
      FROM recipe_items ri
      LEFT JOIN supplies s ON ri.supply_id = s.id
      LEFT JOIN supply_monthly_prices smp ON s.id = smp.supply_id 
        AND smp.month_year = (
          SELECT MAX(month_year) 
          FROM supply_monthly_prices 
          WHERE supply_id = s.id AND company_id = ${parseInt(companyId)}
        )
      WHERE ri.company_id = ${parseInt(companyId)}
      ORDER BY ri.recipe_id, s.name
      LIMIT 20
    `;
    console.log('🧩 Items de recetas con precios:', (recipeItemsConPrecios as any[]).length);

    // 4. Verificar costos indirectos
    const costosIndirectos = await prisma.$queryRaw`
      SELECT ii.label, ii.current_price, cdc.product_category_id, cdc.percentage
      FROM "IndirectItem" ii
      LEFT JOIN cost_distribution_config cdc ON ii.label = cdc.cost_name
      WHERE ii."companyId" = ${parseInt(companyId)}
      AND cdc.is_active = true
      LIMIT 10
    `;
    console.log('💼 Costos indirectos configurados:', (costosIndirectos as any[]).length);

    // 5. Verificar empleados y salarios
    const empleadosConSalarios = await prisma.$queryRaw`
      SELECT 
        e.id, 
        e.name, 
        ec.name as category_name,
        ems.gross_salary,
        ems.month_year,
        edc.product_category_id,
        edc.percentage
      FROM employees e
      LEFT JOIN employee_categories ec ON e.category_id = ec.id
      LEFT JOIN employee_monthly_salaries ems ON e.id = ems.employee_id
        AND ems.month_year = (
          SELECT MAX(month_year) 
          FROM employee_monthly_salaries 
          WHERE employee_id = e.id AND company_id = ${parseInt(companyId)}
        )
      LEFT JOIN employee_distribution_config edc ON ec.id = edc.employee_id
      WHERE e.company_id = ${parseInt(companyId)}
      LIMIT 10
    `;
    console.log('👥 Empleados con salarios y distribución:', (empleadosConSalarios as any[]).length);

    // Conteos totales
    const conteos = {
      productos: await prisma.$queryRaw`SELECT COUNT(*) as count FROM products WHERE company_id = ${parseInt(companyId)} AND is_active = true`,
      recetas: await prisma.$queryRaw`SELECT COUNT(*) as count FROM recipes WHERE company_id = ${parseInt(companyId)} AND is_active = true`,
      recetasConProducto: await prisma.$queryRaw`SELECT COUNT(*) as count FROM recipes WHERE company_id = ${parseInt(companyId)} AND is_active = true AND product_id IS NOT NULL`,
      insumos: await prisma.$queryRaw`SELECT COUNT(*) as count FROM supplies WHERE company_id = ${parseInt(companyId)} AND is_active = true`,
      preciosInsumos: await prisma.$queryRaw`SELECT COUNT(*) as count FROM supply_monthly_prices WHERE company_id = ${parseInt(companyId)}`,
      recipeItems: await prisma.$queryRaw`SELECT COUNT(*) as count FROM recipe_items WHERE company_id = ${parseInt(companyId)}`,
      costosIndirectos: await prisma.$queryRaw`SELECT COUNT(*) as count FROM "IndirectItem" WHERE "companyId" = ${parseInt(companyId)}`,
      distribucionCostos: await prisma.$queryRaw`SELECT COUNT(*) as count FROM cost_distribution_config WHERE company_id = ${parseInt(companyId)} AND is_active = true`,
      empleados: await prisma.$queryRaw`SELECT COUNT(*) as count FROM employees WHERE company_id = ${parseInt(companyId)}`,
      salarios: await prisma.$queryRaw`SELECT COUNT(*) as count FROM employee_monthly_salaries WHERE company_id = ${parseInt(companyId)}`,
      distribucionEmpleados: await prisma.$queryRaw`SELECT COUNT(*) as count FROM employee_distribution_config WHERE company_id = ${parseInt(companyId)}`
    };

    // Análisis de problemas
    const problemas = [];
    
    if ((conteos.recetas as any[])[0].count === 0) {
      problemas.push('❌ No hay recetas configuradas');
    }
    
    if ((conteos.recetasConProducto as any[])[0].count === 0) {
      problemas.push('❌ Las recetas no están asociadas a productos');
    }
    
    if ((conteos.recipeItems as any[])[0].count === 0) {
      problemas.push('❌ Las recetas no tienen ingredientes');
    }
    
    if ((conteos.preciosInsumos as any[])[0].count === 0) {
      problemas.push('❌ No hay precios de insumos configurados');
    }
    
    if ((conteos.distribucionCostos as any[])[0].count === 0) {
      problemas.push('⚠️ No hay distribución de costos indirectos');
    }
    
    if ((conteos.distribucionEmpleados as any[])[0].count === 0) {
      problemas.push('⚠️ No hay distribución de costos de empleados');
    }

    console.log('\n📊 CONTEOS TOTALES:');
    Object.entries(conteos).forEach(([key, value]) => {
      console.log(`  ${key}: ${(value as any[])[0].count}`);
    });

    console.log('\n🚨 PROBLEMAS IDENTIFICADOS:');
    problemas.forEach(problema => console.log(`  ${problema}`));

    return NextResponse.json({
      muestras: {
        productos: productos,
        recetas: recetas,
        recipeItemsConPrecios: recipeItemsConPrecios,
        costosIndirectos: costosIndirectos,
        empleadosConSalarios: empleadosConSalarios
      },
      conteos: {
        productos: (conteos.productos as any[])[0].count,
        recetas: (conteos.recetas as any[])[0].count,
        recetasConProducto: (conteos.recetasConProducto as any[])[0].count,
        insumos: (conteos.insumos as any[])[0].count,
        preciosInsumos: (conteos.preciosInsumos as any[])[0].count,
        recipeItems: (conteos.recipeItems as any[])[0].count,
        costosIndirectos: (conteos.costosIndirectos as any[])[0].count,
        distribucionCostos: (conteos.distribucionCostos as any[])[0].count,
        empleados: (conteos.empleados as any[])[0].count,
        salarios: (conteos.salarios as any[])[0].count,
        distribucionEmpleados: (conteos.distribucionEmpleados as any[])[0].count
      },
      problemas: problemas,
      recomendaciones: [
        '1. Crear recetas para los productos',
        '2. Asociar recetas a productos usando product_id',
        '3. Agregar ingredientes a las recetas (recipe_items)',
        '4. Configurar precios mensuales para los insumos',
        '5. Configurar costos indirectos y su distribución por categorías',
        '6. Configurar empleados, salarios y distribución de costos laborales'
      ]
    });

  } catch (error) {
    console.error('❌ Error en verificación:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}