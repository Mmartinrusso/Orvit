import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 === BUSCANDO TABLA DE INGREDIENTES ===');

    const possibleNames = [
      'recipe_ingredients',
      'ingredients',
      'recipe_items',
      'recipe_supplies',
      'recipe_components',
      'recipe_materials'
    ];

    const results: any = {};

    for (const tableName of possibleNames) {
      try {
        const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ${tableName} LIMIT 1` as any[];
        results[tableName] = { 
          exists: true, 
          count: Number(count[0]?.count || 0),
          status: 'found'
        };
      } catch (error) {
        results[tableName] = { 
          exists: false, 
          error: 'No existe',
          status: 'not_found'
        };
      }
    }

    // También vamos a ver qué tablas existen que contengan 'recipe'
    const allTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%recipe%' 
      OR table_name LIKE '%ingredient%'
      OR table_name LIKE '%supply%'
    ` as any[];

    return NextResponse.json({
      possible_names: results,
      existing_related_tables: allTables,
      found_ingredients_table: Object.keys(results).find(name => results[name].exists)
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Error buscando tabla de ingredientes',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}