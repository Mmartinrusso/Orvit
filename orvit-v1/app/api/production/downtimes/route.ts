import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';
import { z } from 'zod';
import { logProductionEvent } from '@/lib/production/event-logger';

export const dynamic = 'force-dynamic';

// Schema de validación para ProductionDowntime
const DowntimeSchema = z.object({
  dailyReportId: z.number().optional().nullable(),
  productionOrderId: z.number().optional().nullable(),
  shiftId: z.number().optional().nullable(),
  workCenterId: z.number().optional().nullable(),
  machineId: z.number().optional().nullable(),
  type: z.enum(['PLANNED', 'UNPLANNED']),
  reasonCodeId: z.number().optional().nullable(),
  description: z.string().min(1, 'La descripción es requerida'),
  rootCause: z.string().optional().nullable(),
  startTime: z.string().datetime({ message: 'Fecha de inicio inválida' }),
  endTime: z.string().datetime().optional().nullable(),
  durationMinutes: z.number().optional().nullable(),
  affectsLine: z.boolean().default(true),
  isMicrostop: z.boolean().default(false),
  detectedBy: z.enum(['MANUAL', 'SUPERVISOR', 'SENSOR']).default('MANUAL'),
  offlineId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productionOrderId = searchParams.get('productionOrderId');
    const workCenterId = searchParams.get('workCenterId');
    const machineId = searchParams.get('machineId');
    const reasonCodeId = searchParams.get('reasonCodeId');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const hasWorkOrder = searchParams.get('hasWorkOrder');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const whereClause: any = {
      companyId: auth.companyId,
    };

    if (productionOrderId) {
      whereClause.productionOrderId = parseInt(productionOrderId);
    }

    if (workCenterId) {
      whereClause.workCenterId = parseInt(workCenterId);
    }

    if (machineId) {
      whereClause.machineId = parseInt(machineId);
    }

    if (reasonCodeId) {
      whereClause.reasonCodeId = parseInt(reasonCodeId);
    }

    if (type) {
      whereClause.type = type;
    }

    if (dateFrom || dateTo) {
      whereClause.startTime = {};
      if (dateFrom) {
        whereClause.startTime.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.startTime.lte = new Date(dateTo);
      }
    }

    if (hasWorkOrder !== null && hasWorkOrder !== undefined) {
      whereClause.workOrderId = hasWorkOrder === 'true' ? { not: null } : null;
    }

    const [downtimes, total] = await Promise.all([
      prisma.productionDowntime.findMany({
        where: whereClause,
        include: {
          productionOrder: {
            select: {
              id: true,
              code: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
          shift: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          workCenter: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          machine: {
            select: {
              id: true,
              name: true,
              nickname: true,
            },
          },
          reasonCode: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              triggersMaintenance: true,
            },
          },
          workOrder: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          reportedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.productionDowntime.count({ where: whereClause }),
    ]);

    // Calcular estadísticas
    const stats = await prisma.productionDowntime.aggregate({
      where: whereClause,
      _sum: {
        durationMinutes: true,
      },
      _count: {
        id: true,
      },
    });

    return NextResponse.json({
      success: true,
      downtimes,
      stats: {
        totalDowntimes: stats._count.id,
        totalMinutes: stats._sum.durationMinutes || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching downtimes:', error);
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
    const validatedData = DowntimeSchema.parse(body);

    // Si tiene offlineId, verificar si ya existe (idempotencia)
    if (validatedData.offlineId) {
      const existingDowntime = await prisma.productionDowntime.findFirst({
        where: {
          companyId: auth.companyId,
          offlineId: validatedData.offlineId,
        },
      });

      if (existingDowntime) {
        return NextResponse.json({
          success: true,
          downtime: existingDowntime,
          message: 'Parada ya sincronizada',
          alreadyExists: true,
        });
      }
    }

    // Calcular duración si se proporciona endTime
    let durationMinutes = validatedData.durationMinutes;
    if (validatedData.endTime && !durationMinutes) {
      const start = new Date(validatedData.startTime);
      const end = new Date(validatedData.endTime);
      durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    }

    // Crear la parada
    const downtime = await prisma.productionDowntime.create({
      data: {
        dailyReportId: validatedData.dailyReportId,
        productionOrderId: validatedData.productionOrderId,
        shiftId: validatedData.shiftId,
        workCenterId: validatedData.workCenterId,
        machineId: validatedData.machineId,
        type: validatedData.type,
        reasonCodeId: validatedData.reasonCodeId,
        description: validatedData.description,
        rootCause: validatedData.rootCause,
        startTime: new Date(validatedData.startTime),
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : null,
        durationMinutes,
        affectsLine: validatedData.affectsLine,
        isMicrostop: validatedData.isMicrostop,
        detectedBy: validatedData.detectedBy,
        offlineId: validatedData.offlineId,
        syncedAt: validatedData.offlineId ? new Date() : null,
        reportedById: auth.user.id,
        companyId: auth.companyId,
      },
      include: {
        reasonCode: {
          select: {
            id: true,
            code: true,
            name: true,
            triggersMaintenance: true,
          },
        },
        workCenter: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Registrar evento
    if (validatedData.productionOrderId) {
      await logProductionEvent({
        entityType: 'DOWNTIME',
        entityId: downtime.id,
        eventType: 'DOWNTIME_STARTED',
        newValue: {
          type: validatedData.type,
          description: validatedData.description,
          reasonCodeId: validatedData.reasonCodeId,
        },
        performedById: auth.user.id,
        productionOrderId: validatedData.productionOrderId,
        companyId: auth.companyId,
      });
    }

    return NextResponse.json({
      success: true,
      downtime,
      suggestWorkOrder: downtime.reasonCode?.triggersMaintenance === true,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating downtime:', error);

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
