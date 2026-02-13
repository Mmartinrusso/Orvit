import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema de validación para ProductionQualityControl
const QualityControlSchema = z.object({
  dailyReportId: z.number().optional().nullable(),
  productionOrderId: z.number().optional().nullable(),
  batchLotId: z.number().optional().nullable(),
  controlType: z.string().min(1, 'El tipo de control es requerido'),
  parameter: z.string().optional().nullable(),
  expectedValue: z.string().optional().nullable(),
  actualValue: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  result: z.enum(['APPROVED', 'REJECTED', 'HOLD', 'PENDING']),
  rejectionReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachmentUrls: z.any().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productionOrderId = searchParams.get('productionOrderId');
    const batchLotId = searchParams.get('batchLotId');
    const result = searchParams.get('result');
    const controlType = searchParams.get('controlType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const whereClause: any = {
      companyId: auth.companyId,
    };

    if (productionOrderId) {
      whereClause.productionOrderId = parseInt(productionOrderId);
    }

    if (batchLotId) {
      whereClause.batchLotId = parseInt(batchLotId);
    }

    if (result) {
      whereClause.result = result;
    }

    if (controlType) {
      whereClause.controlType = controlType;
    }

    if (dateFrom || dateTo) {
      whereClause.inspectedAt = {};
      if (dateFrom) {
        whereClause.inspectedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.inspectedAt.lte = new Date(dateTo);
      }
    }

    const [controls, total] = await Promise.all([
      prisma.productionQualityControl.findMany({
        where: whereClause,
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
          batchLot: {
            select: {
              id: true,
              lotCode: true,
              qualityStatus: true,
            },
          },
          inspectedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { inspectedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.productionQualityControl.count({ where: whereClause }),
    ]);

    // Estadísticas
    const stats = await prisma.productionQualityControl.groupBy({
      by: ['result'],
      where: whereClause,
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      controls,
      stats: stats.reduce((acc, s) => ({ ...acc, [s.result]: s._count.id }), {}),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching quality controls:', error);
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
    const validatedData = QualityControlSchema.parse(body);

    const control = await prisma.productionQualityControl.create({
      data: {
        ...validatedData,
        inspectedById: auth.user.id,
        companyId: auth.companyId,
      },
      include: {
        productionOrder: {
          select: {
            id: true,
            code: true,
          },
        },
        batchLot: {
          select: {
            id: true,
            lotCode: true,
          },
        },
        inspectedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Si el control es REJECTED y hay un lote, actualizar estado del lote
    if (validatedData.result === 'REJECTED' && validatedData.batchLotId) {
      await prisma.productionBatchLot.update({
        where: { id: validatedData.batchLotId },
        data: {
          qualityStatus: 'BLOCKED',
          blockedReason: validatedData.rejectionReason || 'Rechazado en control de calidad',
          blockedAt: new Date(),
          blockedById: auth.user.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      control,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating quality control:', error);

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
