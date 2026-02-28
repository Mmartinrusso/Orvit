import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, checkPermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';
import { logProductionEvent } from '@/lib/production/event-logger';

export const dynamic = 'force-dynamic';

// Schema de validación para DailyProductionReport
const DailyReportSchema = z.object({
  date: z.string().min(1, 'La fecha es requerida'),
  shiftId: z.number().min(1, 'Seleccione un turno'),
  productionOrderId: z.number().optional().nullable(),
  workCenterId: z.number().optional().nullable(),
  operatorId: z.number().min(1, 'Seleccione un operador'),
  supervisorId: z.number().optional().nullable(),
  teamSize: z.number().optional().nullable(),
  goodQuantity: z.number().min(0, 'La cantidad no puede ser negativa'),
  scrapQuantity: z.number().min(0).default(0),
  reworkQuantity: z.number().min(0).default(0),
  uom: z.string().min(1, 'Seleccione una unidad'),
  variantBreakdown: z.any().optional().nullable(),
  shiftDurationMinutes: z.number().min(1, 'Duración del turno requerida'),
  productiveMinutes: z.number().min(0),
  downtimeMinutes: z.number().min(0).default(0),
  setupMinutes: z.number().min(0).default(0),
  observations: z.string().optional().nullable(),
  issues: z.string().optional().nullable(),
  offlineId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARTES.VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const productionOrderId = searchParams.get('productionOrderId');
    const workCenterId = searchParams.get('workCenterId');
    const shiftId = searchParams.get('shiftId');
    const operatorId = searchParams.get('operatorId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const isConfirmed = searchParams.get('isConfirmed');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const whereClause: any = {
      companyId: user!.companyId,
    };

    // If user does NOT have produccion.partes.view_all, filter to only their own reports
    const canViewAll = await checkPermission(user!.id, user!.companyId, PRODUCCION_PERMISSIONS.PARTES.VIEW_ALL);
    if (!canViewAll) {
      whereClause.operatorId = user!.id;
    }

    if (productionOrderId) {
      whereClause.productionOrderId = parseInt(productionOrderId);
    }

    if (workCenterId) {
      whereClause.workCenterId = parseInt(workCenterId);
    }

    if (shiftId) {
      whereClause.shiftId = parseInt(shiftId);
    }

    // Only allow operatorId filter override if user has view_all permission
    if (operatorId && canViewAll) {
      whereClause.operatorId = parseInt(operatorId);
    }

    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) {
        whereClause.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.date.lte = new Date(dateTo);
      }
    }

    if (isConfirmed !== null && isConfirmed !== undefined) {
      whereClause.isConfirmed = isConfirmed === 'true';
    }

    const [reports, total] = await Promise.all([
      prisma.dailyProductionReport.findMany({
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
          operator: {
            select: {
              id: true,
              name: true,
            },
          },
          supervisor: {
            select: {
              id: true,
              name: true,
            },
          },
          confirmedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.dailyProductionReport.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching daily reports:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARTES.CREATE);
    if (error) return error;

    const body = await request.json();
    const validatedData = DailyReportSchema.parse(body);

    // Si tiene offlineId, verificar si ya existe (idempotencia para sync offline)
    if (validatedData.offlineId) {
      const existingReport = await prisma.dailyProductionReport.findFirst({
        where: {
          companyId: user!.companyId,
          offlineId: validatedData.offlineId,
        },
      });

      if (existingReport) {
        return NextResponse.json({
          success: true,
          report: existingReport,
          message: 'Reporte ya sincronizado',
          alreadyExists: true,
        });
      }
    }

    // Verificar que el turno existe
    const shift = await prisma.workShift.findFirst({
      where: {
        id: validatedData.shiftId,
        companyId: user!.companyId,
      },
    });

    if (!shift) {
      return NextResponse.json(
        { error: 'Turno no encontrado' },
        { status: 400 }
      );
    }

    // Verificar orden de producción si se especifica
    let productionOrder = null;
    if (validatedData.productionOrderId) {
      productionOrder = await prisma.productionOrder.findFirst({
        where: {
          id: validatedData.productionOrderId,
          companyId: user!.companyId,
        },
      });

      if (!productionOrder) {
        return NextResponse.json(
          { error: 'Orden de producción no encontrada' },
          { status: 400 }
        );
      }

      // Verificar que la orden esté en un estado que permita reportes
      if (!['IN_PROGRESS', 'PAUSED'].includes(productionOrder.status)) {
        return NextResponse.json(
          { error: 'Solo se pueden registrar partes para órdenes en progreso o pausadas' },
          { status: 400 }
        );
      }
    }

    // Crear el reporte
    const report = await prisma.dailyProductionReport.create({
      data: {
        date: new Date(validatedData.date),
        shiftId: validatedData.shiftId,
        productionOrderId: validatedData.productionOrderId,
        workCenterId: validatedData.workCenterId,
        operatorId: validatedData.operatorId,
        supervisorId: validatedData.supervisorId,
        teamSize: validatedData.teamSize,
        goodQuantity: validatedData.goodQuantity,
        scrapQuantity: validatedData.scrapQuantity,
        reworkQuantity: validatedData.reworkQuantity,
        uom: validatedData.uom,
        variantBreakdown: validatedData.variantBreakdown,
        shiftDurationMinutes: validatedData.shiftDurationMinutes,
        productiveMinutes: validatedData.productiveMinutes,
        downtimeMinutes: validatedData.downtimeMinutes,
        setupMinutes: validatedData.setupMinutes,
        observations: validatedData.observations,
        issues: validatedData.issues,
        offlineId: validatedData.offlineId,
        syncedAt: validatedData.offlineId ? new Date() : null,
        companyId: user!.companyId,
      },
      include: {
        shift: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        operator: {
          select: {
            id: true,
            name: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
          },
        },
      },
    });

    // Actualizar cantidades en la orden de producción si está asociada
    if (productionOrder) {
      await prisma.productionOrder.update({
        where: { id: productionOrder.id },
        data: {
          producedQuantity: {
            increment: validatedData.goodQuantity,
          },
          scrapQuantity: {
            increment: validatedData.scrapQuantity,
          },
          reworkQuantity: {
            increment: validatedData.reworkQuantity,
          },
        },
      });

      // Registrar evento
      await logProductionEvent({
        entityType: 'DAILY_REPORT',
        entityId: report.id,
        eventType: 'REPORT_CREATED',
        newValue: {
          goodQuantity: validatedData.goodQuantity,
          scrapQuantity: validatedData.scrapQuantity,
          date: validatedData.date,
          shiftId: validatedData.shiftId,
        },
        performedById: user!.id,
        productionOrderId: productionOrder.id,
        companyId: user!.companyId,
      });
    }

    return NextResponse.json({
      success: true,
      report,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating daily report:', error);

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
