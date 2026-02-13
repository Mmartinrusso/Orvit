import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';
import { z } from 'zod';
import { generateOrderCode } from '@/lib/production/order-code-generator';
import { logProductionEvent } from '@/lib/production/event-logger';

export const dynamic = 'force-dynamic';

// Schema de validación para ProductionOrder
const ProductionOrderSchema = z.object({
  productId: z.string().min(1, 'El producto es requerido'),
  productVariantId: z.string().optional().nullable(),
  recipeId: z.string().optional().nullable(),
  plannedQuantity: z.number().positive('La cantidad debe ser positiva'),
  targetUom: z.string().min(1, 'La unidad de medida es requerida'),
  plannedCycleTimeSec: z.number().optional().nullable(),
  plannedSetupMinutes: z.number().optional().nullable(),
  plannedStartDate: z.string().datetime({ message: 'Fecha de inicio inválida' }),
  plannedEndDate: z.string().datetime({ message: 'Fecha de fin inválida' }).optional().nullable(),
  workCenterId: z.number().optional().nullable(),
  sectorId: z.number().optional().nullable(),
  responsibleId: z.number().optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const workCenterId = searchParams.get('workCenterId');
    const productId = searchParams.get('productId');
    const priority = searchParams.get('priority');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const whereClause: any = {
      companyId: auth.companyId,
    };

    if (status) {
      // Permitir múltiples estados separados por coma
      const statuses = status.split(',').map(s => s.trim());
      whereClause.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }

    if (workCenterId) {
      whereClause.workCenterId = parseInt(workCenterId);
    }

    if (productId) {
      whereClause.productId = productId;
    }

    if (priority) {
      whereClause.priority = priority;
    }

    if (dateFrom || dateTo) {
      whereClause.plannedStartDate = {};
      if (dateFrom) {
        whereClause.plannedStartDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.plannedStartDate.lte = new Date(dateTo);
      }
    }

    const [orders, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where: whereClause,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              unitLabel: true,
              line: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
          workCenter: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
            },
          },
          sector: {
            select: {
              id: true,
              name: true,
            },
          },
          responsible: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              dailyReports: true,
              downtimes: true,
              batchLots: true,
            },
          },
        },
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { plannedStartDate: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.productionOrder.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching production orders:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId || !auth.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = ProductionOrderSchema.parse(body);

    // Verificar que el producto existe
    const product = await prisma.costProduct.findFirst({
      where: {
        id: validatedData.productId,
        companyId: auth.companyId,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 400 }
      );
    }

    // Verificar workCenter si se especifica
    if (validatedData.workCenterId) {
      const workCenter = await prisma.workCenter.findFirst({
        where: {
          id: validatedData.workCenterId,
          companyId: auth.companyId,
        },
      });

      if (!workCenter) {
        return NextResponse.json(
          { error: 'Centro de trabajo no encontrado' },
          { status: 400 }
        );
      }
    }

    // Verificar sector si se especifica
    if (validatedData.sectorId) {
      const sector = await prisma.sector.findFirst({
        where: {
          id: validatedData.sectorId,
          area: {
            companyId: auth.companyId,
          },
        },
      });

      if (!sector) {
        return NextResponse.json(
          { error: 'Sector no encontrado' },
          { status: 400 }
        );
      }
    }

    // Generar código único
    const code = await generateOrderCode(auth.companyId);

    // Crear la orden
    const order = await prisma.productionOrder.create({
      data: {
        code,
        productId: validatedData.productId,
        productVariantId: validatedData.productVariantId,
        recipeId: validatedData.recipeId,
        plannedQuantity: validatedData.plannedQuantity,
        targetUom: validatedData.targetUom,
        plannedCycleTimeSec: validatedData.plannedCycleTimeSec,
        plannedSetupMinutes: validatedData.plannedSetupMinutes,
        plannedStartDate: new Date(validatedData.plannedStartDate),
        plannedEndDate: validatedData.plannedEndDate ? new Date(validatedData.plannedEndDate) : null,
        workCenterId: validatedData.workCenterId,
        sectorId: validatedData.sectorId,
        responsibleId: validatedData.responsibleId,
        priority: validatedData.priority,
        notes: validatedData.notes,
        status: 'DRAFT',
        companyId: auth.companyId,
        createdById: auth.user.id,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            unitLabel: true,
            line: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        workCenter: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        responsible: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Registrar evento de creación
    await logProductionEvent({
      entityType: 'PRODUCTION_ORDER',
      entityId: order.id,
      eventType: 'ORDER_CREATED',
      newValue: {
        code: order.code,
        productId: order.productId,
        plannedQuantity: Number(order.plannedQuantity),
        status: order.status,
      },
      performedById: auth.user.id,
      productionOrderId: order.id,
      companyId: auth.companyId,
    });

    return NextResponse.json({
      success: true,
      order,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating production order:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
