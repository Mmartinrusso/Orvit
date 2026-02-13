import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';
    const productionMonth = searchParams.get('productionMonth') || '2025-08';

    console.log('🔍 === DEBUG CÁLCULO DETALLADO ===');

    // 1. Obtener datos de ventas directamente
    const salesRecords = await prisma.$queryRaw`
      SELECT product_id, SUM(quantity_sold) as total_sales
      FROM monthly_sales
      WHERE company_id = ${parseInt(companyId)}
      AND (
        DATE_TRUNC('month', created_at) = DATE_TRUNC('month', ${productionMonth + '-01'}::date)
        OR DATE_TRUNC('month', month_year) = DATE_TRUNC('month', ${productionMonth + '-01'}::date)
        OR fecha_imputacion = ${productionMonth}
      )
      GROUP BY product_id
      ORDER BY total_sales DESC
    ` as any[];

    console.log('📊 Datos de ventas encontrados:', salesRecords.length);

    // 2. Obtener productos para ver categorías
    const products = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.category_id,
        pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.company_id = ${parseInt(companyId)}
      ORDER BY pc.name, p.name
    ` as any[];

    // 3. Obtener costos indirectos mensuales
    const monthlyIndirectCosts = await prisma.$queryRaw`
      SELECT 
        icmr.amount,
        icb.name as cost_name
      FROM indirect_cost_monthly_records icmr
      JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
      WHERE icmr.company_id = ${parseInt(companyId)}
      AND icmr.fecha_imputacion = ${productionMonth}
    ` as any[];

    // 4. Obtener distribución de costos indirectos
    const distributionConfig = await prisma.$queryRaw`
      SELECT 
        cdc.product_category_id,
        pc.name as category_name,
        cdc.cost_name,
        cdc.percentage
      FROM cost_distribution_config cdc
      LEFT JOIN product_categories pc ON cdc.product_category_id = pc.id
      WHERE cdc.company_id = ${parseInt(companyId)}
      AND cdc.is_active = true
    ` as any[];

    // 5. Calcular costos por categoría
    const costsByCategory: { [categoryId: number]: number } = {};
    
    // Agrupar por categoría
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

      categoryConfigs.forEach((config: any) => {
        const monthlyRecord = monthlyIndirectCosts.find((record: any) => record.cost_name === config.cost_name);
        if (monthlyRecord) {
          const costAmount = Number(monthlyRecord.amount) * (Number(config.percentage) / 100);
          totalCategoryIndirectCost += costAmount;
        }
      });

      costsByCategory[categoryId] = totalCategoryIndirectCost;
    });

    // 6. Crear mapa de ventas
    const distributionData: { [productId: number]: number } = {};
    salesRecords.forEach((record: any) => {
      distributionData[Number(record.product_id)] = Number(record.total_sales) || 0;
    });

    // 7. Analizar un producto específico (buscar un bloque)
    const bloqueProduct = products.find((p: any) => p.name?.toLowerCase().includes('bloque'));
    
    if (bloqueProduct) {
      const categoryId = bloqueProduct.category_id;
      const productsInCategory = products.filter((p: any) => p.category_id === categoryId);
      
      const productQuantity = distributionData[bloqueProduct.id] || 0;
      const totalCategoryQuantity = productsInCategory.reduce((sum, p) => {
        return sum + (distributionData[p.id] || 0);
      }, 0);
      
      const distributionRatio = totalCategoryQuantity > 0 ? productQuantity / totalCategoryQuantity : 0;
      const categoryCosts = costsByCategory[categoryId] || 0;
      const totalIndirectCostForProduct = categoryCosts * distributionRatio;
      const indirectCostPerUnit = productQuantity > 0 ? totalIndirectCostForProduct / productQuantity : totalIndirectCostForProduct;

      const analisisDetallado = {
        producto: {
          id: bloqueProduct.id,
          nombre: bloqueProduct.name,
          categoria: bloqueProduct.category_name,
          categoria_id: categoryId
        },
        datos_ventas: {
          producto_cantidad: productQuantity,
          categoria_total: totalCategoryQuantity,
          productos_en_categoria: productsInCategory.length,
          ratio_distribucion: distributionRatio
        },
        costos_categoria: {
          total_costos_indirectos: categoryCosts,
          costo_asignado_producto: totalIndirectCostForProduct,
          costo_por_unidad: indirectCostPerUnit
        },
        calculo_verificacion: {
          formula_esperada: `${categoryCosts.toFixed(2)} * ${distributionRatio.toFixed(4)} / ${productQuantity} = ${indirectCostPerUnit.toFixed(2)}`,
          division_directa: totalCategoryQuantity > 0 ? (categoryCosts / totalCategoryQuantity).toFixed(2) : 'N/A'
        }
      };

      return NextResponse.json({
        status: 'debug_complete',
        resumen: {
          total_productos: products.length,
          total_ventas_registros: salesRecords.length,
          total_costos_indirectos: monthlyIndirectCosts.length,
          total_configuracion_distribucion: distributionConfig.length
        },
        analisis_detallado: analisisDetallado,
        datos_raw: {
          ventas_top_5: salesRecords.slice(0, 5),
          costos_por_categoria: costsByCategory,
          productos_categoria_bloque: productsInCategory.map((p: any) => ({
            id: p.id,
            nombre: p.name,
            ventas: distributionData[p.id] || 0
          }))
        }
      });
    } else {
      return NextResponse.json({
        status: 'no_bloque_found',
        productos_disponibles: products.slice(0, 10).map((p: any) => p.name)
      });
    }

  } catch (error) {
    console.error('❌ Error en debug cálculo detallado:', error);
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