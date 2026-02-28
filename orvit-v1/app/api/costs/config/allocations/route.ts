import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';
import { AllocationCategoryQuerySchema, AllocationsArraySchema } from '@/lib/validations/costs';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/costs/config/allocations - Get allocations by category
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    if (!category) {
      return NextResponse.json(
        { error: 'Parámetro category requerido (EMPLEADOS | INDIRECTOS)' },
        { status: 400 }
      );
    }

    const validatedQuery = AllocationCategoryQuerySchema.parse({ category });

    const allocations = await prisma.globalAllocation.findMany({
      where: { category: validatedQuery.category },
      include: {
        line: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        line: { name: 'asc' },
      },
    });

    // Get all lines to show missing allocations
    const allLines = await prisma.line.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    // Create complete allocation map
    const allocationMap = new Map(
      allocations.map(a => [a.lineId, a])
    );

    const completeAllocations = allLines.map(line => {
      const allocation = allocationMap.get(line.id);
      return {
        lineId: line.id,
        line,
        percent: allocation?.percent.toNumber() || 0,
        updatedAt: allocation?.updatedAt || null,
      };
    });

    return NextResponse.json({
      category: validatedQuery.category,
      allocations: completeAllocations,
      totalPercent: completeAllocations.reduce((sum, a) => sum + a.percent, 0),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error fetching allocations:', error);
    return NextResponse.json(
      { error: 'Error al obtener asignaciones' },
      { status: 500 }
    );
  }
}
