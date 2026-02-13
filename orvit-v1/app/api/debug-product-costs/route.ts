import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';
    const productId = searchParams.get('productId');
    const productionMonth = searchParams.get('month') || '2025-08';

    if (!productId) {
      return NextResponse.json(
        { error: 'productId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 === DEBUG COSTOS DE PRODUCTO ===');
    console.log('CompanyId:', companyId);
    console.log('ProductId:', productId);
    console.log('Mes:', productionMonth);

    // 1. Obtener información del producto
    const product = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.sku,
        p.unit_cost,
        p.unit_price,
        pc.id as category_id,
        pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.id = ${parseInt(productId)}
      AND p.company_id = ${parseInt(companyId)}
    ` as any[];

    if (product.length === 0) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const productInfo = product[0];
    console.log('📦 Producto:', productInfo.name, '- Categoría:', productInfo.category_name);

    // 2. Obtener costos indirectos mensuales
    const monthlyRecords = await prisma.$queryRaw`
      SELECT 
        icmr.id,
        icmr.amount,
        icmr.fecha_imputacion,
        icb.name as cost_name
      FROM indirect_cost_monthly_records icmr
      JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
      WHERE icmr.company_id = ${parseInt(companyId)}
      AND icmr.fecha_imputacion = ${productionMonth}
      ORDER BY icb.name
    ` as any[];

    console.log('📅 Costos indirectos mensuales:', monthlyRecords.length);

    // 3. Obtener configuración de distribución para la categoría del producto
    const distributionConfig = await prisma.$queryRaw`
      SELECT 
        cdc.product_category_id,
        pc.name as category_name,
        cdc.cost_name,
        cdc.percentage,
        cdc.is_active
      FROM cost_distribution_config cdc
      LEFT JOIN product_categories pc ON cdc.product_category_id = pc.id
      WHERE cdc.company_id = ${parseInt(companyId)}
      AND cdc.product_category_id = ${productInfo.category_id}
      AND cdc.is_active = true
      ORDER BY cdc.cost_name
    ` as any[];

    console.log('🎯 Configuración de distribución para categoría:', distributionConfig.length);

    // 4. Calcular costos indirectos asignados al producto
    const indirectCostsBreakdown: any[] = [];
    let totalIndirectCosts = 0;

    distributionConfig.forEach((config: any) => {
      const monthlyRecord = monthlyRecords.find((record: any) => record.cost_name === config.cost_name);
      if (monthlyRecord) {
        const baseAmount = Number(monthlyRecord.amount);
        const percentage = Number(config.percentage);
        const assignedToCategory = baseAmount * (percentage / 100);
        
        indirectCostsBreakdown.push({
          cost_name: config.cost_name,
          base_amount: baseAmount,
          percentage: percentage,
          assigned_to_category: assignedToCategory
        });
        
        totalIndirectCosts += assignedToCategory;
      }
    });

    // 5. Obtener producción del producto para calcular distribución
    let productProduction = 1; // Default
    let categoryTotalProduction = 1; // Default
    
    try {
      const productionRecords = await prisma.$queryRaw`
        SELECT 
          product_id,
          SUM(quantity) as total_production
        FROM monthly_production
        WHERE company_id = ${parseInt(companyId)}
        AND production_month = ${productionMonth}
        AND product_id = ${parseInt(productId)}
        GROUP BY product_id
      ` as any[];

      if (productionRecords.length > 0) {
        productProduction = Number(productionRecords[0].total_production) || 1;
      }

      // Obtener producción total de la categoría
      const categoryProductionRecords = await prisma.$queryRaw`
        SELECT 
          SUM(mp.quantity) as category_total_production
        FROM monthly_production mp
        JOIN products p ON mp.product_id = p.id
        WHERE mp.company_id = ${parseInt(companyId)}
        AND mp.production_month = ${productionMonth}
        AND p.category_id = ${productInfo.category_id}
      ` as any[];

      if (categoryProductionRecords.length > 0 && categoryProductionRecords[0].category_total_production) {
        categoryTotalProduction = Number(categoryProductionRecords[0].category_total_production);
      } else {
        // Si no hay producción real, contar productos en la categoría
        const productsInCategory = await prisma.$queryRaw`
          SELECT COUNT(*) as count
          FROM products
          WHERE category_id = ${productInfo.category_id}
          AND company_id = ${parseInt(companyId)}
        ` as any[];
        
        categoryTotalProduction = Number(productsInCategory[0].count) || 1;
      }
    } catch (error) {
      console.log('⚠️ No se encontró producción real, usando valores por defecto');
    }

    // 6. Calcular distribución final
    const productionRatio = productProduction / categoryTotalProduction;
    const finalIndirectCosts = totalIndirectCosts * productionRatio;

    // 7. Obtener costos de empleados (implementar después)
    const employeeCosts = 0; // TODO: Implementar

    // 8. Obtener costos de materiales (receta)
    let materialsCost = 0;
    let recipeDetails: any[] = [];

    try {
      const recipe = await prisma.$queryRaw`
        SELECT id, name, output_quantity
        FROM recipes
        WHERE product_id = ${parseInt(productId)}
        AND company_id = ${parseInt(companyId)}
        LIMIT 1
      ` as any[];

      if (recipe.length > 0) {
        const recipeInfo = recipe[0];
        
        const ingredients = await prisma.$queryRaw`
          SELECT 
            ri.supply_id,
            ri.quantity,
            ri.unit_measure,
            s.name as supply_name,
            sp.price as unit_price
          FROM recipe_items ri
          LEFT JOIN supplies s ON ri.supply_id = s.id
          LEFT JOIN supply_prices sp ON ri.supply_id = sp.supply_id 
            AND sp.company_id = ${parseInt(companyId)}
            AND sp.is_current = true
          WHERE ri.recipe_id = ${recipeInfo.id}
          AND ri.company_id = ${parseInt(companyId)}
        ` as any[];

        let recipeTotalCost = 0;
        recipeDetails = ingredients.map((ingredient: any) => {
          const quantity = Number(ingredient.quantity);
          const unitPrice = Number(ingredient.unit_price) || 0;
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

        const outputQuantity = Number(recipeInfo.output_quantity) || 1;
        materialsCost = recipeTotalCost / outputQuantity;
      } else {
        materialsCost = Number(productInfo.unit_cost) || 0;
      }
    } catch (error) {
      console.error('Error calculando materiales:', error);
      materialsCost = Number(productInfo.unit_cost) || 0;
    }

    const result = {
      product: {
        id: productInfo.id,
        name: productInfo.name,
        description: productInfo.description,
        sku: productInfo.sku,
        category_id: productInfo.category_id,
        category_name: productInfo.category_name,
        unit_cost: Number(productInfo.unit_cost),
        unit_price: Number(productInfo.unit_price)
      },
      costs_breakdown: {
        materials: {
          total: materialsCost,
          recipe_details: recipeDetails
        },
        indirect_costs: {
          total_category_costs: totalIndirectCosts,
          production_ratio: productionRatio,
          final_product_costs: finalIndirectCosts,
          breakdown: indirectCostsBreakdown
        },
        employee_costs: {
          total: employeeCosts,
          breakdown: [] // TODO: Implementar
        }
      },
      production_info: {
        product_production: productProduction,
        category_total_production: categoryTotalProduction,
        production_ratio: productionRatio,
        production_month: productionMonth
      },
      totals: {
        materials: materialsCost,
        indirect_costs: finalIndirectCosts,
        employee_costs: employeeCosts,
        total_cost: materialsCost + finalIndirectCosts + employeeCosts,
        suggested_price: (materialsCost + finalIndirectCosts + employeeCosts) * 1.3
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error en debug costos de producto:', error);
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