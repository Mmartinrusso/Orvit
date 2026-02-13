import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';
    const productName = searchParams.get('productName') || 'Bloque LT10';

    console.log('🔍 === DEBUG MATERIALES ===');
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
    console.log('📦 Producto encontrado:', selectedProduct.name);

    // 2. Buscar recetas activas
    const recipes = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.name,
        r.product_id as "productId",
        r.output_quantity as "outputQuantity",
        r.output_unit_label as "outputUnitLabel",
        r.is_active
      FROM recipes r
      WHERE r.company_id = ${parseInt(companyId)}
      AND r.is_active = true
      AND r.product_id = ${selectedProduct.id}
    ` as any[];

    console.log('📋 Recetas encontradas:', recipes.length);

    // 3. Obtener precios de insumos
    const supplyPrices = await prisma.$queryRaw`
      SELECT DISTINCT ON (supply_id) 
        supply_id,
        price_per_unit,
        month_year,
        created_at
      FROM supply_monthly_prices 
      WHERE company_id = ${parseInt(companyId)}
      ORDER BY supply_id, month_year DESC, created_at DESC
    ` as any[];

    console.log('💰 Precios de insumos:', supplyPrices.length);

    const priceMap = new Map();
    supplyPrices.forEach((price: any) => {
      priceMap.set(Number(price.supply_id), Number(price.price_per_unit));
    });

    let materialsCostCalculation = {
      method: 'unit_cost',
      value: Number(selectedProduct.unit_cost) || 0,
      details: 'Sin receta, usando unit_cost'
    };

    // 4. Si hay receta, calcular con receta
    if (recipes.length > 0) {
      const selectedRecipe = recipes[0];
      console.log('🧪 Usando receta:', selectedRecipe.name);

      // Obtener ingredientes
      const ingredients = await prisma.$queryRaw`
        SELECT 
          ri.supply_id,
          ri.quantity,
          ri.unit_measure,
          s.name as supply_name,
          s.unit_price as supply_unit_price
        FROM recipe_items ri
        LEFT JOIN supplies s ON ri.supply_id = s.id
        WHERE ri.recipe_id = ${selectedRecipe.id}
        AND ri.company_id = ${parseInt(companyId)}
        ORDER BY ri.id
      ` as any[];

      console.log('🥄 Ingredientes encontrados:', ingredients.length);

      // Calcular costo de materiales
      let recipeTotalCost = 0;
      const ingredientDetails = ingredients.map((ingredient: any) => {
        const supplyId = Number(ingredient.supply_id);
        const quantity = Number(ingredient.quantity);
        const unitPriceFromMap = priceMap.get(supplyId) || 0;
        const unitPriceFromSupply = Number(ingredient.supply_unit_price) || 0;
        const totalCost = quantity * unitPriceFromMap;
        
        recipeTotalCost += totalCost;
        
        return {
          supply_name: ingredient.supply_name,
          supply_id: supplyId,
          quantity: quantity,
          unit_measure: ingredient.unit_measure,
          unit_price_from_map: unitPriceFromMap,
          unit_price_from_supply: unitPriceFromSupply,
          total_cost: totalCost
        };
      });

      const outputQuantity = Number(selectedRecipe.outputQuantity) || 1;
      const materialsCostPerUnit = recipeTotalCost / outputQuantity;

      materialsCostCalculation = {
        method: 'recipe',
        value: materialsCostPerUnit,
        details: {
          recipe_name: selectedRecipe.name,
          recipe_id: selectedRecipe.id,
          total_recipe_cost: recipeTotalCost,
          output_quantity: outputQuantity,
          cost_per_unit: materialsCostPerUnit,
          ingredients: ingredientDetails
        }
      };
    }

    // 5. Comparar con método anterior (usando supplies.unit_price directamente)
    let oldMethodCost = 0;
    if (recipes.length > 0) {
      const selectedRecipe = recipes[0];
      
      const oldMethodData = await prisma.$queryRaw`
        SELECT 
          ri.quantity,
          ri.unit_measure,
          s.name as supply_name,
          s.unit_price,
          (ri.quantity * s.unit_price) as total_cost
        FROM recipe_items ri
        LEFT JOIN supplies s ON ri.supply_id = s.id
        WHERE ri.recipe_id = ${selectedRecipe.id}
        AND ri.company_id = ${parseInt(companyId)}
        ORDER BY ri.id
      ` as any[];

      const oldTotalCost = oldMethodData.reduce((sum: number, ingredient: any) => {
        return sum + (Number(ingredient.total_cost) || 0);
      }, 0);

      const outputQuantity = Number(selectedRecipe.outputQuantity) || 1;
      oldMethodCost = oldTotalCost / outputQuantity;
    }

    return NextResponse.json({
      status: 'debug_complete',
      producto: {
        id: selectedProduct.id,
        name: selectedProduct.name,
        unit_cost: Number(selectedProduct.unit_cost),
        category: selectedProduct.category_name
      },
      calculo_actual: materialsCostCalculation,
      metodo_anterior: {
        method: 'supplies.unit_price',
        value: oldMethodCost,
        details: 'Usando s.unit_price directamente'
      },
      comparacion: {
        diferencia: materialsCostCalculation.value - oldMethodCost,
        metodo_recomendado: oldMethodCost > 0 ? 'metodo_anterior' : 'calculo_actual'
      },
      debug_info: {
        total_recipes: recipes.length,
        total_supply_prices: supplyPrices.length,
        price_map_size: priceMap.size
      }
    });

  } catch (error) {
    console.error('❌ Error en debug materiales:', error);
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