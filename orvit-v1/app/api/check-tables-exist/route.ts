import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 === VERIFICANDO TABLAS DEL SISTEMA ===');

    const tables = ['recipes', 'recipe_ingredients', 'supplies'];
    const results: any = {};

    for (const tableName of tables) {
      try {
        const exists = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = ${tableName}
          )
        ` as any[];
        
        results[tableName] = {
          exists: exists[0]?.exists || false,
          error: null
        };

        if (exists[0]?.exists) {
          // Contar registros si la tabla existe
          const count = await prisma.$queryRaw`
            SELECT COUNT(*) as total FROM ${tableName}
          ` as any[];
          results[tableName].count = Number(count[0]?.total || 0);
        }
      } catch (error) {
        results[tableName] = {
          exists: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        };
      }
    }

    return NextResponse.json({
      tables: results,
      summary: {
        recipes_available: results.recipes?.exists && results.recipes?.count > 0,
        ingredients_available: results.recipe_ingredients?.exists && results.recipe_ingredients?.count > 0,
        supplies_available: results.supplies?.exists && results.supplies?.count > 0
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Error verificando tablas',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}