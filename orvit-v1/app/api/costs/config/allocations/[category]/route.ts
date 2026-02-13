import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AllocationsArraySchema, AllocationCategoryQuerySchema } from '@/lib/validations/costs';
import { z } from 'zod';

// PUT /api/costs/config/allocations/[category] - Replace all allocations for a category
export async function PUT(
  request: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    // Validate category
    const validatedCategory = AllocationCategoryQuerySchema.parse({ 
      category: params.category 
    });

    const body = await request.json();
    const validatedAllocations = AllocationsArraySchema.parse(body.allocations);

    // Verify all lines exist
    const lineIds = validatedAllocations.map(a => a.lineId);
    const existingLines = await prisma.line.findMany({
      where: { id: { in: lineIds } },
      select: { id: true },
    });

    if (existingLines.length !== lineIds.length) {
      return NextResponse.json(
        { error: 'Una o más líneas no existen' },
        { status: 400 }
      );
    }

    // Verify percentages sum to 1 (100%)
    const totalPercent = validatedAllocations.reduce((sum, a) => sum + a.percent, 0);
    if (Math.abs(totalPercent - 1) > 0.0001) {
      return NextResponse.json(
        { error: 'La suma de porcentajes debe ser exactamente 100%' },
        { status: 400 }
      );
    }

    // Use transaction to replace all allocations
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing allocations for this category
      await tx.globalAllocation.deleteMany({
        where: { category: validatedCategory.category },
      });

      // Create new allocations
      const createdAllocations = await Promise.all(
        validatedAllocations.map(allocation =>
          tx.globalAllocation.create({
            data: {
              category: validatedCategory.category,
              lineId: allocation.lineId,
              percent: allocation.percent,
            },
            include: {
              line: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          })
        )
      );

      return createdAllocations;
    });

    return NextResponse.json({
      message: 'Asignaciones actualizadas exitosamente',
      category: validatedCategory.category,
      allocations: result,
      totalPercent: result.reduce((sum, a) => sum + a.percent.toNumber(), 0),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating allocations:', error);
    return NextResponse.json(
      { error: 'Error al actualizar asignaciones' },
      { status: 500 }
    );
  }
}
