import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';
import { UpdateLineSchema } from '@/lib/validations/costs';
import { z } from 'zod';

// GET /api/costs/lines/[id] - Get a specific line
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const line = await prisma.line.findUnique({
      where: { id: params.id },
      include: {
        products: {
          where: { active: true },
          include: {
            yieldConfig: true,
            volumetricParam: true,
            variant: true,
            costHistory: {
              orderBy: { month: 'desc' },
              take: 1,
            },
          },
        },
        globalAllocations: true,
        _count: {
          select: {
            products: { where: { active: true } },
          },
        },
      },
    });

    if (!line) {
      return NextResponse.json(
        { error: 'Línea no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(line);
  } catch (error) {
    console.error('Error fetching line:', error);
    return NextResponse.json(
      { error: 'Error al obtener línea' },
      { status: 500 }
    );
  }
}

// PUT /api/costs/lines/[id] - Update a line
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const validatedData = UpdateLineSchema.parse(body);

    // Check if line exists
    const existingLine = await prisma.line.findUnique({
      where: { id: params.id },
    });

    if (!existingLine) {
      return NextResponse.json(
        { error: 'Línea no encontrada' },
        { status: 404 }
      );
    }

    // Check if code already exists (if changing code)
    if (validatedData.code && validatedData.code !== existingLine.code) {
      const duplicateLine = await prisma.line.findUnique({
        where: { code: validatedData.code },
      });

      if (duplicateLine) {
        return NextResponse.json(
          { error: 'Ya existe una línea con este código' },
          { status: 400 }
        );
      }
    }

    const updatedLine = await prisma.line.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        products: {
          where: { active: true },
        },
        globalAllocations: true,
        _count: {
          select: {
            products: { where: { active: true } },
          },
        },
      },
    });

    return NextResponse.json(updatedLine);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating line:', error);
    return NextResponse.json(
      { error: 'Error al actualizar línea' },
      { status: 500 }
    );
  }
}

// DELETE /api/costs/lines/[id] - Delete a line
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    // Check if line exists
    const existingLine = await prisma.line.findUnique({
      where: { id: params.id },
      include: {
        products: { where: { active: true } },
      },
    });

    if (!existingLine) {
      return NextResponse.json(
        { error: 'Línea no encontrada' },
        { status: 404 }
      );
    }

    // Check if line has active products
    if (existingLine.products.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una línea con productos activos' },
        { status: 400 }
      );
    }

    await prisma.line.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Línea eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting line:', error);
    return NextResponse.json(
      { error: 'Error al eliminar línea' },
      { status: 500 }
    );
  }
}
