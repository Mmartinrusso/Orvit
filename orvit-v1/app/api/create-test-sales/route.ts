import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === CREANDO DATOS DE VENTAS DE PRUEBA ===');
    console.log('CompanyId:', companyId);

    // Obtener algunos productos de la categoría Bloques para crear ventas de prueba
    const products = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.company_id = ${parseInt(companyId)}
      AND pc.name = 'Bloques'
      LIMIT 5
    ` as any[];

    console.log('📦 Productos encontrados:', products.length);

    if (products.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron productos de la categoría Bloques'
      }, { status: 404 });
    }

    // Crear ventas de prueba para 2025-08
    const salesData = [
      { productId: products[0].id, quantity: 1000, price: 500 }, // Producto con muchas ventas
      { productId: products[1].id, quantity: 500, price: 600 },  // Producto con ventas medias
      { productId: products[2].id, quantity: 100, price: 700 },  // Producto con pocas ventas
      // products[3] y products[4] no tendrán ventas para demostrar la redistribución
    ];

    let insertedRecords = 0;
    for (const sale of salesData) {
      try {
        await prisma.$executeRaw`
          INSERT INTO monthly_sales (
            company_id,
            product_id,
            quantity,
            unit_price,
            total_amount,
            created_at
          ) VALUES (
            ${parseInt(companyId)},
            ${sale.productId},
            ${sale.quantity},
            ${sale.price},
            ${sale.quantity * sale.price},
            '2025-08-15'::timestamp
          )
        `;
        insertedRecords++;
        console.log(`✅ Venta creada: ${products.find(p => p.id === sale.productId)?.name} - ${sale.quantity} unidades`);
      } catch (error) {
        console.log(`❌ Error creando venta para producto ${sale.productId}:`, error);
      }
    }

    // Verificar las ventas creadas
    const createdSales = await prisma.$queryRaw`
      SELECT 
        ms.product_id,
        p.name as product_name,
        SUM(ms.quantity) as total_sales
      FROM monthly_sales ms
      JOIN products p ON ms.product_id = p.id
      WHERE ms.company_id = ${parseInt(companyId)}
      AND DATE_TRUNC('month', ms.created_at) = '2025-08-01'::date
      GROUP BY ms.product_id, p.name
      ORDER BY total_sales DESC
    ` as any[];

    return NextResponse.json({
      success: true,
      message: `${insertedRecords} registros de ventas creados`,
      createdSales: createdSales,
      summary: {
        total_products_with_sales: createdSales.length,
        total_sales: createdSales.reduce((sum: number, s: any) => sum + Number(s.total_sales), 0)
      }
    });

  } catch (error) {
    console.error('❌ Error creando datos de ventas:', error);
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