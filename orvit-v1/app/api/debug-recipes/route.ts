import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === DEBUG RECETAS ===');

    // Verificar si existen recetas
    const recipes = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.name,
        r.product_id,
        p.name as product_name,
        r.output_quantity,
        r.output_unit_label
      FROM recipes r
      LEFT JOIN products p ON r.product_id = p.id
      WHERE r.company_id = ${parseInt(companyId)}
      LIMIT 5
    ` as any[];

    console.log('📋 Recetas encontradas:', recipes.length);

    // Verificar ingredientes
    const ingredients = await prisma.$queryRaw`
      SELECT 
        ri.id,
        ri.recipe_id,
        ri.supply_id,
        ri.quantity,
        ri.unit_measure,
        s.name as supply_name,
        s.unit_price
      FROM recipe_ingredients ri
      LEFT JOIN supplies s ON ri.supply_id = s.id
      LEFT JOIN recipes r ON ri.recipe_id = r.id
      WHERE r.company_id = ${parseInt(companyId)}
      LIMIT 5
    ` as any[];

    console.log('🥄 Ingredientes encontrados:', ingredients.length);

    // Verificar supplies
    const supplies = await prisma.$queryRaw`
      SELECT id, name, unit_price, unit_measure
      FROM supplies
      WHERE company_id = ${parseInt(companyId)}
      LIMIT 5
    ` as any[];

    console.log('📦 Supplies encontrados:', supplies.length);

    return NextResponse.json({
      recipes: recipes,
      ingredients: ingredients,
      supplies: supplies,
      summary: {
        total_recipes: recipes.length,
        total_ingredients: ingredients.length,
        total_supplies: supplies.length
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Error verificando recetas',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}