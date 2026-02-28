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
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === VERIFICACIÓN SIMPLE PRODUCTOS-RECETAS ===');

    // Contar productos con recetas
    const productsWithRecipes = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM products p
      JOIN recipes r ON p.id = r.product_id
      WHERE p.company_id = ${parseInt(companyId)}
    ` as any[];

    // Obtener ejemplo de producto con receta
    const exampleProduct = await prisma.$queryRaw`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        r.id as recipe_id,
        r.name as recipe_name
      FROM products p
      JOIN recipes r ON p.id = r.product_id
      WHERE p.company_id = ${parseInt(companyId)}
      LIMIT 1
    ` as any[];

    // Verificar si hay recetas con ingredientes
    const recipeWithIngredients = await prisma.$queryRaw`
      SELECT 
        r.id as recipe_id,
        r.name as recipe_name,
        r.product_id,
        COUNT(ri.id) as ingredients_count
      FROM recipes r
      LEFT JOIN recipe_items ri ON r.id = ri.recipe_id
      WHERE r.company_id = ${parseInt(companyId)}
      GROUP BY r.id, r.name, r.product_id
      HAVING COUNT(ri.id) > 0
      LIMIT 1
    ` as any[];

    return NextResponse.json({
      products_with_recipes_count: Number(productsWithRecipes[0]?.count || 0),
      example_product: exampleProduct[0] || null,
      recipe_with_ingredients: recipeWithIngredients[0] || null,
      has_valid_recipes: Number(productsWithRecipes[0]?.count || 0) > 0 && recipeWithIngredients.length > 0
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Error verificando productos-recetas',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}