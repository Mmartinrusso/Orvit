import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    console.log('🔍 === VERIFICACIÓN SIMPLE DE TABLAS ===');

    const results: any = {};

    // Verificar recipes
    try {
      const recipes = await prisma.$queryRaw`SELECT COUNT(*) as count FROM recipes LIMIT 1` as any[];
      results.recipes = { exists: true, count: Number(recipes[0]?.count || 0) };
    } catch (error) {
      results.recipes = { exists: false, error: 'Tabla no existe' };
    }

    // Verificar recipe_ingredients
    try {
      const ingredients = await prisma.$queryRaw`SELECT COUNT(*) as count FROM recipe_ingredients LIMIT 1` as any[];
      results.recipe_ingredients = { exists: true, count: Number(ingredients[0]?.count || 0) };
    } catch (error) {
      results.recipe_ingredients = { exists: false, error: 'Tabla no existe' };
    }

    // Verificar supplies
    try {
      const supplies = await prisma.$queryRaw`SELECT COUNT(*) as count FROM supplies LIMIT 1` as any[];
      results.supplies = { exists: true, count: Number(supplies[0]?.count || 0) };
    } catch (error) {
      results.supplies = { exists: false, error: 'Tabla no existe' };
    }

    return NextResponse.json({
      tables: results,
      has_recipe_system: results.recipes?.exists && results.recipe_ingredients?.exists && results.supplies?.exists,
      recommendation: !results.recipes?.exists 
        ? "Las tablas de recetas no existen. Necesitas configurar el sistema de recetas primero."
        : results.recipes?.count === 0
        ? "Las tablas existen pero no hay recetas configuradas. Necesitas crear recetas para los productos."
        : "Sistema de recetas disponible."
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