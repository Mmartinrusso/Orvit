import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 Buscando categorías para companyId:', companyId);

    // Primero obtener categorías
    const categories = await prisma.product_categories.findMany({
      where: {
        company_id: parseInt(companyId)
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log('📦 Categorías encontradas:', categories.length);

    // Obtener productos para cada categoría
    const categoriesWithProducts = await Promise.all(
      categories.map(async (category) => {
        try {
          const products = await prisma.products.findMany({
            where: {
              category_id: category.id,
              company_id: parseInt(companyId)
            },
            orderBy: {
              name: 'asc'
            }
          });

          // Extraer longitud de viguetas del nombre si es posible
          const productsWithLength = products.map(product => {
            const lengthMatch = product.name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
            return {
              id: product.id,
              name: product.name,
              description: product.description || '',
              sku: product.sku || '',
              current_price: product.current_price || 0,
              current_cost: product.current_cost || 0,
              category_id: product.category_id,
              category_name: category.name,
              recipe_id: product.recipe_id,
              output_quantity: 0,
              output_unit_label: '',
              units_per_item: product.units_per_item || 1,
              length: lengthMatch ? parseFloat(lengthMatch[1]) : undefined
            };
          });

          console.log(`📦 Categoría ${category.name}: ${productsWithLength.length} productos`);

          return {
            id: category.id,
            name: category.name,
            description: category.description || '',
            product_count: productsWithLength.length,
            products: productsWithLength
          };
        } catch (error) {
          console.error(`❌ Error cargando productos para categoría ${category.name}:`, error);
          return {
            id: category.id,
            name: category.name,
            description: category.description || '',
            product_count: 0,
            products: []
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      categories: categoriesWithProducts
    });

  } catch (error) {
    console.error('Error obteniendo categorías de productos:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
