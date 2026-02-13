import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 === DEBUG TABLA PRODUCTS ===');

    // Verificar estructura de la tabla products
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    ` as any[];

    console.log('📋 Columnas de products:', tableInfo);

    // Verificar datos de ejemplo
    const sampleData = await prisma.$queryRaw`
      SELECT * FROM products WHERE company_id = 3 LIMIT 3
    ` as any[];

    console.log('📊 Datos de ejemplo:', sampleData);

    return NextResponse.json({
      table_structure: tableInfo,
      sample_data: sampleData
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Error verificando tabla products',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}