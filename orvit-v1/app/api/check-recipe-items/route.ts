import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === VERIFICANDO RECIPE_ITEMS ===');

    // Contar recipe_items
    const itemsCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM recipe_items
    ` as any[];

    // Obtener ejemplo de recipe_items
    const sampleItems = await prisma.$queryRaw`
      SELECT * FROM recipe_items LIMIT 5
    ` as any[];

    // Verificar relación con recetas
    const recipesWithItems = await prisma.$queryRaw`
      SELECT 
        r.id as recipe_id,
        r.name as recipe_name,
        r.product_id,
        COUNT(ri.id) as items_count
      FROM recipes r
      LEFT JOIN recipe_items ri ON r.id = ri.recipe_id
      WHERE r.company_id = ${parseInt(companyId)}
      GROUP BY r.id, r.name, r.product_id
      ORDER BY items_count DESC
      LIMIT 5
    ` as any[];

    return NextResponse.json({
      total_recipe_items: Number(itemsCount[0]?.count || 0),
      sample_items: sampleItems,
      recipes_with_items: recipesWithItems,
      has_items: Number(itemsCount[0]?.count || 0) > 0
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Error verificando recipe_items',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}