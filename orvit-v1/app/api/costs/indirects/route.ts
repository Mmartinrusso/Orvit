import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateMonthlyIndirectSchema, MonthQuerySchema } from '@/lib/validations/costs';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/costs/indirects - List monthly indirect costs
export const GET = withGuards(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const category = searchParams.get('category');
    const itemId = searchParams.get('itemId');

    const whereClause: any = {
      companyId: user.companyId,
    };

    if (month) {
      const validatedMonth = MonthQuerySchema.parse({ month });
      whereClause.month = validatedMonth.month;
    }

    if (category) {
      whereClause.category = category;
    }

    if (itemId) {
      whereClause.itemId = itemId;
    }

    const indirects = await prisma.monthlyIndirect.findMany({
      where: whereClause,
      include: {
        item: {
          select: {
            id: true,
            code: true,
            label: true,
          },
        },
      },
      orderBy: [
        { month: 'desc' },
        { category: 'asc' },
        { label: 'asc' },
      ],
    });

    // Group by month and category for summary
    const summary = indirects.reduce((acc, indirect) => {
      if (!acc[indirect.month]) {
        acc[indirect.month] = {};
      }
      if (!acc[indirect.month][indirect.category]) {
        acc[indirect.month][indirect.category] = {
          category: indirect.category,
          totalAmount: 0,
          itemCount: 0,
        };
      }

      acc[indirect.month][indirect.category].totalAmount += indirect.amount.toNumber();
      acc[indirect.month][indirect.category].itemCount += 1;

      return acc;
    }, {} as Record<string, Record<string, any>>);

    // Convert to array format
    const monthlySummary = Object.entries(summary).map(([month, categories]) => ({
      month,
      categories: Object.values(categories),
      totalAmount: Object.values(categories).reduce((sum: number, cat: any) => sum + cat.totalAmount, 0),
    }));

    return NextResponse.json({
      indirects,
      monthlySummary,
      categories: ['IMP_SERV', 'SOCIAL', 'VEHICLES', 'MKT', 'OTHER'],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error fetching indirects:', error);
    return NextResponse.json(
      { error: 'Error al obtener costos indirectos' },
      { status: 500 }
    );
  }
});

// POST /api/costs/indirects - Create a new monthly indirect cost
export const POST = withGuards(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const validation = validateRequest(CreateMonthlyIndirectSchema, body);
    if (!validation.success) return validation.response;

    const newIndirect = await prisma.monthlyIndirect.create({
      data: {
        ...validation.data,
        companyId: user.companyId,
      },
    });

    return NextResponse.json(newIndirect, { status: 201 });
  } catch (error) {
    console.error('Error creating indirect cost:', error);
    return NextResponse.json(
      { error: 'Error al crear costo indirecto' },
      { status: 500 }
    );
  }
});
