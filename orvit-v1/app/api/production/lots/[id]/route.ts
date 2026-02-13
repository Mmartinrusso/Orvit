import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';
import { z } from 'zod';
import { logProductionEvent } from '@/lib/production/event-logger';

export const dynamic = 'force-dynamic';

// Schema para bloquear lote
const BlockLotSchema = z.object({
  action: z.literal('block'),
  blockedReason: z.string().min(1, 'El motivo de bloqueo es requerido'),
});

// Schema para liberar lote
const ReleaseLotSchema = z.object({
  action: z.literal('release'),
  notes: z.string().optional(),
});

// Schema para aprobar lote
const ApproveLotSchema = z.object({
  action: z.literal('approve'),
  notes: z.string().optional(),
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

    const lotId = parseInt(params.id);
    if (isNaN(lotId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const lot = await prisma.productionBatchLot.findFirst({
      where: {
        id: lotId,
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
        qualityControls: {
          orderBy: { inspectedAt: 'desc' },
          include: {
            inspectedBy: {
              select: { name: true },
            },
          },
        },
        defects: {
          include: {
            reasonCode: {
              select: {
                code: true,
                name: true,
              },
            },
            reportedBy: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!lot) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lot,
    });
  } catch (error) {
    console.error('Error fetching batch lot:', error);
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

    const lotId = parseInt(params.id);
    if (isNaN(lotId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el lote existe
    const existingLot = await prisma.productionBatchLot.findFirst({
      where: {
        id: lotId,
        companyId: auth.companyId,
      },
    });

    if (!existingLot) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }

    const body = await request.json();

    // Acción de bloquear
    if (body.action === 'block') {
      const { blockedReason } = BlockLotSchema.parse(body);

      if (existingLot.qualityStatus === 'BLOCKED') {
        return NextResponse.json(
          { error: 'El lote ya está bloqueado' },
          { status: 400 }
        );
      }

      const lot = await prisma.productionBatchLot.update({
        where: { id: lotId },
        data: {
          qualityStatus: 'BLOCKED',
          blockedReason,
          blockedAt: new Date(),
          blockedById: auth.user.id,
        },
      });

      // Registrar evento
      await logProductionEvent({
        entityType: 'BATCH_LOT',
        entityId: lotId,
        eventType: 'LOT_BLOCKED',
        newValue: { blockedReason },
        performedById: auth.user.id,
        productionOrderId: existingLot.productionOrderId,
        companyId: auth.companyId,
      });

      return NextResponse.json({
        success: true,
        lot,
        message: 'Lote bloqueado',
      });
    }

    // Acción de liberar
    if (body.action === 'release') {
      const { notes } = ReleaseLotSchema.parse(body);

      if (existingLot.qualityStatus !== 'BLOCKED') {
        return NextResponse.json(
          { error: 'Solo se pueden liberar lotes bloqueados' },
          { status: 400 }
        );
      }

      const lot = await prisma.productionBatchLot.update({
        where: { id: lotId },
        data: {
          qualityStatus: 'APPROVED',
          releasedAt: new Date(),
          releasedById: auth.user.id,
          blockedReason: null,
        },
      });

      // Registrar evento
      await logProductionEvent({
        entityType: 'BATCH_LOT',
        entityId: lotId,
        eventType: 'LOT_RELEASED',
        notes,
        performedById: auth.user.id,
        productionOrderId: existingLot.productionOrderId,
        companyId: auth.companyId,
      });

      return NextResponse.json({
        success: true,
        lot,
        message: 'Lote liberado',
      });
    }

    // Acción de aprobar
    if (body.action === 'approve') {
      const { notes } = ApproveLotSchema.parse(body);

      if (existingLot.qualityStatus === 'BLOCKED') {
        return NextResponse.json(
          { error: 'No se puede aprobar un lote bloqueado. Libérelo primero.' },
          { status: 400 }
        );
      }

      if (existingLot.qualityStatus === 'APPROVED') {
        return NextResponse.json(
          { error: 'El lote ya está aprobado' },
          { status: 400 }
        );
      }

      const lot = await prisma.productionBatchLot.update({
        where: { id: lotId },
        data: {
          qualityStatus: 'APPROVED',
          releasedAt: new Date(),
          releasedById: auth.user.id,
        },
      });

      // Registrar evento
      await logProductionEvent({
        entityType: 'BATCH_LOT',
        entityId: lotId,
        eventType: 'LOT_RELEASED',
        notes,
        performedById: auth.user.id,
        productionOrderId: existingLot.productionOrderId,
        companyId: auth.companyId,
      });

      return NextResponse.json({
        success: true,
        lot,
        message: 'Lote aprobado',
      });
    }

    return NextResponse.json(
      { error: 'Acción no reconocida' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating batch lot:', error);

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
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const lotId = parseInt(params.id);
    if (isNaN(lotId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el lote existe
    const existingLot = await prisma.productionBatchLot.findFirst({
      where: {
        id: lotId,
        companyId: auth.companyId,
      },
      include: {
        _count: {
          select: {
            qualityControls: true,
          },
        },
      },
    });

    if (!existingLot) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }

    // No permitir eliminar lotes aprobados o con controles
    if (existingLot.qualityStatus === 'APPROVED') {
      return NextResponse.json(
        { error: 'No se puede eliminar un lote aprobado' },
        { status: 400 }
      );
    }

    if (existingLot._count.qualityControls > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un lote con controles de calidad' },
        { status: 400 }
      );
    }

    await prisma.productionBatchLot.delete({
      where: { id: lotId },
    });

    return NextResponse.json({
      success: true,
      message: 'Lote eliminado',
    });
  } catch (error) {
    console.error('Error deleting batch lot:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
