import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

const UpdateInputSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100, 'Nombre muy largo').optional(),
  unitLabel: z.string().min(1, 'Unidad requerida').max(20, 'Unidad muy larga').optional(),
  supplier: z.string().max(100, 'Proveedor muy largo').optional(),
});

// GET /api/inputs/[id] - Obtener insumo específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const input = await prisma.inputItem.findUnique({
      where: { id: params.id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        priceHistory: {
          orderBy: { effectiveFrom: 'desc' },
          take: 10, // Últimos 10 cambios de precio
        },
        _count: {
          select: {
            priceHistory: true,
            recipeItems: true,
          },
        },
      },
    });

    if (!input) {
      return NextResponse.json(
        { error: 'Insumo no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(input);
  } catch (error) {
    console.error('Error fetching input:', error);
    return NextResponse.json(
      { error: 'Error al obtener insumo' },
      { status: 500 }
    );
  }
}

// PUT /api/inputs/[id] - Actualizar insumo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const validatedData = UpdateInputSchema.parse(body);

    // Verificar que el insumo existe
    const existingInput = await prisma.inputItem.findUnique({
      where: { id: params.id },
    });

    if (!existingInput) {
      return NextResponse.json(
        { error: 'Insumo no encontrado' },
        { status: 404 }
      );
    }

    // Si se está cambiando el nombre, verificar que no existe otro insumo con el mismo nombre
    if (validatedData.name && validatedData.name !== existingInput.name) {
      const duplicateInput = await prisma.inputItem.findFirst({
        where: {
          companyId: existingInput.companyId,
          name: validatedData.name,
          id: { not: params.id },
        },
      });

      if (duplicateInput) {
        return NextResponse.json(
          { error: 'Ya existe otro insumo con ese nombre en esta empresa' },
          { status: 400 }
        );
      }
    }

    const updatedInput = await prisma.inputItem.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            priceHistory: true,
            recipeItems: true,
          },
        },
      },
    });

    return NextResponse.json(updatedInput);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating input:', error);
    return NextResponse.json(
      { error: 'Error al actualizar insumo' },
      { status: 500 }
    );
  }
}

// DELETE /api/inputs/[id] - Eliminar insumo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    // Verificar que el insumo existe
    const existingInput = await prisma.inputItem.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            recipeItems: true,
            perUnitBOM: true,
          },
        },
      },
    });

    if (!existingInput) {
      return NextResponse.json(
        { error: 'Insumo no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que no esté siendo usado en recetas o BOMs
    if (existingInput._count.recipeItems > 0 || existingInput._count.perUnitBOM > 0) {
      return NextResponse.json(
        { 
          error: 'No se puede eliminar el insumo porque está siendo usado en recetas o BOMs',
          details: {
            recipeItems: existingInput._count.recipeItems,
            perUnitBOM: existingInput._count.perUnitBOM,
          }
        },
        { status: 400 }
      );
    }

    // Eliminar el insumo (el historial de precios se elimina automáticamente por CASCADE)
    await prisma.inputItem.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Insumo eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting input:', error);
    return NextResponse.json(
      { error: 'Error al eliminar insumo' },
      { status: 500 }
    );
  }
}
