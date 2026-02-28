import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateMonthlyProductionSchema, MonthQuerySchema } from '@/lib/validations/costs';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/costs/production - List monthly production
export const GET = withGuards(async (request: NextRequest, { user }) => {
  try {
    const { error: permError } = await requirePermission(PRODUCCION_PERMISSIONS.REPORTES.VIEW);
    if (permError) return permError;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const productId = searchParams.get('productId');
    const lineId = searchParams.get('lineId');

    const whereClause: any = {
      companyId: user.companyId,
    };

    if (month) {
      const validatedMonth = MonthQuerySchema.parse({ month });
      whereClause.month = validatedMonth.month;
    }

    if (productId) {
      whereClause.productId = productId;
    }

    if (lineId) {
      whereClause.product = {
        lineId: lineId,
      };
    }

    const productions = await prisma.monthlyProduction.findMany({
      where: whereClause,
      include: {
        product: {
          include: {
            line: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { month: 'desc' },
        { product: { line: { name: 'asc' } } },
        { product: { name: 'asc' } },
      ],
    });

    // Group by month for summary
    const monthlyTotals = productions.reduce((acc, prod) => {
      if (!acc[prod.month]) {
        acc[prod.month] = {
          month: prod.month,
          totalQuantity: 0,
          productCount: 0,
          lineCount: new Set(),
        };
      }

      acc[prod.month].totalQuantity += prod.producedQuantity.toNumber();
      acc[prod.month].productCount += 1;
      acc[prod.month].lineCount.add(prod.product.lineId);

      return acc;
    }, {} as Record<string, any>);

    // Convert Set to count
    Object.values(monthlyTotals).forEach((total: any) => {
      total.lineCount = total.lineCount.size;
    });

    return NextResponse.json({
      productions,
      monthlyTotals: Object.values(monthlyTotals),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error fetching production:', error);
    return NextResponse.json(
      { error: 'Error al obtener producción' },
      { status: 500 }
    );
  }
});

// POST /api/costs/production - Create or update monthly production
export const POST = withGuards(async (request: NextRequest, { user }) => {
  try {
    const { error: permError } = await requirePermission(PRODUCCION_PERMISSIONS.REPORTES.VIEW);
    if (permError) return permError;

    const body = await request.json();
    const validation = validateRequest(CreateMonthlyProductionSchema, body);
    if (!validation.success) return validation.response;

    // Check if product exists and belongs to user's company
    const product = await prisma.costProduct.findFirst({
      where: { id: validation.data.productId, companyId: user.companyId },
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
        { status: 400 }
      );
    }

    // Upsert monthly production
    const production = await prisma.monthlyProduction.upsert({
      where: {
        productId_month: {
          productId: validation.data.productId,
          month: validation.data.month,
        },
      },
      update: {
        producedQuantity: validation.data.producedQuantity,
      },
      create: validation.data,
      include: {
        product: {
          include: {
            line: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Producción registrada exitosamente',
      production,
    });
  } catch (error) {
    console.error('Error creating production:', error);
    return NextResponse.json(
      { error: 'Error al registrar producción' },
      { status: 500 }
    );
  }
});
