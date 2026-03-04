import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { CreateAgendaSubtaskSchema } from '@/lib/validations/agenda-tasks';
import { validateRequest } from '@/lib/validations/helpers';
import { triggerCompanyEvent } from '@/lib/chat/pusher';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Verifica acceso del usuario a la tarea. Retorna el task o null. */
async function verifyTaskAccess(taskId: number, user: any) {
  const task = await prisma.agendaTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
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

  return canAccess ? task : null;
}

// GET /api/agenda/tasks/[id]/subtasks — Listar subtareas
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const task = await verifyTaskAccess(taskId, user);
    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const subtasks = await prisma.agendaSubtask.findMany({
      where: { taskId },
      include: {
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(
      subtasks.map((s) => ({
        id: s.id,
        title: s.title,
        done: s.done,
        note: s.note,
        sortOrder: s.sortOrder,
        taskId: s.taskId,
        assigneeId: s.assigneeId,
        assignee: s.assignee,
        companyId: s.companyId,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[API] Error fetching subtasks:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/agenda/tasks/[id]/subtasks — Crear subtarea
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const task = await verifyTaskAccess(taskId, user);
    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const validation = validateRequest(CreateAgendaSubtaskSchema, body);
    if (!validation.success) return validation.response;

    const data = validation.data;

    // Calcular sortOrder (siguiente después del máximo actual)
    const maxOrder = await prisma.agendaSubtask.aggregate({
      where: { taskId },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const subtask = await prisma.agendaSubtask.create({
      data: {
        title: data.title,
        done: data.done ?? false,
        note: data.note ?? null,
        assigneeId: data.assigneeId ?? null,
        sortOrder: nextOrder,
        taskId,
        companyId: task.companyId,
      },
      include: {
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Pusher realtime trigger (subtask change = task updated)
    triggerCompanyEvent(task.companyId, "tasks", "task:updated", { id: taskId });

    return NextResponse.json(
      {
        id: subtask.id,
        title: subtask.title,
        done: subtask.done,
        note: subtask.note,
        sortOrder: subtask.sortOrder,
        taskId: subtask.taskId,
        assigneeId: subtask.assigneeId,
        assignee: subtask.assignee,
        companyId: subtask.companyId,
        createdAt: subtask.createdAt.toISOString(),
        updatedAt: subtask.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error creating subtask:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
