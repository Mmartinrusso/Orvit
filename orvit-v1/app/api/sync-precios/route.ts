import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { companyId } = await request.json();

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔄 === SINCRONIZANDO PRECIOS ===');
    console.log('CompanyId:', companyId);

    // 1. OBTENER PRECIOS CALCULADOS DE LA API DE RECETAS
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/lista-precios-recetas?companyId=${companyId}`);
    
    if (!response.ok) {
      throw new Error('Error obteniendo precios de recetas');
    }

    const data = await response.json();
    const productPrices = data.productPrices || [];

    console.log(`📊 Precios obtenidos: ${productPrices.length} productos`);

    // 2. ACTUALIZAR UNIT_COST EN LA TABLA PRODUCTS
    let updatedCount = 0;
    const results = [];

    for (const productPrice of productPrices) {
      if (productPrice.id && productPrice.materialsCost > 0) {
        try {
          // Actualizar unit_cost con el precio calculado
          await prisma.$executeRaw`
            UPDATE products 
            SET unit_cost = ${productPrice.materialsCost}
            WHERE id = ${productPrice.id}
            AND company_id = ${parseInt(companyId)}
          `;

          console.log(`✅ ${productPrice.name}: ${productPrice.materialsCost.toFixed(2)}`);
          
          results.push({
            product_id: productPrice.id,
            product_name: productPrice.name,
            new_cost: productPrice.materialsCost,
            updated: true
          });
          
          updatedCount++;
          
        } catch (error) {
          console.error(`❌ Error actualizando ${productPrice.name}:`, error);
          results.push({
            product_id: productPrice.id,
            product_name: productPrice.name,
            error: error.message,
            updated: false
          });
        }
      }
    }

    console.log(`✅ Sincronización completada: ${updatedCount} productos actualizados`);

    return NextResponse.json({
      success: true,
      processed: productPrices.length,
      updated: updatedCount,
      results: results
    });

  } catch (error) {
    console.error('❌ Error sincronizando precios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: (error as Error).message },
      { status: 500 }
    );
  }
}