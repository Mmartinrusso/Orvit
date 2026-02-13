import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';
import { z } from 'zod';
import { logProductionEvent } from '@/lib/production/event-logger';

export const dynamic = 'force-dynamic';

// Schema de validación para actualización
const DailyReportUpdateSchema = z.object({
  goodQuantity: z.number().min(0).optional(),
  scrapQuantity: z.number().min(0).optional(),
  reworkQuantity: z.number().min(0).optional(),
  productiveMinutes: z.number().min(0).optional(),
  downtimeMinutes: z.number().min(0).optional(),
  setupMinutes: z.number().min(0).optional(),
  observations: z.string().optional().nullable(),
  issues: z.string().optional().nullable(),
  teamSize: z.number().optional().nullable(),
});

// Schema para confirmar reporte
const ConfirmReportSchema = z.object({
  action: z.literal('confirm'),
  reviewNotes: z.string().optional(),
});

// Schema para revisar reporte (segundo nivel)
const ReviewReportSchema = z.object({
  action: z.literal('review'),
  reviewNotes: z.string().optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const reportId = parseInt(params.id);
    if (isNaN(reportId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const report = await prisma.dailyProductionReport.findFirst({
      where: {
        id: reportId,
        companyId: auth.companyId,
      },
      include: {
        productionOrder: {
          select: {
            id: true,
            code: true,
            status: true,
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
            startTime: true,
            endTime: true,
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
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
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
        reviewedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        downtimes: {
          include: {
            reasonCode: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
          orderBy: { startTime: 'asc' },
        },
        qualityControls: {
          orderBy: { inspectedAt: 'desc' },
          take: 10,
        },
        defects: {
          include: {
            reasonCode: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error fetching daily report:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId || !auth.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const reportId = parseInt(params.id);
    if (isNaN(reportId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el reporte existe
    const existingReport = await prisma.dailyProductionReport.findFirst({
      where: {
        id: reportId,
        companyId: auth.companyId,
      },
      include: {
        productionOrder: true,
      },
    });

    if (!existingReport) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    const body = await request.json();

    // Detectar si es una acción de confirmar
    if (body.action === 'confirm') {
      const { reviewNotes } = ConfirmReportSchema.parse(body);

      if (existingReport.isConfirmed) {
        return NextResponse.json(
          { error: 'El reporte ya está confirmado' },
          { status: 400 }
        );
      }

      const report = await prisma.dailyProductionReport.update({
        where: { id: reportId },
        data: {
          isConfirmed: true,
          confirmedAt: new Date(),
          confirmedById: auth.user.id,
        },
        include: {
          shift: { select: { name: true } },
          operator: { select: { name: true } },
        },
      });

      // Registrar evento
      if (existingReport.productionOrderId) {
        await logProductionEvent({
          entityType: 'DAILY_REPORT',
          entityId: report.id,
          eventType: 'REPORT_CONFIRMED',
          notes: reviewNotes,
          performedById: auth.user.id,
          productionOrderId: existingReport.productionOrderId,
          companyId: auth.companyId,
        });
      }

      return NextResponse.json({
        success: true,
        report,
        message: 'Reporte confirmado',
      });
    }

    // Detectar si es una acción de revisar
    if (body.action === 'review') {
      const { reviewNotes } = ReviewReportSchema.parse(body);

      if (!existingReport.isConfirmed) {
        return NextResponse.json(
          { error: 'El reporte debe estar confirmado antes de ser revisado' },
          { status: 400 }
        );
      }

      if (existingReport.isReviewed) {
        return NextResponse.json(
          { error: 'El reporte ya está revisado' },
          { status: 400 }
        );
      }

      const report = await prisma.dailyProductionReport.update({
        where: { id: reportId },
        data: {
          isReviewed: true,
          reviewedAt: new Date(),
          reviewedById: auth.user.id,
          reviewNotes,
        },
      });

      // Registrar evento
      if (existingReport.productionOrderId) {
        await logProductionEvent({
          entityType: 'DAILY_REPORT',
          entityId: report.id,
          eventType: 'REPORT_REVIEWED',
          notes: reviewNotes,
          performedById: auth.user.id,
          productionOrderId: existingReport.productionOrderId,
          companyId: auth.companyId,
        });
      }

      return NextResponse.json({
        success: true,
        report,
        message: 'Reporte revisado',
      });
    }

    // Actualización normal - solo permitida si no está confirmado
    if (existingReport.isConfirmed) {
      return NextResponse.json(
        { error: 'No se puede editar un reporte confirmado' },
        { status: 400 }
      );
    }

    const validatedData = DailyReportUpdateSchema.parse(body);

    // Guardar valores anteriores para actualizar la OP
    const previousGoodQuantity = Number(existingReport.goodQuantity);
    const previousScrapQuantity = Number(existingReport.scrapQuantity);
    const previousReworkQuantity = Number(existingReport.reworkQuantity);

    const report = await prisma.dailyProductionReport.update({
      where: { id: reportId },
      data: validatedData,
      include: {
        shift: { select: { name: true } },
        operator: { select: { name: true } },
      },
    });

    // Actualizar cantidades en la orden de producción si cambió
    if (existingReport.productionOrderId && validatedData.goodQuantity !== undefined) {
      const goodDiff = (validatedData.goodQuantity || 0) - previousGoodQuantity;
      const scrapDiff = (validatedData.scrapQuantity || 0) - previousScrapQuantity;
      const reworkDiff = (validatedData.reworkQuantity || 0) - previousReworkQuantity;

      if (goodDiff !== 0 || scrapDiff !== 0 || reworkDiff !== 0) {
        await prisma.productionOrder.update({
          where: { id: existingReport.productionOrderId },
          data: {
            producedQuantity: { increment: goodDiff },
            scrapQuantity: { increment: scrapDiff },
            reworkQuantity: { increment: reworkDiff },
          },
        });
      }

      // Registrar evento
      await logProductionEvent({
        entityType: 'DAILY_REPORT',
        entityId: report.id,
        eventType: 'REPORT_UPDATED',
        previousValue: {
          goodQuantity: previousGoodQuantity,
          scrapQuantity: previousScrapQuantity,
        },
        newValue: validatedData,
        performedById: auth.user.id,
        productionOrderId: existingReport.productionOrderId,
        companyId: auth.companyId,
      });
    }

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error updating daily report:', error);

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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId || !auth.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const reportId = parseInt(params.id);
    if (isNaN(reportId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el reporte existe
    const existingReport = await prisma.dailyProductionReport.findFirst({
      where: {
        id: reportId,
        companyId: auth.companyId,
      },
    });

    if (!existingReport) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    // No permitir eliminar reportes confirmados
    if (existingReport.isConfirmed) {
      return NextResponse.json(
        { error: 'No se puede eliminar un reporte confirmado' },
        { status: 400 }
      );
    }

    // Revertir cantidades en la orden de producción
    if (existingReport.productionOrderId) {
      await prisma.productionOrder.update({
        where: { id: existingReport.productionOrderId },
        data: {
          producedQuantity: {
            decrement: Number(existingReport.goodQuantity),
          },
          scrapQuantity: {
            decrement: Number(existingReport.scrapQuantity),
          },
          reworkQuantity: {
            decrement: Number(existingReport.reworkQuantity),
          },
        },
      });
    }

    // Eliminar paradas asociadas primero
    await prisma.productionDowntime.deleteMany({
      where: { dailyReportId: reportId },
    });

    // Eliminar controles de calidad asociados
    await prisma.productionQualityControl.deleteMany({
      where: { dailyReportId: reportId },
    });

    // Eliminar defectos asociados
    await prisma.productionDefect.deleteMany({
      where: { dailyReportId: reportId },
    });

    // Eliminar el reporte
    await prisma.dailyProductionReport.delete({
      where: { id: reportId },
    });

    return NextResponse.json({
      success: true,
      message: 'Reporte eliminado',
    });
  } catch (error) {
    console.error('Error deleting daily report:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
