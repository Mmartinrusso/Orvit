import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';
    const productName = searchParams.get('productName') || 'Bloque LT10';

    console.log('🔍 === DEBUG RECETAS DE PRODUCTO ===');
    console.log('CompanyId:', companyId);
    console.log('Producto:', productName);

    // 1. Buscar el producto
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
      AND p.name ILIKE ${`%${productName}%`}
      LIMIT 1
    ` as any[];

    if (product.length === 0) {
      return NextResponse.json({
        error: 'Producto no encontrado',
        productos_disponibles: await prisma.$queryRaw`
          SELECT name FROM products WHERE company_id = ${parseInt(companyId)} LIMIT 10
        `
      });
    }

    const selectedProduct = product[0];
    console.log('📦 Producto encontrado:', selectedProduct.name, 'ID:', selectedProduct.id);

    // 2. Buscar TODAS las recetas (activas e inactivas) para este producto
    const allRecipes = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.name,
        r.product_id,
        r.output_quantity,
        r.output_unit_label,
        r.is_active,
        r.created_at
      FROM recipes r
      WHERE r.company_id = ${parseInt(companyId)}
      AND r.product_id = ${selectedProduct.id}
      ORDER BY r.created_at DESC
    ` as any[];

    console.log('📋 Total recetas encontradas para este producto:', allRecipes.length);

    // 3. Buscar recetas activas específicamente
    const activeRecipes = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.name,
        r.product_id,
        r.output_quantity,
        r.output_unit_label,
        r.is_active
      FROM recipes r
      WHERE r.company_id = ${parseInt(companyId)}
      AND r.product_id = ${selectedProduct.id}
      AND r.is_active = true
    ` as any[];

    console.log('✅ Recetas activas:', activeRecipes.length);

    // 4. Si hay receta activa, obtener sus ingredientes
    let ingredientDetails = [];
    let calculationResult = null;

    if (activeRecipes.length > 0) {
      const recipe = activeRecipes[0];
      console.log('🧪 Usando receta activa:', recipe.name);

      // Obtener ingredientes
      const ingredients = await prisma.$queryRaw`
        SELECT 
          ri.id as recipe_item_id,
          ri.supply_id,
          ri.quantity as ingredient_quantity,
          ri.unit_measure as ingredient_unit,
          s.name as supply_name,
          s.unit_measure as supply_unit,
          s.unit_price as supply_price,
          s.is_active as supply_active
        FROM recipe_items ri
        INNER JOIN supplies s ON ri.supply_id = s.id
        WHERE ri.recipe_id = ${recipe.id}
        AND ri.company_id = ${parseInt(companyId)}
        ORDER BY ri.id
      ` as any[];

      console.log('🥄 Ingredientes encontrados:', ingredients.length);

      // Calcular costo
      let totalRecipeCost = 0;
      ingredientDetails = ingredients.map((ingredient: any) => {
        const quantity = Number(ingredient.ingredient_quantity) || 0;
        const unitPrice = Number(ingredient.supply_price) || 0;
        const totalCost = quantity * unitPrice;
        totalRecipeCost += totalCost;

        return {
          supply_name: ingredient.supply_name,
          supply_id: ingredient.supply_id,
          quantity: quantity,
          ingredient_unit: ingredient.ingredient_unit,
          supply_unit: ingredient.supply_unit,
          unit_price: unitPrice,
          total_cost: totalCost,
          supply_active: ingredient.supply_active
        };
      });

      const outputQuantity = Number(recipe.output_quantity) || 1;
      const costPerUnit = totalRecipeCost / outputQuantity;

      calculationResult = {
        recipe_name: recipe.name,
        recipe_id: recipe.id,
        total_recipe_cost: totalRecipeCost,
        output_quantity: outputQuantity,
        cost_per_unit: costPerUnit,
        ingredients_count: ingredients.length
      };
    }

    // 5. Verificar si hay problemas comunes
    const diagnostics = {
      producto_existe: product.length > 0,
      tiene_recetas: allRecipes.length > 0,
      tiene_recetas_activas: activeRecipes.length > 0,
      tiene_ingredientes: ingredientDetails.length > 0,
      ingredientes_con_precio_cero: ingredientDetails.filter(i => i.unit_price === 0).length,
      ingredientes_inactivos: ingredientDetails.filter(i => !i.supply_active).length
    };

    return NextResponse.json({
      status: 'debug_complete',
      producto: {
        id: selectedProduct.id,
        name: selectedProduct.name,
        unit_cost: Number(selectedProduct.unit_cost),
        category: selectedProduct.category_name
      },
      recetas: {
        total: allRecipes.length,
        activas: activeRecipes.length,
        lista_todas: allRecipes.map(r => ({
          id: r.id,
          name: r.name,
          is_active: r.is_active,
          output_quantity: r.output_quantity
        }))
      },
      ingredientes: ingredientDetails,
      calculo: calculationResult,
      diagnosticos: diagnostics,
      recomendaciones: {
        problema_principal: diagnostics.tiene_recetas_activas ? 
          (diagnostics.tiene_ingredientes ? 'Revisar precios de ingredientes' : 'Sin ingredientes en receta') :
          (diagnostics.tiene_recetas ? 'Activar receta' : 'Crear receta'),
        accion_sugerida: diagnostics.tiene_recetas_activas ? 
          'Verificar que los supplies tengan precios > 0' : 
          'Crear o activar una receta para este producto'
      }
    });

  } catch (error) {
    console.error('❌ Error en debug recetas producto:', error);
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