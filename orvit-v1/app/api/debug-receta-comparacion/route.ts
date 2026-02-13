import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const productName = searchParams.get('productName') || 'Adoquin Holanda 6cm';

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 === DEBUG COMPARACIÓN DE RECETA ===');
    console.log('CompanyId:', companyId);
    console.log('Producto:', productName);

    // 1. BUSCAR EL PRODUCTO
    const product = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.unit_cost,
        p.category_id,
        p.subcategory_id,
        pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.company_id = ${parseInt(companyId)}
      AND p.name ILIKE ${`%${productName}%`}
      AND p.is_active = true
      LIMIT 1
    ` as any[];

    if (product.length === 0) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const foundProduct = product[0];
    console.log('📦 Producto encontrado:', foundProduct.name, 'ID:', foundProduct.id);

    // 2. BUSCAR LA RECETA
    const productIdStr = foundProduct.id.toString();
    const recipeQuery = await prisma.$queryRaw`
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
      AND r.company_id = ${parseInt(companyId)}
      AND r.is_active = true
      ORDER BY r.created_at DESC
    ` as any[];

    if (recipeQuery.length === 0) {
      return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });
    }

    const recipe = recipeQuery[0];
    console.log('📋 Receta encontrada:', recipe.name);
    console.log('   - Base Type:', recipe.base_type);
    console.log('   - Output Quantity:', recipe.output_quantity);
    console.log('   - Cantidad Pastones:', recipe.cantidad_pastones);
    console.log('   - Metros Útiles:', recipe.metros_utiles);

    // 3. OBTENER INGREDIENTES DE LA RECETA (NO del banco)
    const ingredients = await prisma.$queryRaw`
      SELECT 
        ri.supply_id,
        ri.quantity,
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
          WHERE supply_id = s.id AND company_id = ${parseInt(companyId)}
        )
      WHERE ri.recipe_id = ${recipe.id}
      AND ri.company_id = ${parseInt(companyId)}
      AND (ri.is_bank_ingredient = false OR ri.is_bank_ingredient IS NULL)
      ORDER BY s.name
    ` as any[];

    // 4. OBTENER INGREDIENTES DEL BANCO
    const bankIngredients = await prisma.$queryRaw`
      SELECT 
        ri.supply_id,
        ri.quantity,
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
          WHERE supply_id = s.id AND company_id = ${parseInt(companyId)}
        )
      WHERE ri.recipe_id = ${recipe.id}
      AND ri.company_id = ${parseInt(companyId)}
      AND ri.is_bank_ingredient = true
      ORDER BY s.name
    ` as any[];

    console.log('📦 Ingredientes de receta:', ingredients.length);
    console.log('🏦 Ingredientes del banco:', bankIngredients.length);

    // 5. CALCULAR COSTOS PASO A PASO
    let costoPorPaston = 0;
    const ingredientDetails = ingredients.map(ingredient => {
      const quantity = Number(ingredient.quantity);
      const unitPrice = Number(ingredient.unit_price);
      const itemCost = quantity * unitPrice;
      costoPorPaston += itemCost;
      
      console.log(`  📦 ${ingredient.supply_name}:`);
      console.log(`     - Cantidad: ${quantity} ${ingredient.unit_measure}`);
      console.log(`     - Precio: $${unitPrice} (mes: ${ingredient.month_year})`);
      console.log(`     - Costo: $${itemCost.toFixed(2)}`);
      
      return {
        supply_name: ingredient.supply_name,
        quantity: quantity,
        unit_measure: ingredient.unit_measure,
        unit_price: unitPrice,
        month_year: ingredient.month_year,
        total_cost: itemCost
      };
    });

    let costoBanco = 0;
    const bankDetails = bankIngredients.map(ingredient => {
      const quantity = Number(ingredient.quantity);
      const unitPrice = Number(ingredient.unit_price);
      const itemCost = quantity * unitPrice;
      costoBanco += itemCost;
      
      console.log(`  🏦 ${ingredient.supply_name}:`);
      console.log(`     - Cantidad: ${quantity} ${ingredient.unit_measure}`);
      console.log(`     - Precio: $${unitPrice} (mes: ${ingredient.month_year})`);
      console.log(`     - Costo: $${itemCost.toFixed(2)}`);
      
      return {
        supply_name: ingredient.supply_name,
        quantity: quantity,
        unit_measure: ingredient.unit_measure,
        unit_price: unitPrice,
        month_year: ingredient.month_year,
        total_cost: itemCost
      };
    });

    console.log(`💰 CÁLCULO DE COSTOS:`);
    console.log(`   - Costo por pastón: $${costoPorPaston.toFixed(2)}`);
    console.log(`   - Costo del banco: $${costoBanco.toFixed(2)}`);

    let totalCost = 0;
    let calculationMethod = '';

    if (recipe.base_type === 'PER_BANK' && recipe.cantidad_pastones) {
      const cantidadPastones = Number(recipe.cantidad_pastones);
      const costoRecetaMultiplicado = costoPorPaston * cantidadPastones;
      totalCost = costoRecetaMultiplicado + costoBanco;
      calculationMethod = `PER_BANK: (${costoPorPaston.toFixed(2)} × ${cantidadPastones}) + ${costoBanco.toFixed(2)} = ${totalCost.toFixed(2)}`;
      
      console.log(`🏦 Receta Por Banco:`);
      console.log(`   - Costo por pastón: $${costoPorPaston.toFixed(2)}`);
      console.log(`   - Cantidad pastones: ${cantidadPastones}`);
      console.log(`   - Costo receta multiplicado: $${costoRecetaMultiplicado.toFixed(2)}`);
      console.log(`   - Costo banco: $${costoBanco.toFixed(2)}`);
      console.log(`   - TOTAL: $${totalCost.toFixed(2)}`);
    } else {
      totalCost = costoPorPaston + costoBanco;
      calculationMethod = `STANDARD: ${costoPorPaston.toFixed(2)} + ${costoBanco.toFixed(2)} = ${totalCost.toFixed(2)}`;
      
      console.log(`📦 Receta Estándar:`);
      console.log(`   - Costo total: $${totalCost.toFixed(2)}`);
    }

    // 6. CALCULAR COSTO POR UNIDAD
    const outputQuantity = Number(recipe.output_quantity) || 1;
    const costPerUnit = totalCost / outputQuantity;
    
    console.log(`📊 COSTO POR UNIDAD:`);
    console.log(`   - Costo total del lote: $${totalCost.toFixed(2)}`);
    console.log(`   - Unidades por lote: ${outputQuantity}`);
    console.log(`   - Costo por unidad: $${costPerUnit.toFixed(2)}`);

    // 7. COMPARAR CON UNIT_COST
    const unitCostFromProduct = Number(foundProduct.unit_cost) || 0;
    console.log(`🔍 COMPARACIÓN:`);
    console.log(`   - Unit cost del producto: $${unitCostFromProduct.toFixed(2)}`);
    console.log(`   - Costo calculado: $${costPerUnit.toFixed(2)}`);
    console.log(`   - Diferencia: $${(costPerUnit - unitCostFromProduct).toFixed(2)}`);

    return NextResponse.json({
      product: {
        id: foundProduct.id,
        name: foundProduct.name,
        unit_cost: unitCostFromProduct,
        category_name: foundProduct.category_name
      },
      recipe: {
        id: recipe.id,
        name: recipe.name,
        base_type: recipe.base_type,
        output_quantity: outputQuantity,
        cantidad_pastones: recipe.cantidad_pastones,
        metros_utiles: recipe.metros_utiles
      },
      costs: {
        costo_por_paston: costoPorPaston,
        costo_banco: costoBanco,
        total_cost: totalCost,
        cost_per_unit: costPerUnit,
        calculation_method: calculationMethod
      },
      ingredients: {
        recipe_ingredients: ingredientDetails,
        bank_ingredients: bankDetails
      },
      comparison: {
        unit_cost_from_product: unitCostFromProduct,
        calculated_cost: costPerUnit,
        difference: costPerUnit - unitCostFromProduct
      }
    });

  } catch (error) {
    console.error('❌ Error en debug:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}