import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === VERIFICANDO SISTEMA DE RECETAS ===');

    // 1. Verificar si existen recetas
    const recipes = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM recipes WHERE company_id = ${parseInt(companyId)}
    ` as any[];

    // 2. Verificar si existen ingredientes
    const ingredients = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM recipe_ingredients ri
      JOIN recipes r ON ri.recipe_id = r.id
      WHERE r.company_id = ${parseInt(companyId)}
    ` as any[];

    // 3. Verificar si existen supplies
    const supplies = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM supplies WHERE company_id = ${parseInt(companyId)}
    ` as any[];

    // 4. Verificar productos con recetas
    const productsWithRecipes = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM products p
      JOIN recipes r ON p.id = r.product_id
      WHERE p.company_id = ${parseInt(companyId)}
    ` as any[];

    // 5. Obtener ejemplo de receta completa si existe
    const sampleRecipe = await prisma.$queryRaw`
      SELECT 
        p.name as product_name,
        r.name as recipe_name,
        r.output_quantity,
        r.output_unit_label,
        ri.quantity as ingredient_quantity,
        ri.unit_measure,
        s.name as supply_name,
        s.unit_price,
        (ri.quantity * s.unit_price) as ingredient_cost
      FROM products p
      JOIN recipes r ON p.id = r.product_id
      JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      JOIN supplies s ON ri.supply_id = s.id
      WHERE p.company_id = ${parseInt(companyId)}
      LIMIT 5
    ` as any[];

    return NextResponse.json({
      system_status: {
        total_recipes: Number(recipes[0]?.total || 0),
        total_ingredients: Number(ingredients[0]?.total || 0),
        total_supplies: Number(supplies[0]?.total || 0),
        products_with_recipes: Number(productsWithRecipes[0]?.total || 0)
      },
      sample_recipe: sampleRecipe,
      has_recipe_system: Number(recipes[0]?.total || 0) > 0
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Error verificando sistema de recetas',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}