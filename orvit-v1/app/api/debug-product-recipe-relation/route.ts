import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === DEBUG RELACIÓN PRODUCTOS-RECETAS ===');

    // Verificar productos con recetas
    const productsWithRecipes = await prisma.$queryRaw`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        r.id as recipe_id,
        r.name as recipe_name,
        r.output_quantity,
        COUNT(ri.id) as ingredients_count
      FROM products p
      LEFT JOIN recipes r ON p.id = r.product_id
      LEFT JOIN recipe_items ri ON r.id = ri.recipe_id
      WHERE p.company_id = ${parseInt(companyId)}
      GROUP BY p.id, p.name, r.id, r.name, r.output_quantity
      ORDER BY p.name
      LIMIT 10
    ` as any[];

    // Verificar recetas sin productos
    const recipesWithoutProducts = await prisma.$queryRaw`
      SELECT 
        r.id as recipe_id,
        r.name as recipe_name,
        r.product_id,
        p.name as product_name
      FROM recipes r
      LEFT JOIN products p ON r.product_id = p.id
      WHERE r.company_id = ${parseInt(companyId)}
      AND (p.id IS NULL OR p.company_id != ${parseInt(companyId)})
      LIMIT 5
    ` as any[];

    return NextResponse.json({
      products_with_recipes: productsWithRecipes,
      recipes_without_products: recipesWithoutProducts,
      summary: {
        products_checked: productsWithRecipes.length,
        products_with_recipes: productsWithRecipes.filter(p => p.recipe_id !== null).length,
        products_without_recipes: productsWithRecipes.filter(p => p.recipe_id === null).length,
        orphan_recipes: recipesWithoutProducts.length
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Error verificando relación productos-recetas',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}