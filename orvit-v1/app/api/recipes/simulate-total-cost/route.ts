import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

interface RecipeIngredient {
  supplyId: number;
  quantity: number;
  testPrice?: number;
}

interface SimulationRequest {
  recipeId: number;
  ingredients: RecipeIngredient[];
  productionQuantity: number; // Cantidad de unidades a producir
  productionMonth: string; // Mes para obtener costos de empleados e indirectos
  productCategoryId?: number; // Categoría del producto para distribución
  productId?: number; // ID del producto
}

/**
 * ⚡ ULTRA OPTIMIZADO: Calcula el costo total de una receta modificada
 * - Máximo paralelismo en queries
 * - Mínimo número de solicitudes a BD
 * - Manejo de errores detallado
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación con manejo de errores específico
    const token = cookies().get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Token no proporcionado. Por favor, inicia sesión nuevamente.' }, { status: 401 });
    }

    let userId: number;
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
      userId = payload.userId as number;
    } catch (jwtError: any) {
      // Capturar errores específicos de JWT (token expirado, firma inválida, etc.)
      console.error('❌ Error verificando JWT:', jwtError?.message || jwtError);
      const errorMessage = jwtError?.code === 'ERR_JWT_EXPIRED' 
        ? 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
        : jwtError?.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED'
        ? 'Token inválido. Por favor, inicia sesión nuevamente.'
        : 'Error de autenticación. Por favor, inicia sesión nuevamente.';
      
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }

    // Obtener usuario y empresa
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companies: {
          select: {
            company: {
              select: {
                id: true,
              },
            },
          },
        },
        ownedCompanies: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 });
    }

    const companyId = user.ownedCompanies?.[0]?.id || user.companies?.[0]?.company?.id;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario sin empresa asociada' }, { status: 400 });
    }

    const body: SimulationRequest = await request.json();
    const { recipeId, ingredients, productionQuantity, productionMonth, productCategoryId, productId } = body;

    // Validación mejorada
    if (!recipeId || !ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: recipeId, ingredients (array no vacío)' },
        { status: 400 }
      );
    }

    if (!productionQuantity || productionQuantity <= 0) {
      return NextResponse.json(
        { error: 'productionQuantity debe ser mayor a 0' },
        { status: 400 }
      );
    }

    if (!productionMonth || typeof productionMonth !== 'string') {
      return NextResponse.json(
        { error: 'productionMonth es requerido y debe ser una cadena de texto' },
        { status: 400 }
      );
    }

    // ⚡ OPTIMIZACIÓN: Preparar datos de insumos antes de las queries
    const supplyIds = ingredients.map(ing => ing.supplyId).filter((id, index, self) => self.indexOf(id) === index);
    const supplyIdsNeedingPrice = supplyIds.filter(id => !ingredients.find(ing => ing.supplyId === id && ing.testPrice));

    // ⚡ OPTIMIZACIÓN: Normalizar formato de fecha (YYYY-MM)
    const parsedRecipeId = parseInt(recipeId.toString());
    let parsedProductionMonth = productionMonth.trim();
    
    // Validar y normalizar formato de fecha
    if (!/^\d{4}-\d{2}$/.test(parsedProductionMonth)) {
      // Intentar convertir de otros formatos
      const dateMatch = parsedProductionMonth.match(/(\d{4})-(\d{1,2})/);
      if (dateMatch) {
        const [, year, month] = dateMatch;
        parsedProductionMonth = `${year}-${month.padStart(2, '0')}`;
      } else {
        return NextResponse.json(
          { error: 'productionMonth debe estar en formato YYYY-MM (ej: 2024-03)' },
          { status: 400 }
        );
      }
    }

    const [
      recipeQuery,
      suppliesData,
      pricesData
    ] = await Promise.all([
      // 1. Obtener receta y producto
      prisma.$queryRaw<any[]>`
        SELECT 
          r.id,
          r.product_id as "productId",
          r.output_quantity as "outputQuantity",
          r.company_id as "companyId",
          p.id as "productIdNum",
          p.category_id as "categoryId",
          pc.name as "categoryName"
        FROM recipes r
        LEFT JOIN products p ON CAST(r.product_id AS INTEGER) = p.id
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE r.id = ${parsedRecipeId} 
          AND r.company_id = ${companyId}
        LIMIT 1
      `,
      // 2. Obtener nombres de todos los insumos
      supplyIds.length > 0 ? prisma.$queryRaw<any[]>`
        SELECT id, name
        FROM supplies
        WHERE id = ANY(${supplyIds}::int[])
          AND company_id = ${companyId}
      ` : Promise.resolve([]),
      // 3. Obtener precios de todos los insumos que lo necesitan
      supplyIdsNeedingPrice.length > 0 ? prisma.$queryRaw<any[]>`
        SELECT DISTINCT ON (supply_id)
          supply_id,
          price_per_unit + COALESCE(freight_cost, 0) as total_price
        FROM supply_monthly_prices
        WHERE supply_id = ANY(${supplyIdsNeedingPrice}::int[])
          AND company_id = ${companyId}
          AND fecha_imputacion <= ${parsedProductionMonth}
        ORDER BY supply_id, fecha_imputacion DESC
      ` : Promise.resolve([])
    ]);

    // Validar receta
    if (!recipeQuery || recipeQuery.length === 0) {
      return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });
    }

    const recipe = recipeQuery[0];
    const outputQuantity = Number(recipe.outputQuantity || 1);
    if (outputQuantity <= 0) {
      return NextResponse.json({ error: 'outputQuantity debe ser mayor a 0' }, { status: 400 });
    }

    const categoryId = productCategoryId || recipe.categoryId;
    const categoryName = recipe.categoryName || '';

    if (!categoryId) {
      return NextResponse.json(
        { error: 'No se pudo determinar la categoría del producto' },
        { status: 400 }
      );
    }

    // Crear mapas para acceso rápido O(1)
    const supplyNameMap = new Map(suppliesData.map(s => [s.id, s.name]));
    const priceMap = new Map(pricesData.map(p => [p.supply_id, Number(p.total_price || 0)]));

    // Calcular costos de materiales
    let materialsCost = 0;
    const materialsBreakdown = ingredients.map(ingredient => {
      const unitPrice = ingredient.testPrice || priceMap.get(ingredient.supplyId) || 0;
      const totalCost = ingredient.quantity * unitPrice;
      materialsCost += totalCost;

      return {
        supplyId: ingredient.supplyId,
        supplyName: supplyNameMap.get(ingredient.supplyId) || 'Desconocido',
        quantity: ingredient.quantity,
        unitPrice: unitPrice,
        totalCost: totalCost,
      };
    });

    // Costo de materiales por unidad
    const materialsCostPerUnit = materialsCost / outputQuantity;
    const materialsCostForProduction = materialsCostPerUnit * productionQuantity;

    // ⚡ OPTIMIZACIÓN: Ejecutar TODAS las queries de costos en paralelo
    let employeeCostsForCategory = 0;
    let employeeBreakdown: any[] = [];
    let indirectCostsForCategory = 0;
    let indirectBreakdown: any[] = [];
    let totalCategoryQuantity = productionQuantity;
    let distributionRatio = 1;

    try {
      // Ejecutar todas las queries en paralelo
      const [
        employeeSalariesMonthly,
        employeeDistribution,
        monthlyRecords,
        distributionConfig,
        categoryProduction
      ] = await Promise.all([
        // 1. Obtener salarios mensuales (primera opción)
        prisma.$queryRaw<any[]>`
          SELECT 
            ec.id as category_id,
            ec.name as category_name,
            COALESCE(SUM(ems.total_cost), 0) as total_salary
          FROM employee_categories ec
          INNER JOIN employees e ON ec.id = e.category_id 
            AND e.company_id = ${companyId} 
            AND e.active = true
          LEFT JOIN employee_monthly_salaries ems ON e.id = ems.employee_id 
            AND ems.fecha_imputacion = ${parsedProductionMonth}
          WHERE ec.company_id = ${companyId} 
            AND ec.is_active = true
          GROUP BY ec.id, ec.name
        `,
        // 2. Obtener configuración de distribución de empleados
        prisma.$queryRaw<any[]>`
          SELECT 
            ecd.employee_category_id,
            ecd.percentage,
            ec.name as employee_category_name
          FROM employee_cost_distribution ecd
          LEFT JOIN employee_categories ec ON ecd.employee_category_id = ec.id
          WHERE ecd.company_id = ${companyId} 
            AND ecd.is_active = true
            AND ecd.product_category_id = ${categoryId}
        `,
        // 3. Obtener registros mensuales de costos indirectos
        prisma.$queryRaw<any[]>`
          SELECT 
            icmr.amount,
            icb.name as cost_name
          FROM indirect_cost_monthly_records icmr
          JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
          WHERE icmr.company_id = ${companyId}
            AND icmr.fecha_imputacion = ${parsedProductionMonth}
        `,
        // 4. Obtener configuración de distribución de indirectos
        prisma.$queryRaw<any[]>`
          SELECT 
            cdc.cost_name,
            cdc.percentage
          FROM cost_distribution_config cdc
          WHERE cdc.company_id = ${companyId}
            AND cdc.is_active = true
            AND cdc.product_category_id = ${categoryId}
        `,
        // 5. Obtener producción de categoría (opcional, puede fallar silenciosamente)
        prisma.$queryRaw<any[]>`
          SELECT 
            SUM(quantity) as total_quantity
          FROM monthly_production
          WHERE company_id = ${companyId}
            AND production_month = ${parsedProductionMonth}
            AND product_id IN (
              SELECT id FROM products
              WHERE category_id = ${categoryId}
                AND company_id = ${companyId}
                AND is_active = true
            )
        `.catch(() => [{ total_quantity: 0 }])
      ]);

      // Verificar si hay salarios mensuales, si no, usar employee_salary_history
      const totalSalariesFromMonthly = employeeSalariesMonthly.reduce((sum: number, s: any) => sum + Number(s.total_salary || 0), 0);
      let employeeSalaries = employeeSalariesMonthly;

      if (totalSalariesFromMonthly === 0) {
        employeeSalaries = await prisma.$queryRaw<any[]>`
          SELECT 
            ec.id as category_id,
            ec.name as category_name,
            COALESCE(SUM(esh.gross_salary + COALESCE(esh.payroll_taxes, 0)), 0) as total_salary
          FROM employee_categories ec
          INNER JOIN employees e ON ec.id = e.category_id 
            AND e.company_id = ${companyId} 
            AND e.active = true
          LEFT JOIN LATERAL (
            SELECT gross_salary, payroll_taxes
            FROM employee_salary_history esh
            WHERE esh.employee_id = e.id
            ORDER BY esh.effective_from DESC
            LIMIT 1
          ) esh ON true
          WHERE ec.company_id = ${companyId} 
            AND ec.is_active = true
          GROUP BY ec.id, ec.name
        `;
      }

      // Calcular costos de empleados
      const salaryMap = new Map(employeeSalaries.map((s: any) => [s.category_id, Number(s.total_salary || 0)]));
      for (const dist of employeeDistribution) {
        const salary = salaryMap.get(dist.employee_category_id) || 0;
        const assignedAmount = salary * (Number(dist.percentage || 0) / 100);
        employeeCostsForCategory += assignedAmount;

        if (assignedAmount > 0) {
          employeeBreakdown.push({
            employeeCategoryName: dist.employee_category_name,
            percentage: dist.percentage,
            totalSalary: salary,
            assignedAmount: assignedAmount,
          });
        }
      }

      // Calcular costos indirectos
      if (monthlyRecords.length > 0) {
        const recordsMap = new Map(monthlyRecords.map((r: any) => [r.cost_name, Number(r.amount || 0)]));
        const configMap = new Map(distributionConfig.map((c: any) => [c.cost_name, Number(c.percentage || 0)]));

        for (const [costName, amount] of recordsMap.entries()) {
          const percentage = configMap.get(costName) || 0;
          const costAmount = amount * (percentage / 100);
          indirectCostsForCategory += costAmount;

          if (costAmount > 0) {
            indirectBreakdown.push({
              costName: costName,
              baseAmount: amount,
              percentage: percentage,
              assignedAmount: costAmount,
            });
          }
        }

        // Fallback si no hay configuración
        if (indirectCostsForCategory === 0 && distributionConfig.length === 0) {
          const fallbackConfig = await prisma.$queryRaw<any[]>`
            SELECT 
              icb.name,
              icb.distribution_method,
              icmr.amount,
              iccc.category_id as config_category_id
            FROM indirect_cost_base icb
            LEFT JOIN indirect_cost_monthly_records icmr ON icb.id = icmr.cost_base_id
              AND icmr.company_id = ${companyId}
              AND icmr.fecha_imputacion = ${parsedProductionMonth}
            LEFT JOIN indirect_cost_category_config iccc ON icb.id = iccc.cost_base_id
            WHERE icb.company_id = ${companyId}
              AND icb.is_active = true
              AND (
                iccc.category_id = ${categoryId}
                OR icb.distribution_method = 'equal'
              )
          `;

          for (const config of fallbackConfig) {
            if (config.config_category_id === categoryId || config.distribution_method === 'equal') {
              const amount = Number(config.amount || 0);
              if (amount > 0) {
                indirectCostsForCategory += amount;
                indirectBreakdown.push({
                  costName: config.name,
                  amount: amount,
                });
              }
            }
          }
        }
      }

      // Calcular ratio de distribución
      const existingProduction = Number(categoryProduction[0]?.total_quantity || 0);
      totalCategoryQuantity = existingProduction + productionQuantity;
      if (totalCategoryQuantity > 0) {
        distributionRatio = productionQuantity / totalCategoryQuantity;
      }
    } catch (error) {
      console.error('❌ Error calculando costos:', error);
      // Continuar con valores por defecto (solo materiales)
    }

    // 6. Distribuir costos de empleados e indirectos
    const employeeCostsForProduct = employeeCostsForCategory * distributionRatio;
    const indirectCostsForProduct = indirectCostsForCategory * distributionRatio;

    // Costos por unidad
    const employeeCostPerUnit = productionQuantity > 0 ? employeeCostsForProduct / productionQuantity : 0;
    const indirectCostPerUnit = productionQuantity > 0 ? indirectCostsForProduct / productionQuantity : 0;

    // 7. Calcular costo total
    const totalCostForProduction = materialsCostForProduction + employeeCostsForProduct + indirectCostsForProduct;
    const totalCostPerUnit = materialsCostPerUnit + employeeCostPerUnit + indirectCostPerUnit;

    return NextResponse.json({
      success: true,
      results: {
        // Costos totales para la producción
        materialsCost: materialsCostForProduction,
        employeeCosts: employeeCostsForProduct,
        indirectCosts: indirectCostsForProduct,
        totalCost: totalCostForProduction,

        // Costos por unidad
        materialsCostPerUnit: materialsCostPerUnit,
        employeeCostPerUnit: employeeCostPerUnit,
        indirectCostPerUnit: indirectCostPerUnit,
        totalCostPerUnit: totalCostPerUnit,

        // Desglose
        materialsBreakdown: materialsBreakdown,
        employeeBreakdown: employeeBreakdown,
        indirectBreakdown: indirectBreakdown,

        // Información de distribución
        productionQuantity: productionQuantity,
        totalCategoryQuantity: totalCategoryQuantity,
        distributionRatio: distributionRatio,
        categoryName: categoryName,

        // Costos totales de la categoría (sin distribuir)
        totalEmployeeCostsForCategory: employeeCostsForCategory,
        totalIndirectCostsForCategory: indirectCostsForCategory,
      },
    });
  } catch (error: any) {
    console.error('❌ Error en simulate-total-cost:', error);
    const errorMessage = error?.message || 'Error desconocido';
    const errorStack = error?.stack;
    
    // En desarrollo, enviar más detalles del error
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

