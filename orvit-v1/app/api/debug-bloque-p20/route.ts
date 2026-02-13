import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 === DEBUG BLOQUE P20 PORTANTE ===');

    // Buscar el producto Bloque P20 Portante en todas las empresas
    const products = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.unit_cost,
        p.company_id,
        p.category_id,
        p.subcategory_id,
        pc.name as category_name,
        c.name as company_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.name ILIKE '%Bloque P20 Portante%'
      AND p.is_active = true
    ` as any[];

    console.log('📦 Productos encontrados:', products.length);

    if (products.length === 0) {
      return NextResponse.json({ error: 'Producto Bloque P20 Portante no encontrado' }, { status: 404 });
    }

    const results = [];

    for (const product of products) {
      console.log(`\n🏢 === EMPRESA: ${product.company_name} (ID: ${product.company_id}) ===`);
      console.log(`📦 Producto: ${product.name} (ID: ${product.id})`);
      console.log(`💰 Unit Cost: ${product.unit_cost}`);

      // Buscar la receta
      const productIdStr = product.id.toString();
      const recipes = await prisma.$queryRaw`
        SELECT 
          r.id,
          r.name,
          r.product_id,
          r.base_type,
          r.output_quantity,
          r.output_unit_label,
          r.metros_utiles,
          r.cantidad_pastones,
          r.created_at
        FROM recipes r
        WHERE r.product_id = ${productIdStr}
        AND r.company_id = ${product.company_id}
        AND r.is_active = true
        ORDER BY r.created_at DESC
      ` as any[];

      if (recipes.length === 0) {
        console.log('❌ No se encontró receta para este producto');
        results.push({
          product: product,
          recipe: null,
          error: 'No recipe found'
        });
        continue;
      }

      const recipe = recipes[0];
      console.log(`📋 Receta: ${recipe.name}`);
      console.log(`   - Base Type: ${recipe.base_type}`);
      console.log(`   - Output Quantity: ${recipe.output_quantity}`);
      console.log(`   - Cantidad Pastones: ${recipe.cantidad_pastones}`);

      // Obtener ingredientes de la receta
      const ingredients = await prisma.$queryRaw`
        SELECT 
          ri.supply_id,
          ri.quantity,
          ri.is_bank_ingredient,
          s.name as supply_name,
          s.unit_measure,
          COALESCE(smp.price_per_unit, 0) as unit_price,
          smp.month_year
        FROM recipe_items ri
        LEFT JOIN supplies s ON ri.supply_id = s.id
        LEFT JOIN supply_monthly_prices smp ON s.id = smp.supply_id 
          AND smp.month_year = (
            SELECT MAX(month_year) 
            FROM supply_monthly_prices 
            WHERE supply_id = s.id AND company_id = ${product.company_id}
          )
        WHERE ri.recipe_id = ${recipe.id}
        AND ri.company_id = ${product.company_id}
        ORDER BY ri.is_bank_ingredient, s.name
      ` as any[];

      console.log(`📦 Total ingredientes: ${ingredients.length}`);

      let costoPorPaston = 0;
      let costoBanco = 0;

      const ingredientDetails = ingredients.map(ingredient => {
        const quantity = Number(ingredient.quantity);
        const unitPrice = Number(ingredient.unit_price);
        const itemCost = quantity * unitPrice;
        const isBankIngredient = ingredient.is_bank_ingredient === true;

        if (isBankIngredient) {
          costoBanco += itemCost;
          console.log(`  🏦 BANCO - ${ingredient.supply_name}: ${quantity} × ${unitPrice} = ${itemCost.toFixed(2)}`);
        } else {
          costoPorPaston += itemCost;
          console.log(`  📦 RECETA - ${ingredient.supply_name}: ${quantity} × ${unitPrice} = ${itemCost.toFixed(2)}`);
        }

        return {
          supply_name: ingredient.supply_name,
          quantity: quantity,
          unit_price: unitPrice,
          total_cost: itemCost,
          is_bank_ingredient: isBankIngredient,
          month_year: ingredient.month_year
        };
      });

      console.log(`💰 RESUMEN DE COSTOS:`);
      console.log(`   - Costo por pastón: ${costoPorPaston.toFixed(2)}`);
      console.log(`   - Costo del banco: ${costoBanco.toFixed(2)}`);

      // Calcular costo total según el tipo de receta
      let totalCost = 0;
      let calculationMethod = '';

      if (recipe.base_type === 'PER_BANK' && recipe.cantidad_pastones) {
        const cantidadPastones = Number(recipe.cantidad_pastones);
        const costoRecetaMultiplicado = costoPorPaston * cantidadPastones;
        totalCost = costoRecetaMultiplicado + costoBanco;
        calculationMethod = `PER_BANK: (${costoPorPaston.toFixed(2)} × ${cantidadPastones}) + ${costoBanco.toFixed(2)} = ${totalCost.toFixed(2)}`;
        
        console.log(`🏦 Cálculo Por Banco:`);
        console.log(`   - Costo receta × pastones: ${costoRecetaMultiplicado.toFixed(2)}`);
        console.log(`   - + Costo banco: ${costoBanco.toFixed(2)}`);
        console.log(`   - = Total: ${totalCost.toFixed(2)}`);
      } else {
        totalCost = costoPorPaston + costoBanco;
        calculationMethod = `STANDARD: ${costoPorPaston.toFixed(2)} + ${costoBanco.toFixed(2)} = ${totalCost.toFixed(2)}`;
        
        console.log(`📦 Cálculo Estándar:`);
        console.log(`   - Total: ${totalCost.toFixed(2)}`);
      }

      // Calcular costo por unidad
      const outputQuantity = Number(recipe.output_quantity) || 1;
      const costPerUnit = totalCost / outputQuantity;
      
      console.log(`📊 COSTO POR UNIDAD:`);
      console.log(`   - Costo total: ${totalCost.toFixed(2)}`);
      console.log(`   - Unidades: ${outputQuantity}`);
      console.log(`   - Costo por unidad: ${costPerUnit.toFixed(2)}`);
      console.log(`   - Unit cost del producto: ${product.unit_cost}`);
      console.log(`   - Diferencia: ${(costPerUnit - Number(product.unit_cost)).toFixed(2)}`);

      results.push({
        product: {
          id: product.id,
          name: product.name,
          unit_cost: Number(product.unit_cost),
          company_id: product.company_id,
          company_name: product.company_name
        },
        recipe: {
          id: recipe.id,
          name: recipe.name,
          base_type: recipe.base_type,
          output_quantity: outputQuantity,
          cantidad_pastones: recipe.cantidad_pastones
        },
        costs: {
          costo_por_paston: costoPorPaston,
          costo_banco: costoBanco,
          total_cost: totalCost,
          cost_per_unit: costPerUnit,
          calculation_method: calculationMethod
        },
        ingredients: ingredientDetails,
        comparison: {
          unit_cost_from_product: Number(product.unit_cost),
          calculated_cost: costPerUnit,
          difference: costPerUnit - Number(product.unit_cost)
        }
      });
    }

    return NextResponse.json({
      found_products: products.length,
      results: results
    });

  } catch (error) {
    console.error('❌ Error en debug Bloque P20:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}