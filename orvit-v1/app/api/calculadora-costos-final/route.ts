import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders, shouldDisableCache } from '@/lib/perf';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
// Para debugging temporal, cambiar a true
const DEBUG = false; // Desactivado para mejor rendimiento
const log = DEBUG ? console.log.bind(console) : () => {};
const warn = DEBUG ? console.warn.bind(console) : () => {};

// ============================================================================
// FUNCIONES PRINCIPALES: VENTAS, PRODUCCIÓN Y SIMULACIÓN
// ============================================================================

/**
 * Calcula costos para distribución por VENTAS
 */
async function calculateCostsForSales(companyId: number, productionMonth: string) {
  return await calculateCostsInternal(companyId, productionMonth, 'sales');
}

/**
 * Calcula costos para distribución por PRODUCCIÓN
 */
async function calculateCostsForProduction(companyId: number, productionMonth: string) {
  return await calculateCostsInternal(companyId, productionMonth, 'production');
}

/**
 * Calcula costos para SIMULACIÓN (usando cantidades proporcionadas)
 */
async function calculateCostsForSimulation(companyId: number, productionMonth: string, simulatedQuantities: { [productId: number]: number }) {
  return await calculateCostsInternal(companyId, productionMonth, 'simulation', simulatedQuantities);
}

/**
 * Función interna que contiene toda la lógica común
 */
async function calculateCostsInternal(
  companyId: number, 
  productionMonth: string, 
  distributionMethod: 'sales' | 'production' | 'simulation',
  simulatedQuantities?: { [productId: number]: number }
) {
  // Declarar dataSource en el scope de la función
  let dataSource = '';
  const targetMonth = productionMonth || '2025-08';
  const targetMonthDate = targetMonth + '-01';
  
  try {
    // ✅ OPTIMIZACIÓN: Ejecutar TODAS las queries iniciales en paralelo
    const [
      costosProducts,
      ventasProducts,
      costCategories,
      recipes,
      supplyPrices,
      recipeItems,
      salesData,
      productionData,
      indirectCostsBase,
      employeeCategories
    ] = await Promise.all([
      // 1. Productos de costos
      prisma.$queryRaw`
        SELECT p.id, p.name, p.description, p.sku, p.category_id, p.subcategory_id,
               p.unit_price, p.unit_cost, p.stock_quantity, pc.name as category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.company_id = ${companyId} AND p.is_active = true
        ORDER BY pc.name, p.name
      ` as Promise<any[]>,
      
      // 2. Productos de ventas
      prisma.$queryRaw`
        SELECT p.id, p.name, p.code, p.description, p."categoryId", p.unit,
               p."costPrice", p."minStock", p."currentStock", p.volume, p.weight,
               p.location, p."blocksPerM2", p."isActive", p."companyId", p."createdById",
               c.id as "category_id", c.name as "category_name"
        FROM "Product" p
        LEFT JOIN "Category" c ON p."categoryId" = c.id
        WHERE p."companyId" = ${companyId} AND p."isActive" = true
        ORDER BY p.name ASC
      ` as Promise<any[]>,
      
      // 3. Categorías de costos
      prisma.$queryRaw`SELECT id, name FROM product_categories WHERE company_id = ${companyId}` as Promise<any[]>,
      
      // 4. Recetas activas
      prisma.$queryRaw`
        SELECT r.id, r.name, r.product_id as "productId", r.subcategory_id as "subcategoryId",
               r.base_type as "baseType", r.output_quantity as "outputQuantity",
               r.output_unit_label as "outputUnitLabel", r.intermediate_quantity as "intermediateQuantity",
               r.intermediate_unit_label as "intermediateUnitLabel", r.units_per_item as "unitsPerItem",
               r.metros_utiles as "metrosUtiles", r.cantidad_pastones as "cantidadPastones"
        FROM recipes r WHERE r.company_id = ${companyId} AND r.is_active = true
      ` as Promise<any[]>,
      
      // 5. Precios de insumos
      prisma.$queryRaw`
        SELECT DISTINCT ON (supply_id) supply_id, price_per_unit, COALESCE(freight_cost, 0) as freight_cost
        FROM supply_monthly_prices WHERE company_id = ${companyId}
        ORDER BY supply_id, month_year DESC NULLS LAST
      ` as Promise<any[]>,
      
      // 6. Items de recetas (todos de una vez)
      prisma.$queryRaw`
        SELECT ri.recipe_id, ri.supply_id, ri.quantity, ri.unit_measure, ri.is_bank_ingredient
        FROM recipe_items ri
        INNER JOIN recipes r ON ri.recipe_id = r.id
        WHERE r.company_id = ${companyId} AND r.is_active = true
      ` as Promise<any[]>,
      
      // 7. Datos de ventas del mes (incluye precio promedio por producto)
      prisma.$queryRaw`
        SELECT product_id, product_name, quantity_sold, total_revenue, unit_price,
               AVG(unit_price) OVER (PARTITION BY product_id) as avg_price
        FROM monthly_sales WHERE company_id = ${companyId} AND fecha_imputacion = ${targetMonth}
      ` as Promise<any[]>,
      
      // 8. Datos de producción del mes
      prisma.$queryRaw`
        SELECT product_id, quantity_produced, fecha_imputacion as month
        FROM monthly_production WHERE company_id = ${companyId} AND fecha_imputacion = ${targetMonth}
      ` as Promise<any[]>,
      
      // 9. Costos indirectos base (usando la estructura correcta del schema)
      prisma.$queryRaw`
        SELECT icb.id, icb.name, icc.name as category, icb.description,
               COALESCE(icmr.amount, 0) as monthly_amount
        FROM indirect_cost_base icb
        LEFT JOIN indirect_cost_categories icc ON icb.category_id = icc.id
        LEFT JOIN indirect_cost_monthly_records icmr ON icb.id = icmr.cost_base_id 
          AND icmr.fecha_imputacion = ${targetMonth}
        WHERE icb.company_id = ${companyId}
      ` as Promise<any[]>,
      
      // 10. Categorías de empleados con salarios (usando employee_monthly_salaries que es más confiable)
      prisma.$queryRaw`
        SELECT ec.id, ec.name, COALESCE(SUM(ems.total_cost), 0) as total_salary
        FROM employee_categories ec
        LEFT JOIN employees e ON ec.id = e.category_id AND e.company_id = ${companyId} AND e.active = true
        LEFT JOIN employee_monthly_salaries ems ON e.id = ems.employee_id AND ems.fecha_imputacion = ${targetMonth}
        WHERE ec.company_id = ${companyId} AND ec.is_active = true
        GROUP BY ec.id, ec.name
      ` as Promise<any[]>
    ]);

    // Crear mapas para acceso rápido
    const costCategoriesMap = new Map((costCategories as any[]).map(c => [c.name.toLowerCase(), c.id]));

    // Transformar productos de ventas al formato de costos
    const transformedVentasProducts = ventasProducts.map(product => {
      let mappedCategoryId = 0;
      let mappedCategoryName = 'Sin categoría';

      if (product.category_name) {
        const categoryNameLower = product.category_name.toLowerCase();
        if (costCategoriesMap.has(categoryNameLower)) {
          mappedCategoryId = costCategoriesMap.get(categoryNameLower)!;
          mappedCategoryName = product.category_name;
        } else {
          // Fallback: buscar una categoría similar o la primera disponible
          const firstCostCategory = costCategories[0];
          if (firstCostCategory) {
            mappedCategoryId = firstCostCategory.id;
            mappedCategoryName = firstCostCategory.name;
          }
        }
      } else {
        // Si el producto de ventas no tiene categoría, usar la primera de costos
        const firstCostCategory = costCategories[0];
        if (firstCostCategory) {
          mappedCategoryId = firstCostCategory.id;
          mappedCategoryName = firstCostCategory.name;
        }
      }

      return {
        id: `ventas-${product.id}`, // Prefix para distinguir de productos de costos
        name: product.name,
        description: product.description || '',
        sku: product.code || '',
        category_id: mappedCategoryId,
        subcategory_id: null,
        unit_price: product.costPrice || 0,
        unit_cost: product.costPrice || 0,
        stock_quantity: product.currentStock || 0,
        category_name: mappedCategoryName
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

    // ✅ Las recetas y precios ya se obtuvieron en el Promise.all inicial
    // Crear mapa de precios de insumos
    const priceMap = new Map();
    (supplyPrices as any[]).forEach((price: any) => {
      const supplyId = Number(price.supply_id);
      const basePrice = Number(price.price_per_unit) || 0;
      const freightCost = Number(price.freight_cost) || 0;
      const totalPrice = basePrice + freightCost; // Incluir flete en el precio
      priceMap.set(supplyId, totalPrice);
    });

    // 4. PROCESAR PRODUCTOS CON CÁLCULO REAL
    const productPrices: Array<{
      id: number;
      product_name: string;
      product_description: string;
      sku: string;
      category_name: string;
      category_id: number;
      current_price: number;
      current_cost: number;
      stock_quantity: number;
      calculated_cost: number;
      calculated_price: number;
      average_sale_price: number;
      recipe_id: number | null;
      recipe_name: string | null;
      output_quantity: number;
      output_unit_label: string;
      intermediate_quantity: number;
      intermediate_unit_label: string;
      units_per_item: number;
      base_type: string;
      cost_breakdown: {
        materials: number;
        indirect_costs: number;
        employee_costs: number;
        total: number;
      };
      cost_breakdown_per_unit: {
        materials: number;
        indirect_costs: number;
        employee_costs: number;
        total: number;
      };
      recipe_details?: any[];
      indirect_costs_breakdown?: any[];
      employee_costs_breakdown?: any[];
      total_products_in_category?: number;
      total_production_in_category?: number;
      production_info?: {
        source: string;
        actual_production: number;
        planned_production: number;
        production_month: string | null;
        batches_needed: number;
        materials_cost_per_batch: number;
        category_total_production?: number;
        distribution_ratio?: number;
        distribution_method?: string;
      };
      distribution_info?: {
        method: string;
        data_source: string;
        product_quantity: number;
        category_total_quantity: number;
        distribution_ratio: number;
        percentage_of_category: number;
        has_real_data: boolean;
        category_total_cost: number;
        product_total_cost: number;
      };
    }> = [];

    for (const product of products) {
      let materialsCost = 0;
      let recipeId = null;
      let recipeName = null;
      let recipeDetails: any[] = [];

      // Extraer el ID numérico real si es un producto de ventas (formato: "ventas-123")
      const isVentasProduct = typeof product.id === 'string' && product.id.startsWith('ventas-');
      const numericProductId = isVentasProduct 
        ? parseInt(product.id.replace('ventas-', ''), 10) 
        : Number(product.id);

      try {
        // Buscar receta para el producto (solo para productos de costos, no de ventas)
        let selectedRecipe = null;
        if (!isVentasProduct) {
          // Intentar coincidencia exacta (product_id puede ser String o Int en la BD)
          selectedRecipe = recipes.find((r: any) => {
            if (!r.productId) return false;
            // Comparar como strings para manejar casos donde uno es String y otro Int
            const recipeProductId = String(r.productId).trim();
            const productIdStr = String(product.id).trim();
            return recipeProductId === productIdStr;
          });
        }
        
        // Si no se encuentra receta directa y es vigueta, buscar por subcategoría (solo para productos de costos)
        if (!selectedRecipe && !isVentasProduct &&
            product.category_name && 
            product.category_name.toLowerCase().includes('vigueta') && 
            product.subcategory_id) {
          selectedRecipe = recipes.find((r: any) => {
            if (!r.subcategoryId) return false;
            return Number(r.subcategoryId) === Number(product.subcategory_id);
          });
          
        }

        if (selectedRecipe) {
          recipeId = selectedRecipe.id;
          recipeName = selectedRecipe.name;
          
          // ✅ OPTIMIZADO: Usar ingredientes del Promise.all en lugar de query individual
          const ingredients = (recipeItems as any[]).filter(ri => ri.recipe_id === selectedRecipe.id);

          // Calcular costo de materiales
          let costoPorPaston = 0;
          let costoBanco = 0;
          const baseType = selectedRecipe.baseType || 'standard';
          const cantidadPastones = Number(selectedRecipe.cantidadPastones) || 0;
          
          recipeDetails = ingredients.map((ingredient: any) => {
            const supplyId = Number(ingredient.supply_id);
            const quantity = Number(ingredient.quantity) || 0;
            const unitPrice = priceMap.get(supplyId) || 0;
            const totalCost = quantity * unitPrice;
            const isBankIngredient = ingredient.is_bank_ingredient === true;
            
            if (isBankIngredient) {
              costoBanco += totalCost;
            } else {
              costoPorPaston += totalCost;
            }
            
            return {
              supply_name: ingredient.supply_name,
              quantity: quantity,
              unit_measure: ingredient.unit_measure,
              unit_price: unitPrice,
              total_cost: totalCost,
              is_bank_ingredient: isBankIngredient
            };
          });

          // Calcular costo total según el tipo de receta
          let recipeTotalCost = 0;
          const outputQuantity = Number(selectedRecipe.outputQuantity) || 1;
          
          if (baseType === 'PER_BANK' && cantidadPastones > 0) {
            // Para recetas "Por Banco": (costoPorPaston × cantidadPastones) + costoBanco
            const costoRecetaMultiplicado = costoPorPaston * cantidadPastones;
            recipeTotalCost = costoRecetaMultiplicado + costoBanco;
          } else {
            // Para recetas estándar: suma de todos los ingredientes
            recipeTotalCost = costoPorPaston + costoBanco;
          }
          
          // Calcular costo por unidad
          // Para viguetas, calcular por metros usando la misma lógica del módulo de recetas
          if (product.category_name && product.category_name.toLowerCase().includes('vigueta')) {
            const metrosMatch = product.name.match(/(\d+\.?\d*)\s*mts?/i);
            const metros = metrosMatch ? parseFloat(metrosMatch[1]) : 0;
            const metrosUtiles = Number(selectedRecipe.metrosUtiles) || 1;
            
            if (metros > 0 && metrosUtiles > 0) {
              // Calcular costo por metro según el tipo de receta (igual que en el módulo de recetas)
              let costPerMeter = 0;
              if (baseType === 'PER_BANK' && cantidadPastones > 0) {
                // Para recetas "Por Banco": (costo_receta × pastones + costo_banco) ÷ metros_útiles
                const totalCost = (costoPorPaston * cantidadPastones) + costoBanco;
                costPerMeter = totalCost / metrosUtiles;
              } else {
                // Para recetas normales: (costo_receta + costo_banco) ÷ metros_útiles
                const totalCost = costoPorPaston + costoBanco;
                costPerMeter = totalCost / metrosUtiles;
              }
              materialsCost = metros * costPerMeter;
            } else {
          materialsCost = recipeTotalCost / outputQuantity;
            }
          } else {
            // Para productos normales, dividir el costo del lote entre las unidades producidas
            materialsCost = recipeTotalCost / outputQuantity;
          }
          
          log(`📦 ${product.name} - RESUMEN Costo materiales:`);
          log(`   - Total receta: $${recipeTotalCost.toFixed(2)}`);
          log(`   - Cantidad de salida (outputQuantity): ${outputQuantity}`);
          log(`   - Costo por unidad: $${materialsCost.toFixed(2)}`);
          
          if (recipeTotalCost === 0 && ingredients.length > 0) {
            warn(`⚠️ ${product.name}: Receta tiene ${ingredients.length} ingredientes pero costo total es $0 - Verificar precios en supply_monthly_prices`);
          }
        } else {
          // Sin receta, usar unit_cost
          materialsCost = Number(product.unit_cost) || 0;
        }
      } catch (error) {
        console.error(`Error calculando ${product.name}:`, error);
        materialsCost = Number(product.unit_cost) || 0;
      }

      // ✅ OPTIMIZADO: Obtener precio de venta promedio del mapa (ya cargado en Promise.all)
      let averageSalePrice = 0;
      const productIdStr = product.id.toString();
      const saleRecord = (salesData as any[]).find(s => s.product_id?.toString() === productIdStr);
      if (saleRecord && saleRecord.avg_price) {
        averageSalePrice = Number(saleRecord.avg_price);
      }

      // Re-buscar la receta para obtener todos los campos (solo para productos de costos)
      const selectedRecipe = !isVentasProduct 
        ? recipes.find((r: any) => 
            r.productId && r.productId.toString() === product.id.toString()
          )
        : null;

      const employeeCosts = 0; // Por implementar
      // Los costos indirectos se calcularán después para todos los productos
      const totalCost = materialsCost + employeeCosts;

      productPrices.push({
        id: numericProductId,
        product_name: product.name,
        product_description: product.description || '',
        sku: product.sku || '',
        category_name: product.category_name || 'Sin categoría',
        category_id: Number(product.category_id),
        current_price: Number(product.unit_price) || 0,
        current_cost: Number(product.unit_cost) || 0,
        stock_quantity: Number(product.stock_quantity) || 0,
        calculated_cost: totalCost,
        calculated_price: totalCost * 1.3, // Margen del 30%
        average_sale_price: averageSalePrice,
        recipe_id: recipeId ? Number(recipeId) : null,
        recipe_name: recipeName,
        output_quantity: selectedRecipe ? Number(selectedRecipe.outputQuantity) || 1 : 1,
        output_unit_label: selectedRecipe ? selectedRecipe.outputUnitLabel || 'unidades' : 'unidades',
        intermediate_quantity: selectedRecipe ? Number(selectedRecipe.intermediateQuantity) || 1 : 1,
        intermediate_unit_label: selectedRecipe ? selectedRecipe.intermediateUnitLabel || 'placas' : 'placas',
        units_per_item: selectedRecipe ? Number(selectedRecipe.unitsPerItem) || 1 : 1,
        base_type: selectedRecipe ? selectedRecipe.baseType || 'standard' : 'standard',
        cost_breakdown: {
          materials: materialsCost,
          indirect_costs: 0, // Se calculará después
          employee_costs: employeeCosts,
          total: totalCost
        },
        cost_breakdown_per_unit: {
          materials: materialsCost,
          indirect_costs: 0, // Se calculará después
          employee_costs: employeeCosts,
          total: totalCost
        },
        recipe_details: recipeDetails,
        indirect_costs_breakdown: [] as any[],
        employee_costs_breakdown: [],
        total_products_in_category: 1,
        total_production_in_category: 0,
        production_info: {
          source: 'planificada',
          actual_production: 0,
          planned_production: 0,
          production_month: productionMonth,
          batches_needed: 0,
          materials_cost_per_batch: materialsCost
        }
      });
    }

    log('✅ Productos procesados:', productPrices.length);

    // ============================================================================
    // 4. OBTENER DATOS DE DISTRIBUCIÓN SEGÚN EL MÉTODO (ANTES DE CALCULAR COSTOS)
    // ============================================================================
    let distributionData: { [productId: number]: number } = {};
    
    if (distributionMethod === 'simulation' && simulatedQuantities) {
      // ===== SIMULACIÓN =====
      log('🎮 Usando datos de SIMULACIÓN');
      distributionData = { ...simulatedQuantities };
      dataSource = 'simulación';
      log('🎮 Datos de simulación cargados:', Object.keys(distributionData).length, 'productos');
      
    } else if (distributionMethod === 'sales') {
      // ===== VENTAS =====
      log('💰 Obteniendo datos de VENTAS para mes:', productionMonth);
      
      const salesRecords = await prisma.$queryRaw`
        SELECT 
          product_id,
          SUM(quantity_sold) as total_sales
        FROM monthly_sales
        WHERE company_id = ${companyId}
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
        GROUP BY product_id
      ` as any[];

      salesRecords.forEach((record: any) => {
        const productIdNum = Number(record.product_id);
        if (!isNaN(productIdNum)) {
          distributionData[productIdNum] = (distributionData[productIdNum] || 0) + Number(record.total_sales) || 0;
        }
      });

      dataSource = 'ventas';
      log('💰 Datos de ventas encontrados:', Object.keys(distributionData).length, 'productos');
      
    } else if (distributionMethod === 'production') {
      // ===== PRODUCCIÓN =====
      log('🏭 Obteniendo datos de PRODUCCIÓN para mes:', productionMonth);
      
      if (!productionMonth) {
        warn('⚠️ productionMonth es requerido para production');
        dataSource = 'sin_datos';
      } else {
        const productionRecords = await prisma.$queryRaw`
          SELECT 
            product_id,
            SUM(quantity_produced) as total_quantity
          FROM monthly_production
          WHERE company_id = ${companyId}
          AND fecha_imputacion = ${productionMonth}
          GROUP BY product_id
        ` as any[];
        
        productionRecords.forEach((record: any) => {
          distributionData[Number(record.product_id)] = Number(record.total_quantity) || 0;
        });

        dataSource = Object.keys(distributionData).length > 0 ? 'producción' : 'sin_datos';
        log('🏭 Datos de producción encontrados:', Object.keys(distributionData).length, 'productos');
      }
    }

    // CALCULAR COSTOS INDIRECTOS Y DE EMPLEADOS PARA TODOS LOS PRODUCTOS
    // Pasar distributionData para evitar recalcularlo
    const indirectCostsData = await calculateIndirectCosts(companyId, productionMonth || '2025-08', productPrices, distributionMethod, distributionData);
    const employeeCostsData = await calculateEmployeeCosts(companyId, productionMonth || '2025-08', productPrices, distributionMethod, distributionData);
    
    log('📊 RESULTADOS DE CÁLCULOS:');
    log(`   - Costos indirectos calculados para ${indirectCostsData.length} productos`);
    log(`   - Costos empleados calculados para ${employeeCostsData.length} productos`);
    
    // Buscar costos para bloques específicos
    const p13Indirect = indirectCostsData.find(ic => {
      const product = productPrices.find(p => p.product_name.includes('Bloque P13') && !p.product_name.includes('SP'));
      return product && Number(ic.productId) === Number(product.id);
    });
    const p13Employee = employeeCostsData.find(ec => {
      const product = productPrices.find(p => p.product_name.includes('Bloque P13') && !p.product_name.includes('SP'));
      return product && Number(ec.productId) === Number(product.id);
    });
    const p20PortanteIndirect = indirectCostsData.find(ic => {
      const product = productPrices.find(p => p.product_name.includes('Bloque P20 Portante'));
      return product && Number(ic.productId) === Number(product.id);
    });
    const p20PortanteEmployee = employeeCostsData.find(ec => {
      const product = productPrices.find(p => p.product_name.includes('Bloque P20 Portante'));
      return product && Number(ec.productId) === Number(product.id);
    });
    
    if (p13Indirect) {
      const p13Product = productPrices.find(p => p.product_name.includes('Bloque P13') && !p.product_name.includes('SP'));
      log(`🔍 BLOQUE P13 - Costos calculados:`);
      log(`   - Product ID: ${p13Product?.id} (tipo: ${typeof p13Product?.id})`);
      log(`   - indirectData.productId: ${p13Indirect.productId} (tipo: ${typeof p13Indirect.productId})`);
      log(`   - indirectCost: $${p13Indirect.indirectCost}`);
      if ('distributionInfo' in p13Indirect && p13Indirect.distributionInfo) {
        log(`   - distributionInfo: ${JSON.stringify(p13Indirect.distributionInfo)}`);
      }
    }
    if (p13Employee) {
      log(`   - employeeCost: $${p13Employee.employeeCost}`);
      if ('distributionInfo' in p13Employee && p13Employee.distributionInfo) {
        log(`   - distributionInfo: ${JSON.stringify(p13Employee.distributionInfo)}`);
      }
    }
    
    if (p20PortanteIndirect) {
      const p20Product = productPrices.find(p => p.product_name.includes('Bloque P20 Portante'));
      log(`🔍 BLOQUE P20 PORTANTE - Costos calculados:`);
      log(`   - Product ID: ${p20Product?.id} (tipo: ${typeof p20Product?.id})`);
      log(`   - indirectData.productId: ${p20PortanteIndirect.productId} (tipo: ${typeof p20PortanteIndirect.productId})`);
      log(`   - indirectCost: $${p20PortanteIndirect.indirectCost}`);
      if ('distributionInfo' in p20PortanteIndirect && p20PortanteIndirect.distributionInfo) {
        log(`   - distributionInfo: ${JSON.stringify(p20PortanteIndirect.distributionInfo)}`);
      }
    }
    if (p20PortanteEmployee) {
      log(`   - employeeCost: $${p20PortanteEmployee.employeeCost}`);
      if ('distributionInfo' in p20PortanteEmployee && p20PortanteEmployee.distributionInfo) {
        log(`   - distributionInfo: ${JSON.stringify(p20PortanteEmployee.distributionInfo)}`);
      }
    }
    
    log(`   - Ejemplo indirectCostsData (primeros 3):`, indirectCostsData.slice(0, 3).map(ic => ({
      productId: ic.productId,
      productIdType: typeof ic.productId,
      indirectCost: ic.indirectCost
    })));
    log(`   - Ejemplo employeeCostsData (primeros 3):`, employeeCostsData.slice(0, 3).map(ec => ({
      productId: ec.productId,
      productIdType: typeof ec.productId,
      employeeCost: ec.employeeCost
    })));
    
    // Calcular totales para el summary
    const totalIndirectCosts = indirectCostsData.reduce((sum, item) => sum + (item.indirectCost || 0), 0);
    const totalEmployeeCosts = employeeCostsData.reduce((sum, item) => sum + (item.employeeCost || 0), 0);
    
    log(`   - Total costos indirectos: $${totalIndirectCosts.toFixed(2)}`);
    log(`   - Total costos empleados: $${totalEmployeeCosts.toFixed(2)}`);
    
    // Actualizar productos con costos indirectos y de empleados
    log(`🔍 DEBUG: Total indirectCostsData: ${indirectCostsData.length}, Total employeeCostsData: ${employeeCostsData.length}`);
    log(`🔍 DEBUG: Primeros 3 indirectCostsData:`, indirectCostsData.slice(0, 3).map(ic => ({ productId: ic.productId, indirectCost: ic.indirectCost })));
    log(`🔍 DEBUG: Primeros 3 employeeCostsData:`, employeeCostsData.slice(0, 3).map(ec => ({ productId: ec.productId, employeeCost: ec.employeeCost })));
    
    productPrices.forEach((product, index) => {
      // Buscar por ID, asegurando que ambos sean números para comparación
      const productIdNum = Number(product.id);
      const indirectData = indirectCostsData.find(ic => {
        const icIdNum = Number(ic.productId);
        return icIdNum === productIdNum;
      });
      const employeeData = employeeCostsData.find(ec => {
        const ecIdNum = Number(ec.productId);
        return ecIdNum === productIdNum;
      });
      
      // Log detallado para los primeros 5 productos y bloques específicos
      if (index < 5 || product.product_name.includes('Bloque P13') || product.product_name.includes('Bloque P20 Portante')) {
        log(`🔍 DEBUG BÚSQUEDA - ${product.product_name} (ID: ${product.id}, tipo: ${typeof product.id}, productIdNum: ${productIdNum}):`);
        log(`   - indirectData encontrado: ${!!indirectData}`);
        if (indirectData) {
          log(`   - indirectData.productId: ${indirectData.productId} (tipo: ${typeof indirectData.productId})`);
          log(`   - indirectData.indirectCost: $${indirectData.indirectCost}`);
        } else {
          // Buscar en indirectCostsData para ver qué hay
          const matching = indirectCostsData.filter(ic => {
            const icIdNum = Number(ic.productId);
            return icIdNum === productIdNum;
          });
          log(`   - ⚠️ No se encontró indirectData. Coincidencias encontradas: ${matching.length}`);
          if (matching.length === 0) {
            // Buscar productos similares
            const similar = indirectCostsData.slice(0, 5).map(ic => ({ productId: ic.productId, indirectCost: ic.indirectCost }));
            log(`   - Ejemplos de indirectCostsData:`, similar);
          }
        }
        log(`   - employeeData encontrado: ${!!employeeData}`);
        if (employeeData) {
          log(`   - employeeData.productId: ${employeeData.productId} (tipo: ${typeof employeeData.productId})`);
          log(`   - employeeData.employeeCost: $${employeeData.employeeCost}`);
        } else {
          // Buscar en employeeCostsData para ver qué hay
          const matching = employeeCostsData.filter(ec => {
            const ecIdNum = Number(ec.productId);
            return ecIdNum === productIdNum;
          });
          log(`   - ⚠️ No se encontró employeeData. Coincidencias encontradas: ${matching.length}`);
          if (matching.length === 0) {
            // Buscar productos similares
            const similar = employeeCostsData.slice(0, 5).map(ec => ({ productId: ec.productId, employeeCost: ec.employeeCost }));
            log(`   - Ejemplos de employeeCostsData:`, similar);
          }
        }
      }
      
      const indirectCost = indirectData ? (indirectData.indirectCost || 0) : 0;
      const employeeCost = employeeData ? (employeeData.employeeCost || 0) : 0;
      
      // Log detallado para bloques específicos
      if (product.product_name.includes('Bloque P13') || product.product_name.includes('Bloque P20 Portante')) {
        log(`🔍 ASIGNANDO COSTOS - ${product.product_name} (ID: ${product.id}, tipo: ${typeof product.id}):`);
        log(`   - indirectData encontrado: ${!!indirectData}`);
        if (indirectData) {
          log(`   - indirectData.productId: ${indirectData.productId} (tipo: ${typeof indirectData.productId})`);
          log(`   - indirectData.indirectCost: $${indirectData.indirectCost}`);
        }
        log(`   - employeeData encontrado: ${!!employeeData}`);
        if (employeeData) {
          log(`   - employeeData.productId: ${employeeData.productId} (tipo: ${typeof employeeData.productId})`);
          log(`   - employeeData.employeeCost: $${employeeData.employeeCost}`);
        }
        log(`   - indirectCost asignado: $${indirectCost}`);
        log(`   - employeeCost asignado: $${employeeCost}`);
      }
      
      if (indirectCost > 0 || employeeCost > 0) {
        log(`💰 ${product.product_name}: Ind=$${indirectCost.toFixed(2)}, Emp=$${employeeCost.toFixed(2)}`);
      }
      
      // Asignar costos
      product.cost_breakdown.indirect_costs = indirectCost;
      product.cost_breakdown.employee_costs = employeeCost;
      product.cost_breakdown.total = product.cost_breakdown.materials + indirectCost + employeeCost;
      
      product.cost_breakdown_per_unit.indirect_costs = indirectCost;
      product.cost_breakdown_per_unit.employee_costs = employeeCost;
      product.cost_breakdown_per_unit.total = product.cost_breakdown_per_unit.materials + indirectCost + employeeCost;
      
      // Log de verificación para bloques específicos después de asignar
      if (product.product_name.includes('Bloque P13') || product.product_name.includes('Bloque P20 Portante')) {
        log(`✅ VERIFICACIÓN POST-ASIGNACIÓN - ${product.product_name}:`);
        log(`   - product.cost_breakdown.indirect_costs: $${product.cost_breakdown.indirect_costs}`);
        log(`   - product.cost_breakdown.employee_costs: $${product.cost_breakdown.employee_costs}`);
        log(`   - product.cost_breakdown.total: $${product.cost_breakdown.total}`);
      }
      
      product.calculated_cost = product.cost_breakdown.total;
      product.calculated_price = product.calculated_cost * 1.3; // Margen del 30%
      
      product.indirect_costs_breakdown = indirectData ? indirectData.breakdown : [];
      product.employee_costs_breakdown = employeeData ? employeeData.breakdown : [];
      
      // Agregar información de distribución
      if (indirectData && 'distributionInfo' in indirectData && indirectData.distributionInfo && product.production_info) {
        product.production_info.planned_production = indirectData.distributionInfo.product_quantity;
        product.production_info.category_total_production = indirectData.distributionInfo.category_total_quantity;
        product.production_info.distribution_ratio = indirectData.distributionInfo.distribution_ratio;
        product.production_info.source = indirectData.distributionInfo.has_real_data ? 
          `${indirectData.distributionInfo.data_source}_reales` : 'equitativa';
        product.production_info.distribution_method = distributionMethod;
        
        // Agregar distribution_info para el componente ProductCostCard
        product.distribution_info = {
          method: distributionMethod,
          data_source: indirectData.distributionInfo.data_source,
          product_quantity: indirectData.distributionInfo.product_quantity,
          category_total_quantity: indirectData.distributionInfo.category_total_quantity,
          distribution_ratio: indirectData.distributionInfo.distribution_ratio,
          percentage_of_category: indirectData.distributionInfo.percentage_of_category,
          has_real_data: indirectData.distributionInfo.has_real_data,
          category_total_cost: indirectData.distributionInfo.category_total_cost,
          product_total_cost: indirectData.distributionInfo.product_total_cost
        };
      } else {
        // Si no hay datos de distribución, crear uno vacío
        product.distribution_info = {
          method: distributionMethod,
          data_source: 'sin_datos',
          product_quantity: 0,
          category_total_quantity: 0,
          distribution_ratio: 0,
          percentage_of_category: 0,
          has_real_data: false,
          category_total_cost: 0,
          product_total_cost: 0
        };
      }
    });

    const productsWithRecipe = productPrices.filter(p => p.recipe_id !== null).length;
    const productsWithZeroCost = productPrices.filter(p => p.calculated_cost === 0).length;

    log('📈 ESTADÍSTICAS:');
    log(`  - Productos con receta: ${productsWithRecipe}`);
    log(`  - Productos sin receta: ${productPrices.length - productsWithRecipe}`);
    log(`  - Productos con costo $0: ${productsWithZeroCost}`);
    log(`  - Total costos indirectos: ${totalIndirectCosts}`);
    log(`  - Total costos empleados: ${totalEmployeeCosts}`);

    // Calcular totales por categoría para el summary
    // VIGUETAS: unidades y metros
    let totalMetersViguetasSummary = 0;
    let totalUnitsViguetasSummary = 0;
    const viguetaProductsSummary = productPrices.filter(p => {
      const nameLower = (p.product_name || '').toLowerCase();
      const categoryLower = (p.category_name || '').toLowerCase();
      return nameLower.includes('vigueta') || categoryLower.includes('vigueta');
    });
    
    viguetaProductsSummary.forEach(vigueta => {
      const indirectData = indirectCostsData.find(ic => Number(ic.productId) === Number(vigueta.id));
      const unitsSold = (indirectData && 'distributionInfo' in indirectData && indirectData.distributionInfo) 
        ? indirectData.distributionInfo.product_quantity || 0 
        : 0;
      totalUnitsViguetasSummary += unitsSold;
      
      const metrosMatch = vigueta.product_name.match(/(\d+\.?\d*)\s*mts?/i);
      const metros = metrosMatch ? parseFloat(metrosMatch[1]) : 0;
      
      if (metros > 0 && unitsSold > 0) {
        totalMetersViguetasSummary += metros * unitsSold;
      }
    });

    // BLOQUES: unidades vendidas
    let totalUnitsBloquesSummary = 0;
    const bloqueProductsSummary = productPrices.filter(p => {
      const nameLower = (p.product_name || '').toLowerCase();
      const categoryLower = (p.category_name || '').toLowerCase();
      return (nameLower.includes('bloque') || categoryLower.includes('bloque')) && 
             !nameLower.includes('adoquin');
    });
    
    bloqueProductsSummary.forEach(bloque => {
      const indirectData = indirectCostsData.find(ic => Number(ic.productId) === Number(bloque.id));
      const unitsSold = (indirectData && 'distributionInfo' in indirectData && indirectData.distributionInfo) 
        ? indirectData.distributionInfo.product_quantity || 0 
        : 0;
      totalUnitsBloquesSummary += unitsSold;
    });

    // ADOQUINES: unidades y metros cuadrados
    let totalUnitsAdoquinesSummary = 0;
    let totalM2AdoquinesSummary = 0;
    const adoquinProductsSummary = productPrices.filter(p => {
      const nameLower = (p.product_name || '').toLowerCase();
      const categoryLower = (p.category_name || '').toLowerCase();
      return nameLower.includes('adoquin') || categoryLower.includes('adoquin');
    });
    
    adoquinProductsSummary.forEach(adoquin => {
      const indirectData = indirectCostsData.find(ic => Number(ic.productId) === Number(adoquin.id));
      const unitsSold = (indirectData && 'distributionInfo' in indirectData && indirectData.distributionInfo) 
        ? indirectData.distributionInfo.product_quantity || 0 
        : 0;
      totalUnitsAdoquinesSummary += unitsSold;
      
      // Extraer metros cuadrados del nombre del producto o calcular
      // Buscar patrones como "m2", "m²", "metros cuadrados"
      const m2Match = adoquin.product_name.match(/(\d+\.?\d*)\s*m[²2]/i);
      let m2 = m2Match ? parseFloat(m2Match[1]) : 0;
      
      // Si no se encontró m² en el nombre, calcular basándose en unidades por m²
      if (m2 === 0 && unitsSold > 0) {
        // Determinar unidades por m² según el tipo de adoquín
        let unidadesPorM2 = 39.5; // Holanda por defecto
        const nameLower = adoquin.product_name.toLowerCase();
        if (nameLower.includes('holanda')) {
          unidadesPorM2 = 39.5;
        } else if (nameLower.includes('unistone')) {
          unidadesPorM2 = 41.35;
        }
        // Calcular m² totales: unidades / unidades por m²
        m2 = unitsSold / unidadesPorM2;
      }
      
      if (m2 > 0) {
        totalM2AdoquinesSummary += m2;
      }
    });

    // Retornar objeto JavaScript (no NextResponse, eso lo hace el GET)
    return {
      productPrices: productPrices,
      summary: {
        total_products: productPrices.length,
        total_indirect_costs: totalIndirectCosts,
        total_employee_costs: totalEmployeeCosts,
        distribution_method: distributionMethod,
        data_source: dataSource || (distributionMethod === 'production' ? 'producción' : distributionMethod === 'simulation' ? 'simulación' : 'ventas'),
        viguetas: {
          total_units_sold: totalUnitsViguetasSummary,
          total_meters_sold: totalMetersViguetasSummary
        },
        bloques: {
          total_units_sold: totalUnitsBloquesSummary
        },
        adoquines: {
          total_units_sold: totalUnitsAdoquinesSummary,
          total_m2_sold: totalM2AdoquinesSummary
        }
      },
      debug_info: {
        total_products: productPrices.length,
        products_with_recipe: productsWithRecipe,
        products_without_recipe: productPrices.length - productsWithRecipe,
        products_with_zero_cost: productsWithZeroCost,
        total_recipes: recipes.length,
        total_supplies: supplyPrices.length,
        version: 'costos-final'
      }
    };

  } catch (error) {
    console.error('❌ Error en calculadora costos final:', error);
    throw error; // Lanzar el error para que lo maneje el GET
  }
}

// ============================================================================
// ENDPOINT GET PRINCIPAL
// ============================================================================

export async function GET(request: NextRequest) {
  const perfCtx = startPerf();
  
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const productionMonth = searchParams.get('productionMonth') || '2025-08';
    const distributionMethod = searchParams.get('distributionMethod') || 'sales';
    
    endParse(perfCtx);

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    startDb(perfCtx);
    let result;
    
    // Enrutar según el método de distribución
    // Nota: Las queries DB están dentro de estas funciones, así que medimos el tiempo total
    if (distributionMethod === 'sales') {
      result = await calculateCostsForSales(parseInt(companyId), productionMonth);
    } else if (distributionMethod === 'production') {
      result = await calculateCostsForProduction(parseInt(companyId), productionMonth);
    } else {
      return NextResponse.json(
        { error: `Método de distribución no válido: ${distributionMethod}. Use 'sales' o 'production'` },
        { status: 400 }
      );
    }
    // El tiempo DB incluye queries + compute dentro de calculateCostsFor*
    // Para separar mejor, habría que instrumentar internamente, pero por ahora agrupamos
    endDb(perfCtx);
    startCompute(perfCtx);
    // Cualquier transformación final adicional aquí
    endCompute(perfCtx);

    startJson(perfCtx);
    const response = NextResponse.json(result, {
      headers: {
        'Cache-Control': shouldDisableCache(searchParams) 
          ? 'no-cache, no-store, must-revalidate'
          : 'private, max-age=60',
      }
    });
    const metrics = endJson(perfCtx, result);
    return withPerfHeaders(response, metrics, searchParams);

  } catch (error) {
    console.error('❌ Error en GET calculadora costos final:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log detallado para debugging
    console.error('❌ Detalles del error:', {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: errorMessage,
        // Solo incluir stack en desarrollo
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
  // Nota: No desconectar prisma aquí para evitar problemas con conexiones concurrentes
  // Prisma maneja el pool de conexiones automáticamente
}

// Función para calcular costos de empleados por categoría
async function calculateEmployeeCosts(
  companyId: number, 
  productionMonth: string, 
  productPrices: any[], 
  distributionMethod: string = 'sales',
  providedDistributionData?: { [productId: number]: number }
) {
  try {
    log('👥 Calculando costos de empleados para mes:', productionMonth);

    // 1. Obtener salarios mensuales por categoría de empleados
    // Primero intentar con employee_monthly_salaries, si no hay datos usar employee_salary_history
    let employeeSalaries = await prisma.$queryRaw`
      SELECT 
        ec.id as category_id,
        ec.name as category_name,
        COALESCE(SUM(ems.total_cost), 0) as total_salary
      FROM employee_categories ec
      INNER JOIN employees e ON ec.id = e.category_id AND e.company_id = ${companyId} AND e.active = true
      LEFT JOIN employee_monthly_salaries ems ON e.id = ems.employee_id AND ems.fecha_imputacion = ${productionMonth}
      WHERE ec.company_id = ${companyId} AND ec.is_active = true
      GROUP BY ec.id, ec.name
      ORDER BY ec.name ASC
    ` as any[];

    // Verificar si todos los salarios son 0, si es así usar employee_salary_history como fallback
    const totalSalariesFromMonthly = (employeeSalaries as any[]).reduce((sum, s) => sum + Number(s.total_salary), 0);
    
    if (totalSalariesFromMonthly === 0) {
      console.log('⚠️ No hay salarios en employee_monthly_salaries, usando employee_salary_history como fallback');
      employeeSalaries = await prisma.$queryRaw`
        SELECT 
          ec.id as category_id,
          ec.name as category_name,
          COALESCE(SUM(esh.gross_salary + COALESCE(esh.payroll_taxes, 0)), 0) as total_salary
        FROM employee_categories ec
        INNER JOIN employees e ON ec.id = e.category_id AND e.company_id = ${companyId} AND e.active = true
        LEFT JOIN employee_salary_history esh ON e.id = esh.employee_id 
          AND esh.effective_from = (
            SELECT MAX(esh2.effective_from) 
            FROM employee_salary_history esh2 
            WHERE esh2.employee_id = e.id
          )
        WHERE ec.company_id = ${companyId} AND ec.is_active = true
        GROUP BY ec.id, ec.name
        ORDER BY ec.name ASC
      ` as any[];
      console.log('✅ Salarios desde employee_salary_history:', JSON.stringify(employeeSalaries.slice(0, 3)));
    }

    log('💰 Salarios por categoría de empleados:', employeeSalaries.length);

    if (employeeSalaries.length === 0) {
      log('⚠️ No hay datos de empleados, devolviendo costos en 0');
      return productPrices.map(product => ({
        productId: product.id,
        employeeCost: 0,
        totalEmployeeCost: 0,
        breakdown: [],
        distributionInfo: {
          product_quantity: 0,
          category_total_quantity: 0,
          distribution_ratio: 0,
          data_source: 'sin_datos',
          category_total_cost: 0,
          product_total_cost: 0
        }
      }));
    }

    // 2. Obtener configuración de distribución de empleados por categorías de productos
    // NOTA: La tabla correcta es employee_cost_distribution (no employee_distribution_config)
    const employeeDistribution = await prisma.$queryRaw`
      SELECT 
        ecd.employee_category_id,
        ecd.product_category_id,
        ecd.percentage,
        ec.name as employee_category_name,
        pc.name as product_category_name
      FROM employee_cost_distribution ecd
      LEFT JOIN employee_categories ec ON ecd.employee_category_id = ec.id
      LEFT JOIN product_categories pc ON ecd.product_category_id = pc.id
      WHERE ecd.company_id = ${companyId} AND ecd.is_active = true
      ORDER BY ec.name, pc.name
    ` as any[];

    // DEBUG FORZADO - siempre mostrar
    console.log('🎯🎯🎯 DEBUG EMPLEADOS - Distribución encontrada:', employeeDistribution.length);
    console.log('🎯🎯🎯 DEBUG EMPLEADOS - Salarios encontrados:', employeeSalaries.length);
    console.log('🎯🎯🎯 DEBUG EMPLEADOS - Primeros salarios:', JSON.stringify(employeeSalaries.slice(0, 3)));
    console.log('🎯🎯🎯 DEBUG EMPLEADOS - Primera distribución:', JSON.stringify(employeeDistribution.slice(0, 3)));
    
    log('🎯 Distribución de empleados:', employeeDistribution.length);

    // 3. Calcular costos por categoría de productos
    const employeeCostsByCategory: { [categoryId: number]: number } = {};
    const employeeBreakdownByCategory: { [categoryId: number]: any[] } = {};

    // Agrupar por categoría de producto
    const categoriesMap: { [categoryId: number]: any[] } = {};
    employeeDistribution.forEach((dist: any) => {
      if (!categoriesMap[dist.product_category_id]) {
        categoriesMap[dist.product_category_id] = [];
      }
      categoriesMap[dist.product_category_id].push(dist);
    });

    // Calcular costos para cada categoría de producto
    Object.keys(categoriesMap).forEach(categoryIdStr => {
      const categoryId = parseInt(categoryIdStr);
      const categoryDistributions = categoriesMap[categoryId];
      let totalCategoryEmployeeCost = 0;
      const breakdown: any[] = [];

      categoryDistributions.forEach((dist: any) => {
        const employeeSalary = employeeSalaries.find((salary: any) => salary.category_id === dist.employee_category_id);
        if (employeeSalary) {
          const costAmount = Number(employeeSalary.total_salary) * (Number(dist.percentage) / 100);
          totalCategoryEmployeeCost += costAmount;
          breakdown.push({
            employee_category_name: dist.employee_category_name,
            total_salary: Number(employeeSalary.total_salary),
            percentage: Number(dist.percentage),
            assigned_amount: costAmount
          });
        }
      });

      employeeCostsByCategory[categoryId] = totalCategoryEmployeeCost;
      employeeBreakdownByCategory[categoryId] = breakdown;

      const categoryName = productPrices.find(p => p.category_id === categoryId)?.category_name || `Categoría ${categoryId}`;
      log(`👥 Categoría ${categoryName} (ID: ${categoryId}): $${totalCategoryEmployeeCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    });

    // MOSTRAR TOTALES DE COSTOS EMPLEADOS POR CATEGORÍA
    log('='.repeat(80));
    log('📊 TOTALES DE COSTOS EMPLEADOS POR CATEGORÍA (ANTES DE DISTRIBUIR):');
    let totalEmployeeCostsAllCategories = 0;
    Object.keys(employeeCostsByCategory).forEach(categoryIdStr => {
      const catId = parseInt(categoryIdStr);
      const catCost = employeeCostsByCategory[catId] || 0;
      totalEmployeeCostsAllCategories += catCost;
      const categoryName = productPrices.find(p => p.category_id === catId)?.category_name || `Categoría ${catId}`;
      log(`   - ${categoryName} (ID: ${catId}): $${catCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    });
    log(`   ════════════════════════════════════════════════════════════════════════════`);
    log(`   🎯 TOTAL GENERAL COSTOS EMPLEADOS: $${totalEmployeeCostsAllCategories.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    log('='.repeat(80));

    // 4. Obtener datos de distribución según el método
    // Si se proporciona distributionData (simulación), usarlo directamente
    let distributionData: { [productId: number]: number } = {};
    let dataSource = '';

    if (providedDistributionData && distributionMethod === 'simulation') {
      // ===== SIMULACIÓN - Usar datos proporcionados =====
      log('👥 Usando datos de SIMULACIÓN proporcionados para empleados');
      distributionData = { ...providedDistributionData };
      dataSource = 'simulación';
      log('👥 Datos de simulación cargados para costos empleados:', Object.keys(distributionData).length, 'productos');
      
    } else if (distributionMethod === 'sales') {
      // ===== VENTAS =====
      log('👥 Obteniendo datos de VENTAS para empleados, mes:', productionMonth);
      
      const salesRecords = await prisma.$queryRaw`
        SELECT product_id, SUM(quantity_sold) as total_sales
        FROM monthly_sales
        WHERE company_id = ${companyId}
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
        GROUP BY product_id
      ` as any[];

      salesRecords.forEach((record: any) => {
        distributionData[Number(record.product_id)] = Number(record.total_sales) || 0;
      });
      dataSource = 'ventas';
      log('👥 Datos de ventas encontrados para costos empleados:', Object.keys(distributionData).length, 'productos');
      
    } else if (distributionMethod === 'production') {
      // ===== PRODUCCIÓN =====
      log('👥 Obteniendo datos de PRODUCCIÓN para empleados, mes:', productionMonth);
      
      const productionRecords = await prisma.$queryRaw`
        SELECT 
          product_id,
          SUM(quantity_produced) as total_quantity
        FROM monthly_production
        WHERE company_id = ${companyId}
        AND fecha_imputacion = ${productionMonth}
        GROUP BY product_id
      ` as any[];

      productionRecords.forEach((record: any) => {
        distributionData[Number(record.product_id)] = Number(record.total_quantity) || 0;
      });
      dataSource = 'producción';
      log('👥 Datos de producción encontrados para costos empleados:', Object.keys(distributionData).length, 'productos');
    }

    log('👥 Usando datos de distribución para empleados:', Object.keys(distributionData).length, 'productos');

    // 5. Precalcular costos combinados para bloques y adoquines ANTES de iterar
    // Esto asegura que todos los productos del mismo tipo usen exactamente el mismo valor
    const allBloqueProductsEmployees = productPrices.filter(p => {
        const nameLower = (p.product_name || '').toLowerCase();
      const categoryLower = (p.category_name || '').toLowerCase();
      return (nameLower.includes('bloque') || categoryLower.includes('bloque')) && 
             !nameLower.includes('adoquin') && !categoryLower.includes('adoquin');
    });
    const allAdoquinProductsEmployees = productPrices.filter(p => {
      const nameLower = (p.product_name || '').toLowerCase();
      const categoryLower = (p.category_name || '').toLowerCase();
      return nameLower.includes('adoquin') || categoryLower.includes('adoquin');
    });
    
    // Calcular costos combinados para bloques (empleados)
    let combinedBloquesEmployeeCosts = 0;
    if (allBloqueProductsEmployees.length > 0) {
      const bloqueCategoryIdsEmployees = new Set(allBloqueProductsEmployees.map(p => p.category_id));
      bloqueCategoryIdsEmployees.forEach(catId => {
        combinedBloquesEmployeeCosts += employeeCostsByCategory[catId] || 0;
      });
      log(`🔷 COSTOS COMBINADOS BLOQUES EMPLEADOS (precalculados):`);
      log(`   - Productos bloques: ${allBloqueProductsEmployees.length}`);
      log(`   - Categorías involucradas: ${Array.from(bloqueCategoryIdsEmployees).join(', ')}`);
      log(`   - Costos empleados combinados: $${combinedBloquesEmployeeCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    
    // Calcular costos combinados para adoquines (empleados)
    let combinedAdoquinesEmployeeCosts = 0;
    if (allAdoquinProductsEmployees.length > 0) {
      const adoquinCategoryIdsEmployees = new Set(allAdoquinProductsEmployees.map(p => p.category_id));
      adoquinCategoryIdsEmployees.forEach(catId => {
        combinedAdoquinesEmployeeCosts += employeeCostsByCategory[catId] || 0;
      });
      log(`🔲 COSTOS COMBINADOS ADOQUINES EMPLEADOS (precalculados):`);
      log(`   - Productos adoquines: ${allAdoquinProductsEmployees.length}`);
      log(`   - Categorías involucradas: ${Array.from(adoquinCategoryIdsEmployees).join(', ')}`);
      log(`   - Costos empleados combinados: $${combinedAdoquinesEmployeeCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    
    // 5.5. Precalcular costos proporcionales para bloques y adoquines ANTES del map
    const costosProporcionalesBloquesEmpleados: { [productId: number]: { employeeCost: number, totalCost: number, ratio: number } } = {};
    const costosProporcionalesAdoquinesEmpleados: { [productId: number]: { employeeCost: number, totalCost: number, ratio: number } } = {};
    
    if (combinedBloquesEmployeeCosts > 0 && allBloqueProductsEmployees.length > 0) {
      const totalUnidadesBloquesEmpleados = allBloqueProductsEmployees.reduce((sum, p) => {
        const pId = Number(p.id);
        return sum + (distributionData[pId] || 0);
      }, 0);
      
      log(`🔷 ===== PRE-CALCULANDO COSTOS PROPORCIONALES BLOQUES (EMPLEADOS) =====`);
      log(`   - Total costos empleados: $${combinedBloquesEmployeeCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      log(`   - Total unidades: ${totalUnidadesBloquesEmpleados.toLocaleString('es-AR')}`);
      log(`   - Productos bloques: ${allBloqueProductsEmployees.length}`);
      log(`   - Método de distribución: ${distributionMethod}`);
      log(`   - distributionData keys: ${Object.keys(distributionData).slice(0, 10).join(', ')}...`);
      
      // LÓGICA PROPORCIONAL (VENTAS/PRODUCCIÓN) vs TOTAL (SIMULACIÓN)
      // En ventas/producción: Cada producto recibe su % de los costos totales
      // En simulación: Cada producto paga el 100% de los costos totales
      allBloqueProductsEmployees.forEach(p => {
        const pId = Number(p.id);
        const pQuantity = distributionData[pId] || 0;
        
        let employeeCostPerUnit = 0;
        let totalCostForProduct = 0;
        let ratio = 0;
        
        if (distributionMethod === 'simulation') {
          // SIMULACIÓN: Cada producto paga el costo total completo, dividido por sus unidades
          totalCostForProduct = combinedBloquesEmployeeCosts;
          employeeCostPerUnit = pQuantity > 0 ? combinedBloquesEmployeeCosts / pQuantity : 0;
          ratio = 1; // 100% del costo
        } else {
          // VENTAS/PRODUCCIÓN: Distribución proporcional
          ratio = totalUnidadesBloquesEmpleados > 0 ? pQuantity / totalUnidadesBloquesEmpleados : 0;
          totalCostForProduct = combinedBloquesEmployeeCosts * ratio;
          employeeCostPerUnit = pQuantity > 0 ? totalCostForProduct / pQuantity : 0;
        }
        
        costosProporcionalesBloquesEmpleados[pId] = {
          employeeCost: employeeCostPerUnit,
          totalCost: totalCostForProduct,
          ratio: ratio
        };
        
        if (p.product_name.includes('Bloque P13') || p.product_name.includes('Bloque P20 Portante')) {
          log(`   👉 ${p.product_name} (ID: ${pId}):`);
          log(`      - Cantidad: ${pQuantity.toLocaleString('es-AR')} unidades`);
          log(`      - Método: ${distributionMethod}`);
          if (distributionMethod === 'simulation') {
            log(`      - 🎮 SIMULACIÓN: Costo total categoría = $${combinedBloquesEmployeeCosts.toFixed(2)}`);
            log(`      - 🎮 Costo por unidad: $${combinedBloquesEmployeeCosts.toFixed(2)} / ${pQuantity} = $${employeeCostPerUnit.toFixed(6)}`);
            log(`      - 🎮 Costo total producto: $${totalCostForProduct.toFixed(2)}`);
          } else {
            log(`      - Porcentaje: ${(ratio * 100).toFixed(2)}%`);
            log(`      - Costo total asignado: $${combinedBloquesEmployeeCosts.toLocaleString('es-AR')} × ${(ratio * 100).toFixed(2)}% = $${totalCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            log(`      - Costo por unidad: $${totalCostForProduct.toLocaleString('es-AR')} / ${pQuantity.toLocaleString('es-AR')} = $${employeeCostPerUnit.toFixed(6)}`);
          }
        }
      });
    }
    
    if (combinedAdoquinesEmployeeCosts > 0 && allAdoquinProductsEmployees.length > 0) {
      const totalUnidadesAdoquinesEmpleados = allAdoquinProductsEmployees.reduce((sum, p) => {
        const pId = Number(p.id);
        return sum + (distributionData[pId] || 0);
      }, 0);
      
      log(`🔲 PRE-CALCULANDO COSTOS PROPORCIONALES ADOQUINES EMPLEADOS:`);
      log(`   - Total costos empleados: $${combinedAdoquinesEmployeeCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      log(`   - Total unidades: ${totalUnidadesAdoquinesEmpleados.toLocaleString('es-AR')}`);
      
      // LÓGICA PROPORCIONAL (VENTAS/PRODUCCIÓN) vs TOTAL (SIMULACIÓN)
      // En ventas/producción: Cada producto recibe su % de los costos totales
      // En simulación: Cada producto paga el 100% de los costos totales
      allAdoquinProductsEmployees.forEach(p => {
        const pId = Number(p.id);
        const pQuantity = distributionData[pId] || 0;
        
        let employeeCostPerUnit = 0;
        let totalCostForProduct = 0;
        let ratio = 0;
        
        if (distributionMethod === 'simulation') {
          // SIMULACIÓN: Cada producto paga el costo total completo, dividido por sus unidades
          totalCostForProduct = combinedAdoquinesEmployeeCosts;
          employeeCostPerUnit = pQuantity > 0 ? combinedAdoquinesEmployeeCosts / pQuantity : 0;
          ratio = 1; // 100% del costo
        } else {
          // VENTAS/PRODUCCIÓN: Distribución proporcional
          ratio = totalUnidadesAdoquinesEmpleados > 0 ? pQuantity / totalUnidadesAdoquinesEmpleados : 0;
          totalCostForProduct = combinedAdoquinesEmployeeCosts * ratio;
          employeeCostPerUnit = pQuantity > 0 ? totalCostForProduct / pQuantity : 0;
        }
        
        costosProporcionalesAdoquinesEmpleados[pId] = {
          employeeCost: employeeCostPerUnit,
          totalCost: totalCostForProduct,
          ratio: ratio
        };
        
        log(`   👉 ${p.product_name} (ID: ${pId}):`);
        log(`      - Cantidad: ${pQuantity.toLocaleString('es-AR')} unidades`);
        log(`      - Método: ${distributionMethod}`);
        if (distributionMethod === 'simulation') {
          log(`      - 🎮 SIMULACIÓN: Costo total categoría = $${combinedAdoquinesEmployeeCosts.toFixed(2)}`);
          log(`      - 🎮 Costo por unidad: $${combinedAdoquinesEmployeeCosts.toFixed(2)} / ${pQuantity} = $${employeeCostPerUnit.toFixed(6)}`);
          log(`      - 🎮 Costo total producto: $${totalCostForProduct.toFixed(2)}`);
        } else {
          log(`      - Porcentaje: ${(ratio * 100).toFixed(2)}%`);
          log(`      - Costo total asignado: $${combinedAdoquinesEmployeeCosts.toLocaleString('es-AR')} × ${(ratio * 100).toFixed(2)}% = $${totalCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Costo por unidad: $${totalCostForProduct.toLocaleString('es-AR')} / ${pQuantity.toLocaleString('es-AR')} = $${employeeCostPerUnit.toFixed(6)}`);
        }
      });
    }

    // 6. Asignar costos a productos según su % DENTRO DE SU CATEGORÍA
    const result = productPrices.map(product => {
      const categoryId = product.category_id;
      const categoryEmployeeCosts = employeeCostsByCategory[categoryId] || 0;
      
      // Detectar tipo de categoría ANTES de verificar si hay costos
      const categoryNameLower = (product.category_name || '').toLowerCase();
      const productNameLower = (product.product_name || '').toLowerCase();
      const isAdoquinesCategory = categoryNameLower.includes('adoquin') || 
                                 categoryNameLower === 'adoquines' ||
                                 productNameLower.includes('adoquin');
      const isBloquesCategory = (categoryNameLower.includes('bloque') || 
                                categoryNameLower === 'bloques' ||
                                productNameLower.includes('bloque')) && !isAdoquinesCategory;
      const isViguetasCategory = categoryNameLower.includes('vigueta') || 
                                categoryNameLower === 'viguetas' ||
                                productNameLower.includes('vigueta');
      
      // Verificar si hay costos: para bloques y adoquines, usar costos combinados
      // Para otras categorías, usar costos de la categoría específica
      let hasCosts = false;
      if (isBloquesCategory || isAdoquinesCategory) {
        // Para bloques y adoquines, verificar costos combinados
        if (isBloquesCategory && combinedBloquesEmployeeCosts > 0) {
          hasCosts = true;
        } else if (isAdoquinesCategory && combinedAdoquinesEmployeeCosts > 0) {
          hasCosts = true;
        }
      } else {
        // Para otras categorías, verificar costos de la categoría específica
        hasCosts = categoryEmployeeCosts > 0;
      }
      
      if (hasCosts) {
        const productsInCategory = productPrices.filter(p => p.category_id === categoryId);
        const hasRealData = Object.keys(distributionData).length > 0;
        
        let productQuantity = 1;
        let totalCategoryQuantity = productsInCategory.length;
        let distributionRatio = 1 / productsInCategory.length;
        let combinedCategoryEmployeeCosts = categoryEmployeeCosts; // Por defecto, usar el de la categoría

        // Las variables de tipo de categoría ya están definidas arriba
        
        log(`🔍 ${product.product_name}: Categoría = "${product.category_name}", esBloques = ${isBloquesCategory}, esAdoquines = ${isAdoquinesCategory}, esViguetas = ${isViguetasCategory}`);
        
        // Función auxiliar para extraer metros del nombre
        const extractMetersFromName = (name: string): number => {
          const patterns = [
            /(\d+\.?\d*)\s*m\b/i,
            /(\d+\.?\d*)\s*metro/i,
            /(\d+\.?\d*)\s*mts/i,
            /(\d+,\d+)\s*m\b/i,
          ];
          for (const pattern of patterns) {
            const match = name.match(pattern);
            if (match) {
              const meterString = match[1].replace(',', '.');
              const meters = parseFloat(meterString);
              if (!isNaN(meters) && meters > 0) {
                return meters;
              }
            }
          }
          return 0;
        };
        
        if (isViguetasCategory) {
          // Para VIGUETAS: distribuir por metros totales
          const productId = Number(product.id);
          const productUnits = distributionData[productId] || 0;
          const productMeters = extractMetersFromName(product.product_name);
          
          // Calcular total de metros de la categoría: suma de (metros × cantidad) para cada vigueta
          let totalCategoryMeters = 0;
          productsInCategory.forEach(p => {
            const pId = Number(p.id);
            const pUnits = distributionData[pId] || 0;
            const pMeters = extractMetersFromName(p.product_name);
            totalCategoryMeters += pMeters * pUnits;
          });
          
          log(`📏 ${product.product_name} (VIGUETAS - COSTOS EMPLEADOS):`);
          log(`   - Metros del producto: ${productMeters}m`);
          log(`   - Unidades vendidas/producidas: ${productUnits.toLocaleString('es-AR')}`);
          log(`   - Metros totales del producto: ${(productMeters * productUnits).toLocaleString('es-AR')}m`);
          log(`   - Total metros de la categoría: ${totalCategoryMeters.toLocaleString('es-AR')}m`);
          log(`   - Método: ${distributionMethod}`);
          
          if (totalCategoryMeters > 0 && productMeters > 0) {
            let employeeCostPerUnit = 0;
            
            if (distributionMethod === 'simulation') {
              // SIMULACIÓN: Cada vigueta paga el costo total completo de la categoría, dividido por sus unidades
              employeeCostPerUnit = productUnits > 0 ? categoryEmployeeCosts / productUnits : 0;
              log(`   - 🎮 SIMULACIÓN: Costo total categoría = $${categoryEmployeeCosts.toFixed(2)}`);
              log(`   - 🎮 Costo por unidad: $${categoryEmployeeCosts.toFixed(2)} / ${productUnits} = $${employeeCostPerUnit.toFixed(6)}`);
              log(`   - 🎮 Costo total producto: $${categoryEmployeeCosts.toFixed(2)}`);
            } else {
              // VENTAS/PRODUCCIÓN: Distribución proporcional por metros
              const costPerMeter = categoryEmployeeCosts / totalCategoryMeters;
              employeeCostPerUnit = productMeters * costPerMeter;
              log(`   - Costo total categoría: $${categoryEmployeeCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
              log(`   - Costo por metro: $${costPerMeter.toFixed(6)}/m`);
              log(`   - Costo por unidad (${productMeters}m × $${costPerMeter.toFixed(6)}/m): $${employeeCostPerUnit.toFixed(6)}`);
            }
            
            return {
              productId: Number(product.id),
              employeeCost: employeeCostPerUnit,
              totalEmployeeCost: employeeCostPerUnit * productUnits,
              breakdown: employeeBreakdownByCategory[categoryId] || [],
              distributionInfo: {
                product_quantity: productUnits,
                category_total_quantity: totalCategoryMeters,
                distribution_ratio: distributionMethod === 'simulation' ? 1 : (productMeters * productUnits) / totalCategoryMeters,
                percentage_of_category: distributionMethod === 'simulation' ? 100 : ((productMeters * productUnits) / totalCategoryMeters) * 100,
                data_source: dataSource,
                category_total_cost: categoryEmployeeCosts,
                product_total_cost: employeeCostPerUnit * productUnits
              }
            };
          } else {
            // Sin datos o sin metros, no recibe costos
            return {
              productId: Number(product.id),
              employeeCost: 0,
              totalEmployeeCost: 0,
              breakdown: [],
              distributionInfo: {
                product_quantity: 0,
                category_total_quantity: 0,
                distribution_ratio: 0,
                percentage_of_category: 0,
                data_source: dataSource,
                category_total_cost: 0,
                product_total_cost: 0
              }
            };
          }
        } else if (isBloquesCategory || isAdoquinesCategory) {
          // Para BLOQUES y ADOQUINES: usar los costos precalculados proporcionales
          const productId = Number(product.id);
          productQuantity = distributionData[productId] || 0;
          
          // Declarar variables antes de usarlas
          let employeeCostPerUnit = 0;
          let totalEmployeeCostForProduct = 0;
          let distributionRatio = 0;
          let totalCategoryQuantity = 0;
          let combinedCategoryEmployeeCosts = 0;
          
          // Obtener los costos precalculados
          const costosPrecalculadosEmpleados = isBloquesCategory ? costosProporcionalesBloquesEmpleados[productId] : costosProporcionalesAdoquinesEmpleados[productId];
          
          // Log para verificar si se encuentran los costos precalculados
          const categoryType = isBloquesCategory ? 'BLOQUES' : 'ADOQUINES';
          log(`🔍 BUSCANDO COSTOS PRECALCULADOS EMPLEADOS - ${product.product_name} (${categoryType}):`);
          log(`   - productId: ${productId} (tipo: ${typeof productId})`);
          log(`   - costosPrecalculadosEmpleados encontrado: ${!!costosPrecalculadosEmpleados}`);
          if (!costosPrecalculadosEmpleados) {
            const dictToCheck = isBloquesCategory ? costosProporcionalesBloquesEmpleados : costosProporcionalesAdoquinesEmpleados;
            const keys = Object.keys(dictToCheck).map(k => Number(k));
            log(`   - ⚠️ No se encontraron costos precalculados empleados. Claves disponibles en dict: [${keys.slice(0, 5).join(', ')}...] (${keys.length} total)`);
            log(`   - Verificando si productId está en keys: ${keys.includes(productId)}`);
          }
          
          if (costosPrecalculadosEmpleados) {
            // Usar los valores precalculados
            employeeCostPerUnit = costosPrecalculadosEmpleados.employeeCost;
            totalEmployeeCostForProduct = costosPrecalculadosEmpleados.totalCost;
            distributionRatio = costosPrecalculadosEmpleados.ratio;
            
            // Calcular totalCategoryQuantity para el distributionInfo
            const allProductsOfType = isBloquesCategory ? allBloqueProductsEmployees : allAdoquinProductsEmployees;
            totalCategoryQuantity = allProductsOfType.reduce((sum, p) => {
            const pId = Number(p.id);
            return sum + (distributionData[pId] || 0);
          }, 0);
          
            // Usar los costos combinados precalculados
            if (isBloquesCategory) {
              combinedCategoryEmployeeCosts = combinedBloquesEmployeeCosts;
            } else {
              combinedCategoryEmployeeCosts = combinedAdoquinesEmployeeCosts;
            }
            
            const categoryType = isBloquesCategory ? 'BLOQUES' : 'ADOQUINES';
            log(`📊 ${product.product_name} (${categoryType} - COSTOS EMPLEADOS - usando valores precalculados):`);
            log(`   - Product ID: ${productId}`);
            log(`   - Cantidad: ${productQuantity.toLocaleString('es-AR')}`);
            log(`   - Ratio: ${(distributionRatio * 100).toFixed(2)}%`);
            log(`   - Costo total: $${totalEmployeeCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            log(`   - Costo por unidad: $${employeeCostPerUnit.toFixed(6)}`);
          } else {
            // Si no hay costos precalculados, no recibe costos
            employeeCostPerUnit = 0;
            totalEmployeeCostForProduct = 0;
            distributionRatio = 0;
            totalCategoryQuantity = 0;
            combinedCategoryEmployeeCosts = 0;
            warn(`   ⚠️ No se encontraron costos precalculados para ${product.product_name} (ID: ${productId})`);
          }
          
          // Saltar al return, ya que los valores están calculados
          const percentageOfCategory = distributionRatio * 100;
          const costosEmpleadosParaMostrar = isBloquesCategory ? combinedBloquesEmployeeCosts : combinedAdoquinesEmployeeCosts;
          
          return {
            productId: Number(product.id),
            employeeCost: employeeCostPerUnit,
            totalEmployeeCost: totalEmployeeCostForProduct,
            breakdown: employeeBreakdownByCategory[categoryId] || [],
            distributionInfo: {
              product_quantity: productQuantity,
              category_total_quantity: totalCategoryQuantity,
              distribution_ratio: distributionRatio,
              percentage_of_category: percentageOfCategory,
              data_source: dataSource,
              category_total_cost: costosEmpleadosParaMostrar,
              product_total_cost: totalEmployeeCostForProduct
            }
          };
        } else {
          // Para otras categorías: distribución equitativa o total según modo
          productQuantity = distributionData[product.id] || 0;
          
          if (distributionMethod === 'simulation') {
            // SIMULACIÓN: Cada producto paga el total
            totalCategoryQuantity = 1;
            distributionRatio = 1;
            log(`📊 ${product.product_name} (${product.category_name}): 🎮 SIMULACIÓN - Paga el 100% de costos`);
          } else {
            // VENTAS/PRODUCCIÓN: Distribución equitativa
          totalCategoryQuantity = productsInCategory.length;
          distributionRatio = 1 / productsInCategory.length;
          log(`📊 ${product.product_name} (${product.category_name}): Distribución equitativa (${(distributionRatio * 100).toFixed(2)}%)`);
          }
        }
        
        // El producto recibe su % de los costos de SU CATEGORÍA según su participación
        // IMPORTANTE: El porcentaje se calcula sobre el TOTAL de costos de empleados de la categoría
        // Para bloques y adoquines, usar el total combinado de todas las categorías del mismo tipo
        const percentageOfCategory = distributionRatio * 100;
        const costosEmpleadosParaCalcular = (isBloquesCategory || isAdoquinesCategory) ? combinedCategoryEmployeeCosts : categoryEmployeeCosts;
        
        let totalEmployeeCostForProduct = 0;
        let employeeCostPerUnit = 0;
        
        if (distributionMethod === 'simulation' && !isBloquesCategory && !isAdoquinesCategory && !isViguetasCategory) {
          // SIMULACIÓN para otras categorías: Cada producto paga el total de su categoría, dividido por sus unidades
          totalEmployeeCostForProduct = categoryEmployeeCosts;
          employeeCostPerUnit = productQuantity > 0 ? categoryEmployeeCosts / productQuantity : 0;
          log(`   - 🎮 SIMULACIÓN: Costo total categoría = $${categoryEmployeeCosts.toFixed(2)}`);
          log(`   - 🎮 Costo por unidad: $${categoryEmployeeCosts.toFixed(2)} / ${productQuantity} = $${employeeCostPerUnit.toFixed(6)}`);
        } else {
          // VENTAS/PRODUCCIÓN: Distribución proporcional
          totalEmployeeCostForProduct = costosEmpleadosParaCalcular * distributionRatio;
          employeeCostPerUnit = productQuantity > 0 ? totalEmployeeCostForProduct / productQuantity : 0;
        }
        
        // Log adicional para verificar el cálculo
        if (isBloquesCategory || isAdoquinesCategory) {
          log(`   🔢 CÁLCULO FINAL EMPLEADOS - ${product.product_name}:`);
          log(`      - Costos empleados combinados: $${costosEmpleadosParaCalcular.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Distribution ratio: ${distributionRatio.toFixed(6)} (${percentageOfCategory.toFixed(2)}%)`);
          log(`      - Costo total asignado: $${totalEmployeeCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Costo por unidad: $${employeeCostPerUnit.toFixed(6)}`);
        }
        
        const categoryTypeLabel = isBloquesCategory ? 'Bloques' : (isAdoquinesCategory ? 'Adoquines' : product.category_name);
        log(`👥 ${product.product_name} (Categoría ID: ${categoryId}, Tipo: ${categoryTypeLabel}):`);
        log(`   - Unidades vendidas/producto: ${productQuantity.toLocaleString('es-AR')}`);
        log(`   - Total categoría: ${totalCategoryQuantity.toLocaleString('es-AR')}`);
        log(`   - Porcentaje del total: ${percentageOfCategory.toFixed(2)}%`);
        const costosEmpleadosParaMostrar = (isBloquesCategory || isAdoquinesCategory) ? combinedCategoryEmployeeCosts : categoryEmployeeCosts;
        log(`   - Costos empleados TOTALES de categoría (category_id ${categoryId}): $${categoryEmployeeCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        if (isBloquesCategory || isAdoquinesCategory) {
          log(`   - Costos empleados TOTALES combinados de ${categoryTypeLabel}: $${combinedCategoryEmployeeCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        }
        log(`   - Costo TOTAL asignado al producto (${percentageOfCategory.toFixed(2)}% de $${costosEmpleadosParaMostrar.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}): $${totalEmployeeCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        log(`   - Costo por unidad: $${employeeCostPerUnit.toFixed(6)} ($${totalEmployeeCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${productQuantity.toLocaleString('es-AR')} unidades)`);
        log(`   - VERIFICACIÓN: ${productQuantity.toLocaleString('es-AR')} unidades × $${employeeCostPerUnit.toFixed(6)} = $${(productQuantity * employeeCostPerUnit).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        
        return {
          productId: Number(product.id), // Asegurar que sea número
          employeeCost: employeeCostPerUnit,
          totalEmployeeCost: totalEmployeeCostForProduct,
          breakdown: employeeBreakdownByCategory[categoryId] || [],
          distributionInfo: {
            product_quantity: productQuantity,
            category_total_quantity: totalCategoryQuantity,
            distribution_ratio: distributionRatio,
            percentage_of_category: distributionRatio * 100,
            data_source: dataSource,
            category_total_cost: categoryEmployeeCosts,
            product_total_cost: totalEmployeeCostForProduct
          }
        };
      } else {
        return {
          productId: product.id,
          employeeCost: 0,
          totalEmployeeCost: 0,
          breakdown: [],
          distributionInfo: {
            product_quantity: 0,
            category_total_quantity: 0,
            distribution_ratio: 0,
            percentage_of_category: 0,
            data_source: dataSource,
            category_total_cost: 0,
            product_total_cost: 0
          }
        };
      }
    });

    const totalEmployeeCosts = result.reduce((sum, item) => sum + item.employeeCost, 0);
    log('👥 Total costos de empleados distribuidos:', totalEmployeeCosts.toLocaleString('es-AR'));

    return result;

  } catch (error) {
    console.error('❌ Error calculando costos de empleados:', error);
    return productPrices.map(product => ({
      productId: product.id,
      employeeCost: 0,
      breakdown: []
    }));
  }
}

// Función para calcular costos indirectos por mes específico
async function calculateIndirectCosts(
  companyId: number, 
  productionMonth: string, 
  productPrices: any[], 
  distributionMethod: string = 'sales',
  providedDistributionData?: { [productId: number]: number }
) {
  // Declarar variables en el scope de la función
  let dataSource = distributionMethod === 'production' ? 'producción' : distributionMethod === 'simulation' ? 'simulación' : 'ventas';
  
  try {
    log('🔍 Calculando costos indirectos para mes:', productionMonth);

    // 1. Obtener registros mensuales de costos indirectos
    const monthlyRecords = await prisma.$queryRaw`
      SELECT 
        icmr.id,
        icmr.amount,
        icmr.fecha_imputacion,
        icb.name as cost_name
      FROM indirect_cost_monthly_records icmr
      JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
      WHERE icmr.company_id = ${companyId}
      AND icmr.fecha_imputacion = ${productionMonth}
      ORDER BY icb.name
    ` as any[];

    log('📅 Registros mensuales encontrados:', monthlyRecords.length);

    if (monthlyRecords.length === 0) {
      log('⚠️ No hay registros de costos indirectos para el mes', productionMonth);
      return productPrices.map(product => ({
        productId: product.id,
        indirectCost: 0,
        breakdown: []
      }));
    }

    // 2. Obtener configuración de distribución por categorías
    const distributionConfig = await prisma.$queryRaw`
      SELECT 
        cdc.product_category_id,
        pc.name as category_name,
        cdc.cost_name,
        cdc.percentage,
        cdc.is_active
      FROM cost_distribution_config cdc
      LEFT JOIN product_categories pc ON cdc.product_category_id = pc.id
      WHERE cdc.company_id = ${companyId}
      AND cdc.is_active = true
      ORDER BY pc.name, cdc.cost_name
    ` as any[];

    log('🎯 Configuración de distribución:', distributionConfig.length);

    // 3. Calcular costos por categoría
    const costsByCategory: { [categoryId: number]: number } = {};
    const costsBreakdownByCategory: { [categoryId: number]: any[] } = {};

    // Agrupar distribución por categoría
    const categoriesMap: { [categoryId: number]: any[] } = {};
    distributionConfig.forEach((config: any) => {
      if (!categoriesMap[config.product_category_id]) {
        categoriesMap[config.product_category_id] = [];
      }
      categoriesMap[config.product_category_id].push(config);
    });

    // Calcular costos para cada categoría
    Object.keys(categoriesMap).forEach(categoryIdStr => {
      const categoryId = parseInt(categoryIdStr);
      const categoryConfigs = categoriesMap[categoryId];
      let totalCategoryIndirectCost = 0;
      const breakdown: any[] = [];

      categoryConfigs.forEach((config: any) => {
        const monthlyRecord = monthlyRecords.find((record: any) => record.cost_name === config.cost_name);
        if (monthlyRecord) {
          const costAmount = Number(monthlyRecord.amount) * (Number(config.percentage) / 100);
          totalCategoryIndirectCost += costAmount;
          breakdown.push({
            cost_name: config.cost_name,
            base_amount: Number(monthlyRecord.amount),
            percentage: Number(config.percentage),
            assigned_amount: costAmount
          });
        }
      });

      costsByCategory[categoryId] = totalCategoryIndirectCost;
      costsBreakdownByCategory[categoryId] = breakdown;

      const categoryName = productPrices.find(p => p.category_id === categoryId)?.category_name || `Categoría ${categoryId}`;
      log(`💰 Categoría ${categoryName} (ID: ${categoryId}): $${totalCategoryIndirectCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    });

    // MOSTRAR TOTALES DE COSTOS INDIRECTOS POR CATEGORÍA
    log('='.repeat(80));
    log('📊 TOTALES DE COSTOS INDIRECTOS POR CATEGORÍA (ANTES DE DISTRIBUIR):');
    let totalIndirectCostsAllCategories = 0;
    Object.keys(costsByCategory).forEach(categoryIdStr => {
      const catId = parseInt(categoryIdStr);
      const catCost = costsByCategory[catId] || 0;
      totalIndirectCostsAllCategories += catCost;
      const categoryName = productPrices.find(p => p.category_id === catId)?.category_name || `Categoría ${catId}`;
      log(`   - ${categoryName} (ID: ${catId}): $${catCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    });
    log(`   ════════════════════════════════════════════════════════════════════════════`);
    log(`   🎯 TOTAL GENERAL COSTOS INDIRECTOS: $${totalIndirectCostsAllCategories.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    log('='.repeat(80));

    // 4. Obtener datos para distribución proporcional según el método
    // Si se proporciona distributionData (simulación), usarlo directamente
    let distributionData: { [productId: number]: number } = {};
    let totalMetersViguetasSummary = 0;
    let totalUnitsViguetasSummary = 0;
    
    // ============================================================================
    // LÓGICA ESPECÍFICA POR MÉTODO
    // ============================================================================
    
    try {
      if (providedDistributionData && distributionMethod === 'simulation') {
        // ===== SIMULACIÓN - Usar datos proporcionados =====
        log('🎮 Usando datos de SIMULACIÓN proporcionados para costos indirectos');
        distributionData = { ...providedDistributionData };
        log('🎮 Datos de simulación cargados para costos indirectos:', Object.keys(distributionData).length, 'productos');
        
      } else if (distributionMethod === 'sales') {
        // ===== VENTAS =====
        log('💰 Obteniendo datos de VENTAS para mes:', productionMonth);
        
        const salesRecords = await prisma.$queryRaw`
          SELECT 
            product_id,
            SUM(quantity_sold) as total_sales
          FROM monthly_sales
          WHERE company_id = ${companyId}
          AND (
            DATE_TRUNC('month', created_at) = DATE_TRUNC('month', ${productionMonth + '-01'}::date)
            OR DATE_TRUNC('month', month_year) = DATE_TRUNC('month', ${productionMonth + '-01'}::date)
            OR fecha_imputacion = ${productionMonth}
          )
          GROUP BY product_id
        ` as any[];

        salesRecords.forEach((record: any) => {
          const productIdNum = Number(record.product_id);
          if (!isNaN(productIdNum)) {
            distributionData[productIdNum] = (distributionData[productIdNum] || 0) + Number(record.total_sales) || 0;
          }
        });

        dataSource = 'ventas';
        log('💰 Datos de ventas encontrados para', Object.keys(distributionData).length, 'productos');
        
      } else if (distributionMethod === 'production') {
        // ===== PRODUCCIÓN =====
        log('🏭 Obteniendo datos de PRODUCCIÓN para mes:', productionMonth);
        
        if (!productionMonth) {
          warn('⚠️ productionMonth es requerido para production');
          dataSource = 'sin_datos';
        } else {
          const productionRecords = await prisma.$queryRaw`
            SELECT 
              product_id,
              SUM(quantity_produced) as total_quantity
            FROM monthly_production
            WHERE company_id = ${companyId}
            AND fecha_imputacion = ${productionMonth}
            GROUP BY product_id
          ` as any[];
          
          productionRecords.forEach((record: any) => {
            distributionData[Number(record.product_id)] = Number(record.total_quantity) || 0;
          });

          dataSource = Object.keys(distributionData).length > 0 ? 'producción' : 'sin_datos';
          log('🏭 Datos de producción encontrados para', Object.keys(distributionData).length, 'productos');
        }
        
      }
      
      // Calcular total de metros vendidos de viguetas
      let totalMetersViguetas = 0;
      let totalUnitsViguetas = 0;
      const viguetaProducts = productPrices.filter(p => {
        const nameLower = (p.product_name || '').toLowerCase();
        const categoryLower = (p.category_name || '').toLowerCase();
        return nameLower.includes('vigueta') || categoryLower.includes('vigueta');
      });
      
      viguetaProducts.forEach(vigueta => {
        const productId = Number(vigueta.id);
        const unitsSold = distributionData[productId] || 0;
        totalUnitsViguetas += unitsSold;
        
        // Extraer metros del nombre del producto (ej: "10 Viguetas Pretensadas 1.00 mts" -> 1.0)
        const metrosMatch = vigueta.product_name.match(/(\d+\.?\d*)\s*mts?/i);
        const metros = metrosMatch ? parseFloat(metrosMatch[1]) : 0;
        
        if (metros > 0 && unitsSold > 0) {
          totalMetersViguetas += metros * unitsSold;
        }
      });
      
      // Actualizar el summary con los datos calculados
      totalMetersViguetasSummary = totalMetersViguetas;
      totalUnitsViguetasSummary = totalUnitsViguetas;

  } catch (error) {
      console.error('❌ Error obteniendo datos de distribución:', error);
      log(`⚠️ No se encontraron datos de ${dataSource || distributionMethod}, usando distribución equitativa`);
      // Asegurar que dataSource tenga un valor por defecto
      if (!dataSource) {
        dataSource = distributionMethod === 'production' ? 'sin_datos' : 'sin_datos';
      }
    }

    // 5. Precalcular costos combinados para bloques y adoquines ANTES de iterar
    // Esto asegura que todos los productos del mismo tipo usen exactamente el mismo valor
    const allBloqueProducts = productPrices.filter(p => {
      const nameLower = (p.product_name || '').toLowerCase();
      const categoryLower = (p.category_name || '').toLowerCase();
      return (nameLower.includes('bloque') || categoryLower.includes('bloque')) && 
             !nameLower.includes('adoquin') && !categoryLower.includes('adoquin');
    });
    const allAdoquinProducts = productPrices.filter(p => {
      const nameLower = (p.product_name || '').toLowerCase();
      const categoryLower = (p.category_name || '').toLowerCase();
      return nameLower.includes('adoquin') || categoryLower.includes('adoquin');
    });
    
    // Calcular costos combinados para bloques (solo indirectos aquí, empleados se calculan después)
    let combinedBloquesIndirectCosts = 0;
    if (allBloqueProducts.length > 0) {
      const bloqueCategoryIds = new Set(allBloqueProducts.map(p => p.category_id));
      bloqueCategoryIds.forEach(catId => {
        combinedBloquesIndirectCosts += costsByCategory[catId] || 0;
      });
      log(`🔷 COSTOS COMBINADOS BLOQUES (precalculados):`);
      log(`   - Productos bloques: ${allBloqueProducts.length}`);
      log(`   - Categorías involucradas: ${Array.from(bloqueCategoryIds).join(', ')}`);
      log(`   - Costos indirectos combinados: $${combinedBloquesIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    
    // Calcular costos combinados para adoquines (solo indirectos aquí, empleados se calculan después)
    let combinedAdoquinesIndirectCosts = 0;
    if (allAdoquinProducts.length > 0) {
      const adoquinCategoryIds = new Set(allAdoquinProducts.map(p => p.category_id));
      adoquinCategoryIds.forEach(catId => {
        combinedAdoquinesIndirectCosts += costsByCategory[catId] || 0;
      });
      log(`🔲 COSTOS COMBINADOS ADOQUINES (precalculados):`);
      log(`   - Productos adoquines: ${allAdoquinProducts.length}`);
      log(`   - Categorías involucradas: ${Array.from(adoquinCategoryIds).join(', ')}`);
      log(`   - Costos indirectos combinados: $${combinedAdoquinesIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    
    // 5. Precalcular costos proporcionales para bloques y adoquines ANTES del map
    // Esto asegura que cada producto reciba el costo correcto según su participación
    const costosProporcionalesBloques: { [productId: number]: { indirectCost: number, totalCost: number, ratio: number } } = {};
    const costosProporcionalesAdoquines: { [productId: number]: { indirectCost: number, totalCost: number, ratio: number } } = {};
    
    if (combinedBloquesIndirectCosts > 0 && allBloqueProducts.length > 0) {
      // Calcular total de unidades de bloques
      const totalUnidadesBloques = allBloqueProducts.reduce((sum, p) => {
        const pId = Number(p.id);
        return sum + (distributionData[pId] || 0);
      }, 0);
      
      log(`🔷 ===== PRE-CALCULANDO COSTOS PROPORCIONALES BLOQUES (INDIRECTOS) =====`);
      log(`   - Total costos indirectos: $${combinedBloquesIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      log(`   - Total unidades: ${totalUnidadesBloques.toLocaleString('es-AR')}`);
      log(`   - Productos bloques: ${allBloqueProducts.length}`);
      log(`   - Método de distribución: ${distributionMethod}`);
      log(`   - distributionData tiene ${Object.keys(distributionData).length} productos`);
      log(`   - ⚠️ VERIFICACIÓN MATEMÁTICA:`);
      log(`      Total costos / Total unidades = $${combinedBloquesIndirectCosts.toFixed(2)} / ${totalUnidadesBloques} = $${(combinedBloquesIndirectCosts / totalUnidadesBloques).toFixed(6)} por unidad`);
      
      // LÓGICA PROPORCIONAL (VENTAS/PRODUCCIÓN) vs TOTAL (SIMULACIÓN)
      // En ventas/producción: Cada producto recibe su % de los costos totales
      // En simulación: Cada producto paga el 100% de los costos totales
      allBloqueProducts.forEach(p => {
        const pId = Number(p.id);
        const pQuantity = distributionData[pId] || 0;
        
        let indirectCostPerUnit = 0;
        let totalCostForProduct = 0;
        let ratio = 0;
        
        if (distributionMethod === 'simulation') {
          // SIMULACIÓN: Cada producto paga el costo total completo, dividido por sus unidades
          totalCostForProduct = combinedBloquesIndirectCosts;
          indirectCostPerUnit = pQuantity > 0 ? combinedBloquesIndirectCosts / pQuantity : 0;
          ratio = 1; // 100% del costo
            } else {
          // VENTAS/PRODUCCIÓN: Distribución proporcional
          ratio = totalUnidadesBloques > 0 ? pQuantity / totalUnidadesBloques : 0;
          totalCostForProduct = combinedBloquesIndirectCosts * ratio;
          indirectCostPerUnit = pQuantity > 0 ? totalCostForProduct / pQuantity : 0;
        }
        
        costosProporcionalesBloques[pId] = {
          indirectCost: indirectCostPerUnit,
          totalCost: totalCostForProduct,
          ratio: ratio
        };
        
        if (p.product_name.includes('P13') || p.product_name.includes('P20 Portante')) {
          log(`   👉 ${p.product_name} (ID: ${pId}):`);
          log(`      - Cantidad: ${pQuantity.toLocaleString('es-AR')} unidades`);
          log(`      - Método: ${distributionMethod}`);
          if (distributionMethod === 'simulation') {
            log(`      - 🎮 SIMULACIÓN: Costo total categoría = $${combinedBloquesIndirectCosts.toFixed(2)}`);
            log(`      - 🎮 Costo por unidad: $${combinedBloquesIndirectCosts.toFixed(2)} / ${pQuantity} = $${indirectCostPerUnit.toFixed(6)}`);
            log(`      - 🎮 Costo total producto: $${totalCostForProduct.toFixed(2)}`);
          } else {
            log(`      - Porcentaje: ${(ratio * 100).toFixed(4)}%`);
            log(`      - Costo asignado: $${combinedBloquesIndirectCosts.toFixed(2)} × ${(ratio * 100).toFixed(4)}% = $${totalCostForProduct.toFixed(2)}`);
            log(`      - Costo por unidad: $${totalCostForProduct.toFixed(2)} / ${pQuantity} = $${indirectCostPerUnit.toFixed(6)}`);
          }
        }
      });
    }

    if (combinedAdoquinesIndirectCosts > 0 && allAdoquinProducts.length > 0) {
      // Calcular total de unidades de adoquines
      const totalUnidadesAdoquines = allAdoquinProducts.reduce((sum, p) => {
            const pId = Number(p.id);
            return sum + (distributionData[pId] || 0);
          }, 0);
          
      log(`🔲 PRE-CALCULANDO COSTOS PROPORCIONALES ADOQUINES:`);
      log(`   - Total costos indirectos: $${combinedAdoquinesIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      log(`   - Total unidades: ${totalUnidadesAdoquines.toLocaleString('es-AR')}`);
      
      // LÓGICA PROPORCIONAL (VENTAS/PRODUCCIÓN) vs TOTAL (SIMULACIÓN)
      // En ventas/producción: Cada producto recibe su % de los costos totales
      // En simulación: Cada producto paga el 100% de los costos totales
      allAdoquinProducts.forEach(p => {
        const pId = Number(p.id);
        const pQuantity = distributionData[pId] || 0;
        
        let indirectCostPerUnit = 0;
        let totalCostForProduct = 0;
        let ratio = 0;
        
        if (distributionMethod === 'simulation') {
          // SIMULACIÓN: Cada producto paga el costo total completo, dividido por sus unidades
          totalCostForProduct = combinedAdoquinesIndirectCosts;
          indirectCostPerUnit = pQuantity > 0 ? combinedAdoquinesIndirectCosts / pQuantity : 0;
          ratio = 1; // 100% del costo
            } else {
          // VENTAS/PRODUCCIÓN: Distribución proporcional
          ratio = totalUnidadesAdoquines > 0 ? pQuantity / totalUnidadesAdoquines : 0;
          totalCostForProduct = combinedAdoquinesIndirectCosts * ratio;
          indirectCostPerUnit = pQuantity > 0 ? totalCostForProduct / pQuantity : 0;
        }
        
        costosProporcionalesAdoquines[pId] = {
          indirectCost: indirectCostPerUnit,
          totalCost: totalCostForProduct,
          ratio: ratio
        };
        
        log(`   👉 ${p.product_name} (ID: ${pId}):`);
        log(`      - Cantidad: ${pQuantity.toLocaleString('es-AR')} unidades`);
        log(`      - Método: ${distributionMethod}`);
        if (distributionMethod === 'simulation') {
          log(`      - 🎮 SIMULACIÓN: Costo total categoría = $${combinedAdoquinesIndirectCosts.toFixed(2)}`);
          log(`      - 🎮 Costo por unidad: $${combinedAdoquinesIndirectCosts.toFixed(2)} / ${pQuantity} = $${indirectCostPerUnit.toFixed(6)}`);
          log(`      - 🎮 Costo total producto: $${totalCostForProduct.toFixed(2)}`);
          } else {
          log(`      - Porcentaje: ${(ratio * 100).toFixed(2)}%`);
          log(`      - Costo total asignado: $${combinedAdoquinesIndirectCosts.toLocaleString('es-AR')} × ${(ratio * 100).toFixed(2)}% = $${totalCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Costo por unidad: $${totalCostForProduct.toLocaleString('es-AR')} / ${pQuantity.toLocaleString('es-AR')} = $${indirectCostPerUnit.toFixed(6)}`);
        }
      });
    }
    
    // 6. Asignar costos a productos según su % DENTRO DE SU CATEGORÍA
    const result = productPrices.map(product => {
      const categoryId = product.category_id;
      const categoryIndirectCosts = costsByCategory[categoryId] || 0;
      
      // Detectar tipo de categoría ANTES de verificar si hay costos
      const categoryNameLower = (product.category_name || '').toLowerCase();
      const productNameLower = (product.product_name || '').toLowerCase();
      const isAdoquinesCategory = categoryNameLower.includes('adoquin') || 
                                 categoryNameLower === 'adoquines' ||
                                 productNameLower.includes('adoquin');
      const isBloquesCategory = (categoryNameLower.includes('bloque') || 
                                categoryNameLower === 'bloques' ||
                                productNameLower.includes('bloque')) && !isAdoquinesCategory;
      const isViguetasCategory = categoryNameLower.includes('vigueta') || 
                                categoryNameLower === 'viguetas' ||
                                productNameLower.includes('vigueta');
      
      // Verificar si hay costos: para bloques y adoquines, usar costos combinados
      // Para otras categorías, usar costos de la categoría específica
      let hasCosts = false;
      if (isBloquesCategory || isAdoquinesCategory) {
        // Para bloques y adoquines, verificar costos combinados
        if (isBloquesCategory && combinedBloquesIndirectCosts > 0) {
          hasCosts = true;
        } else if (isAdoquinesCategory && combinedAdoquinesIndirectCosts > 0) {
          hasCosts = true;
          }
        } else {
        // Para otras categorías, verificar costos de la categoría específica
        hasCosts = categoryIndirectCosts > 0;
      }
      
      if (hasCosts) {
        const productsInCategory = productPrices.filter(p => p.category_id === categoryId);
        const hasRealData = Object.keys(distributionData).length > 0;

        let productQuantity = 1;
        let totalCategoryQuantity = productsInCategory.length;
        let distributionRatio = 1 / productsInCategory.length;
        let combinedCategoryIndirectCosts = categoryIndirectCosts; // Por defecto, usar el de la categoría

        // Las variables de tipo de categoría ya están definidas arriba
        
        log(`🔍 ${product.product_name}: Categoría = "${product.category_name}", esBloques = ${isBloquesCategory}, esAdoquines = ${isAdoquinesCategory}, esViguetas = ${isViguetasCategory}`);
        
        // Función auxiliar para extraer metros del nombre
        const extractMetersFromName = (name: string): number => {
          const patterns = [
            /(\d+\.?\d*)\s*m\b/i,
            /(\d+\.?\d*)\s*metro/i,
            /(\d+\.?\d*)\s*mts/i,
            /(\d+,\d+)\s*m\b/i,
          ];
          for (const pattern of patterns) {
            const match = name.match(pattern);
            if (match) {
              const meterString = match[1].replace(',', '.');
              const meters = parseFloat(meterString);
              if (!isNaN(meters) && meters > 0) {
                return meters;
              }
            }
          }
          return 0;
        };
        
        if (isViguetasCategory) {
          // Para VIGUETAS: distribuir por metros totales
          const productId = Number(product.id);
          const productUnits = distributionData[productId] || 0;
          const productMeters = extractMetersFromName(product.product_name);
          
          // Calcular total de metros de la categoría: suma de (metros × cantidad) para cada vigueta
          let totalCategoryMeters = 0;
          productsInCategory.forEach(p => {
            const pId = Number(p.id);
            const pUnits = distributionData[pId] || 0;
            const pMeters = extractMetersFromName(p.product_name);
            totalCategoryMeters += pMeters * pUnits;
          });
          
          log(`📏 ${product.product_name} (VIGUETAS - COSTOS INDIRECTOS):`);
          log(`   - Metros del producto: ${productMeters}m`);
          log(`   - Unidades vendidas/producidas: ${productUnits.toLocaleString('es-AR')}`);
          log(`   - Metros totales del producto: ${(productMeters * productUnits).toLocaleString('es-AR')}m`);
          log(`   - Total metros de la categoría: ${totalCategoryMeters.toLocaleString('es-AR')}m`);
          log(`   - Método: ${distributionMethod}`);
          
          if (totalCategoryMeters > 0 && productMeters > 0) {
            let indirectCostPerUnit = 0;
            
            if (distributionMethod === 'simulation') {
              // SIMULACIÓN: Cada vigueta paga el costo total completo de la categoría, dividido por sus unidades
              indirectCostPerUnit = productUnits > 0 ? categoryIndirectCosts / productUnits : 0;
              log(`   - 🎮 SIMULACIÓN: Costo total categoría = $${categoryIndirectCosts.toFixed(2)}`);
              log(`   - 🎮 Costo por unidad: $${categoryIndirectCosts.toFixed(2)} / ${productUnits} = $${indirectCostPerUnit.toFixed(6)}`);
              log(`   - 🎮 Costo total producto: $${categoryIndirectCosts.toFixed(2)}`);
            } else {
              // VENTAS/PRODUCCIÓN: Distribución proporcional por metros
              const costPerMeter = categoryIndirectCosts / totalCategoryMeters;
              indirectCostPerUnit = productMeters * costPerMeter;
              log(`   - Costo total categoría: $${categoryIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
              log(`   - Costo por metro: $${costPerMeter.toFixed(6)}/m`);
              log(`   - Costo por unidad (${productMeters}m × $${costPerMeter.toFixed(6)}/m): $${indirectCostPerUnit.toFixed(6)}`);
            }

        return {
              productId: Number(product.id),
          indirectCost: indirectCostPerUnit,
              totalIndirectCost: indirectCostPerUnit * productUnits,
          breakdown: costsBreakdownByCategory[categoryId] || [],
          distributionInfo: {
                product_quantity: productUnits,
                category_total_quantity: totalCategoryMeters,
                distribution_ratio: distributionMethod === 'simulation' ? 1 : (productMeters * productUnits) / totalCategoryMeters,
                percentage_of_category: distributionMethod === 'simulation' ? 100 : ((productMeters * productUnits) / totalCategoryMeters) * 100,
            has_real_data: hasRealData,
            data_source: dataSource,
            category_total_cost: categoryIndirectCosts,
                product_total_cost: indirectCostPerUnit * productUnits
          }
        };
      } else {
            // Sin datos o sin metros, no recibe costos
        return {
              productId: Number(product.id),
          indirectCost: 0,
          totalIndirectCost: 0,
          breakdown: [],
          distributionInfo: {
            product_quantity: 0,
            category_total_quantity: 0,
            distribution_ratio: 0,
            percentage_of_category: 0,
            has_real_data: false,
            data_source: dataSource,
            category_total_cost: 0,
            product_total_cost: 0
          }
        };
      }
        } else if (isBloquesCategory || isAdoquinesCategory) {
          // Para BLOQUES y ADOQUINES: usar los costos precalculados proporcionales
          const productId = Number(product.id);
          productQuantity = distributionData[productId] || 0;
          
          // Declarar variables antes de usarlas
          let indirectCostPerUnit = 0;
          let totalIndirectCostForProduct = 0;
          let distributionRatio = 0;
          let totalCategoryQuantity = 0;
          let combinedCategoryIndirectCosts = 0;
          
          // Obtener los costos precalculados
          const costosPrecalculados = isBloquesCategory ? costosProporcionalesBloques[productId] : costosProporcionalesAdoquines[productId];
          
          // Log para verificar si se encuentran los costos precalculados
          const categoryType = isBloquesCategory ? 'BLOQUES' : 'ADOQUINES';
          log(`🔍 BUSCANDO COSTOS PRECALCULADOS - ${product.product_name} (${categoryType}):`);
          log(`   - productId: ${productId} (tipo: ${typeof productId})`);
          log(`   - costosPrecalculados encontrado: ${!!costosPrecalculados}`);
          if (!costosPrecalculados) {
            const dictToCheck = isBloquesCategory ? costosProporcionalesBloques : costosProporcionalesAdoquines;
            const keys = Object.keys(dictToCheck).map(k => Number(k));
            log(`   - ⚠️ No se encontraron costos precalculados. Claves disponibles en dict: [${keys.slice(0, 5).join(', ')}...] (${keys.length} total)`);
            log(`   - Verificando si productId está en keys: ${keys.includes(productId)}`);
          }
          
          if (costosPrecalculados) {
            // Usar los valores precalculados
            indirectCostPerUnit = costosPrecalculados.indirectCost;
            totalIndirectCostForProduct = costosPrecalculados.totalCost;
            distributionRatio = costosPrecalculados.ratio;
            
            // Calcular totalCategoryQuantity para el distributionInfo
            const allProductsOfType = isBloquesCategory ? allBloqueProducts : allAdoquinProducts;
            totalCategoryQuantity = allProductsOfType.reduce((sum, p) => {
              const pId = Number(p.id);
              return sum + (distributionData[pId] || 0);
            }, 0);
            
            // Usar los costos combinados precalculados
            if (isBloquesCategory) {
              combinedCategoryIndirectCosts = combinedBloquesIndirectCosts;
            } else {
              combinedCategoryIndirectCosts = combinedAdoquinesIndirectCosts;
            }
            
            const categoryType = isBloquesCategory ? 'BLOQUES' : 'ADOQUINES';
            log(`📊 ===== USANDO COSTOS PRECALCULADOS (${categoryType} - INDIRECTOS) =====`);
            log(`   - Producto: ${product.product_name}`);
            log(`   - Product ID: ${productId}`);
            log(`   - Cantidad: ${productQuantity.toLocaleString('es-AR')}`);
            log(`   - Ratio: ${(distributionRatio * 100).toFixed(4)}%`);
            log(`   - Costos totales de la categoría: $${combinedCategoryIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            log(`   - Costo total proporcional asignado: $${totalIndirectCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${(distributionRatio * 100).toFixed(4)}% de $${combinedCategoryIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
            log(`   - Costo por unidad: $${indirectCostPerUnit.toFixed(6)}`);
            log(`   - ✅ VERIFICACIÓN MATEMÁTICA: ${productQuantity.toLocaleString('es-AR')} × $${indirectCostPerUnit.toFixed(6)} = $${totalIndirectCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            log(`   - ✅ DISTRIBUCIÓN PROPORCIONAL: ${(distributionRatio * 100).toFixed(4)}% de las ${distributionMethod === 'production' ? 'producción' : 'ventas'} → ${(distributionRatio * 100).toFixed(4)}% de los costos`);
            } else {
            // Si no hay costos precalculados, no recibe costos
            indirectCostPerUnit = 0;
            totalIndirectCostForProduct = 0;
            distributionRatio = 0;
            totalCategoryQuantity = 0;
            combinedCategoryIndirectCosts = 0;
            warn(`   ⚠️ No se encontraron costos precalculados para ${product.product_name} (ID: ${productId})`);
          }
          
          // Saltar al return, ya que los valores están calculados
          const percentageOfCategory = distributionRatio * 100;
          const costosIndirectosParaMostrar = isBloquesCategory ? combinedBloquesIndirectCosts : combinedAdoquinesIndirectCosts;

            return {
            productId: Number(product.id),
            indirectCost: indirectCostPerUnit,
            totalIndirectCost: totalIndirectCostForProduct,
            breakdown: costsBreakdownByCategory[categoryId] || [],
            distributionInfo: {
              product_quantity: productQuantity,
              category_total_quantity: totalCategoryQuantity,
              distribution_ratio: distributionRatio,
              percentage_of_category: percentageOfCategory,
              has_real_data: hasRealData,
              data_source: dataSource,
              category_total_cost: costosIndirectosParaMostrar,
              product_total_cost: totalIndirectCostForProduct
            }
          };
    } else {
          // Para otras categorías: distribución equitativa o total según modo
          productQuantity = distributionData[product.id] || 0;
          
          if (distributionMethod === 'simulation') {
            // SIMULACIÓN: Cada producto paga el total
            totalCategoryQuantity = 1;
            distributionRatio = 1;
            log(`📊 ${product.product_name} (${product.category_name}): 🎮 SIMULACIÓN - Paga el 100% de costos`);
          } else {
            // VENTAS/PRODUCCIÓN: Distribución equitativa
            totalCategoryQuantity = productsInCategory.length;
            distributionRatio = 1 / productsInCategory.length;
            log(`📊 ${product.product_name} (${product.category_name}): Distribución equitativa (${(distributionRatio * 100).toFixed(2)}%)`);
          }
        }
        
        // El producto recibe su % de los costos de SU CATEGORÍA según su participación
        // IMPORTANTE: El porcentaje se calcula sobre el TOTAL de costos indirectos de la categoría
        // Para bloques y adoquines, usar el total combinado de todas las categorías del mismo tipo
        const percentageOfCategory = distributionRatio * 100;
        const costosIndirectosParaCalcular = (isBloquesCategory || isAdoquinesCategory) ? combinedCategoryIndirectCosts : categoryIndirectCosts;
        
        // Log específico para verificar que se usan los costos correctos
        if (isBloquesCategory || isAdoquinesCategory) {
          log(`   🔍 VERIFICACIÓN COSTOS - ${product.product_name}:`);
          log(`      - combinedCategoryIndirectCosts: $${combinedCategoryIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - categoryIndirectCosts: $${categoryIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - costosIndirectosParaCalcular: $${costosIndirectosParaCalcular.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - distributionRatio: ${distributionRatio.toFixed(6)}`);
        }
        
        let totalIndirectCostForProduct = 0;
        let indirectCostPerUnit = 0;
        
        if (distributionMethod === 'simulation' && !isBloquesCategory && !isAdoquinesCategory && !isViguetasCategory) {
          // SIMULACIÓN para otras categorías: Cada producto paga el total de su categoría, dividido por sus unidades
          totalIndirectCostForProduct = categoryIndirectCosts;
          indirectCostPerUnit = productQuantity > 0 ? categoryIndirectCosts / productQuantity : 0;
          log(`   - 🎮 SIMULACIÓN: Costo total categoría = $${categoryIndirectCosts.toFixed(2)}`);
          log(`   - 🎮 Costo por unidad: $${categoryIndirectCosts.toFixed(2)} / ${productQuantity} = $${indirectCostPerUnit.toFixed(6)}`);
    } else {
          // VENTAS/PRODUCCIÓN: Distribución proporcional
          totalIndirectCostForProduct = costosIndirectosParaCalcular * distributionRatio;
          indirectCostPerUnit = productQuantity > 0 ? totalIndirectCostForProduct / productQuantity : 0;
        }
        
        // Log adicional para verificar el cálculo
        if (isBloquesCategory || isAdoquinesCategory) {
          log(`   🔢 CÁLCULO FINAL - ${product.product_name} (ID: ${product.id}):`);
          log(`      - Costos indirectos combinados: $${costosIndirectosParaCalcular.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Distribution ratio: ${distributionRatio.toFixed(6)} (${percentageOfCategory.toFixed(2)}%)`);
          log(`      - Cantidad producto: ${productQuantity.toLocaleString('es-AR')}`);
          log(`      - Total categoría: ${totalCategoryQuantity.toLocaleString('es-AR')}`);
          log(`      - Costo total asignado: $${totalIndirectCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Costo por unidad: $${indirectCostPerUnit.toFixed(6)}`);
          log(`      - VERIFICACIÓN: ${productQuantity.toLocaleString('es-AR')} × $${indirectCostPerUnit.toFixed(6)} = $${(productQuantity * indirectCostPerUnit).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          
          // Log específico para P13 y P20 Portante
          if (product.product_name.includes('Bloque P13') || product.product_name.includes('Bloque P20 Portante')) {
            log(`   ⚠️⚠️⚠️ PRODUCTO ESPECÍFICO: ${product.product_name}`);
            log(`      - combinedCategoryIndirectCosts usado: $${combinedCategoryIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            log(`      - distributionRatio: ${distributionRatio.toFixed(6)} (${(distributionRatio * 100).toFixed(2)}%)`);
            log(`      - productQuantity: ${productQuantity.toLocaleString('es-AR')}`);
            log(`      - totalCategoryQuantity: ${totalCategoryQuantity.toLocaleString('es-AR')}`);
            log(`      - totalIndirectCostForProduct: $${totalIndirectCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            log(`      - indirectCostPerUnit: $${indirectCostPerUnit.toFixed(6)}`);
            log(`      - VERIFICACIÓN MATEMÁTICA: $${costosIndirectosParaCalcular.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${distributionRatio.toFixed(6)} = $${totalIndirectCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            log(`      - VERIFICACIÓN MATEMÁTICA: $${totalIndirectCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${productQuantity.toLocaleString('es-AR')} = $${indirectCostPerUnit.toFixed(6)}`);
          }
        }
        
        const categoryTypeLabel = isBloquesCategory ? 'Bloques' : (isAdoquinesCategory ? 'Adoquines' : product.category_name);
        log(`💰 ${product.product_name} (Categoría ID: ${categoryId}, Nombre categoría: ${product.category_name}, Tipo: ${categoryTypeLabel}):`);
        log(`   - Productos en esta categoría (category_id=${categoryId}): ${productsInCategory.length}`);
        log(`   - Unidades vendidas/producto: ${productQuantity.toLocaleString('es-AR')}`);
        log(`   - Total categoría: ${totalCategoryQuantity.toLocaleString('es-AR')}`);
        log(`   - Ratio de distribución: ${distributionRatio.toFixed(6)} (${percentageOfCategory.toFixed(2)}%)`);
        const costosIndirectosParaMostrar = (isBloquesCategory || isAdoquinesCategory) ? combinedCategoryIndirectCosts : categoryIndirectCosts;
        log(`   - Costos indirectos TOTALES de categoría (category_id ${categoryId}): $${categoryIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        if (isBloquesCategory || isAdoquinesCategory) {
          log(`   - Costos indirectos TOTALES combinados de ${categoryTypeLabel}: $${combinedCategoryIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        }
        log(`   - Costo TOTAL asignado al producto (${percentageOfCategory.toFixed(2)}% de $${costosIndirectosParaMostrar.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}): $${totalIndirectCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        log(`   - Costo por unidad: $${indirectCostPerUnit.toFixed(6)} ($${totalIndirectCostForProduct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${productQuantity.toLocaleString('es-AR')} unidades)`);
        log(`   - VERIFICACIÓN: ${productQuantity.toLocaleString('es-AR')} unidades × $${indirectCostPerUnit.toFixed(6)} = $${(productQuantity * indirectCostPerUnit).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

        return {
          productId: Number(product.id), // Asegurar que sea número
          indirectCost: indirectCostPerUnit,
          totalIndirectCost: totalIndirectCostForProduct,
          breakdown: costsBreakdownByCategory[categoryId] || [],
          distributionInfo: {
            product_quantity: productQuantity,
            category_total_quantity: totalCategoryQuantity,
            distribution_ratio: distributionRatio,
            percentage_of_category: distributionRatio * 100,
            has_real_data: hasRealData,
            data_source: dataSource,
            category_total_cost: categoryIndirectCosts,
            product_total_cost: totalIndirectCostForProduct
          }
        };
      } else {
        return {
          productId: Number(product.id), // Asegurar que sea número
          indirectCost: 0,
          totalIndirectCost: 0,
          breakdown: [],
          distributionInfo: {
            product_quantity: 0,
            category_total_quantity: 0,
            distribution_ratio: 0,
            percentage_of_category: 0,
            has_real_data: false,
            data_source: dataSource,
            category_total_cost: 0,
            product_total_cost: 0
          }
        };
      }
    });

    const totalIndirectCosts = result.reduce((sum, item) => sum + item.indirectCost, 0);
    log('💰 Total costos indirectos distribuidos:', totalIndirectCosts.toLocaleString('es-AR'));

    // Log específico para bloques P13 y P20 Portante
    const p13Result = result.find(r => {
      const product = productPrices.find(p => p.id === r.productId);
      return product && product.product_name.includes('Bloque P13');
    });
    const p20PortanteResult = result.find(r => {
      const product = productPrices.find(p => p.id === r.productId);
      return product && product.product_name.includes('Bloque P20 Portante');
    });
    
    if (p13Result) {
      log(`🔍 RESULTADO P13 - productId: ${p13Result.productId}, indirectCost: $${p13Result.indirectCost.toFixed(6)}, totalIndirectCost: $${p13Result.totalIndirectCost.toLocaleString('es-AR')}`);
      if ('distributionInfo' in p13Result && p13Result.distributionInfo) {
        log(`   - distributionInfo.percentage_of_category: ${p13Result.distributionInfo.percentage_of_category.toFixed(2)}%`);
        log(`   - distributionInfo.product_quantity: ${p13Result.distributionInfo.product_quantity?.toLocaleString('es-AR')}`);
        log(`   - distributionInfo.category_total_quantity: ${p13Result.distributionInfo.category_total_quantity?.toLocaleString('es-AR')}`);
      }
    }
    if (p20PortanteResult) {
      log(`🔍 RESULTADO P20 Portante - productId: ${p20PortanteResult.productId}, indirectCost: $${p20PortanteResult.indirectCost.toFixed(6)}, totalIndirectCost: $${p20PortanteResult.totalIndirectCost.toLocaleString('es-AR')}`);
      if ('distributionInfo' in p20PortanteResult && p20PortanteResult.distributionInfo) {
        log(`   - distributionInfo.percentage_of_category: ${p20PortanteResult.distributionInfo.percentage_of_category.toFixed(2)}%`);
        log(`   - distributionInfo.product_quantity: ${p20PortanteResult.distributionInfo.product_quantity?.toLocaleString('es-AR')}`);
        log(`   - distributionInfo.category_total_quantity: ${p20PortanteResult.distributionInfo.category_total_quantity?.toLocaleString('es-AR')}`);
      }
    }
    
    // Comparar los costos de P13 y P20 Portante
    if (p13Result && p20PortanteResult) {
      log(`🔍 COMPARACIÓN P13 vs P20 Portante:`);
      log(`   - P13 indirectCost: $${p13Result.indirectCost.toFixed(6)}, P20 Portante indirectCost: $${p20PortanteResult.indirectCost.toFixed(6)}`);
      log(`   - ¿Son iguales?: ${p13Result.indirectCost === p20PortanteResult.indirectCost ? 'SÍ ⚠️' : 'NO ✅'}`);
      log(`   - Diferencia: $${Math.abs(p13Result.indirectCost - p20PortanteResult.indirectCost).toFixed(6)}`);
    }

    return result;

  } catch (error) {
    console.error('❌ Error calculando costos indirectos:', error);
    return productPrices.map(product => ({
      productId: product.id,
      indirectCost: 0,
      breakdown: []
    }));
  }
}

// ============================================================================
// ENDPOINT POST PARA SIMULACIÓN
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, productionMonth, simulatedQuantities, placas, dias, bancos, diasViguetas } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    if (!simulatedQuantities || Object.keys(simulatedQuantities).length === 0) {
      return NextResponse.json(
        { error: 'simulatedQuantities es requerido para simulación' },
        { status: 400 }
      );
    }

    log('🎮 === CALCULADORA COSTOS FINAL - SIMULACIÓN ===');
    log('CompanyId:', companyId);
    log('Mes:', productionMonth || 'N/A');
    log('Cantidades simuladas:', Object.keys(simulatedQuantities).length, 'productos');

    // Convertir las claves de simulatedQuantities a números si vienen como strings
    const quantities: { [productId: number]: number } = {};
    Object.keys(simulatedQuantities).forEach(key => {
      quantities[Number(key)] = Number(simulatedQuantities[key]) || 0;
    });

    // Calcular simulación base
    const result = await calculateCostsForSimulation(
      parseInt(companyId), 
      productionMonth || '2025-08', 
      quantities
    );

    // Calcular variaciones de cuartos (±1, ±2, ±3 cuartos)
    // Un cuarto = 240 placas
    const QUARTOS_POR_PLACA = 1 / 240; // 1 placa = 1/240 cuartos
    const PLACAS_POR_CUARTO = 240;

    // Obtener productos de Bloques desde el resultado de la simulación
    // Calcular placas actuales basándose en las cantidades simuladas
    let totalPlacasActual = 0;
    const bloquesProducts = (result.productPrices || []).filter(p => {
      const nameLower = (p.product_name || '').toLowerCase();
      const catLower = (p.category_name || '').toLowerCase();
      return (nameLower.includes('bloque') || catLower.includes('bloque')) && 
             !nameLower.includes('adoquin');
    });

    // Obtener recetas para calcular unidades por placa (necesarias para variaciones)
    const recipes = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.product_id,
        r.units_per_item
      FROM recipes r
      WHERE r.company_id = ${companyId}
      AND r.is_active = true
    ` as any[];

    // Intentar obtener las placas desde el body primero (modo "Por Total")
    // Luego desde simulatedQuantities con _placas, finalmente calcular desde las unidades
    let placasFromSimulation = 0;
    
    // Prioridad 1: Usar placas enviadas desde el frontend (modo "Por Total")
    if (placas && typeof placas === 'object') {
      const placasValues = Object.values(placas) as number[];
      const maxPlacas = Math.max(...placasValues.filter(p => p > 0), 0);
      if (maxPlacas > 0) {
        placasFromSimulation = maxPlacas;
        log(`   ✅ Placas obtenidas desde frontend (modo "Por Total"): ${placasFromSimulation}`);
      }
    }
    
    // Prioridad 2: Si no hay placas del frontend, buscar en simulatedQuantities con _placas
    if (placasFromSimulation === 0) {
      Object.keys(simulatedQuantities).forEach(key => {
        if (key.includes('_placas')) {
          const productId = parseInt(key.replace('_placas', ''));
          const placasValue = Number(simulatedQuantities[key]) || 0;
          if (placasValue > placasFromSimulation) {
            placasFromSimulation = placasValue; // Usar el máximo de placas encontrado
          }
        }
      });
      if (placasFromSimulation > 0) {
        log(`   ✅ Placas obtenidas desde simulatedQuantities: ${placasFromSimulation}`);
      }
    }

    // Si no hay placas explícitas, calcular desde las unidades simuladas
    if (placasFromSimulation === 0) {
      // Calcular placas basándose en unidades totales y unidades por placa
      let totalUnidadesBloques = 0;
      let unidadesPorPlacaPromedio = 0;
      let countProducts = 0;

      bloquesProducts.forEach(product => {
        const productId = Number(product.id);
        const unidades = quantities[productId] || 0;
        if (unidades > 0) {
          // Buscar receta para este producto
          const recipe = recipes.find((r: any) => Number(r.product_id) === productId);
          const unidadesPorPlaca = recipe ? Number(recipe.units_per_item) || 1 : 1;
          totalUnidadesBloques += unidades;
          unidadesPorPlacaPromedio += unidadesPorPlaca;
          countProducts++;
        }
      });

      if (countProducts > 0 && unidadesPorPlacaPromedio > 0) {
        unidadesPorPlacaPromedio = unidadesPorPlacaPromedio / countProducts;
        // Estimar placas: unidades totales / unidades por placa
        // Pero necesitamos los días también
        let diasFromSimulation = 22; // Por defecto
        
        // Prioridad 1: Usar días enviados desde el frontend
        if (dias && typeof dias === 'object') {
          const diasValues = Object.values(dias) as number[];
          const maxDias = Math.max(...diasValues.filter(d => d > 0), 0);
          if (maxDias > 0) {
            diasFromSimulation = maxDias;
          }
    } else {
          // Prioridad 2: Buscar en simulatedQuantities
          Object.keys(simulatedQuantities).forEach(key => {
            if (key.includes('_dias') && !key.includes('_dias_vigueta')) {
              const diasValue = Number(simulatedQuantities[key]) || 22;
              if (diasValue > 0) diasFromSimulation = diasValue;
            }
          });
        }
        // placas = unidades / (unidades_por_placa * dias)
        if (unidadesPorPlacaPromedio > 0 && diasFromSimulation > 0) {
          placasFromSimulation = Math.ceil(totalUnidadesBloques / (unidadesPorPlacaPromedio * diasFromSimulation));
        }
      }
    }

    totalPlacasActual = placasFromSimulation;
    const cuartosActuales = totalPlacasActual / PLACAS_POR_CUARTO;

    log('📊 === VARIACIONES DE CUARTOS ===');
    log(`   - Placas actuales: ${totalPlacasActual}`);
    log(`   - Cuartos actuales: ${cuartosActuales.toFixed(2)}`);

    // Generar variaciones: -3, -2, -1, +1, +2, +3 cuartos
    const variaciones = [-3, -2, -1, 1, 2, 3];
    const escenarios: any[] = [];
    escenarios.push({
      nombre: 'Simulación Actual',
      variacionCuartos: 0,
      placas: totalPlacasActual,
      cuartos: cuartosActuales,
      resultado: result
    });

    for (const variacion of variaciones) {
      const nuevasPlacas = Math.max(0, totalPlacasActual + (variacion * PLACAS_POR_CUARTO));
      const nuevosCuartos = nuevasPlacas / PLACAS_POR_CUARTO;

      // Obtener días de la simulación actual
      // Prioridad 1: Usar días enviados desde el frontend
      // Prioridad 2: Buscar en simulatedQuantities
      let diasSimulacion = 22;
      
      if (dias && typeof dias === 'object') {
        const diasValues = Object.values(dias) as number[];
        const maxDias = Math.max(...diasValues.filter(d => d > 0), 0);
        if (maxDias > 0) {
          diasSimulacion = maxDias;
        }
    } else {
        Object.keys(simulatedQuantities).forEach(key => {
          if (key.includes('_dias') && !key.includes('_dias_vigueta')) {
            const diasValue = Number(simulatedQuantities[key]) || 22;
            if (diasValue > 0) diasSimulacion = diasValue;
          }
        });
      }

      // Recalcular cantidades para todos los productos de Bloques
      const nuevasQuantities: { [productId: number]: number } = { ...quantities };
      
      bloquesProducts.forEach(product => {
        const productId = Number(product.id);
        // Buscar receta para obtener unidades por placa
        const recipe = recipes.find((r: any) => Number(r.product_id) === productId);
        const unidadesPorPlaca = recipe ? Number(recipe.units_per_item) || 1 : 1;
        const nuevasUnidades = nuevasPlacas > 0 ? nuevasPlacas * diasSimulacion * unidadesPorPlaca : 0;
        nuevasQuantities[productId] = nuevasUnidades;
      });

      // Calcular costos para esta variación
      try {
        const resultadoVariacion = await calculateCostsForSimulation(
          parseInt(companyId),
          productionMonth || '2025-08',
          nuevasQuantities
        );

        escenarios.push({
          nombre: variacion > 0 ? `+${variacion} cuarto${variacion > 1 ? 's' : ''}` : `${variacion} cuarto${variacion < -1 ? 's' : ''}`,
          variacionCuartos: variacion,
          placas: nuevasPlacas,
          cuartos: nuevosCuartos,
          resultado: resultadoVariacion
        });

        log(`   ✅ Variación ${variacion > 0 ? '+' : ''}${variacion} cuartos: ${nuevasPlacas} placas, ${nuevosCuartos.toFixed(2)} cuartos`);
      } catch (error) {
        console.error(`   ❌ Error calculando variación ${variacion} cuartos:`, error);
      }
    }

    // Calcular variaciones de bancos para viguetas (±1, ±2, ±3 bancos)
    // 1 banco = 1300 metros útiles
    const METROS_UTILES_POR_BANCO = 1300;

    // Obtener productos de Viguetas desde el resultado de la simulación
    let totalBancosActual = 0;
    const viguetasProducts = (result.productPrices || []).filter(p => {
      const nameLower = (p.product_name || '').toLowerCase();
      const catLower = (p.category_name || '').toLowerCase();
      return (nameLower.includes('vigueta') || catLower.includes('vigueta'));
    });

    // Intentar obtener los bancos desde el body primero (modo "Por Total")
    // Luego desde simulatedQuantities con _bancos, finalmente calcular desde las unidades
    let bancosFromSimulation = 0;
    
    // Prioridad 1: Usar bancos enviados desde el frontend (modo "Por Total")
    if (bancos && typeof bancos === 'object') {
      const bancosValues = Object.values(bancos) as number[];
      const maxBancos = Math.max(...bancosValues.filter(b => b > 0), 0);
      if (maxBancos > 0) {
        bancosFromSimulation = maxBancos;
        log(`   ✅ Bancos obtenidos desde frontend (modo "Por Total"): ${bancosFromSimulation}`);
      }
    }
    
    // Prioridad 2: Si no hay bancos del frontend, buscar en simulatedQuantities con _bancos
    if (bancosFromSimulation === 0) {
      Object.keys(simulatedQuantities).forEach(key => {
        if (key.includes('_bancos')) {
          const productId = parseInt(key.replace('_bancos', ''));
          const bancosValue = Number(simulatedQuantities[key]) || 0;
          if (bancosValue > bancosFromSimulation) {
            bancosFromSimulation = bancosValue; // Usar el máximo de bancos encontrado
          }
        }
      });
      if (bancosFromSimulation > 0) {
        log(`   ✅ Bancos obtenidos desde simulatedQuantities: ${bancosFromSimulation}`);
      }
    }

    // Si no hay bancos explícitos, calcular desde las unidades simuladas
    if (bancosFromSimulation === 0 && viguetasProducts.length > 0) {
      // Calcular bancos basándose en unidades totales y metros por vigueta
      let totalMetrosViguetas = 0;

      viguetasProducts.forEach(product => {
        const productId = Number(product.id);
        const unidades = quantities[productId] || 0;
        if (unidades > 0) {
          // Extraer longitud de la vigueta del nombre
          const lengthMatch = product.product_name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
          const longitudVigueta = lengthMatch ? parseFloat(lengthMatch[1]) : 1;
          const metrosParaEsteProducto = unidades * longitudVigueta;
          totalMetrosViguetas += metrosParaEsteProducto;
        }
      });

      // Estimar bancos: metros totales / metros útiles por banco
      // Pero necesitamos los días también
      let diasViguetasFromSimulation = 22; // Por defecto
      
      // Prioridad 1: Usar días enviados desde el frontend
      if (diasViguetas && typeof diasViguetas === 'object') {
        const diasValues = Object.values(diasViguetas) as number[];
        const maxDias = Math.max(...diasValues.filter(d => d > 0), 0);
        if (maxDias > 0) {
          diasViguetasFromSimulation = maxDias;
        }
      } else {
        // Prioridad 2: Buscar en simulatedQuantities
        Object.keys(simulatedQuantities).forEach(key => {
          if (key.includes('_dias_vigueta')) {
            const diasValue = Number(simulatedQuantities[key]) || 22;
            if (diasValue > 0) diasViguetasFromSimulation = diasValue;
          }
        });
      }
      // bancos = metros totales / (metros_útiles_por_banco * dias)
      if (diasViguetasFromSimulation > 0) {
        bancosFromSimulation = Math.ceil(totalMetrosViguetas / (METROS_UTILES_POR_BANCO * diasViguetasFromSimulation));
      }
    }

    totalBancosActual = bancosFromSimulation;
    // Calcular días para metros actuales
    let diasParaMetrosActuales = 22;
    if (diasViguetas && typeof diasViguetas === 'object') {
      const diasValues = Object.values(diasViguetas) as number[];
      const maxDias = Math.max(...diasValues.filter(d => d > 0), 0);
      if (maxDias > 0) {
        diasParaMetrosActuales = maxDias;
      }
    } else {
      Object.keys(simulatedQuantities).forEach(key => {
        if (key.includes('_dias_vigueta')) {
          const diasValue = Number(simulatedQuantities[key]) || 22;
          if (diasValue > 0) diasParaMetrosActuales = diasValue;
        }
      });
    }
    const metrosActuales = totalBancosActual * METROS_UTILES_POR_BANCO * diasParaMetrosActuales;

    log('📊 === VARIACIONES DE BANCOS ===');
    log(`   - Bancos actuales: ${totalBancosActual}`);
    log(`   - Metros actuales: ${metrosActuales.toFixed(2)}`);

    // Generar variaciones: -3, -2, -1, +1, +2, +3 bancos
    const variacionesBancos = [-3, -2, -1, 1, 2, 3];
    const escenariosViguetas: any[] = [];
    
    if (viguetasProducts.length > 0 && totalBancosActual > 0) {
      escenariosViguetas.push({
        nombre: 'Simulación Actual',
        variacionBancos: 0,
        bancos: totalBancosActual,
        metros: metrosActuales,
        resultado: result
      });

      for (const variacion of variacionesBancos) {
        const nuevosBancos = Math.max(0, totalBancosActual + variacion);
        
        // Obtener días de la simulación actual
        let diasSimulacionViguetas = 22;
        
        if (diasViguetas && typeof diasViguetas === 'object') {
          const diasValues = Object.values(diasViguetas) as number[];
          const maxDias = Math.max(...diasValues.filter(d => d > 0), 0);
          if (maxDias > 0) {
            diasSimulacionViguetas = maxDias;
          }
        } else {
          Object.keys(simulatedQuantities).forEach(key => {
            if (key.includes('_dias_vigueta')) {
              const diasValue = Number(simulatedQuantities[key]) || 22;
              if (diasValue > 0) diasSimulacionViguetas = diasValue;
            }
          });
        }

        // Recalcular cantidades para todos los productos de Viguetas
        const nuevasQuantitiesViguetas: { [productId: number]: number } = { ...quantities };
        
        const nuevosMetrosTotales = nuevosBancos > 0 ? nuevosBancos * diasSimulacionViguetas * METROS_UTILES_POR_BANCO : 0;
        
        // Calcular metros totales y distribuirlos proporcionalmente por longitud de vigueta
        let totalLength = 0;
        const viguetaLengths: { [id: number]: number } = {};

        viguetasProducts.forEach(vigueta => {
          const lengthMatch = vigueta.product_name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
          const length = lengthMatch ? parseFloat(lengthMatch[1]) : 1;
          viguetaLengths[vigueta.id] = length;
          totalLength += length;
        });

        // Distribuir metros proporcionalmente
        // Guardar metros totales por producto para usarlos en el cálculo de materiales
        const metrosPorProducto: { [productId: number]: number } = {};
        
        viguetasProducts.forEach(vigueta => {
          const productId = Number(vigueta.id);
          const viguetaLength = viguetaLengths[vigueta.id] || 1;
          const proportion = totalLength > 0 ? viguetaLength / totalLength : 1 / viguetasProducts.length;
          const metersForThisVigueta = nuevosMetrosTotales * proportion;
          const unitsNeeded = viguetaLength > 0 ? Math.floor(metersForThisVigueta / viguetaLength) : 0;
          nuevasQuantitiesViguetas[productId] = unitsNeeded;
          // Guardar metros totales reales (sin Math.floor) para calcular materiales correctamente
          metrosPorProducto[productId] = metersForThisVigueta;
        });

        // Calcular costos para esta variación
        try {
          log(`\n🔍 === CALCULANDO VARIACIÓN ${variacion > 0 ? '+' : ''}${variacion} BANCOS ===`);
          log(`   - Bancos: ${nuevosBancos} (anterior: ${totalBancosActual})`);
          log(`   - Metros totales: ${nuevosMetrosTotales.toFixed(2)} (anterior: ${metrosActuales.toFixed(2)})`);
          log(`   - Días: ${diasSimulacionViguetas}`);
          
          const resultadoVariacion = await calculateCostsForSimulation(
            parseInt(companyId),
            productionMonth || '2025-08',
            nuevasQuantitiesViguetas
          );

          // Calcular totales de materiales y costos indirectos para comparar
          let totalMaterialesVariacion = 0;
          let totalIndirectosVariacion = 0;
          let totalEmpleadosVariacion = 0;
          let totalCostosVariacion = 0;
          let totalMetrosCalculados = 0;
          
          // Calcular materiales basándose en metros totales, no en unidades
          // El costo por metro de materiales es $957.57/m según el usuario
          const costoPorMetroMateriales = 957.57;
          const materialesEsperados = nuevosMetrosTotales * costoPorMetroMateriales;
          
          if (resultadoVariacion.productPrices) {
            resultadoVariacion.productPrices.forEach((p: any) => {
              const productId = Number(p.id);
              const qty = nuevasQuantitiesViguetas[productId] || 0;
              if (qty > 0) {
                // Usar metros totales reales guardados (sin Math.floor) para calcular materiales correctamente
                const metrosTotalesProducto = metrosPorProducto[productId] || 0;
                totalMetrosCalculados += metrosTotalesProducto;
                
                // Para materiales, usar metros totales reales × costo por metro en lugar de unidades × costo por unidad
                // Esto corrige el problema de Math.floor() que pierde metros
                const materiales = metrosTotalesProducto * costoPorMetroMateriales;
                const indirectos = (p.cost_breakdown?.indirect_costs || 0) * qty;
                const empleados = (p.cost_breakdown?.employee_costs || 0) * qty;
                const total = materiales + indirectos + empleados;
                
                totalMaterialesVariacion += materiales;
                totalIndirectosVariacion += indirectos;
                totalEmpleadosVariacion += empleados;
                totalCostosVariacion += total;
              }
            });
          }
          
          // Calcular totales del escenario base para comparar
          let totalMaterialesBase = 0;
          let totalIndirectosBase = 0;
          let totalEmpleadosBase = 0;
          let totalCostosBase = 0;
          
          if (result && result.productPrices) {
            result.productPrices.forEach((p: any) => {
              const qty = quantities[Number(p.id)] || 0;
              if (qty > 0) {
                // Extraer metros del nombre del producto
                const metrosMatch = p.product_name?.match(/(\d+\.?\d*)\s*mts?/i);
                const metrosProducto = metrosMatch ? parseFloat(metrosMatch[1]) : 0;
                const metrosTotalesProducto = metrosProducto * qty;
                
                // Para materiales, usar metros totales × costo por metro para consistencia
                const materiales = metrosTotalesProducto * costoPorMetroMateriales;
                const indirectos = (p.cost_breakdown?.indirect_costs || 0) * qty;
                const empleados = (p.cost_breakdown?.employee_costs || 0) * qty;
                const total = materiales + indirectos + empleados;
                
                totalMaterialesBase += materiales;
                totalIndirectosBase += indirectos;
                totalEmpleadosBase += empleados;
                totalCostosBase += total;
              }
            });
          }
          
          const diferenciaMateriales = totalMaterialesVariacion - totalMaterialesBase;
          const diferenciaIndirectos = totalIndirectosVariacion - totalIndirectosBase;
          const diferenciaEmpleados = totalEmpleadosVariacion - totalEmpleadosBase;
          const diferenciaTotal = totalCostosVariacion - totalCostosBase;
          
          log(`\n💰 === COMPARACIÓN DE COSTOS ===`);
          log(`   📏 METROS:`);
          log(`      - Metros totales variación: ${nuevosMetrosTotales.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}m`);
          log(`      - Metros calculados desde productos: ${totalMetrosCalculados.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}m`);
          log(`      - Diferencia metros: ${(nuevosMetrosTotales - totalMetrosCalculados).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}m`);
          log(`   📦 MATERIALES:`);
          log(`      - Base: $${totalMaterialesBase.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Variación (calculado): $${totalMaterialesVariacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Variación (esperado: ${nuevosMetrosTotales.toFixed(2)}m × $${costoPorMetroMateriales}/m): $${materialesEsperados.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Diferencia calculado vs esperado: $${(totalMaterialesVariacion - materialesEsperados).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Diferencia: $${diferenciaMateriales.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${variacion > 0 ? '+' : ''}${variacion} banco${variacion !== 1 ? 's' : ''})`);
          log(`      - Diferencia por banco: $${(diferenciaMateriales / Math.abs(variacion)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`   💼 COSTOS INDIRECTOS:`);
          log(`      - Base: $${totalIndirectosBase.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Variación: $${totalIndirectosVariacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Diferencia: $${diferenciaIndirectos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`   👥 COSTOS EMPLEADOS:`);
          log(`      - Base: $${totalEmpleadosBase.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Variación: $${totalEmpleadosVariacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Diferencia: $${diferenciaEmpleados.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`   💰 TOTAL:`);
          log(`      - Base: $${totalCostosBase.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Variación: $${totalCostosVariacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Diferencia: $${diferenciaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          log(`      - Diferencia por banco: $${(diferenciaTotal / Math.abs(variacion)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

          escenariosViguetas.push({
            nombre: variacion > 0 ? `+${variacion} banco${variacion > 1 ? 's' : ''}` : `${variacion} banco${variacion < -1 ? 's' : ''}`,
            variacionBancos: variacion,
            bancos: nuevosBancos,
            metros: nuevosMetrosTotales,
            resultado: resultadoVariacion
          });

          log(`   ✅ Variación ${variacion > 0 ? '+' : ''}${variacion} bancos: ${nuevosBancos} bancos, ${nuevosMetrosTotales.toFixed(2)} metros`);
        } catch (error) {
          console.error(`   ❌ Error calculando variación ${variacion} bancos:`, error);
        }
      }

      // Agregar escenarios de viguetas al array principal
      escenarios.push(...escenariosViguetas);
    }

    return NextResponse.json({
      ...result,
      escenarios: escenarios,
      estadisticas: {
        placasActuales: totalPlacasActual,
        cuartosActuales: cuartosActuales,
        bancosActuales: totalBancosActual,
        metrosActuales: metrosActuales,
        variaciones: escenarios.map(e => ({
          nombre: e.nombre,
          variacionCuartos: e.variacionCuartos,
          variacionBancos: e.variacionBancos,
          placas: e.placas,
          cuartos: e.cuartos,
          bancos: e.bancos,
          metros: e.metros
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error en POST calculadora costos final (simulación):', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
  // Nota: No desconectar prisma aquí para evitar problemas con conexiones concurrentes
  // Prisma maneja el pool de conexiones automáticamente
}
