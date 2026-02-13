import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === DEBUG ESPECÍFICO BLOQUE LT10 ===');

    // 1. Buscar el producto Bloque LT10
    const product = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.unit_cost,
        p.category_id,
        pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.company_id = ${parseInt(companyId)}
      AND p.name ILIKE '%Bloque LT10%'
      LIMIT 1
    ` as any[];

    if (product.length === 0) {
      return NextResponse.json({
        error: 'Bloque LT10 no encontrado',
        productos_similares: await prisma.$queryRaw`
          SELECT name FROM products 
          WHERE company_id = ${parseInt(companyId)} 
          AND name ILIKE '%bloque%' 
          LIMIT 10
        `
      });
    }

    const bloqueProduct = product[0];
    console.log('📦 Bloque LT10 encontrado - ID:', bloqueProduct.id);

    // 2. Buscar TODAS las recetas que podrían ser del Bloque LT10
    const allRecipes = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.name,
        r.product_id,
        r.output_quantity,
        r.is_active,
        r.created_at
      FROM recipes r
      WHERE r.company_id = ${parseInt(companyId)}
      AND (
        r.product_id = ${bloqueProduct.id}
        OR r.name ILIKE '%Bloque LT10%'
        OR r.name ILIKE '%LT10%'
      )
      ORDER BY r.created_at DESC
    ` as any[];

    console.log('📋 Recetas relacionadas encontradas:', allRecipes.length);

    // 3. Buscar recetas por nombre que contengan "Bloque" o "LT10"
    const recipesByName = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.name,
        r.product_id,
        r.output_quantity,
        r.is_active,
        p.name as linked_product_name
      FROM recipes r
      LEFT JOIN products p ON r.product_id = p.id
      WHERE r.company_id = ${parseInt(companyId)}
      AND (r.name ILIKE '%Bloque%' OR r.name ILIKE '%LT10%')
      ORDER BY r.name
    ` as any[];

    // 4. Si encontramos una receta activa, calcular su costo
    let recipeCalculation = null;
    const activeRecipe = allRecipes.find(r => r.is_active);

    if (activeRecipe) {
      console.log('🧪 Calculando receta activa:', activeRecipe.name);

      const ingredients = await prisma.$queryRaw`
        SELECT 
          ri.supply_id,
          ri.quantity,
          s.name as supply_name,
          s.unit_price,
          (ri.quantity * s.unit_price) as total_cost
        FROM recipe_items ri
        INNER JOIN supplies s ON ri.supply_id = s.id
        WHERE ri.recipe_id = ${activeRecipe.id}
        AND ri.company_id = ${parseInt(companyId)}
        ORDER BY s.name
      ` as any[];

      const totalRecipeCost = ingredients.reduce((sum: number, ing: any) => 
        sum + (Number(ing.total_cost) || 0), 0
      );
      
      const outputQuantity = Number(activeRecipe.output_quantity) || 1;
      const costPerUnit = totalRecipeCost / outputQuantity;

      recipeCalculation = {
        recipe_id: activeRecipe.id,
        recipe_name: activeRecipe.name,
        total_cost: totalRecipeCost,
        output_quantity: outputQuantity,
        cost_per_unit: costPerUnit,
        ingredients: ingredients.map((ing: any) => ({
          supply_name: ing.supply_name,
          quantity: Number(ing.quantity),
          unit_price: Number(ing.unit_price),
          total_cost: Number(ing.total_cost)
        }))
      };
    }

    return NextResponse.json({
      status: 'debug_complete',
      producto: {
        id: bloqueProduct.id,
        name: bloqueProduct.name,
        unit_cost: Number(bloqueProduct.unit_cost),
        category: bloqueProduct.category_name
      },
      recetas_encontradas: {
        por_product_id: allRecipes.filter(r => r.product_id === bloqueProduct.id),
        por_nombre: recipesByName,
        total: allRecipes.length
      },
      calculo_receta: recipeCalculation,
      problema_detectado: {
        tiene_receta_vinculada: allRecipes.some(r => r.product_id === bloqueProduct.id),
        tiene_receta_activa: allRecipes.some(r => r.product_id === bloqueProduct.id && r.is_active),
        recetas_por_nombre: recipesByName.length,
        recomendacion: allRecipes.some(r => r.product_id === bloqueProduct.id && r.is_active) 
          ? 'La receta debería funcionar, revisar consulta SQL'
          : 'Vincular receta al producto o activar receta existente'
      }
    });

  } catch (error) {
    console.error('❌ Error en debug Bloque LT10:', error);
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