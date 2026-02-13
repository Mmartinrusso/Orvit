import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const productionMonth = searchParams.get('productionMonth') || '2025-08';
    const distributionMethod = searchParams.get('distributionMethod') || 'sales'; // 'sales' o 'production'

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 === CALCULADORA SIMPLE ===');
    console.log('CompanyId:', companyId);
    console.log('Mes:', productionMonth);

    // 1. OBTENER PRODUCTOS ACTIVOS
    const products = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.sku,
        p.category_id,
        p.unit_price,
        p.unit_cost,
        p.stock_quantity,
        pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.company_id = ${parseInt(companyId)}
      AND p.is_active = true
      ORDER BY pc.name, p.name
    ` as any[];

    console.log('📊 Productos encontrados:', products.length);

    // 2. OBTENER RECETAS ACTIVAS
    const recipes = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.name,
        r.product_id as "productId",
        r.subcategory_id as "subcategoryId",
        r.base_type as "baseType",
        r.output_quantity as "outputQuantity",
        r.output_unit_label as "outputUnitLabel"
      FROM recipes r
      WHERE r.company_id = ${parseInt(companyId)}
      AND r.is_active = true
    ` as any[];

    console.log('📋 Recetas encontradas:', recipes.length);

    // 3. OBTENER PRECIOS DE INSUMOS
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

    const priceMap = new Map();
    supplyPrices.forEach((price: any) => {
      priceMap.set(Number(price.supply_id), Number(price.price_per_unit));
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

      try {
        // Buscar receta para el producto
        const selectedRecipe = recipes.find((r: any) => 
          r.productId && r.productId.toString() === product.id.toString()
        );

        if (selectedRecipe) {
          recipeId = selectedRecipe.id;
          recipeName = selectedRecipe.name;
          
          // Obtener ingredientes de la receta
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
          ` as any[];

          // Calcular costo de materiales
          let recipeTotalCost = 0;
          recipeDetails = ingredients.map((ingredient: any) => {
            const supplyId = Number(ingredient.supply_id);
            const quantity = Number(ingredient.quantity);
            const unitPrice = priceMap.get(supplyId) || 0;
            const totalCost = quantity * unitPrice;
            
            recipeTotalCost += totalCost;
            
            return {
              supply_name: ingredient.supply_name,
              quantity: quantity,
              unit_measure: ingredient.unit_measure,
              unit_price: unitPrice,
              total_cost: totalCost
            };
          });

          // Calcular costo por unidad
          const outputQuantity = Number(selectedRecipe.outputQuantity) || 1;
          materialsCost = recipeTotalCost / outputQuantity;
        } else {
          // Sin receta, usar unit_cost
          materialsCost = Number(product.unit_cost) || 0;
        }
      } catch (error) {
        console.error(`Error calculando ${product.name}:`, error);
        materialsCost = Number(product.unit_cost) || 0;
      }

      // Obtener precio de venta promedio
      let averageSalePrice = 0;
      try {
        const saleData: Array<{ avg_price: number | null }> = await prisma.$queryRaw`
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
        ` as Array<{ avg_price: number | null }>;

        if (saleData && saleData.length > 0 && saleData[0].avg_price) {
          averageSalePrice = Number(saleData[0].avg_price);
        }
      } catch (error) {
        console.log(`⚠️ Error obteniendo precio de venta para ${product.name}`);
      }

      const employeeCosts = 0; // Por implementar
      // Los costos indirectos se calcularán después para todos los productos
      const totalCost = materialsCost + employeeCosts;

      productPrices.push({
        id: Number(product.id),
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
        output_quantity: 1,
        output_unit_label: 'unidades',
        intermediate_quantity: 1,
        intermediate_unit_label: 'placas',
        units_per_item: 1,
        base_type: 'standard',
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

    console.log('✅ Productos procesados:', productPrices.length);

    // CALCULAR COSTOS INDIRECTOS Y DE EMPLEADOS PARA TODOS LOS PRODUCTOS
    const indirectCostsData = await calculateIndirectCosts(parseInt(companyId), productionMonth || '2025-08', productPrices, distributionMethod);
    const employeeCostsData = await calculateEmployeeCosts(parseInt(companyId), productionMonth || '2025-08', productPrices, distributionMethod);
    
    // Actualizar productos con costos indirectos y de empleados
    productPrices.forEach((product, index) => {
      const indirectData = indirectCostsData.find(ic => ic.productId === product.id);
      const employeeData = employeeCostsData.find(ec => ec.productId === product.id);
      
      const indirectCost = indirectData ? indirectData.indirectCost : 0;
      const employeeCost = employeeData ? employeeData.employeeCost : 0;
      
      product.cost_breakdown.indirect_costs = indirectCost;
      product.cost_breakdown.employee_costs = employeeCost;
      product.cost_breakdown.total = product.cost_breakdown.materials + indirectCost + employeeCost;
      
      product.cost_breakdown_per_unit.indirect_costs = indirectCost;
      product.cost_breakdown_per_unit.employee_costs = employeeCost;
      product.cost_breakdown_per_unit.total = product.cost_breakdown_per_unit.materials + indirectCost + employeeCost;
      
      product.calculated_cost = product.cost_breakdown.total;
      product.calculated_price = product.calculated_cost * 1.3; // Margen del 30%
      
      product.indirect_costs_breakdown = indirectData ? indirectData.breakdown : [];
      product.employee_costs_breakdown = employeeData ? employeeData.breakdown : [];
      
      // Agregar información de distribución
      if (indirectData && indirectData.distributionInfo) {
        product.production_info.planned_production = indirectData.distributionInfo.product_quantity;
        product.production_info.category_total_production = indirectData.distributionInfo.category_total_quantity;
        product.production_info.distribution_ratio = indirectData.distributionInfo.distribution_ratio;
        product.production_info.source = indirectData.distributionInfo.has_real_data ? 
          `${indirectData.distributionInfo.data_source}_reales` : 'equitativa';
        product.production_info.distribution_method = distributionMethod;
      }
    });

    const productsWithRecipe = productPrices.filter(p => p.recipe_id !== null).length;
    const productsWithZeroCost = productPrices.filter(p => p.calculated_cost === 0).length;

    console.log('📈 ESTADÍSTICAS:');
    console.log(`  - Productos con receta: ${productsWithRecipe}`);
    console.log(`  - Productos sin receta: ${productPrices.length - productsWithRecipe}`);
    console.log(`  - Productos con costo $0: ${productsWithZeroCost}`);

    return NextResponse.json({
      productPrices: productPrices,
      debug_info: {
        total_products: productPrices.length,
        products_with_recipe: productsWithRecipe,
        products_without_recipe: productPrices.length - productsWithRecipe,
        products_with_zero_cost: productsWithZeroCost,
        total_recipes: recipes.length,
        total_supplies: supplyPrices.length,
        version: 'simple-with-recipes'
      }
    });

  } catch (error) {
    console.error('❌ Error en calculadora simple:', error);
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

// Función para calcular costos de empleados por categoría
async function calculateEmployeeCosts(companyId: number, productionMonth: string, productPrices: any[], distributionMethod: string = 'sales') {
  try {
    console.log('👥 Calculando costos de empleados para mes:', productionMonth);

    // 1. Obtener salarios mensuales por categoría de empleados
    const employeeSalaries = await prisma.$queryRaw`
      SELECT 
        ec.id as category_id,
        ec.name as category_name,
        COALESCE(SUM(esh.gross_salary + esh.payroll_taxes), 0) as total_salary
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

    console.log('💰 Salarios por categoría de empleados:', employeeSalaries.length);

    if (employeeSalaries.length === 0) {
      console.log('⚠️ No hay datos de empleados, devolviendo costos en 0');
      return productPrices.map(product => ({
        productId: product.id,
        employeeCost: 0,
        totalEmployeeCost: 0,
        breakdown: [],
        distributionInfo: {
          product_quantity: 0,
          category_total_quantity: 0,
          distribution_ratio: 0,
          data_source: 'sin_datos'
        }
      }));
    }

    // 2. Obtener configuración de distribución de empleados por categorías de productos
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
      WHERE ecd.company_id = ${companyId}
      ORDER BY ec.name, pc.name
    ` as any[];

    console.log('🎯 Distribución de empleados:', employeeDistribution.length);

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

      console.log(`👥 Categoría ${categoryId}: ${totalCategoryEmployeeCost.toLocaleString('es-AR')}`);
    });

    // 4. Obtener datos de distribución (ventas o producción)
    let distributionData: { [productId: number]: number } = {};
    let dataSource = '';

    if (distributionMethod === 'production') {
      const productionRecords = await prisma.$queryRaw`
        SELECT product_id, SUM(quantity) as total_quantity
        FROM monthly_production
        WHERE company_id = ${companyId}
        AND production_month = ${productionMonth}
        GROUP BY product_id
      ` as any[];

      productionRecords.forEach((record: any) => {
        distributionData[Number(record.product_id)] = Number(record.total_quantity) || 0;
      });
      dataSource = 'producción';
    } else {
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
    }

    console.log('👥 Usando datos de distribución para empleados:', Object.keys(distributionData).length, 'productos');

    // 5. Asignar costos a productos según su % DENTRO DE SU CATEGORÍA
    const result = productPrices.map(product => {
      const categoryId = product.category_id;
      const categoryEmployeeCosts = employeeCostsByCategory[categoryId] || 0;
      
      if (categoryEmployeeCosts > 0) {
        const productsInCategory = productPrices.filter(p => p.category_id === categoryId);
        const hasRealData = Object.keys(distributionData).length > 0;
        
        let productQuantity = 1;
        let totalCategoryQuantity = productsInCategory.length;
        let distributionRatio = 1 / productsInCategory.length;

        if (hasRealData) {
          productQuantity = distributionData[product.id] || 0;
          totalCategoryQuantity = productsInCategory.reduce((sum, p) => {
            return sum + (distributionData[p.id] || 0);
          }, 0);

          if (totalCategoryQuantity > 0) {
            distributionRatio = productQuantity / totalCategoryQuantity;
          }
        }
        
        // El producto recibe su % de los costos de SU CATEGORÍA
        const totalEmployeeCostForProduct = categoryEmployeeCosts * distributionRatio;
        const employeeCostPerUnit = productQuantity > 0 ? totalEmployeeCostForProduct / productQuantity : 0;
        
        console.log(`👥 ${product.product_name}: ${productQuantity}/${totalCategoryQuantity} en categoría = ${(distributionRatio * 100).toFixed(1)}%`);
        console.log(`   - Costos empleados de categoría: $${categoryEmployeeCosts.toFixed(2)}`);
        console.log(`   - Costo asignado: $${totalEmployeeCostForProduct.toFixed(2)}`);
        console.log(`   - Costo por unidad: $${employeeCostPerUnit.toFixed(2)}`);
        
        return {
          productId: product.id,
          employeeCost: employeeCostPerUnit,
          totalEmployeeCost: totalEmployeeCostForProduct,
          breakdown: employeeBreakdownByCategory[categoryId] || [],
          distributionInfo: {
            product_quantity: productQuantity,
            category_total_quantity: totalCategoryQuantity,
            distribution_ratio: distributionRatio,
            percentage_of_category: distributionRatio * 100,
            data_source: dataSource
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
            data_source: dataSource
          }
        };
      }
    });

    const totalEmployeeCosts = result.reduce((sum, item) => sum + item.employeeCost, 0);
    console.log('👥 Total costos de empleados distribuidos:', totalEmployeeCosts.toLocaleString('es-AR'));

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
async function calculateIndirectCosts(companyId: number, productionMonth: string, productPrices: any[], distributionMethod: string = 'sales') {
  try {
    console.log('🔍 Calculando costos indirectos para mes:', productionMonth);

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

    console.log('📅 Registros mensuales encontrados:', monthlyRecords.length);

    if (monthlyRecords.length === 0) {
      console.log('⚠️ No hay registros de costos indirectos para el mes', productionMonth);
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

    console.log('🎯 Configuración de distribución:', distributionConfig.length);

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

      console.log(`💰 Categoría ${categoryId}: ${totalCategoryIndirectCost.toLocaleString('es-AR')}`);
    });

    // 4. Obtener datos para distribución proporcional (ventas o producción)
    let distributionData: { [productId: number]: number } = {};
    let dataSource = '';
    
    try {
      if (distributionMethod === 'production') {
        // Usar datos de producción
        const productionRecords = await prisma.$queryRaw`
          SELECT 
            product_id,
            SUM(quantity) as total_quantity
          FROM monthly_production
          WHERE company_id = ${companyId}
          AND production_month = ${productionMonth}
          GROUP BY product_id
        ` as any[];

        productionRecords.forEach((record: any) => {
          distributionData[Number(record.product_id)] = Number(record.total_quantity) || 0;
        });

        dataSource = 'producción';
        console.log('🏭 Datos de producción encontrados para', Object.keys(distributionData).length, 'productos');
      } else {
        // Usar datos de ventas (por defecto)
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
          distributionData[Number(record.product_id)] = Number(record.total_sales) || 0;
        });

        dataSource = 'ventas';
        console.log('📊 Datos de ventas encontrados para', Object.keys(distributionData).length, 'productos');
      }
      
      // Log de datos por producto
      Object.keys(distributionData).forEach(productId => {
        const product = productPrices.find(p => p.id === Number(productId));
        if (product) {
          console.log(`📈 ${product.product_name}: ${distributionData[Number(productId)]} unidades (${dataSource})`);
        }
      });
    } catch (error) {
      console.log(`⚠️ No se encontraron datos de ${dataSource}, usando distribución equitativa`);
    }

    // 5. Asignar costos a productos según su % DENTRO DE SU CATEGORÍA
    const result = productPrices.map(product => {
      const categoryId = product.category_id;
      const categoryIndirectCosts = costsByCategory[categoryId] || 0;
      
      if (categoryIndirectCosts > 0) {
        const productsInCategory = productPrices.filter(p => p.category_id === categoryId);
        const hasRealData = Object.keys(distributionData).length > 0;
        
        let productQuantity = 1;
        let totalCategoryQuantity = productsInCategory.length;
        let distributionRatio = 1 / productsInCategory.length;

        if (hasRealData) {
          productQuantity = distributionData[product.id] || 0;
          totalCategoryQuantity = productsInCategory.reduce((sum, p) => {
            return sum + (distributionData[p.id] || 0);
          }, 0);

          if (totalCategoryQuantity > 0) {
            distributionRatio = productQuantity / totalCategoryQuantity;
          }
        }
        
        // El producto recibe su % de los costos de SU CATEGORÍA
        const totalIndirectCostForProduct = categoryIndirectCosts * distributionRatio;
        const indirectCostPerUnit = productQuantity > 0 ? totalIndirectCostForProduct / productQuantity : 0;
        
        console.log(`💰 ${product.product_name}: ${productQuantity}/${totalCategoryQuantity} en categoría = ${(distributionRatio * 100).toFixed(1)}%`);
        console.log(`   - Costos indirectos de categoría: $${categoryIndirectCosts.toFixed(2)}`);
        console.log(`   - Costo asignado: $${totalIndirectCostForProduct.toFixed(2)}`);
        console.log(`   - Costo por unidad: $${indirectCostPerUnit.toFixed(2)}`);
        
        return {
          productId: product.id,
          indirectCost: indirectCostPerUnit,
          totalIndirectCost: totalIndirectCostForProduct,
          breakdown: costsBreakdownByCategory[categoryId] || [],
          distributionInfo: {
            product_quantity: productQuantity,
            category_total_quantity: totalCategoryQuantity,
            distribution_ratio: distributionRatio,
            percentage_of_category: distributionRatio * 100,
            has_real_data: hasRealData,
            data_source: dataSource
          }
        };
      } else {
        return {
          productId: product.id,
          indirectCost: 0,
          totalIndirectCost: 0,
          breakdown: [],
          distributionInfo: {
            product_quantity: 0,
            category_total_quantity: 0,
            distribution_ratio: 0,
            percentage_of_category: 0,
            has_real_data: false,
            data_source: dataSource
          }
        };
      }
    });

    const totalIndirectCosts = result.reduce((sum, item) => sum + item.indirectCost, 0);
    console.log('💰 Total costos indirectos distribuidos:', totalIndirectCosts.toLocaleString('es-AR'));

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