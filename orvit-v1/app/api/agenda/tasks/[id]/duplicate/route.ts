import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { hasPermission } from '@/lib/permissions';
import { triggerCompanyEvent } from '@/lib/chat/pusher';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/agenda/tasks/[id]/duplicate — Duplicar tarea
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!hasPermission('tasks.create', { userId: user.id, userRole: user.role })) {
      return NextResponse.json({ error: 'No tienes permiso para crear tareas' }, { status: 403 });
    }

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Obtener tarea original con subtareas
    const original = await prisma.agendaTask.findUnique({
      where: { id: taskId },
      include: {
        subtasks: { orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { id: true, name: true, avatar: true } },
        assignedToUser: { select: { id: true, name: true, avatar: true } },
        assignedToContact: { select: { id: true, name: true, avatar: true } },
        group: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    if (!original) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Verificar acceso
    if (original.createdById !== user.id && original.assignedToUserId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Crear copia
    const duplicate = await prisma.agendaTask.create({
      data: {
        title: `${original.title} (copia)`,
        description: original.description,
        dueDate: original.dueDate,
        priority: original.priority,
        category: original.category,
        groupId: (original as any).groupId || null,
        status: 'PENDING',
        source: 'WEB',
        createdById: user.id,
        companyId: original.companyId,
        assignedToUserId: original.assignedToUserId,
        assignedToContactId: original.assignedToContactId,
        assignedToName: original.assignedToName,
        isCompanyVisible: (original as any).isCompanyVisible ?? false,
        notes: original.notes as any,
        // Duplicar subtareas
        subtasks: original.subtasks.length > 0
          ? {
              create: original.subtasks.map((st) => ({
                title: st.title,
                done: false,
                note: st.note,
                sortOrder: st.sortOrder,
                assigneeId: st.assigneeId,
                companyId: st.companyId,
              })),
            }
          : undefined,
      },
      include: {
        createdBy: { select: { id: true, name: true, avatar: true } },
        assignedToUser: { select: { id: true, name: true, avatar: true } },
        assignedToContact: { select: { id: true, name: true, avatar: true } },
        group: { select: { id: true, name: true, color: true, icon: true } },
        reminders: { orderBy: { remindAt: 'asc' } },
        _count: { select: { comments: true, subtasks: true } },
      },
    });

    const response = {
      id: duplicate.id,
      title: duplicate.title,
      description: duplicate.description,
      dueDate: duplicate.dueDate?.toISOString() || null,
      priority: duplicate.priority,
      status: duplicate.status,
      category: duplicate.category,
      groupId: (duplicate as any).groupId || null,
      group: (duplicate as any).group || null,
      createdById: duplicate.createdById,
      createdBy: duplicate.createdBy,
      assignedToUserId: duplicate.assignedToUserId,
      assignedToUser: duplicate.assignedToUser,
      assignedToContactId: duplicate.assignedToContactId,
      assignedToContact: duplicate.assignedToContact,
      assignedToName: duplicate.assignedToName,
      source: duplicate.source,
      discordMessageId: duplicate.discordMessageId,
      companyId: duplicate.companyId,
      isCompanyVisible: (duplicate as any).isCompanyVisible ?? false,
      externalNotified: false,
      externalNotifiedAt: null,
      reminders: [],
      notes: duplicate.notes,
      completedAt: null,
      completedNote: duplicate.completedNote,
      _count: {
        comments: 0,
        subtasks: (duplicate as any)._count?.subtasks ?? 0,
        subtasksDone: 0,
      },
      createdAt: duplicate.createdAt.toISOString(),
      updatedAt: duplicate.updatedAt.toISOString(),
    };

    // Pusher realtime trigger
    triggerCompanyEvent(duplicate.companyId, "tasks", "task:created", { id: duplicate.id });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[API] Error duplicating task:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
