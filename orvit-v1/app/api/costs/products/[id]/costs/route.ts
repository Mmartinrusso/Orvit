import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';
import { MonthQuerySchema } from '@/lib/validations/costs';
import { calculateProductCost } from '@/lib/costs/calculator';
import { z } from 'zod';

// GET /api/costs/products/[id]/costs - Get cost history for a product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    const product = await prisma.costProduct.findUnique({
      where: { id: params.id },
      include: {
        line: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const whereClause: any = {
      productId: params.id,
    };

    if (month) {
      const validatedMonth = MonthQuerySchema.parse({ month });
      whereClause.month = validatedMonth.month;
    }

    const costHistory = await prisma.productCostHistory.findMany({
      where: whereClause,
      orderBy: { month: 'desc' },
      take: month ? 1 : 12, // If specific month, get 1, otherwise get last 12
    });

    // If no cost history found and month specified, try to calculate it
    if (costHistory.length === 0 && month) {
      try {
        const calculatedCost = await calculateProductCost(params.id, month);
        
        return NextResponse.json({
          product: {
            id: product.id,
            name: product.name,
            costMethod: product.costMethod,
            unitLabel: product.unitLabel,
            line: product.line,
          },
          costHistory: [],
          calculatedCost,
          message: 'Costo calculado en tiempo real (no guardado en historial)',
        });
      } catch (calcError) {
        return NextResponse.json({
          product: {
            id: product.id,
            name: product.name,
            costMethod: product.costMethod,
            unitLabel: product.unitLabel,
            line: product.line,
          },
          costHistory: [],
          error: 'No se pudo calcular el costo para este mes',
          details: calcError instanceof Error ? calcError.message : 'Error desconocido',
        });
      }
    }

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        costMethod: product.costMethod,
        unitLabel: product.unitLabel,
        line: product.line,
      },
      costHistory,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error fetching product costs:', error);
    return NextResponse.json(
      { error: 'Error al obtener costos del producto' },
      { status: 500 }
    );
  }
}
