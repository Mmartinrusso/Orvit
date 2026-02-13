import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔄 === ASIGNANDO COSTOS DE MATERIALES ===');

    // Obtener algunos productos para asignar costos
    const products = await prisma.$queryRaw`
      SELECT id, name, category_id
      FROM products 
      WHERE company_id = ${parseInt(companyId)}
      AND unit_cost = 0
      LIMIT 10
    ` as any[];

    console.log('📦 Productos sin costos:', products.length);

    let updated = 0;
    
    // Asignar costos de ejemplo basados en el tipo de producto
    for (const product of products) {
      let unitCost = 0;
      let unitPrice = 0;

      // Asignar costos según el nombre del producto
      if (product.name.toLowerCase().includes('bloque')) {
        unitCost = Math.floor(Math.random() * 200) + 100; // Entre 100-300
        unitPrice = unitCost * 1.5; // 50% de margen
      } else if (product.name.toLowerCase().includes('adoquin')) {
        unitCost = Math.floor(Math.random() * 150) + 80; // Entre 80-230
        unitPrice = unitCost * 1.4; // 40% de margen
      } else if (product.name.toLowerCase().includes('vigueta')) {
        unitCost = Math.floor(Math.random() * 500) + 200; // Entre 200-700
        unitPrice = unitCost * 1.6; // 60% de margen
      } else {
        unitCost = Math.floor(Math.random() * 100) + 50; // Entre 50-150
        unitPrice = unitCost * 1.3; // 30% de margen
      }

      // Actualizar el producto
      await prisma.$executeRaw`
        UPDATE products 
        SET unit_cost = ${unitCost}, unit_price = ${unitPrice}
        WHERE id = ${product.id}
      `;

      updated++;
      console.log(`✅ ${product.name}: Cost=${unitCost}, Price=${unitPrice}`);
    }

    return NextResponse.json({
      success: true,
      message: `${updated} productos actualizados con costos de materiales`,
      updated_products: updated
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ 
      error: 'Error asignando costos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}