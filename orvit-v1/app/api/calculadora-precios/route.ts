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

    console.log('🔍 === CALCULADORA DE PRECIOS ===');
    console.log('CompanyId:', companyId);

    // 1. OBTENER TODOS LOS PRODUCTOS ACTIVOS (costos + ventas)
    const costosProducts = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.sku,
        p.category_id,
        p.subcategory_id,
        p.unit_price,
        p.unit_cost,
        p.stock_quantity,
        pc.name as category_name,
        ps.name as subcategory_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN product_subcategories ps ON p.subcategory_id = ps.id
      WHERE p.company_id = ${parseInt(companyId)}
      AND p.is_active = true
      ORDER BY pc.name, p.name
    ` as any[];

    // Obtener productos de ventas (tabla Product) con sus categorías
    const ventasProducts = await prisma.product.findMany({
      where: {
        companyId: parseInt(companyId),
        isActive: true
      },
      include: {
        category: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Obtener todas las categorías de costos para mapear
    const costosCategories = await prisma.$queryRaw`
      SELECT id, name
      FROM product_categories
      WHERE company_id = ${parseInt(companyId)}
    ` as any[];

    // Crear un mapa de categorías de ventas a costos por nombre
    const categoryMap = new Map<string, number>();
    costosCategories.forEach((cat: any) => {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
    });

    // Transformar productos de ventas al formato de costos
    const transformedVentasProducts = ventasProducts.map(product => {
      // Intentar mapear la categoría de ventas a costos
      let categoryId: number | null = null;
      let categoryName = 'Sin categoría';
      
      if (product.category) {
        categoryName = product.category.name;
        // Buscar categoría en costos por nombre (case insensitive)
        const mappedId = categoryMap.get(product.category.name.toLowerCase().trim());
        if (mappedId) {
          categoryId = mappedId;
        } else {
          // Si no existe en costos, buscar por nombre similar
          const similarCategory = costosCategories.find((cat: any) => 
            cat.name.toLowerCase().trim() === product.category!.name.toLowerCase().trim() ||
            cat.name.toLowerCase().includes(product.category!.name.toLowerCase().trim()) ||
            product.category!.name.toLowerCase().trim().includes(cat.name.toLowerCase().trim())
          );
          
          if (similarCategory) {
            categoryId = similarCategory.id;
            categoryName = similarCategory.name;
          } else {
            // Si no encontramos ninguna coincidencia, usar la primera categoría disponible
            // o null si no hay categorías, pero mantener el nombre original
            if (costosCategories.length > 0) {
              categoryId = costosCategories[0].id;
              categoryName = costosCategories[0].name;
              console.log(`⚠️ Categoría de ventas "${product.category.name}" no encontrada en costos para producto "${product.name}". Usando categoría por defecto: "${categoryName}"`);
            } else {
              categoryId = null;
              console.log(`⚠️ Categoría de ventas "${product.category.name}" no encontrada en costos para producto "${product.name}" y no hay categorías disponibles`);
            }
          }
        }
      } else {
        // Si el producto no tiene categoría en ventas, usar la primera categoría disponible
        if (costosCategories.length > 0) {
          categoryId = costosCategories[0].id;
          categoryName = costosCategories[0].name;
        }
      }

      return {
        id: `ventas-${product.id}`,
        name: product.name,
        description: product.description || '',
        sku: product.code || '',
        category_id: categoryId,
        subcategory_id: null,
        unit_price: product.costPrice || 0,
        unit_cost: product.costPrice || 0,
        stock_quantity: product.currentStock || 0,
        category_name: categoryName,
        subcategory_name: null
      };
    });

    // Combinar productos (costos + ventas) y eliminar duplicados por nombre
    const allProducts = [...costosProducts];
    const costosNames = new Set(costosProducts.map((p: any) => p.name.toLowerCase()));
    
    transformedVentasProducts.forEach(ventasProduct => {
      if (!costosNames.has(ventasProduct.name.toLowerCase())) {
        allProducts.push(ventasProduct);
      }
    });

    const products = allProducts;
    console.log('📊 Productos encontrados (costos + ventas):', products.length);

    // 2. OBTENER TODAS LAS RECETAS ACTIVAS
    const recipes = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.name,
        r.product_id as "productId",
        r.subcategory_id as "subcategoryId",
        r.base_type as "baseType",
        r.output_quantity as "outputQuantity",
        r.output_unit_label as "outputUnitLabel",
        r.intermediate_quantity as "intermediateQuantity",
        r.intermediate_unit_label as "intermediateUnitLabel",
        r.units_per_item as "unitsPerItem",
        r.metros_utiles as "metrosUtiles",
        r.cantidad_pastones as "cantidadPastones"
      FROM recipes r
      WHERE r.company_id = ${parseInt(companyId)}
      AND r.is_active = true
    ` as any[];

    console.log('📋 Recetas encontradas:', recipes.length);

    // 3. OBTENER PRECIOS DE INSUMOS MÁS RECIENTES
    const supplyPrices = await prisma.$queryRaw`
      SELECT DISTINCT ON (supply_id) 
        supply_id,
        price_per_unit,
        month_year
      FROM supply_monthly_prices 
      WHERE company_id = ${parseInt(companyId)}
      ORDER BY supply_id, month_year DESC
    ` as any[];

    console.log('💰 Precios de insumos:', supplyPrices.length);

    // Crear un mapa de precios para acceso rápido
    const priceMap = new Map();
    supplyPrices.forEach(price => {
      priceMap.set(Number(price.supply_id), Number(price.price_per_unit));
    });

    // 4. OBTENER COSTOS INDIRECTOS (simplificado - solo IndirectItem)
    let indirectCosts = [];
    try {
      indirectCosts = await prisma.$queryRaw`
        SELECT 
          ii.label as cost_name,
          ii."currentPrice" as amount
        FROM "IndirectItem" ii
        WHERE ii."companyId" = ${parseInt(companyId)}
      ` as any[];
      
      console.log('💼 Costos indirectos:', indirectCosts.length);
    } catch (error) {
      console.log('⚠️ Error cargando costos indirectos:', error);
      indirectCosts = [];
    }

    console.log('💼 Costos indirectos:', indirectCosts.length);

    // 5. OBTENER COSTOS DE EMPLEADOS POR MES
    let employeeCosts = [];
    if (productionMonth) {
      // Si hay mes específico, usar ese mes
      employeeCosts = await prisma.$queryRaw`
        SELECT 
          ec.name as category_name,
          edc.product_category_id,
          edc.percentage,
          COALESCE(
            (SELECT SUM(ems.gross_salary)
             FROM employee_monthly_salaries ems
             WHERE ems.employee_id IN (
               SELECT e.id FROM employees e WHERE e.category_id = ec.id
             )
             AND ems.company_id = ${parseInt(companyId)}
             AND ems.month_year = ${productionMonth}), 0
          ) as total_salary
        FROM employee_categories ec
        LEFT JOIN employee_distribution_config edc ON ec.id = edc.employee_id
        WHERE ec.company_id = ${parseInt(companyId)}
      ` as any[];
      
      console.log('👥 Costos de empleados mensuales para', productionMonth, ':', employeeCosts.length);
    } else {
      // Si no hay mes específico, usar el último mes disponible
      employeeCosts = await prisma.$queryRaw`
        SELECT 
          ec.name as category_name,
          edc.product_category_id,
          edc.percentage,
          COALESCE(
            (SELECT SUM(ems.gross_salary)
             FROM employee_monthly_salaries ems
             WHERE ems.employee_id IN (
               SELECT e.id FROM employees e WHERE e.category_id = ec.id
             )
             AND ems.company_id = ${parseInt(companyId)}
             AND ems.month_year = (
               SELECT MAX(month_year) FROM employee_monthly_salaries 
               WHERE company_id = ${parseInt(companyId)}
             )), 0
          ) as total_salary
        FROM employee_categories ec
        LEFT JOIN employee_distribution_config edc ON ec.id = edc.employee_id
        WHERE ec.company_id = ${parseInt(companyId)}
      ` as any[];
      
      console.log('👥 Costos de empleados (último mes):', employeeCosts.length);
    }

    console.log('👥 Costos de empleados:', employeeCosts.length);

    // 6. CALCULAR PRECIOS PARA CADA PRODUCTO
    const productPrices = [];

    for (const product of products) {
      console.log(`\n🔍 === PROCESANDO: ${product.name} ===`);
      
      let materialsCost = 0;
      let productIndirectCostsTotal = 0;
      let productEmployeeCostsTotal = 0;
      let recipeDetails: any[] = [];
      let recipeId = null;
      let recipeName = null;
      let selectedRecipe = null;

      try {
        // BUSCAR RECETA PARA EL PRODUCTO
        // Buscar receta directa por product_id
        selectedRecipe = recipes.find(r => 
          r.productId && r.productId.toString() === product.id.toString()
        );

        // Si no hay receta directa y es vigueta, buscar por subcategoría
        if (!selectedRecipe && 
            product.category_name && 
            product.category_name.toLowerCase().includes('vigueta') && 
            product.subcategory_id) {
          selectedRecipe = recipes.find(r => 
            r.subcategoryId && r.subcategoryId === product.subcategory_id
          );
        }

        if (selectedRecipe) {
          recipeId = selectedRecipe.id;
          recipeName = selectedRecipe.name;
          
          console.log(`✅ Receta encontrada: ${selectedRecipe.name}`);

          // OBTENER INGREDIENTES DE LA RECETA
          const ingredients = await prisma.$queryRaw`
            SELECT 
              ri.supply_id,
              ri.quantity,
              ri.unit_measure,
              s.name as supply_name
            FROM recipe_items ri
            LEFT JOIN supplies s ON ri.supply_id = s.id
            WHERE ri.recipe_id = ${selectedRecipe.id}
            AND ri.company_id = ${parseInt(companyId)}
            AND (ri.is_bank_ingredient = false OR ri.is_bank_ingredient IS NULL)
          ` as any[];

          console.log(`📦 Ingredientes encontrados: ${ingredients.length}`);

          // CALCULAR COSTO DE MATERIALES
          let recipeTotalCost = 0;
          recipeDetails = ingredients.map(ingredient => {
            const supplyId = Number(ingredient.supply_id);
            const quantity = Number(ingredient.quantity);
            const unitPrice = priceMap.get(supplyId) || 0;
            const totalCost = quantity * unitPrice;
            
            recipeTotalCost += totalCost;
            
            console.log(`  📦 ${ingredient.supply_name}: ${quantity} TN × $${unitPrice}/TN = $${totalCost.toFixed(2)}`);
            if (unitPrice === 0) {
              console.log(`    ⚠️ Sin precio para supply_id: ${supplyId}`);
            }
            
            return {
              supply_name: ingredient.supply_name,
              quantity: quantity,
              unit_measure: ingredient.unit_measure,
              unit_price: unitPrice,
              total_cost: totalCost
            };
          });

          console.log(`💰 Costo total de receta: $${recipeTotalCost.toFixed(2)}`);
          
          if (recipeTotalCost === 0) {
            console.log(`⚠️ COSTO DE RECETA ES $0 - Verificar precios de insumos`);
            console.log(`   - Ingredientes: ${ingredients.length}`);
            console.log(`   - Precios disponibles: ${priceMap.size}`);
          }

          // CALCULAR COSTO POR UNIDAD
          const outputQuantity = Number(selectedRecipe.outputQuantity) || 1;
          console.log(`📊 Lote produce: ${outputQuantity} unidades`);
          
          if (product.category_name && product.category_name.toLowerCase().includes('vigueta')) {
            // Para viguetas, calcular por metros
            const metrosMatch = product.name.match(/(\d+\.?\d*)\s*mts?/i);
            const metros = metrosMatch ? parseFloat(metrosMatch[1]) : 0;
            const metrosUtiles = Number(selectedRecipe.metrosUtiles) || 1;
            
            if (metros > 0 && metrosUtiles > 0) {
              const costPerMeter = recipeTotalCost / metrosUtiles;
              materialsCost = metros * costPerMeter;
              console.log(`💰 Vigueta: ${metros}m × $${costPerMeter.toFixed(2)}/m = $${materialsCost.toFixed(2)}`);
            } else {
              materialsCost = recipeTotalCost / outputQuantity;
              console.log(`💰 Vigueta (sin metros): $${recipeTotalCost.toFixed(2)} ÷ ${outputQuantity} = $${materialsCost.toFixed(2)}/unidad`);
            }
          } else {
            // Para productos normales, dividir el costo del lote entre las unidades producidas
            materialsCost = recipeTotalCost / outputQuantity;
            console.log(`💰 Costo por unidad: $${recipeTotalCost.toFixed(2)} ÷ ${outputQuantity} unidades = $${materialsCost.toFixed(2)}/unidad`);
          }
        } else {
          // Sin receta, usar unit_cost
          materialsCost = Number(product.unit_cost) || 0;
          console.log(`⚠️ Sin receta, usando unit_cost: $${materialsCost.toFixed(2)}`);
        }

        // CALCULAR COSTOS INDIRECTOS
        const productIndirectCosts = indirectCosts.filter(cost => 
          cost.product_category_id === product.category_id
        );
        
        productIndirectCostsTotal = productIndirectCosts.reduce((total, cost) => {
          const amount = Number(cost.amount) || 0;
          const percentage = Number(cost.percentage) || 0;
          const costValue = amount * percentage / 100;
          console.log(`    💼 ${cost.cost_name}: $${amount} × ${percentage}% = $${costValue.toFixed(2)}`);
          return total + costValue;
        }, 0);

        console.log(`💼 Costos indirectos totales: $${productIndirectCostsTotal.toFixed(2)} (${productIndirectCosts.length} items)`);

        // CALCULAR COSTOS DE EMPLEADOS
        const productEmployeeCosts = employeeCosts.filter(cost => 
          cost.product_category_id === product.category_id
        );
        
        productEmployeeCostsTotal = productEmployeeCosts.reduce((total, cost) => {
          const salary = Number(cost.total_salary) || 0;
          const percentage = Number(cost.percentage) || 0;
          const costValue = salary * percentage / 100;
          console.log(`    👥 ${cost.category_name}: $${salary} × ${percentage}% = $${costValue.toFixed(2)}`);
          return total + costValue;
        }, 0);

        console.log(`👥 Costos empleados totales: $${productEmployeeCostsTotal.toFixed(2)} (${productEmployeeCosts.length} items)`);

      } catch (error) {
        console.error(`❌ Error calculando ${product.name}:`, error);
        materialsCost = Number(product.unit_cost) || 0;
        productIndirectCostsTotal = 0;
        productEmployeeCostsTotal = 0;
      }

      // CALCULAR PRECIO PROMEDIO DE VENTA
      let averageSalePrice = 0;
      try {
        const saleData = await prisma.$queryRaw`
          SELECT AVG(unit_price) as avg_price
          FROM monthly_sales
          WHERE product_id = ${product.id.toString()}
          AND company_id = ${parseInt(companyId)}
          AND (
            fecha_imputacion = ${productionMonth}
            OR (
              month_year IS NOT NULL
              AND DATE_TRUNC('month', month_year) = DATE_TRUNC('month', ${productionMonth + '-01'}::date)
            )
            OR (
              month_year IS NULL
              AND fecha_imputacion IS NULL
              AND created_at IS NOT NULL
              AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', ${productionMonth + '-01'}::date)
            )
          )
        `;

        if (saleData && saleData.length > 0 && saleData[0].avg_price) {
          averageSalePrice = Number(saleData[0].avg_price);
        }
      } catch (error) {
        console.log(`⚠️ Error obteniendo precio de venta para ${product.name}`);
      }

      const calculatedCost = materialsCost + productIndirectCostsTotal + productEmployeeCostsTotal;
      
      console.log(`📊 RESUMEN ${product.name}:`);
      console.log(`  - Materiales: $${materialsCost.toFixed(2)}`);
      console.log(`  - Indirectos: $${productIndirectCostsTotal.toFixed(2)}`);
      console.log(`  - Empleados: $${productEmployeeCostsTotal.toFixed(2)}`);
      console.log(`  - TOTAL: $${calculatedCost.toFixed(2)}`);
      console.log(`  - Precio promedio venta: $${averageSalePrice.toFixed(2)}`);

      productPrices.push({
        id: Number(product.id),
        product_name: product.name,
        product_description: product.description || '',
        sku: product.sku || '',
        category_name: product.category_name || 'Sin categoría',
        category_id: Number(product.category_id),
        subcategory_name: product.subcategory_name || 'Sin subcategoría',
        current_price: Number(product.unit_price) || 0,
        current_cost: Number(product.unit_cost) || 0,
        stock_quantity: Number(product.stock_quantity) || 0,
        calculated_cost: Number(calculatedCost.toFixed(2)),
        calculated_price: Number((calculatedCost * 1.3).toFixed(2)),
        average_sale_price: Number(averageSalePrice.toFixed(2)),
        recipe_id: recipeId ? Number(recipeId) : null,
        recipe_name: recipeName,
        output_quantity: selectedRecipe ? Number(selectedRecipe.outputQuantity) || 1 : 1,
        output_unit_label: selectedRecipe ? selectedRecipe.outputUnitLabel || 'unidades' : 'unidades',
        intermediate_quantity: selectedRecipe ? Number(selectedRecipe.intermediateQuantity) || 1 : 1,
        intermediate_unit_label: selectedRecipe ? selectedRecipe.intermediateUnitLabel || 'placas' : 'placas',
        units_per_item: selectedRecipe ? Number(selectedRecipe.unitsPerItem) || 1 : 1,
        base_type: 'standard',
        cost_breakdown: {
          materials: Number(materialsCost.toFixed(2)),
          indirect_costs: Number(productIndirectCostsTotal.toFixed(2)),
          employee_costs: Number(productEmployeeCostsTotal.toFixed(2)),
          total: Number(calculatedCost.toFixed(2))
        },
        cost_breakdown_per_unit: {
          materials: Number(materialsCost.toFixed(2)),
          indirect_costs: Number(productIndirectCostsTotal.toFixed(2)),
          employee_costs: Number(productEmployeeCostsTotal.toFixed(2)),
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
    
    const productosConReceta = productPrices.filter(p => p.recipe_id !== null).length;
    const productosSinReceta = productPrices.filter(p => p.recipe_id === null).length;
    const productosConCostosCero = productPrices.filter(p => p.calculated_cost === 0).length;

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
        total_recipes: recipes.length,
        total_supplies: supplyPrices.length,
        total_indirect_costs: indirectCosts.length,
        total_employee_costs: employeeCosts.length
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