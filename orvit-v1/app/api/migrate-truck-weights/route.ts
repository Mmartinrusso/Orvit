import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Flag de módulo: ALTER TABLE solo corre una vez por proceso del servidor
let migrationApplied = false;

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    if (migrationApplied) {
      return NextResponse.json({
        success: true,
        message: 'Migración ya aplicada en este proceso',
        columnsAdded: ['chasisWeight', 'acopladoWeight'],
      });
    }

    // ALTER TABLE con IF NOT EXISTS (PostgreSQL 9.6+) — no requiere DO $$ block
    await prisma.$executeRaw`
      ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "chasisWeight" DOUBLE PRECISION
    `;

    await prisma.$executeRaw`
      ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "acopladoWeight" DOUBLE PRECISION
    `;

    migrationApplied = true;

    // Verificar que las columnas existen
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Truck'
        AND column_name IN ('chasisWeight', 'acopladoWeight')
    `;

    return NextResponse.json({
      success: true,
      message: 'Migración completada exitosamente',
      columnsAdded: columns.map((c) => c.column_name),
    });

  } catch (error: any) {
    console.error('Error durante la migración:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al aplicar la migración',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
