import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  console.log('🚀 === ENDPOINT EJECUTÁNDOSE ===');
  console.log('🚀 Timestamp:', new Date().toISOString());
  console.log('🚀 URL:', request.url);

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const productionMonth = searchParams.get('productionMonth');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 === LISTA DE PRECIOS BASADA EN RECETAS (FIXED) ===');
    console.log('CompanyId:', companyId);
    console.log('ProductionMonth:', productionMonth || 'planificada');
    console.log('🔍 === VERIFICANDO PARÁMETROS ===');
    console.log('🔍 companyId type:', typeof companyId, 'value:', companyId);
    console.log('🔍 productionMonth type:', typeof productionMonth, 'value:', productionMonth);

    // 1. OBTENER TODOS LOS PRODUCTOS ACTIVOS
    const products = await prisma.$queryRaw`
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

    console.log('📊 Productos encontrados:', products.length);

    // 2. OBTENER DATOS DE PRODUCCIÓN Y VENTAS POR MES (si se especifica)
    let productionData: any[] = [];
    let salesData: any[] = [];
    
    if (productionMonth && productionMonth !== 'planificada') {
      console.log(`📅 Obteniendo datos del mes: ${productionMonth}`);
      
      try {
        // Obtener producción del mes
        productionData = await prisma.$queryRaw`
          SELECT
            mp.product_id,
            mp.quantity_produced,
            p.name as product_name
          FROM monthly_production mp
          LEFT JOIN products p ON mp.product_id::integer = p.id
          WHERE mp.company_id = ${parseInt(companyId)}
          AND mp.fecha_imputacion = ${productionMonth}
        ` as any[];
        
        // Obtener ventas del mes
        salesData = await prisma.$queryRaw`
          SELECT 
            ms.product_id,
            ms.unit_price,
            ms.quantity_sold,
            p.name as product_name
          FROM monthly_sales ms
          LEFT JOIN products p ON ms.product_id::integer = p.id
          WHERE ms.company_id = ${parseInt(companyId)}
          AND ms.fecha_imputacion = ${productionMonth}
        ` as any[];
        
        // Debug: verificar si hay ventas para cualquier mes
        const allSales = await prisma.$queryRaw`
          SELECT 
            ms.product_id,
            ms.unit_price,
            ms.quantity_sold,
            ms.fecha_imputacion,
            p.name as product_name
          FROM monthly_sales ms
          LEFT JOIN products p ON ms.product_id::integer = p.id
          WHERE ms.company_id = ${parseInt(companyId)}
          ORDER BY ms.fecha_imputacion DESC
          LIMIT 10
        ` as any[];
        
        console.log(`🔍 Debug - Total ventas en BD: ${allSales.length}`);
        if (allSales.length > 0) {
          console.log(`🔍 Debug - Últimas ventas:`, allSales.slice(0, 3));
          // Mostrar meses únicos disponibles
          const uniqueMonths = [...new Set(allSales.map(s => s.fecha_imputacion))].sort();
          console.log(`🔍 Debug - Meses con ventas disponibles:`, uniqueMonths);
        } else {
          console.log(`🔍 Debug - NO HAY VENTAS en la base de datos`);
        }
        
        // Debug: verificar si hay producción para cualquier mes
        const allProduction = await prisma.$queryRaw`
          SELECT 
            mp.product_id,
            mp.quantity_produced,
            mp.fecha_imputacion,
            p.name as product_name
          FROM monthly_production mp
          LEFT JOIN products p ON mp.product_id::integer = p.id
          WHERE mp.company_id = ${parseInt(companyId)}
          ORDER BY mp.fecha_imputacion DESC
          LIMIT 10
        ` as any[];
        
        console.log(`🔍 Debug - Total producción en BD: ${allProduction.length}`);
        if (allProduction.length > 0) {
          console.log(`🔍 Debug - Última producción:`, allProduction.slice(0, 3));
          // Mostrar meses únicos disponibles
          const uniqueMonths = [...new Set(allProduction.map(p => p.fecha_imputacion))].sort();
          console.log(`🔍 Debug - Meses con producción disponible:`, uniqueMonths);
        } else {
          console.log(`🔍 Debug - NO HAY PRODUCCIÓN en la base de datos`);
        }
        
        console.log(`📊 Producción encontrada: ${productionData.length} registros`);
        console.log(`💰 Ventas encontradas: ${salesData.length} registros`);
        
        if (productionData.length > 0) {
          console.log(`📦 Ejemplos de producción:`, productionData.slice(0, 3));
          // Verificar tipos de product_id
          console.log(`📦 Tipos de product_id en producción:`, productionData.slice(0, 3).map(p => ({
            product_id: p.product_id,
            type: typeof p.product_id,
            product_name: p.product_name
          })));
        }
        if (salesData.length > 0) {
          console.log(`💰 Ejemplos de ventas:`, salesData.slice(0, 3));
          // Verificar tipos de product_id
          console.log(`💰 Tipos de product_id en ventas:`, salesData.slice(0, 3).map(s => ({
            product_id: s.product_id,
            type: typeof s.product_id,
            product_name: s.product_name
          })));
        }
      } catch (error) {
        console.error('❌ Error obteniendo datos mensuales:', error);
      }
    }

    // 3. FUNCIÓN PARA CALCULAR COSTO DE UNA RECETA (EXACTA COMO RECETAS.TSX)
    const calculateRecipeCost = async (recipeId: number, recipe: any) => {
      console.log(`🔍 Calculando costo de receta ID: ${recipeId} - ${recipe.name}`);
      
      // Obtener ingredientes de la receta (NO del banco) - CON FLETE SI EXISTE
      const ingredients = await prisma.$queryRaw`
        SELECT 
          ri.supply_id,
          ri.quantity,
          s.name as supply_name,
          s.unit_measure,
          COALESCE(smp.price_per_unit, 0) as unit_price,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'supply_monthly_prices' 
              AND column_name = 'freight_cost'
            ) THEN COALESCE(smp.freight_cost, 0)
            ELSE 0
          END as freight_cost
        FROM recipe_items ri
        LEFT JOIN supplies s ON ri.supply_id = s.id
        LEFT JOIN supply_monthly_prices smp ON s.id = smp.supply_id 
          AND smp.month_year = (
            SELECT MAX(month_year) 
            FROM supply_monthly_prices 
            WHERE supply_id = s.id AND company_id = ${parseInt(companyId)}
          )
        WHERE ri.recipe_id = ${recipeId}
        AND ri.company_id = ${parseInt(companyId)}
        AND (ri.is_bank_ingredient = false OR ri.is_bank_ingredient IS NULL)
        ORDER BY s.name
      ` as any[];

      // Obtener ingredientes del banco (solo para recetas "Por Banco") - CON FLETE SI EXISTE
      const bankIngredients = await prisma.$queryRaw`
        SELECT 
          ri.supply_id,
          ri.quantity,
          s.name as supply_name,
          s.unit_measure,
          COALESCE(smp.price_per_unit, 0) as unit_price,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'supply_monthly_prices' 
              AND column_name = 'freight_cost'
            ) THEN COALESCE(smp.freight_cost, 0)
            ELSE 0
          END as freight_cost
        FROM recipe_items ri
        LEFT JOIN supplies s ON ri.supply_id = s.id
        LEFT JOIN supply_monthly_prices smp ON s.id = smp.supply_id 
          AND smp.month_year = (
            SELECT MAX(month_year) 
            FROM supply_monthly_prices 
            WHERE supply_id = s.id AND company_id = ${parseInt(companyId)}
          )
        WHERE ri.recipe_id = ${recipeId}
        AND ri.company_id = ${parseInt(companyId)}
        AND ri.is_bank_ingredient = true
        ORDER BY s.name
      ` as any[];

      console.log(`📦 Ingredientes de receta: ${ingredients.length}`);
      console.log(`🏦 Ingredientes del banco: ${bankIngredients.length}`);

      // Calcular costo de ingredientes de la receta (por pastón) - INCLUYENDO FLETE
      let costoPorPaston = 0;
      const recipeDetails = ingredients.map(ingredient => {
        const quantity = Number(ingredient.quantity);
        const unitPrice = Number(ingredient.unit_price);
        const freightCost = Number(ingredient.freight_cost) || 0;
        const totalPrice = unitPrice + freightCost; // IGUAL QUE getCurrentPrice()
        const itemCost = quantity * totalPrice;
        costoPorPaston += itemCost;
        
        console.log(`  📦 ${ingredient.supply_name}: ${quantity} × ${totalPrice} (${unitPrice} + ${freightCost} flete) = ${itemCost.toFixed(2)}`);
        
        return {
          supply_name: ingredient.supply_name,
          quantity: quantity,
          unit_measure: ingredient.unit_measure,
          unit_price: unitPrice,
          freight_cost: freightCost,
          total_price: totalPrice,
          total_cost: itemCost
        };
      });

      // Calcular costo de ingredientes del banco (NO se multiplican por pastones) - INCLUYENDO FLETE
      let costoBanco = 0;
      const bankDetails = bankIngredients.map(ingredient => {
        const quantity = Number(ingredient.quantity);
        const unitPrice = Number(ingredient.unit_price);
        const freightCost = Number(ingredient.freight_cost) || 0;
        const totalPrice = unitPrice + freightCost; // IGUAL QUE getCurrentPrice()
        const itemCost = quantity * totalPrice;
        costoBanco += itemCost;
        
        console.log(`  🏦 ${ingredient.supply_name}: ${quantity} × ${totalPrice} (${unitPrice} + ${freightCost} flete) = ${itemCost.toFixed(2)}`);
        
        return {
          supply_name: ingredient.supply_name,
          quantity: quantity,
          unit_measure: ingredient.unit_measure,
          unit_price: unitPrice,
          freight_cost: freightCost,
          total_price: totalPrice,
          total_cost: itemCost
        };
      });

      console.log(`💰 Costo por pastón: ${costoPorPaston.toFixed(2)}`);
      console.log(`🏦 Costo del banco: ${costoBanco.toFixed(2)}`);

      let totalCost = 0;

      // LÓGICA EXACTA COPIADA DE RECETAS.TSX LÍNEA 626-632
      if (recipe.base_type === 'PER_BANK' && recipe.cantidad_pastones) {
        const costoRecetaMultiplicado = costoPorPaston * Number(recipe.cantidad_pastones);
        totalCost = costoRecetaMultiplicado + costoBanco; // Los del banco NO se multiplican
        console.log(`Receta ${recipe.name} (Por Banco): costo por pastón=${costoPorPaston.toFixed(2)}, cantidad pastones=${recipe.cantidad_pastones}, costo receta total=${costoRecetaMultiplicado.toFixed(2)}, costo banco=${costoBanco.toFixed(2)}, total final=${totalCost.toFixed(2)}`);
      } else {
        totalCost = costoPorPaston + costoBanco;
        console.log(`Receta ${recipe.name} (Estándar): costo por pastón=${costoPorPaston.toFixed(2)}, costo banco=${costoBanco.toFixed(2)}, total final=${totalCost.toFixed(2)}`);
      }
      
      return {
        totalCost,
        recipeDetails: [...recipeDetails, ...bankDetails]
      };
    };

    // 3. PROCESAR CADA PRODUCTO
    const productPrices = [];

    for (const product of products) {
      console.log(`\n🔍 === PROCESANDO: ${product.name} (ID: ${product.id}) ===`);
      
      let materialsCost = 0;
      let recipeDetails: any[] = [];
      let recipeId = null;
      let recipeName = null;
      let outputQuantity = 1;
      let outputUnitLabel = 'unidades';

      try {
        // BUSCAR RECETA PARA EL PRODUCTO (igual que en tu sistema)
        const productIdStr = product.id.toString();
        console.log(`🔍 Buscando receta para product_id: "${productIdStr}"`);
        
        // Buscar receta directa por product_id
        const directRecipe = await prisma.$queryRaw`
          SELECT 
            r.id,
            r.name,
            r.product_id,
            r.base_type,
            r.output_quantity,
            r.output_unit_label,
            r.metros_utiles,
            r.cantidad_pastones
          FROM recipes r
          WHERE r.product_id = ${productIdStr}
          AND r.company_id = ${parseInt(companyId)}
          AND r.is_active = true
          ORDER BY r.created_at DESC
          LIMIT 1
        ` as any[];
        
        let selectedRecipe = null;
        
        if (directRecipe && directRecipe.length > 0) {
          selectedRecipe = directRecipe[0];
          console.log(`✅ Receta directa encontrada: ${selectedRecipe.name}`);
        } else if (product.category_name && product.category_name.toLowerCase().includes('vigueta') && product.subcategory_id) {
          // Para viguetas, buscar por subcategoría
          const subcategoryRecipe = await prisma.$queryRaw`
            SELECT 
              r.id,
              r.name,
              r.base_type,
              r.output_quantity,
              r.output_unit_label,
              r.metros_utiles,
              r.cantidad_pastones
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
        }

        if (selectedRecipe) {
          recipeId = selectedRecipe.id;
          recipeName = selectedRecipe.name;
          outputQuantity = Number(selectedRecipe.output_quantity) || 1;
          outputUnitLabel = selectedRecipe.output_unit_label || 'unidades';
          
          console.log(`📊 Receta produce: ${outputQuantity} ${outputUnitLabel} por lote`);

          // CALCULAR COSTO DE LA RECETA
          const recipeCost = await calculateRecipeCost(selectedRecipe.id, selectedRecipe);
          recipeDetails = recipeCost.recipeDetails;
          
          // CALCULAR COSTO POR UNIDAD
          if (product.category_name && product.category_name.toLowerCase().includes('vigueta')) {
            // Para viguetas, calcular por metros
            const metrosMatch = product.name.match(/(\d+\.?\d*)\s*mts?/i);
            const metros = metrosMatch ? parseFloat(metrosMatch[1]) : 0;
            const metrosUtiles = Number(selectedRecipe.metros_utiles) || 1;
            
            if (metros > 0 && metrosUtiles > 0) {
              const costPerMeter = recipeCost.totalCost / metrosUtiles;
              materialsCost = metros * costPerMeter;
              console.log(`💰 Vigueta: ${metros}m × ${costPerMeter.toFixed(2)}/m = ${materialsCost.toFixed(2)}`);
            } else {
              materialsCost = recipeCost.totalCost / outputQuantity;
              console.log(`💰 Vigueta (sin metros): ${recipeCost.totalCost.toFixed(2)} ÷ ${outputQuantity} = ${materialsCost.toFixed(2)}/unidad`);
            }
          } else {
            // Para productos normales, dividir el costo del lote entre las unidades producidas
            materialsCost = recipeCost.totalCost / outputQuantity;
            console.log(`💰 Costo por unidad: ${recipeCost.totalCost.toFixed(2)} ÷ ${outputQuantity} unidades = ${materialsCost.toFixed(2)}/unidad`);
          }
        } else {
          // Sin receta, usar unit_cost
          materialsCost = Number(product.unit_cost) || 0;
          console.log(`⚠️ Sin receta, usando unit_cost: ${materialsCost.toFixed(2)}`);
        }

      } catch (error) {
        console.error(`❌ Error calculando ${product.name}:`, error);
        materialsCost = Number(product.unit_cost) || 0;
      }

        // ===== NUEVO CÁLCULO DE COSTOS INDIRECTOS (DESDE CERO) =====
        let indirectCosts = 0;
        let employeeCosts = 0;
        
        // Solo calcular si hay mes y categoría
        if (productionMonth && productionMonth !== 'planificada' && product.category_id) {
          console.log(`\n🔍 === NUEVO CÁLCULO PARA ${product.name} (Categoría: ${product.category_id}) ===`);
          
          try {
            // PASO 1: Obtener TODOS los costos indirectos del mes
            console.log(`📊 PASO 1: Obteniendo costos indirectos del mes ${productionMonth}`);
            const allIndirectCosts = await prisma.$queryRaw`
              SELECT 
                icmr.amount,
                icb.name as cost_name
              FROM indirect_cost_monthly_records icmr
              JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
              WHERE icmr.company_id = ${parseInt(companyId)} 
              AND icmr.fecha_imputacion = ${productionMonth}
            ` as any[];
            
            console.log(`💰 Costos indirectos encontrados: ${allIndirectCosts.length}`);
            if (allIndirectCosts.length > 0) {
              const totalIndirectCosts = allIndirectCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
              console.log(`💰 Total costos indirectos del mes: $${totalIndirectCosts.toLocaleString('es-AR')}`);
              allIndirectCosts.forEach(cost => {
                console.log(`  - ${cost.cost_name}: $${Number(cost.amount).toLocaleString('es-AR')}`);
              });
            }
            
            // PASO 2: Obtener distribución para esta categoría
            console.log(`📊 PASO 2: Obteniendo distribución para categoría ${product.category_id}`);
            const distributions = await prisma.$queryRaw`
              SELECT 
                cost_name,
                percentage
              FROM cost_distribution_config 
              WHERE company_id = ${parseInt(companyId)} 
              AND product_category_id = ${Number(product.category_id)}
            ` as any[];
            
            console.log(`📊 Distribuciones encontradas: ${distributions.length}`);
            if (distributions.length > 0) {
              distributions.forEach(dist => {
                console.log(`  - ${dist.cost_name}: ${dist.percentage}%`);
              });
            }
            
            // PASO 3: Calcular cuánto de cada costo va a esta categoría
            console.log(`📊 PASO 3: Calculando distribución por costo`);
            let totalCategoryCosts = 0;
            
            for (const distribution of distributions) {
              const costName = distribution.cost_name;
              const percentage = Number(distribution.percentage);
              
              // Buscar el costo específico
              const specificCost = allIndirectCosts.find(cost => cost.cost_name === costName);
              
              if (specificCost) {
                const costAmount = Number(specificCost.amount);
                const categoryShare = costAmount * (percentage / 100);
                totalCategoryCosts += categoryShare;
                
                console.log(`  💰 ${costName}: $${costAmount.toLocaleString('es-AR')} × ${percentage}% = $${categoryShare.toLocaleString('es-AR')}`);
              } else {
                console.log(`  ⚠️ No se encontró el costo "${costName}" en el mes ${productionMonth}`);
              }
            }
            
            console.log(`💰 Total costos indirectos para esta categoría: $${totalCategoryCosts.toLocaleString('es-AR')}`);
            
            // PASO 4: Obtener producción total de la categoría
            console.log(`📊 PASO 4: Obteniendo producción de la categoría`);
            const categoryProduction = await prisma.$queryRaw`
              SELECT COALESCE(SUM(mp.quantity_produced), 0) as total
              FROM monthly_production mp
              JOIN products p ON mp.product_id::integer = p.id
              WHERE p.company_id = ${parseInt(companyId)}
              AND p.category_id = ${Number(product.category_id)}
              AND mp.fecha_imputacion = ${productionMonth}
            ` as any[];
            
            const totalCategoryProduction = Number(categoryProduction[0]?.total || 0);
            console.log(`📦 Producción total de la categoría: ${totalCategoryProduction.toLocaleString('es-AR')} unidades`);
            
            // PASO 5: Calcular costo por unidad de la categoría
            if (totalCategoryProduction > 0) {
              const costPerUnit = totalCategoryCosts / totalCategoryProduction;
              console.log(`💰 Costo por unidad de la categoría: $${costPerUnit.toFixed(2)}`);
              
              // PASO 6: Obtener producción de este producto específico
              const productProduction = productionData.find(p => {
                const match1 = p.product_id === product.id.toString();
                const match2 = p.product_id === product.id;
                const match3 = Number(p.product_id) === Number(product.id);
                return match1 || match2 || match3;
              });
              
              const productProd = productProduction ? Number(productProduction.quantity_produced) || 0 : 0;
              console.log(`📦 Producción de ${product.name}: ${productProd.toLocaleString('es-AR')} unidades`);
              
              // PASO 7: Calcular costo indirecto para este producto
              indirectCosts = costPerUnit * productProd;
              console.log(`✅ COSTO INDIRECTO FINAL: $${costPerUnit.toFixed(2)} × ${productProd.toLocaleString('es-AR')} = $${indirectCosts.toLocaleString('es-AR')}`);
            } else {
              console.log(`⚠️ No hay producción en la categoría para el mes ${productionMonth}`);
            }
            
          } catch (error) {
            console.error(`❌ Error en nuevo cálculo:`, error);
          }
        }
      
      const calculatedCost = materialsCost + indirectCosts + employeeCosts;
      
      // Obtener datos de producción y ventas del mes seleccionado
      let actualProduction = 0;
      let averageSalePrice = 0;
      let productionInfo = {
        source: 'planificada',
        actual_production: 0,
        planned_production: outputQuantity,
        production_month: null,
        batches_needed: 0,
        materials_cost_per_batch: calculatedCost
      };

      if (productionMonth && productionMonth !== 'planificada') {
        console.log(`🔍 Buscando datos para producto ID: ${product.id} (tipo: ${typeof product.id})`);
        
        // Buscar producción del mes para este producto
        const productProduction = productionData.find(p => {
          const match1 = p.product_id === product.id.toString();
          const match2 = p.product_id === product.id;
          const match3 = Number(p.product_id) === Number(product.id);
          console.log(`  📦 Comparando producción: ${p.product_id} (${typeof p.product_id}) vs ${product.id} (${typeof product.id}) - match1: ${match1}, match2: ${match2}, match3: ${match3}`);
          return match1 || match2 || match3;
        });
        
        if (productProduction) {
          actualProduction = Number(productProduction.quantity_produced) || 0;
          console.log(`📦 ✅ Encontrada producción para ${product.name}: ${actualProduction} unidades`);
          productionInfo = {
            source: 'real',
            actual_production: actualProduction,
            planned_production: outputQuantity,
            production_month: productionMonth,
            batches_needed: actualProduction > 0 ? Math.ceil(actualProduction / outputQuantity) : 0,
            materials_cost_per_batch: calculatedCost
          };
        } else {
          console.log(`📦 ❌ NO se encontró producción para ${product.name} (ID: ${product.id})`);
        }

        // Buscar ventas del mes para este producto
        const productSales = salesData.find(s => {
          const match1 = s.product_id === product.id.toString();
          const match2 = s.product_id === product.id;
          const match3 = Number(s.product_id) === Number(product.id);
          console.log(`  💰 Comparando ventas: ${s.product_id} (${typeof s.product_id}) vs ${product.id} (${typeof product.id}) - match1: ${match1}, match2: ${match2}, match3: ${match3}`);
          return match1 || match2 || match3;
        });
        
        if (productSales) {
          averageSalePrice = Number(productSales.unit_price) || 0;
          console.log(`💰 ✅ Encontradas ventas para ${product.name}: $${averageSalePrice}`);
        } else {
          console.log(`💰 ❌ NO se encontraron ventas para ${product.name} (ID: ${product.id})`);
        }
      }
      
      console.log(`📊 RESUMEN ${product.name}:`);
      console.log(`  - Materiales: $${materialsCost.toFixed(2)}`);
      console.log(`  - Indirectos: $${indirectCosts.toFixed(2)}`);
      console.log(`  - Empleados: $${employeeCosts.toFixed(2)}`);
      console.log(`  - TOTAL: $${calculatedCost.toFixed(2)}`);
      if (productionMonth && productionMonth !== 'planificada') {
        console.log(`  - Producción real: ${actualProduction}`);
        console.log(`  - Precio venta promedio: ${averageSalePrice.toFixed(2)}`);
      }

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
        materialsCost: materialsCost,
        indirectCosts: indirectCosts,
        employeeCosts: employeeCosts,
        // Campos adicionales que espera el componente
        recipe_id: recipeId,
        recipe_name: recipeName,
        output_quantity: outputQuantity,
        output_unit_label: outputUnitLabel,
        intermediate_quantity: 1,
        intermediate_unit_label: 'lotes',
        base_type: 'PER_BATCH', // Se puede mejorar después
        calculated_cost: calculatedCost,
        calculated_price: calculatedCost * 1.3, // Margen ejemplo del 30%
        units_per_item: 1,
        // Estructura de costos que espera el componente
        cost_breakdown: {
          materials: materialsCost,
          indirect_costs: indirectCosts,
          employee_costs: employeeCosts,
          total: calculatedCost
        },
        cost_breakdown_per_unit: {
          materials: materialsCost,
          indirect_costs: indirectCosts,
          employee_costs: employeeCosts,
          total: calculatedCost
        },
        recipe_details: recipeDetails,
        production_info: productionInfo,
        average_sale_price: averageSalePrice
      });
    }

    console.log(`\n✅ === PROCESAMIENTO COMPLETADO ===`);
    console.log(`Total productos procesados: ${productPrices.length}`);
    console.log(`Productos con receta: ${productPrices.filter(p => p.recipe_id).length}`);
    console.log(`Productos sin receta: ${productPrices.filter(p => !p.recipe_id).length}`);
    console.log(`Productos con costo cero: ${productPrices.filter(p => p.materialsCost === 0).length}`);

    console.log('✅ === ENDPOINT COMPLETADO EXITOSAMENTE ===');
    console.log('✅ Total productos procesados:', productPrices.length);
    console.log('✅ Productos con costos indirectos > 0:', productPrices.filter(p => p.indirectCosts > 0).length);
    console.log('✅ Productos con costos empleados > 0:', productPrices.filter(p => p.employeeCosts > 0).length);

    return NextResponse.json({
      productPrices,
      debug_info: {
        total_products: productPrices.length,
        products_with_recipe: productPrices.filter(p => p.recipe_id).length,
        products_without_recipe: productPrices.filter(p => !p.recipe_id).length,
        products_with_zero_cost: productPrices.filter(p => p.materialsCost === 0).length
      }
    });

  } catch (error) {
    console.error('❌ Error calculando precios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 }
    );
  }
}