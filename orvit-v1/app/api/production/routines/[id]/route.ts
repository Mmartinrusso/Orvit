import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET /api/production/routines/[id] - Get routine by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.VIEW);
    if (error) return error;
    const companyId = user!.companyId;
    const id = parseInt(params.id);

    const routine = await prisma.productionRoutine.findFirst({
      where: { id, companyId },
      include: {
        template: {
          select: { id: true, code: true, name: true, type: true, items: true }
        },
        workCenter: {
          select: { id: true, name: true, code: true }
        },
        shift: {
          select: { id: true, name: true }
        },
        executedBy: {
          select: { id: true, name: true }
        },
      },
    });

    if (!routine) {
      return NextResponse.json(
        { success: false, error: 'Rutina no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, routine });
  } catch (error) {
    console.error('Error fetching routine:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener rutina' },
      { status: 500 }
    );
  }
}

// PUT /api/production/routines/[id] - Update routine
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.EXECUTE);
    if (error) return error;
    const companyId = user!.companyId;
    const id = parseInt(params.id);
    const body = await request.json();

    const existing = await prisma.productionRoutine.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Rutina no encontrada' },
        { status: 404 }
      );
    }

    // Handle special actions
    if (body.action === 'link_workorder') {
      // Create a work order from the routine issue
      const workOrder = await prisma.workOrder.create({
        data: {
          title: `Problema en rutina: ${body.issueDescription || 'Sin descripción'}`,
          description: `Problema detectado durante ejecución de rutina.\nFecha: ${existing.date}\nDescripción: ${body.issueDescription || existing.issueDescription}`,
          priority: body.priority || 'medium',
          status: 'pending',
          companyId,
          createdById: body.userId,
        },
      });

      // Update routine with linked work order
      const routine = await prisma.productionRoutine.update({
        where: { id },
        data: { linkedWorkOrderId: workOrder.id },
        include: {
          template: { select: { id: true, code: true, name: true, type: true } },
        },
      });

      return NextResponse.json({
        success: true,
        routine,
        workOrder,
      });
    }

    // Normal update
    const routine = await prisma.productionRoutine.update({
      where: { id },
      data: {
        responses: body.responses !== undefined ? body.responses : existing.responses,
        hasIssues: body.hasIssues !== undefined ? body.hasIssues : existing.hasIssues,
        issueDescription: body.issueDescription !== undefined ? body.issueDescription : existing.issueDescription,
        linkedDowntimeId: body.linkedDowntimeId !== undefined
          ? (body.linkedDowntimeId ? parseInt(body.linkedDowntimeId) : null)
          : existing.linkedDowntimeId,
        linkedWorkOrderId: body.linkedWorkOrderId !== undefined
          ? (body.linkedWorkOrderId ? parseInt(body.linkedWorkOrderId) : null)
          : existing.linkedWorkOrderId,
      },
      include: {
        template: {
          select: { id: true, code: true, name: true, type: true }
        },
        workCenter: {
          select: { id: true, name: true, code: true }
        },
        shift: {
          select: { id: true, name: true }
        },
        executedBy: {
          select: { id: true, name: true }
        },
      },
    });

    return NextResponse.json({ success: true, routine });
  } catch (error) {
    console.error('Error updating routine:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar rutina' },
      { status: 500 }
    );
  }
}

// DELETE /api/production/routines/[id] - Delete routine execution
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: permError } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.EXECUTE);
    if (permError) return permError;
    const companyId = user!.companyId;
    const id = parseInt(params.id);

    const existing = await prisma.productionRoutine.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Rutina no encontrada' },
        { status: 404 }
      );
    }

    await prisma.productionRoutine.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Ejecución eliminada' });
  } catch (error) {
    console.error('Error deleting routine:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar rutina' },
      { status: 500 }
    );
  }
}
