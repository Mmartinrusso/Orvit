import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const productionMonth = searchParams.get('productionMonth');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 === INICIANDO CÁLCULO DE PRECIOS ===');
    console.log('CompanyId:', companyId);

    // Obtener todos los productos activos con manejo de errores
    let products: any[] = [];
    try {
      products = await prisma.$queryRaw`
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
          p.is_active,
          pc.name as category_name,
          ps.name as subcategory_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        LEFT JOIN product_subcategories ps ON p.subcategory_id = ps.id
        WHERE p.company_id = ${parseInt(companyId)}
        AND p.is_active = true
        ORDER BY pc.name, p.name
      ` as any[];
    } catch (error) {
      console.error('❌ Error obteniendo productos:', error);
      return NextResponse.json(
        { error: 'Error obteniendo productos de la base de datos' },
        { status: 500 }
      );
    }

    console.log('📊 Productos encontrados:', products.length);

    if (products.length === 0) {
      console.log('⚠️ No se encontraron productos activos para la empresa');
      return NextResponse.json({
        productPrices: [],
        debug_info: {
          message: 'No hay productos activos para esta empresa',
          total_products: 0
        }
      });
    }

    // Verificar datos básicos con manejo de errores
    let recipeCount = 0;
    let suppliesCount = 0;
    let pricesCount = 0;
    let recipeItemsCount = 0;

    try {
      const recipeResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM recipes WHERE company_id = ${parseInt(companyId)} AND is_active = true
      ` as any[];
      recipeCount = recipeResult[0].count;
    } catch (error) {
      console.error('❌ Error contando recetas:', error);
    }

    try {
      const suppliesResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM supplies WHERE company_id = ${parseInt(companyId)} AND is_active = true
      ` as any[];
      suppliesCount = suppliesResult[0].count;
    } catch (error) {
      console.error('❌ Error contando insumos:', error);
    }

    try {
      const pricesResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM supply_monthly_prices WHERE company_id = ${parseInt(companyId)}
      ` as any[];
      pricesCount = pricesResult[0].count;
    } catch (error) {
      console.error('❌ Error contando precios:', error);
    }

    try {
      const recipeItemsResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM recipe_items WHERE company_id = ${parseInt(companyId)}
      ` as any[];
      recipeItemsCount = recipeItemsResult[0].count;
    } catch (error) {
      console.error('❌ Error contando items de recetas:', error);
    }

    console.log('📋 Recetas activas:', recipeCount);
    console.log('📦 Insumos activos:', suppliesCount);
    console.log('💰 Precios de insumos:', pricesCount);
    console.log('🧩 Items de recetas:', recipeItemsCount);

    // DIAGNÓSTICO
    if (recipeCount === 0) {
      console.log('⚠️ NO HAY RECETAS CONFIGURADAS - Los costos serán $0');
    }
    
    if (pricesCount === 0) {
      console.log('⚠️ NO HAY PRECIOS DE INSUMOS - Los costos de materiales serán $0');
    }

    if (recipeItemsCount === 0) {
      console.log('⚠️ NO HAY ITEMS EN LAS RECETAS - Los costos de materiales serán $0');
    }

    // Calcular precios para cada producto
    const productPrices: any[] = [];
    
    for (const product of products) {
      console.log(`\n🔍 === PROCESANDO: ${product.name} (ID: ${product.id}) ===`);
      
      let materialsCost = 0;
      let indirectCosts = 0;
      let employeeCosts = 0;
      let recipeDetails: any[] = [];
      let recipeId = null;
      let recipeName = null;

      try {
        // 1. BUSCAR RECETA DEL PRODUCTO
        const productIdStr = product.id.toString();
        console.log(`🔍 Buscando receta para product_id: "${productIdStr}"`);
        
        let selectedRecipe = null;
        
        try {
          const directRecipe = await prisma.$queryRaw`
            SELECT 
              r.id,
              r.name,
              r.product_id,
              r.output_quantity,
              r.output_unit_label,
              r.metros_utiles
            FROM recipes r
            WHERE r.product_id = ${productIdStr}
            AND r.company_id = ${parseInt(companyId)}
            AND r.is_active = true
            ORDER BY r.created_at DESC
            LIMIT 1
          ` as any[];
          
          if (directRecipe && directRecipe.length > 0) {
            selectedRecipe = directRecipe[0];
            console.log(`✅ Receta encontrada: ${selectedRecipe.name}`);
          }
        } catch (error) {
          console.error(`❌ Error buscando receta directa para ${product.name}:`, error);
        }

        // Si no hay receta directa y es vigueta, buscar por subcategoría
        if (!selectedRecipe && product.category_name && product.category_name.toLowerCase().includes('vigueta') && product.subcategory_id) {
          try {
            const subcategoryRecipe = await prisma.$queryRaw`
              SELECT 
                r.id,
                r.name,
                r.output_quantity,
                r.output_unit_label,
                r.metros_utiles
              FROM recipes r
              WHERE r.subcategory_id = ${product.subcategory_id}
              AND r.company_id = ${parseInt(companyId)}
              AND r.is_active = true
              ORDER BY r.created_at DESC
              LIMIT 1
            ` as any[];

            if (subcategoryRecipe && subcategoryRecipe.length > 0) {
              selectedRecipe = subcategoryRecipe[0];
              console.log(`✅ Receta de subcategoría encontrada: ${selectedRecipe.name}`);
            }
          } catch (error) {
            console.error(`❌ Error buscando receta de subcategoría para ${product.name}:`, error);
          }
        }

        // 2. CALCULAR COSTO DE MATERIALES
        if (selectedRecipe) {
          recipeId = selectedRecipe.id;
          recipeName = selectedRecipe.name;
          
          console.log(`🔍 Calculando ingredientes para receta ID: ${selectedRecipe.id}`);
          
          try {
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
            ` as any[];
            
            console.log(`📦 Ingredientes encontrados: ${recipeCostQuery.length}`);

            let recipeTotalCost = 0;
            recipeDetails = recipeCostQuery.map((item: any) => {
              const itemCost = parseFloat(item.total_cost) || 0;
              recipeTotalCost += itemCost;
              
              console.log(`  📦 ${item.supply_name || 'Sin nombre'}: ${item.quantity} ${item.unit_measure || ''} × $${item.unit_price || 0} = $${itemCost.toFixed(2)}`);
              
              return {
                supply_name: item.supply_name || 'Sin nombre',
                quantity: parseFloat(item.quantity) || 0,
                unit_measure: item.unit_measure || '',
                unit_price: parseFloat(item.unit_price) || 0,
                total_cost: itemCost
              };
            });
            
            console.log(`💰 Costo total de receta: $${recipeTotalCost.toFixed(2)}`);
            
            // Para viguetas, calcular por metros
            if (product.category_name && product.category_name.toLowerCase().includes('vigueta')) {
              const metrosMatch = product.name.match(/(\d+\.?\d*)\s*mts?/i);
              const metros = metrosMatch ? parseFloat(metrosMatch[1]) : 0;
              const metrosUtiles = parseFloat(selectedRecipe.metros_utiles) || 1;
              
              if (metros > 0 && metrosUtiles > 0) {
                const costPerMeter = recipeTotalCost / metrosUtiles;
                materialsCost = metros * costPerMeter;
                console.log(`💰 Vigueta: ${metros}m × $${costPerMeter.toFixed(2)}/m = $${materialsCost.toFixed(2)}`);
              } else {
                materialsCost = recipeTotalCost;
                console.log(`💰 Vigueta (sin metros): $${materialsCost.toFixed(2)}`);
              }
            } else {
              materialsCost = recipeTotalCost;
              console.log(`💰 Producto estándar: $${materialsCost.toFixed(2)}`);
            }
          } catch (error) {
            console.error(`❌ Error calculando costo de receta para ${product.name}:`, error);
            materialsCost = 0;
          }
        } else {
          // Sin receta, usar unit_cost
          materialsCost = parseFloat(product.unit_cost?.toString() || '0');
          console.log(`⚠️ ${product.name}: Sin receta encontrada, usando unit_cost: $${materialsCost.toFixed(2)}`);
        }

        // 3. CALCULAR COSTOS INDIRECTOS (simplificado por ahora)
        indirectCosts = 0;
        console.log(`💼 ${product.name}: Costos indirectos: $${indirectCosts.toFixed(2)}`);

        // 4. CALCULAR COSTOS DE EMPLEADOS (simplificado por ahora)
        employeeCosts = 0;
        console.log(`👥 ${product.name}: Costos empleados: $${employeeCosts.toFixed(2)}`);

      } catch (error) {
        console.error(`❌ Error general calculando ${product.name}:`, error);
        materialsCost = parseFloat(product.unit_cost?.toString() || '0');
        indirectCosts = 0;
        employeeCosts = 0;
      }

      const calculatedCost = materialsCost + indirectCosts + employeeCosts;
      
      console.log(`📊 RESUMEN ${product.name}:`);
      console.log(`  - Materiales: $${materialsCost.toFixed(2)}`);
      console.log(`  - Indirectos: $${indirectCosts.toFixed(2)}`);
      console.log(`  - Empleados: $${employeeCosts.toFixed(2)}`);
      console.log(`  - TOTAL: $${calculatedCost.toFixed(2)}`);

      productPrices.push({
        id: Number(product.id),
        product_name: product.name,
        product_description: product.description || '',
        sku: product.sku || '',
        category_name: product.category_name || 'Sin categoría',
        category_id: Number(product.category_id),
        subcategory_name: product.subcategory_name || 'Sin subcategoría',
        current_price: parseFloat(product.unit_price?.toString() || '0'),
        current_cost: parseFloat(product.unit_cost?.toString() || '0'),
        stock_quantity: Number(product.stock_quantity) || 0,
        calculated_cost: Number(calculatedCost.toFixed(2)),
        calculated_price: Number((calculatedCost * 1.3).toFixed(2)),
        average_sale_price: 0,
        recipe_id: recipeId ? Number(recipeId) : null,
        recipe_name: recipeName,
        output_quantity: 1,
        output_unit_label: 'unidades',
        intermediate_quantity: 1,
        intermediate_unit_label: 'placas',
        units_per_item: 1,
        base_type: 'standard',
        cost_breakdown: {
          materials: Number(materialsCost.toFixed(2)),
          indirect_costs: Number(indirectCosts.toFixed(2)),
          employee_costs: Number(employeeCosts.toFixed(2)),
          total: Number(calculatedCost.toFixed(2))
        },
        cost_breakdown_per_unit: {
          materials: Number(materialsCost.toFixed(2)),
          indirect_costs: Number(indirectCosts.toFixed(2)),
          employee_costs: Number(employeeCosts.toFixed(2)),
          total: Number(calculatedCost.toFixed(2))
        },
        recipe_details: recipeDetails.map(detail => ({
          supply_name: detail.supply_name,
          quantity: Number(detail.quantity.toFixed(2)),
          unit_measure: detail.unit_measure,
          unit_price: Number(detail.unit_price.toFixed(2)),
          total_cost: Number(detail.total_cost.toFixed(2))
        })),
        indirect_costs_breakdown: [],
        employee_costs_breakdown: [],
        total_products_in_category: 1,
        total_production_in_category: 0,
        production_info: {
          source: 'planificada',
          actual_production: 0,
          planned_production: 0,
          production_month: productionMonth,
          batches_needed: 0,
          materials_cost_per_batch: Number(materialsCost.toFixed(2))
        }
      });
    }

    console.log('✅ Productos procesados:', productPrices.length);
    
    let productosConReceta = 0;
    let productosSinReceta = 0;
    let productosConCostosCero = 0;
    
    productPrices.forEach(p => {
      if (p.recipe_id) {
        productosConReceta++;
      } else {
        productosSinReceta++;
      }
      
      if (p.calculated_cost === 0) {
        productosConCostosCero++;
      }
    });

    console.log('\n📈 ESTADÍSTICAS FINALES:');
    console.log(`  - Productos con receta: ${productosConReceta}`);
    console.log(`  - Productos sin receta: ${productosSinReceta}`);
    console.log(`  - Productos con costo $0: ${productosConCostosCero}`);

    return NextResponse.json({
      productPrices: productPrices,
      debug_info: {
        total_products: productPrices.length,
        products_with_recipe: productosConReceta,
        products_without_recipe: productosSinReceta,
        products_with_zero_cost: productosConCostosCero,
        total_recipes: Number(recipeCount),
        total_supplies: Number(suppliesCount),
        total_prices: Number(pricesCount),
        total_recipe_items: Number(recipeItemsCount)
      }
    });

  } catch (error) {
    console.error('❌ Error calculating product prices:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}