import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

// PUT /api/costs/recipes/[id]/activate - Activate a recipe (deactivates others in same scope)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    // Check if recipe exists
    const recipe = await prisma.recipe.findUnique({
      where: { id: params.id },
    });

    if (!recipe) {
      return NextResponse.json(
        { error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    // Use transaction to ensure only one active recipe per scope
    const result = await prisma.$transaction(async (tx) => {
      // Deactivate all recipes in the same scope
      await tx.recipe.updateMany({
        where: {
          scopeType: recipe.scopeType,
          scopeId: recipe.scopeId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Activate the target recipe
      const activatedRecipe = await tx.recipe.update({
        where: { id: params.id },
        data: { isActive: true },
        include: {
          items: {
            include: {
              input: true,
            },
          },
          _count: {
            select: {
              items: true,
              batchRuns: true,
            },
          },
        },
      });

      return activatedRecipe;
    });

    return NextResponse.json({
      message: 'Receta activada exitosamente',
      recipe: result,
    });
  } catch (error) {
    console.error('Error activating recipe:', error);
    return NextResponse.json(
      { error: 'Error al activar receta' },
      { status: 500 }
    );
  }
}
