import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateRecipeSchema } from '@/lib/validations/costs';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';

export const dynamic = 'force-dynamic';


export const GET = withGuards(async (_request: NextRequest, { user }) => {
  try {
    const recipes = await prisma.recipe.findMany({
      where: {
        companyId: user.companyId,
      },
      include: {
        items: {
          include: {
            input: {
              select: {
                id: true,
                name: true,
                unitLabel: true,
                currentPrice: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});

export const POST = withGuards(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const validation = validateRequest(CreateRecipeSchema, body);
    if (!validation.success) return validation.response;

    const recipe = await prisma.recipe.create({
      data: {
        name: validation.data.name,
        base: validation.data.base,
        scopeType: validation.data.scopeType,
        scopeId: validation.data.scopeId,
        version: validation.data.version,
        description: validation.data.description,
        createdBy: validation.data.createdBy || user.name || 'Usuario',
        companyId: user.companyId,
        outputQuantity: validation.data.outputQuantity,
        outputUnitLabel: validation.data.outputUnitLabel,
        intermediateQuantity: validation.data.intermediateQuantity,
        intermediateUnitLabel: validation.data.intermediateUnitLabel,
        items: {
          create: validation.data.items.map(item => ({
            inputId: item.inputId,
            quantity: item.quantity,
            unitLabel: item.unitLabel,
          })),
        },
      },
      include: {
        items: {
          include: {
            input: {
              select: {
                id: true,
                name: true,
                unitLabel: true,
                currentPrice: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});
