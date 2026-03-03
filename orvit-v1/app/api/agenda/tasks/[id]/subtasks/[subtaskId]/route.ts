import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { UpdateAgendaSubtaskSchema } from '@/lib/validations/agenda-tasks';
import { validateRequest } from '@/lib/validations/helpers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string; subtaskId: string }>;
}

/** Verifica acceso del usuario a la tarea padre de la subtarea. */
async function verifySubtaskAccess(taskId: number, subtaskId: number, user: any) {
  const subtask = await prisma.agendaSubtask.findUnique({
    where: { id: subtaskId },
    select: { id: true, taskId: true },
  });

  if (!subtask || subtask.taskId !== taskId) return null;

  const task = await prisma.agendaTask.findUnique({
    where: { id: taskId },
    select: {
      companyId: true,
      createdById: true,
      assignedToUserId: true,
      isCompanyVisible: true,
    },
  });

  if (!task) return null;

  const userCompanyIds = [
    ...(user.ownedCompanies ?? []).map((c: any) => c.id),
    ...(user.companies ?? []).map((c: any) => c.companyId),
  ];
  const canAccess =
    task.createdById === user.id ||
    task.assignedToUserId === user.id ||
    task.isCompanyVisible ||
    userCompanyIds.includes(task.companyId);

  return canAccess ? subtask : null;
}

// PUT /api/agenda/tasks/[id]/subtasks/[subtaskId] — Actualizar subtarea
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, subtaskId: subtaskIdStr } = await params;
    const taskId = parseInt(id);
    const subtaskId = parseInt(subtaskIdStr);
    if (isNaN(taskId) || isNaN(subtaskId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const subtask = await verifySubtaskAccess(taskId, subtaskId, user);
    if (!subtask) {
      return NextResponse.json({ error: 'Subtarea no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const validation = validateRequest(UpdateAgendaSubtaskSchema, body);
    if (!validation.success) return validation.response;

    const data = validation.data;

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.done !== undefined) updateData.done = data.done;
    if (data.note !== undefined) updateData.note = data.note;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;

    const updated = await prisma.agendaSubtask.update({
      where: { id: subtaskId },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      done: updated.done,
      note: updated.note,
      sortOrder: updated.sortOrder,
      taskId: updated.taskId,
      assigneeId: updated.assigneeId,
      assignee: updated.assignee,
      companyId: updated.companyId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[API] Error updating subtask:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/agenda/tasks/[id]/subtasks/[subtaskId] — Eliminar subtarea
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, subtaskId: subtaskIdStr } = await params;
    const taskId = parseInt(id);
    const subtaskId = parseInt(subtaskIdStr);
    if (isNaN(taskId) || isNaN(subtaskId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const subtask = await verifySubtaskAccess(taskId, subtaskId, user);
    if (!subtask) {
      return NextResponse.json({ error: 'Subtarea no encontrada' }, { status: 404 });
    }

    await prisma.agendaSubtask.delete({ where: { id: subtaskId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting subtask:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
