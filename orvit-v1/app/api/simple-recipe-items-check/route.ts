import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    console.log('🔍 === VERIFICACIÓN SIMPLE RECIPE_ITEMS ===');

    // Verificar si recipe_items tiene datos
    try {
      const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM recipe_items` as any[];
      const hasItems = Number(count[0]?.count || 0) > 0;
      
      let sampleData = [];
      if (hasItems) {
        sampleData = await prisma.$queryRaw`SELECT * FROM recipe_items LIMIT 3` as any[];
      }

      return NextResponse.json({
        recipe_items_exist: true,
        total_items: Number(count[0]?.count || 0),
        has_data: hasItems,
        sample_data: sampleData,
        message: hasItems 
          ? `Encontrados ${count[0]?.count} items en recipe_items`
          : "La tabla recipe_items existe pero está vacía"
      });
    } catch (error) {
      return NextResponse.json({
        recipe_items_exist: false,
        error: "La tabla recipe_items no existe",
        message: "Necesitas crear la tabla recipe_items o usar un nombre diferente"
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Error verificando recipe_items',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}