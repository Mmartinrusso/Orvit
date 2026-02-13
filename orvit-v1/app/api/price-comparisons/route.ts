import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders, shouldDisableCache } from '@/lib/perf';

export const dynamic = 'force-dynamic';


// GET /api/price-comparisons?companyId=123
export async function GET(request: NextRequest) {
  const perfCtx = startPerf();
  
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    endParse(perfCtx);

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    startDb(perfCtx);
    const comparisons = await prisma.priceComparison.findMany({
      where: {
        companyId: parseInt(companyId)
      },
      include: {
        competitors: {
          include: {
            productPrices: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    endDb(perfCtx);

    startCompute(perfCtx);
    // Transformar a la estructura esperada por el frontend
    const transformedComparisons = comparisons.map(comp => ({
      id: comp.id,
      name: comp.name,
      createdAt: comp.createdAt.toISOString(),
      competitors: comp.competitors.map(competitor => ({
        id: competitor.id,
        name: competitor.name,
        prices: competitor.productPrices.reduce((acc, pp) => {
          acc[pp.productId] = pp.competitorPrice ? parseFloat(pp.competitorPrice.toString()) : null;
          return acc;
        }, {} as { [productId: number]: number | null })
      })),
      products: comp.competitors[0]?.productPrices.map(pp => ({
        productId: pp.productId,
        productName: pp.productName,
        myPrice: parseFloat(pp.myPrice.toString())
      })) || []
    }));
    endCompute(perfCtx);

    startJson(perfCtx);
    const response = NextResponse.json(transformedComparisons, {
      headers: {
        'Cache-Control': shouldDisableCache(searchParams) 
          ? 'no-cache, no-store, must-revalidate'
          : 'private, max-age=300',
      }
    });
    const metrics = endJson(perfCtx, transformedComparisons);
    return withPerfHeaders(response, metrics, searchParams);

  } catch (error) {
    console.error('❌ Error en GET /api/price-comparisons:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/price-comparisons
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, companyId, competitors, products } = body;

    console.log('💾 POST /api/price-comparisons - Recibiendo datos:', {
      name,
      companyId,
      competitorsCount: competitors?.length || 0,
      productsCount: products?.length || 0
    });

    if (!name || !companyId || !competitors || !products) {
      console.error('❌ Faltan campos requeridos:', { name: !!name, companyId: !!companyId, competitors: !!competitors, products: !!products });
      return NextResponse.json(
        { error: 'name, companyId, competitors y products son requeridos' },
        { status: 400 }
      );
    }

    // Crear la comparativa con todos sus datos
    console.log('💾 Creando comparativa en base de datos...');
    const comparison = await prisma.priceComparison.create({
      data: {
        name,
        companyId: parseInt(companyId),
        competitors: {
          create: competitors.map((competitor: any) => ({
            name: competitor.name,
            productPrices: {
              create: products.map((product: any) => ({
                productId: product.productId,
                productName: product.productName,
                myPrice: product.myPrice,
                competitorPrice: competitor.prices[product.productId] || null
              }))
            }
          }))
        }
      },
      include: {
        competitors: {
          include: {
            productPrices: true
          }
        }
      }
    });

    // Transformar a la estructura esperada
    const transformedComparison = {
      id: comparison.id,
      name: comparison.name,
      createdAt: comparison.createdAt.toISOString(),
      competitors: comparison.competitors.map(competitor => ({
        id: competitor.id,
        name: competitor.name,
        prices: competitor.productPrices.reduce((acc, pp) => {
          acc[pp.productId] = pp.competitorPrice ? parseFloat(pp.competitorPrice.toString()) : null;
          return acc;
        }, {} as { [productId: number]: number | null })
      })),
      products: comparison.competitors[0]?.productPrices.map(pp => ({
        productId: pp.productId,
        productName: pp.productName,
        myPrice: parseFloat(pp.myPrice.toString())
      })) || []
    };

    console.log('✅ Comparativa guardada exitosamente en BD:', {
      id: comparison.id,
      name: comparison.name,
      competitorsCount: comparison.competitors.length,
      totalProductPrices: comparison.competitors.reduce((sum, c) => sum + c.productPrices.length, 0)
    });

    return NextResponse.json({
      success: true,
      comparison: transformedComparison
    });

  } catch (error) {
    console.error('❌ Error en POST /api/price-comparisons:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/price-comparisons?id=123
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id es requerido' },
        { status: 400 }
      );
    }

    await prisma.priceComparison.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Comparativa eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en DELETE /api/price-comparisons:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

