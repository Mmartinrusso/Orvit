import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔄 === CREANDO VENTAS SIMPLES ===');

    // Eliminar ventas existentes de agosto
    await prisma.$executeRaw`
      DELETE FROM monthly_sales 
      WHERE company_id = ${parseInt(companyId)} 
      AND DATE_TRUNC('month', created_at) = '2025-08-01'::date
    `;

    // Crear ventas directamente con IDs conocidos
    await prisma.$executeRaw`
      INSERT INTO monthly_sales (
        company_id, product_id, quantity_sold, unit_price, total_revenue, created_at
      ) VALUES 
        (${parseInt(companyId)}, '9', 1000, 500, 500000, '2025-08-15'::timestamp),
        (${parseInt(companyId)}, '10', 500, 600, 300000, '2025-08-15'::timestamp),
        (${parseInt(companyId)}, '11', 200, 700, 140000, '2025-08-15'::timestamp)
    `;

    return NextResponse.json({
      success: true,
      message: '3 ventas creadas para agosto',
      sales: [
        { product_id: '9', quantity: 1000 },
        { product_id: '10', quantity: 500 },
        { product_id: '11', quantity: 200 }
      ]
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ 
      error: 'Error creando ventas',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}