import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const productId = searchParams.get('productId') || '9'; // Default to product ID 9

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 DEBUG: Cargando producto específico, companyId:', companyId, 'productId:', productId);

    // Obtener el producto específico
    const products = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.sku,
        p.category_id,
        p.subcategory_id,
        p.company_id,
        p.unit_price,
        p.unit_cost,
        p.stock_quantity,
        p.min_stock_level,
        p.is_active,
        p.created_at,
        p.updated_at,
        pc.name as category_name,
        pc.description as category_description,
        ps.name as subcategory_name,
        ps.description as subcategory_description
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN product_subcategories ps ON p.subcategory_id = ps.id
      WHERE p.company_id = ${parseInt(companyId)}
      AND p.id = ${parseInt(productId)}
      AND p.is_active = true
      LIMIT 1
    `;

    if ((products as any[]).length === 0) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const product = (products as any[])[0];
    console.log('📊 Producto encontrado:', product.name);

    let calculatedCost = 0;
    let materialsCost = 0;
    let recipeDetails: any[] = [];
    let recipeId = null;
    let recipeName = null;

    // Buscar receta directa del producto
    console.log(`🔍 Buscando receta para product_id: "${product.id}"`);
    
    const productIdStr = product.id.toString();
    const directRecipe = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.name,
        r.product_id,
        r.output_quantity,
        r.output_unit_label,
        r.intermediate_quantity,
        r.intermediate_unit_label,
        r.units_per_item,
        r.metros_utiles
      FROM recipes r
      WHERE r.product_id = ${productIdStr}
      AND r.company_id = ${parseInt(companyId)}
      AND r.is_active = true
      ORDER BY r.created_at DESC
      LIMIT 1
    `;
    
    console.log(`📋 Recetas encontradas:`, (directRecipe as any[]).length);

    if (directRecipe && (directRecipe as any[]).length > 0) {
      const selectedRecipe = (directRecipe as any[])[0];
      recipeId = selectedRecipe.id;
      recipeName = selectedRecipe.name;
      
      console.log(`✅ Receta encontrada: ${selectedRecipe.name} (ID: ${selectedRecipe.id})`);

      // Buscar ingredientes de la receta
      console.log(`🔍 Buscando ingredientes para receta ID: ${selectedRecipe.id}`);
      
      const recipeCostQuery = await prisma.$queryRaw`
        SELECT 
          ri.quantity,
          s.name as supply_name,
          s.unit_measure,
          COALESCE(smp.price_per_unit, 0) as unit_price,
          (ri.quantity * COALESCE(smp.price_per_unit, 0)) as total_cost
        FROM recipe_items ri
        LEFT JOIN supplies s ON ri.supply_id = s.id
        LEFT JOIN supply_monthly_prices smp ON s.id = smp.supply_id 
          AND smp.month_year = (
            SELECT MAX(month_year) 
            FROM supply_monthly_prices 
            WHERE supply_id = s.id AND company_id = ${parseInt(companyId)}
          )
        WHERE ri.recipe_id = ${selectedRecipe.id}
        AND ri.company_id = ${parseInt(companyId)}
        ORDER BY s.name
      `;
      
      const recipeItems = recipeCostQuery as any[];
      console.log(`📦 Ingredientes encontrados: ${recipeItems.length}`);

      let recipeTotalCost = 0;

      recipeDetails = recipeItems.map((item: any, index: number) => {
        const itemCost = parseFloat(item.total_cost) || 0;
        recipeTotalCost += itemCost;
        
        console.log(`  📦 Ingrediente ${index + 1}: ${item.supply_name}`);
        console.log(`    - Cantidad: ${item.quantity} ${item.unit_measure}`);
        console.log(`    - Precio usado: $${item.unit_price || 0}`);
        console.log(`    - Costo total: $${itemCost.toFixed(2)}`);
        
        return {
          supply_name: item.supply_name,
          quantity: parseFloat(item.quantity) || 0,
          unit_measure: item.unit_measure,
          unit_price: parseFloat(item.unit_price) || 0,
          total_cost: itemCost
        };
      });
      
      console.log(`💰 Costo total de receta: $${recipeTotalCost.toFixed(2)}`);
      
      // Asignar el costo de materiales
      materialsCost = recipeTotalCost;
      console.log(`💰 ${product.name}: Costo de materiales = $${materialsCost.toFixed(2)}`);
    } else {
      console.log(`⚠️ ${product.name}: No se encontró receta`);
      materialsCost = parseFloat(product.unit_cost?.toString() || '0');
    }

    // Calcular costo total
    calculatedCost = materialsCost; // Por ahora solo materiales
    
    console.log(`📊 RESUMEN ${product.name}:`);
    console.log(`  - Materiales: $${materialsCost.toFixed(2)}`);
    console.log(`  - TOTAL: $${calculatedCost.toFixed(2)}`);

    const result = {
      id: product.id,
      product_name: product.name,
      recipe_id: recipeId,
      recipe_name: recipeName,
      calculated_cost: calculatedCost,
      cost_breakdown: {
        materials: materialsCost,
        indirect_costs: 0,
        employee_costs: 0,
        total: calculatedCost
      },
      recipe_details: recipeDetails
    };

    return NextResponse.json({ product: result });

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