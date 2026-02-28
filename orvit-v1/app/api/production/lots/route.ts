import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';
import { generateLotCode } from '@/lib/production/order-code-generator';
import { logProductionEvent } from '@/lib/production/event-logger';

export const dynamic = 'force-dynamic';

// Schema de validación para ProductionBatchLot
const BatchLotSchema = z.object({
  productionOrderId: z.number().min(1, 'La orden de producción es requerida'),
  quantity: z.number().positive('La cantidad debe ser positiva'),
  uom: z.string().min(1, 'La unidad es requerida'),
  productionDate: z.string().min(1, 'La fecha de producción es requerida'),
  expirationDate: z.string().optional().nullable(),
  rawMaterialLots: z.any().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CALIDAD.VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const productionOrderId = searchParams.get('productionOrderId');
    const qualityStatus = searchParams.get('qualityStatus');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const whereClause: any = {
      companyId: user!.companyId,
    };

    if (productionOrderId) {
      whereClause.productionOrderId = parseInt(productionOrderId);
    }

    if (qualityStatus) {
      // Permitir múltiples estados separados por coma
      const statuses = qualityStatus.split(',').map(s => s.trim());
      whereClause.qualityStatus = statuses.length === 1 ? statuses[0] : { in: statuses };
    }

    if (dateFrom || dateTo) {
      whereClause.productionDate = {};
      if (dateFrom) {
        whereClause.productionDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.productionDate.lte = new Date(dateTo);
      }
    }

    const [lots, total] = await Promise.all([
      prisma.productionBatchLot.findMany({
        where: whereClause,
        include: {
          productionOrder: {
            select: {
              id: true,
              code: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  unitLabel: true,
                },
              },
            },
          },
          blockedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          releasedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              qualityControls: true,
              defects: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.productionBatchLot.count({ where: whereClause }),
    ]);

    // Estadísticas por estado
    const stats = await prisma.productionBatchLot.groupBy({
      by: ['qualityStatus'],
      where: { companyId: user!.companyId },
      _count: { id: true },
      _sum: { quantity: true },
    });

    return NextResponse.json({
      success: true,
      lots,
      stats: stats.reduce((acc, s) => ({
        ...acc,
        [s.qualityStatus]: {
          count: s._count.id,
          quantity: Number(s._sum.quantity) || 0,
        },
      }), {}),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching batch lots:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CALIDAD.VIEW);
    if (error) return error;

    const body = await request.json();
    const validatedData = BatchLotSchema.parse(body);

    // Verificar que la orden de producción existe
    const order = await prisma.productionOrder.findFirst({
      where: {
        id: validatedData.productionOrderId,
        companyId: user!.companyId,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Orden de producción no encontrada' },
        { status: 400 }
      );
    }

    // Generar código único de lote
    const lotCode = await generateLotCode(user!.companyId);

    const lot = await prisma.productionBatchLot.create({
      data: {
        lotCode,
        productionOrderId: validatedData.productionOrderId,
        quantity: validatedData.quantity,
        uom: validatedData.uom,
        qualityStatus: 'PENDING',
        productionDate: new Date(validatedData.productionDate),
        expirationDate: validatedData.expirationDate
          ? new Date(validatedData.expirationDate)
          : null,
        rawMaterialLots: validatedData.rawMaterialLots,
        companyId: user!.companyId,
      },
      include: {
        productionOrder: {
          select: {
            id: true,
            code: true,
            product: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Registrar evento
    await logProductionEvent({
      entityType: 'BATCH_LOT',
      entityId: lot.id,
      eventType: 'LOT_CREATED',
      newValue: {
        lotCode: lot.lotCode,
        quantity: Number(lot.quantity),
        uom: lot.uom,
      },
      performedById: user!.id,
      productionOrderId: validatedData.productionOrderId,
      companyId: user!.companyId,
    });

    return NextResponse.json({
      success: true,
      lot,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating batch lot:', error);

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
