import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 === INSERTANDO VENTAS DIRECTAS ===');

    // Eliminar ventas existentes de agosto
    await prisma.$executeRaw`
      DELETE FROM monthly_sales 
      WHERE company_id = 3 
      AND created_at >= '2025-08-01'::date 
      AND created_at < '2025-09-01'::date
    `;

    // Insertar ventas para productos específicos
    await prisma.$executeRaw`
      INSERT INTO monthly_sales (
        company_id, product_id, product_name, quantity_sold, unit_price, total_revenue, created_at
      ) VALUES 
        (3, '9', 'Adoquin Holanda 6cm', 1000, 500, 500000, '2025-08-15 10:00:00'),
        (3, '10', 'Bloque LT10', 800, 600, 480000, '2025-08-15 11:00:00'),
        (3, '11', 'Bloque LT13', 300, 700, 210000, '2025-08-15 12:00:00')
    `;

    console.log('✅ Ventas insertadas correctamente');

    return NextResponse.json({
      success: true,
      message: 'Ventas insertadas correctamente',
      sales: [
        { product_id: '9', product_name: 'Adoquin Holanda 6cm', quantity: 1000 },
        { product_id: '10', product_name: 'Bloque LT10', quantity: 800 },
        { product_id: '11', product_name: 'Bloque LT13', quantity: 300 }
      ]
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ 
      error: 'Error insertando ventas',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}