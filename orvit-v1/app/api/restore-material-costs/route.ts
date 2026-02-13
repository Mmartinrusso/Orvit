import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔄 === RESTAURANDO COSTOS DE MATERIALES ===');

    // Obtener productos sin unit_cost
    const products = await prisma.$queryRaw`
      SELECT id, name, category_id
      FROM products 
      WHERE company_id = ${parseInt(companyId)}
      AND (unit_cost = 0 OR unit_cost IS NULL)
      ORDER BY name
    ` as any[];

    console.log('📦 Productos sin costos:', products.length);

    let updated = 0;
    
    // Asignar costos realistas según el tipo de producto
    for (const product of products) {
      let unitCost = 0;

      const productName = product.name.toLowerCase();
      
      // Asignar costos según el tipo de producto
      if (productName.includes('bloque')) {
        if (productName.includes('p20') || productName.includes('portante')) {
          unitCost = 180; // Bloques portantes más caros
        } else if (productName.includes('p13') || productName.includes('p10')) {
          unitCost = 150; // Bloques medianos
        } else {
          unitCost = 120; // Bloques básicos
        }
      } else if (productName.includes('adoquin')) {
        if (productName.includes('holanda')) {
          unitCost = 200; // Adoquines Holanda
        } else if (productName.includes('unistone')) {
          unitCost = 220; // Adoquines Unistone
        } else {
          unitCost = 180; // Adoquines básicos
        }
      } else if (productName.includes('vigueta')) {
        unitCost = 350; // Viguetas más caras
      } else if (productName.includes('bovedilla')) {
        unitCost = 80; // Bovedillas más baratas
      } else if (productName.includes('losa')) {
        unitCost = 250; // Losas
      } else {
        unitCost = 100; // Productos genéricos
      }

      // Actualizar el producto
      await prisma.$executeRaw`
        UPDATE products 
        SET unit_cost = ${unitCost}
        WHERE id = ${product.id}
      `;

      updated++;
      console.log(`✅ ${product.name}: $${unitCost}`);
    }

    return NextResponse.json({
      success: true,
      message: `${updated} productos actualizados con costos de materiales`,
      updated_products: updated
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ 
      error: 'Error restaurando costos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}