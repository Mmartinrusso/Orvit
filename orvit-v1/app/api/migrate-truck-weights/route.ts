import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Aplicando migración: Agregar campos de peso a la tabla Truck...');

    // Agregar columna chasisWeight si no existe
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
            ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "chasisWeight" DOUBLE PRECISION;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
      `);
      console.log('✅ Columna chasisWeight agregada (o ya existía)');
    } catch (error: any) {
      if (error.message?.includes('duplicate_column') || error.message?.includes('already exists')) {
        console.log('ℹ️  Columna chasisWeight ya existe');
      } else {
        throw error;
      }
    }

    // Agregar columna acopladoWeight si no existe
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
            ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "acopladoWeight" DOUBLE PRECISION;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
      `);
      console.log('✅ Columna acopladoWeight agregada (o ya existía)');
    } catch (error: any) {
      if (error.message?.includes('duplicate_column') || error.message?.includes('already exists')) {
        console.log('ℹ️  Columna acopladoWeight ya existe');
      } else {
        throw error;
      }
    }

    // Verificar que las columnas existen
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Truck' 
      AND column_name IN ('chasisWeight', 'acopladoWeight');
    `) as any[];

    return NextResponse.json({
      success: true,
      message: 'Migración completada exitosamente',
      columnsAdded: columns.map((c: any) => c.column_name),
    });

  } catch (error: any) {
    console.error('❌ Error durante la migración:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al aplicar la migración',
        details: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

