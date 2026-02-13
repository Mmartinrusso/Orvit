import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔄 === CREANDO VENTAS AGOSTO (CORREGIDO) ===');

    // Obtener productos de Bloques
    const products = await prisma.$queryRaw`
      SELECT p.id, p.name, pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.company_id = ${parseInt(companyId)}
      AND pc.name = 'Bloques'
      LIMIT 5
    ` as any[];

    // Eliminar ventas existentes de agosto
    await prisma.$executeRaw`
      DELETE FROM monthly_sales 
      WHERE company_id = ${parseInt(companyId)} 
      AND DATE_TRUNC('month', created_at) = '2025-08-01'::date
    `;

    // Crear ventas con diferentes cantidades
    const salesData = [
      { productId: products[0]?.id, quantity: 1000, price: 500 }, // Muchas ventas
      { productId: products[1]?.id, quantity: 500, price: 600 },  // Ventas medias
      { productId: products[2]?.id, quantity: 200, price: 700 },  // Pocas ventas
      // products[3] y [4] sin ventas para mostrar redistribución
    ];

    let created = 0;
    for (const sale of salesData) {
      if (sale.productId) {
        await prisma.$executeRaw`
          INSERT INTO monthly_sales (
            company_id, product_id, quantity_sold, unit_price, total_revenue, created_at
          ) VALUES (
            ${parseInt(companyId)}, ${sale.productId}, ${sale.quantity}, 
            ${sale.price}, ${sale.quantity * sale.price}, '2025-08-15'::timestamp
          )
        `;
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${created} ventas creadas para agosto (corregido)`,
      sales: salesData.filter(s => s.productId).map((s, i) => ({
        product: products[i]?.name,
        quantity: s.quantity
      }))
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: 'Error creando ventas' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}