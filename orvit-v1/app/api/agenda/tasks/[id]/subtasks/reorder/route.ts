import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { ReorderAgendaSubtasksSchema } from '@/lib/validations/agenda-tasks';
import { validateRequest } from '@/lib/validations/helpers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/agenda/tasks/[id]/subtasks/reorder — Reordenar subtareas
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar acceso a la tarea
    const task = await prisma.agendaTask.findUnique({
      where: { id: taskId },
      select: {
        companyId: true,
        createdById: true,
        assignedToUserId: true,
        isCompanyVisible: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const userCompanyIds = [
      ...(user.ownedCompanies ?? []).map((c: any) => c.id),
      ...(user.companies ?? []).map((c: any) => c.companyId),
    ];
    const canAccess =
      task.createdById === user.id ||
      task.assignedToUserId === user.id ||
      task.isCompanyVisible ||
      userCompanyIds.includes(task.companyId);

    if (!canAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const validation = validateRequest(ReorderAgendaSubtasksSchema, body);
    if (!validation.success) return validation.response;

    const { order } = validation.data;

    // Actualizar sortOrder en transacción
    const operations = order.map((subtaskId, index) =>
      prisma.agendaSubtask.updateMany({
        where: { id: subtaskId, taskId },
        data: { sortOrder: index },
      })
    );

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error reordering subtasks:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
