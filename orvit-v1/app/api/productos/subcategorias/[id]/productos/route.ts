import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Función para extraer metros del nombre del producto
 * Busca patrones como "4.50m", "6.00m", "3.5m", etc.
 */
function extractMetersFromName(name: string): number {
  // Patrones para encontrar metros en el nombre
  const patterns = [
    /(\d+\.?\d*)\s*m\b/i,           // "4.50m", "6m", "3.5 m"
    /(\d+\.?\d*)\s*metro/i,         // "4.50metro", "6 metros"
    /(\d+\.?\d*)\s*mts/i,           // "4.50mts", "6 mts"
    /(\d+,\d+)\s*m\b/i,             // "4,50m" (coma decimal)
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      // Convertir coma decimal a punto decimal si es necesario
      const meterString = match[1].replace(',', '.');
      const meters = parseFloat(meterString);
      if (!isNaN(meters) && meters > 0) {
        return meters;
      }
    }
  }

  return 0; // No se encontraron metros
}

// GET /api/productos/subcategorias/[id]/productos - Obtener productos de una subcategoría con cálculo de costos
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const subcategoryId = params.id;

    console.log('🔍 API Productos por Subcategoría - subcategoryId:', subcategoryId, 'companyId:', companyId);

    if (!companyId || !subcategoryId) {
      return NextResponse.json(
        { error: 'Company ID y Subcategory ID son requeridos' },
        { status: 400 }
      );
    }

    // Obtener productos de la subcategoría
    const products = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.sku,
        p.unit_price as "unitPrice",
        p.unit_cost as "unitCost",
        p.stock_quantity as "stockQuantity",
        p.is_active as "isActive"
      FROM products p
      WHERE p.subcategory_id = ${parseInt(subcategoryId)}
        AND p.company_id = ${parseInt(companyId)}
        AND p.is_active = true
      ORDER BY p.name
    `;

    console.log('📊 Productos encontrados:', products);

    // Obtener la receta activa para esta subcategoría
    const activeRecipe = await prisma.$queryRaw`
      SELECT 
        r.id,
        r.name,
        r.base_type as "baseType"
      FROM recipes r
      WHERE r.subcategory_id = ${parseInt(subcategoryId)}
        AND r.company_id = ${parseInt(companyId)}
        AND r.is_active = true
      LIMIT 1
    `;

    console.log('📊 Receta activa encontrada:', activeRecipe);

    if (!activeRecipe || (activeRecipe as any[]).length === 0) {
      return NextResponse.json({
        products: [],
        costPerMeter: 0,
        summary: {
          totalProducts: 0,
          averageCost: 0,
          totalCost: 0
        }
      });
    }

    const recipe = (activeRecipe as any[])[0];

    // Calcular costo por metro de la receta
    let costPerMeter = 0;
    
    try {
      // Obtener ingredientes de la receta (NO del banco)
      const ingredients = await prisma.$queryRaw`
        SELECT 
          ri.supply_id as "supplyId",
          ri.quantity,
          s.name as "supplyName"
        FROM recipe_items ri
        LEFT JOIN supplies s ON ri.supply_id = s.id
        WHERE ri.recipe_id = ${recipe.id}
          AND ri.company_id = ${parseInt(companyId)}
          AND (ri.is_bank_ingredient = false OR ri.is_bank_ingredient IS NULL)
      `;

      // Obtener ingredientes del banco por separado
      const bankIngredients = await prisma.$queryRaw`
        SELECT 
          ri.supply_id as "supplyId",
          ri.quantity,
          s.name as "supplyName"
        FROM recipe_items ri
        LEFT JOIN supplies s ON ri.supply_id = s.id
        WHERE ri.recipe_id = ${recipe.id}
          AND ri.company_id = ${parseInt(companyId)}
          AND ri.is_bank_ingredient = true
      `;

      // Calcular costo de ingredientes de la receta (incluyendo flete)
      let recipeCost = 0;
      for (const ingredient of ingredients as any[]) {
        // Obtener precio actual del insumo (precio base + flete)
        const priceResult = await prisma.$queryRaw`
          SELECT 
            price_per_unit,
            COALESCE(freight_cost, 0) as freight_cost,
            (price_per_unit + COALESCE(freight_cost, 0)) as total_price
          FROM supply_monthly_prices
          WHERE supply_id = ${ingredient.supplyId}
            AND company_id = ${parseInt(companyId)}
          ORDER BY month_year DESC
          LIMIT 1
        `;

        const priceData = (priceResult as any[])[0];
        const totalPrice = priceData?.total_price || (priceData?.price_per_unit || 0) + (priceData?.freight_cost || 0);
        recipeCost += ingredient.quantity * totalPrice;
      }

      // Calcular costo de ingredientes del banco (incluyendo flete)
      let bankCost = 0;
      for (const ingredient of bankIngredients as any[]) {
        const priceResult = await prisma.$queryRaw`
          SELECT 
            price_per_unit,
            COALESCE(freight_cost, 0) as freight_cost,
            (price_per_unit + COALESCE(freight_cost, 0)) as total_price
          FROM supply_monthly_prices
          WHERE supply_id = ${ingredient.supplyId}
            AND company_id = ${parseInt(companyId)}
          ORDER BY month_year DESC
          LIMIT 1
        `;

        const priceData = (priceResult as any[])[0];
        const totalPrice = priceData?.total_price || (priceData?.price_per_unit || 0) + (priceData?.freight_cost || 0);
        bankCost += ingredient.quantity * totalPrice;
      }

      // Obtener configuración de la receta para calcular costo por metro
      const recipeConfig = await prisma.$queryRaw`
        SELECT 
          r.output_quantity as "outputQuantity",
          r.metros_utiles as "metrosUtiles",
          r.cantidad_pastones as "cantidadPastones"
        FROM recipes r
        WHERE r.id = ${recipe.id}
      `;

      const config = (recipeConfig as any[])[0];

      if (recipe.baseType === 'PER_BANK' && config.cantidadPastones && config.metrosUtiles) {
        // Para recetas "Por Banco": (costo_receta × pastones + costo_banco) ÷ metros_útiles
        const totalCost = (recipeCost * config.cantidadPastones) + bankCost;
        costPerMeter = totalCost / config.metrosUtiles;
      } else if (config.outputQuantity) {
        // Para recetas normales: costo_total ÷ cantidad_salida
        const totalCost = recipeCost + bankCost;
        costPerMeter = totalCost / config.outputQuantity;
      }

      console.log(`💰 Cálculo de costo por metro:`, {
        recipeCost,
        bankCost,
        cantidadPastones: config.cantidadPastones,
        metrosUtiles: config.metrosUtiles,
        outputQuantity: config.outputQuantity,
        costPerMeter
      });

    } catch (error) {
      console.error('Error calculando costo por metro:', error);
      costPerMeter = 0;
    }

    // Procesar productos con cálculo de costos individuales
    const processedProducts = (products as any[]).map(product => {
      const meters = extractMetersFromName(product.name);
      const totalCost = meters > 0 ? costPerMeter * meters : 0;

      return {
        ...product,
        meters,
        costPerMeter,
        totalCost,
        hasMeters: meters > 0
      };
    });

    // Calcular estadísticas
    const productsWithMeters = processedProducts.filter(p => p.hasMeters);
    const totalCost = productsWithMeters.reduce((sum, p) => sum + p.totalCost, 0);
    const averageCost = productsWithMeters.length > 0 ? totalCost / productsWithMeters.length : 0;

    const response = {
      products: processedProducts,
      costPerMeter,
      recipe: {
        id: recipe.id,
        name: recipe.name,
        baseType: recipe.baseType
      },
      summary: {
        totalProducts: processedProducts.length,
        productsWithMeters: productsWithMeters.length,
        averageCost,
        totalCost
      }
    };

    console.log('✅ Respuesta final:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error obteniendo productos de subcategoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
