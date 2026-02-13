import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('🚀 === LISTA PRECIOS SIMPLE ===');
  console.log('🚀 Timestamp:', new Date().toISOString());
  
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const productionMonth = searchParams.get('productionMonth');

    console.log('🔍 CompanyId:', companyId);
    console.log('🔍 ProductionMonth:', productionMonth);

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    // Obtener productos
    const products = await prisma.products.findMany({
      where: { company_id: parseInt(companyId) },
      include: { recipe: true }
    });

    console.log(`📦 Productos encontrados: ${products.length}`);

    const productPrices = [];

    for (const product of products) {
      console.log(`🔍 Procesando: ${product.name}`);
      
      // Calcular costo de materiales
      let materialsCost = 0;
      if (product.recipe) {
        const recipeDetails = await prisma.recipe_details.findMany({
          where: { recipe_id: product.recipe.id },
          include: { ingredient: true }
        });
        
        materialsCost = recipeDetails.reduce((total, detail) => {
          return total + (Number(detail.quantity) * Number(detail.ingredient.current_price));
        }, 0);
      }

      // Calcular costos indirectos
      let indirectCosts = 0;
      if (productionMonth && productionMonth !== 'planificada' && product.category_id) {
        console.log(`💰 Calculando costos indirectos para ${product.name}`);
        
        try {
          // Obtener costos del mes
          const costs = await prisma.$queryRaw`
            SELECT amount FROM indirect_cost_monthly_records 
            WHERE company_id = ${parseInt(companyId)} 
            AND fecha_imputacion = ${productionMonth}
          ` as any[];
          
          if (costs.length > 0) {
            const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
            console.log(`💰 Total costos: $${totalCosts.toFixed(2)}`);
            
            // Obtener distribución
            const dist = await prisma.$queryRaw`
              SELECT percentage FROM cost_distribution_config 
              WHERE company_id = ${parseInt(companyId)} 
              AND product_category_id = ${Number(product.category_id)}
            ` as any[];
            
            if (dist.length > 0) {
              const categoryShare = dist.reduce((total, d) => 
                total + (totalCosts * Number(d.percentage) / 100), 0);
              
              // Obtener producción de la categoría
              const prod = await prisma.$queryRaw`
                SELECT COALESCE(SUM(mp.quantity_produced), 0) as total
                FROM monthly_production mp
                JOIN products p ON mp.product_id::integer = p.id
                WHERE p.company_id = ${parseInt(companyId)}
                AND p.category_id = ${Number(product.category_id)}
                AND mp.fecha_imputacion = ${productionMonth}
              ` as any[];
              
              const totalProd = Number(prod[0]?.total || 0);
              
              if (totalProd > 0) {
                const costPerUnit = categoryShare / totalProd;
                
                // Obtener producción del producto
                const productProd = await prisma.$queryRaw`
                  SELECT COALESCE(SUM(quantity_produced), 0) as total
                  FROM monthly_production
                  WHERE product_id = ${product.id.toString()}
                  AND fecha_imputacion = ${productionMonth}
                ` as any[];
                
                const productProduction = Number(productProd[0]?.total || 0);
                indirectCosts = costPerUnit * productProduction;
                
                console.log(`✅ ${product.name}: $${indirectCosts.toFixed(2)}`);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error calculando costos para ${product.name}:`, error);
        }
      }

      const calculatedCost = materialsCost + indirectCosts;

      productPrices.push({
        id: product.id,
        name: product.name,
        materialsCost: materialsCost,
        indirectCosts: indirectCosts,
        totalCost: calculatedCost,
        cost_breakdown: {
          materials: materialsCost,
          indirect_costs: indirectCosts,
          total: calculatedCost
        }
      });
    }

    console.log(`✅ Procesados ${productPrices.length} productos`);
    console.log(`💰 Productos con costos indirectos: ${productPrices.filter(p => p.indirectCosts > 0).length}`);

    return NextResponse.json({
      productPrices,
      debug_info: {
        total_products: productPrices.length,
        products_with_indirect_costs: productPrices.filter(p => p.indirectCosts > 0).length
      }
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
