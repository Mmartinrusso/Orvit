import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 === VERIFICANDO TABLA MONTHLY_SALES ===');

    // Verificar estructura de la tabla
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'monthly_sales'
      ORDER BY ordinal_position
    ` as any[];

    console.log('📋 Columnas de monthly_sales:', tableInfo);

    // Verificar datos existentes
    const sampleData = await prisma.$queryRaw`
      SELECT * FROM monthly_sales LIMIT 3
    ` as any[];

    console.log('📊 Datos de ejemplo:', sampleData);

    return NextResponse.json({
      table_structure: tableInfo,
      sample_data: sampleData,
      total_records: sampleData.length
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Error verificando tabla',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}