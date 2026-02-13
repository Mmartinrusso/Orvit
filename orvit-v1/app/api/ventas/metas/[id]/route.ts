import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { prisma } from '@/lib/prisma';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * GET - Get goal details with progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.VENTAS_VIEW);
    if (error) return error;

    const viewMode = getViewMode(request);

    const goal = await prisma.salesGoal.findFirst({
      where: applyViewMode({ id: params.id }, viewMode, user!.companyId),
      include: {
        vendedor: {
          select: { id: true, name: true, email: true },
        },
        creator: {
          select: { id: true, name: true },
        },
        progress: {
          orderBy: { fecha: 'desc' },
        },
      },
    });

    if (!goal) {
      return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 });
    }

    // Calculate current progress
    const latestProgress = goal.progress[0];
    const cumplimientoActual = latestProgress?.porcentajeCumplimiento || 0;
    const valorAlcanzado = latestProgress?.valorAlcanzado || 0;

    return NextResponse.json({
      ...goal,
      cumplimientoActual,
      valorAlcanzado,
      diasRestantes: Math.ceil(
        (new Date(goal.fechaFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    });
  } catch (error) {
    console.error('Error fetching goal:', error);
    return NextResponse.json({ error: 'Error al obtener meta' }, { status: 500 });
  }
}

/**
 * PUT - Update goal or add progress
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.VENTAS_CONFIG);
    if (error) return error;

    const body = await request.json();
    const { action, ...data } = body;

    const viewMode = getViewMode(request);

    const goal = await prisma.salesGoal.findFirst({
      where: applyViewMode({ id: params.id }, viewMode, user!.companyId),
    });

    if (!goal) {
      return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 });
    }

    if (action === 'add_progress') {
      // Add progress entry
      const { fecha, valorAlcanzado, cantidadVentas, montoVentas, clientesNuevos, margenPromedio } = data;

      const porcentajeCumplimiento = (Number(valorAlcanzado) / Number(goal.metaValor)) * 100;

      const progress = await prisma.salesGoalProgress.create({
        data: {
          goalId: params.id,
          fecha: new Date(fecha || new Date()),
          valorAlcanzado,
          porcentajeCumplimiento,
          cantidadVentas,
          montoVentas,
          clientesNuevos,
          margenPromedio,
        },
      });

      return NextResponse.json(progress, { status: 201 });
    }

    if (action === 'close') {
      const updatedGoal = await prisma.salesGoal.update({
        where: { id: params.id },
        data: { isClosed: true },
      });
      return NextResponse.json(updatedGoal);
    }

    if (action === 'activate') {
      const updatedGoal = await prisma.salesGoal.update({
        where: { id: params.id },
        data: { isActive: true },
      });
      return NextResponse.json(updatedGoal);
    }

    if (action === 'deactivate') {
      const updatedGoal = await prisma.salesGoal.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      return NextResponse.json(updatedGoal);
    }

    // Update general fields
    const updatedGoal = await prisma.salesGoal.update({
      where: { id: params.id },
      data: {
        ...data,
        fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : undefined,
        fechaFin: data.fechaFin ? new Date(data.fechaFin) : undefined,
      },
    });

    return NextResponse.json(updatedGoal);
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json({ error: 'Error al actualizar meta' }, { status: 500 });
  }
}

/**
 * DELETE - Delete goal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.VENTAS_CONFIG);
    if (error) return error;

    const viewMode = getViewMode(request);

    const goal = await prisma.salesGoal.findFirst({
      where: applyViewMode({ id: params.id }, viewMode, user!.companyId),
    });

    if (!goal) {
      return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 });
    }

    await prisma.salesGoal.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json({ error: 'Error al eliminar meta' }, { status: 500 });
  }
}
