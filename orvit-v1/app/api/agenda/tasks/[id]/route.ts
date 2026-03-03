import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { hasPermission } from '@/lib/permissions';
import { z } from 'zod';
import { logTaskUpdateActivity } from '@/lib/agenda/activity-logger';

export const dynamic = 'force-dynamic';

// Schema de validación para actualizar tarea
const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  dueDate: z.preprocess(
    (val) => {
      if (!val || typeof val !== 'string') return val;
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return `${val}T00:00:00.000Z`;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val)) return `${val}.000Z`;
      return val;
    },
    z.string().datetime().optional().nullable()
  ),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED']).optional(),
  category: z.string().max(100).optional().nullable(),
  groupId: z.number().int().positive().optional().nullable(),
  assignedToUserId: z.number().optional().nullable(),
  assignedToContactId: z.number().optional().nullable(),
  assignedToName: z.string().max(200).optional().nullable(),
  isCompanyVisible: z.boolean().optional(),
  completedNote: z.string().max(1000).optional(),
  notes: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        createdAt: z.string(),
        createdBy: z.string().optional(),
      })
    )
    .optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agenda/tasks/[id] - Obtener tarea por ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);

    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const task = await prisma.agendaTask.findUnique({
      where: { id: taskId },
      include: {
        createdBy: {
          select: { id: true, name: true, avatar: true },
        },
        assignedToUser: {
          select: { id: true, name: true, avatar: true },
        },
        assignedToContact: {
          select: { id: true, name: true, avatar: true },
        },
        group: {
          select: { id: true, name: true, color: true, icon: true },
        },
        reminders: {
          orderBy: { remindAt: 'asc' },
        },
        _count: {
          select: { comments: true, subtasks: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Verificar que el usuario tenga acceso (creador, asignado, o tarea de empresa)
    const userCompanyIds = [
      ...(user.ownedCompanies ?? []).map((c: any) => c.id),
      ...(user.companies ?? []).map((c: any) => c.companyId),
    ];
    const canAccess =
      task.createdById === user.id ||
      task.assignedToUserId === user.id ||
      (task as any).isCompanyVisible ||
      userCompanyIds.includes(task.companyId);
    if (!canAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const subtasksDone = await prisma.agendaSubtask.count({
      where: { taskId: task.id, done: true },
    });

    // Transformar respuesta
    const response = {
      id: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate?.toISOString() || null,
      priority: task.priority,
      status: task.status,
      category: task.category,
      groupId: (task as any).groupId || null,
      group: (task as any).group || null,
      createdById: task.createdById,
      createdBy: task.createdBy,
      assignedToUserId: task.assignedToUserId,
      assignedToUser: task.assignedToUser,
      assignedToContactId: task.assignedToContactId,
      assignedToContact: task.assignedToContact,
      assignedToName: task.assignedToName,
      source: task.source,
      discordMessageId: task.discordMessageId,
      companyId: task.companyId,
      isCompanyVisible: (task as any).isCompanyVisible ?? false,
      externalNotified: (task as any).externalNotified ?? false,
      externalNotifiedAt: (task as any).externalNotifiedAt?.toISOString() || null,
      reminders: task.reminders.map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        remindAt: r.remindAt.toISOString(),
        notifyVia: r.notifyVia,
        isSent: r.isSent,
        sentAt: r.sentAt?.toISOString() || null,
        isRead: r.isRead,
        readAt: r.readAt?.toISOString() || null,
        taskId: r.taskId,
        userId: r.userId,
        companyId: r.companyId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      notes: task.notes,
      completedAt: task.completedAt?.toISOString() || null,
      completedNote: task.completedNote,
      _count: {
        comments: (task as any)._count?.comments ?? 0,
        subtasks: (task as any)._count?.subtasks ?? 0,
        subtasksDone,
      },
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Error fetching agenda task:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT /api/agenda/tasks/[id] - Actualizar tarea
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);

    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar permiso de rol
    if (!hasPermission('tasks.edit', { userId: user.id, userRole: user.role })) {
      return NextResponse.json({ error: 'No tienes permiso para editar tareas' }, { status: 403 });
    }

    // Verificar que la tarea existe y determinar rol del usuario
    const existingTask = await prisma.agendaTask.findUnique({
      where: { id: taskId },
      select: {
        createdById: true,
        assignedToUserId: true,
        companyId: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const isCreator = existingTask.createdById === user.id;
    const isAssignee = existingTask.assignedToUserId === user.id;

    if (!isCreator && !isAssignee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const validation = updateTaskSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Asignado solo puede cambiar status y completedNote
    if (!isCreator) {
      const ASSIGNEE_ALLOWED = new Set(['status', 'completedNote']);
      const forbidden = Object.keys(data).filter(f => !ASSIGNEE_ALLOWED.has(f));
      if (forbidden.length > 0) {
        return NextResponse.json(
          { error: `No autorizado para modificar: ${forbidden.join(', ')}` },
          { status: 403 }
        );
      }
    }

    // Preparar datos de actualización
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.groupId !== undefined) updateData.groupId = data.groupId;
    if (data.assignedToUserId !== undefined) updateData.assignedToUserId = data.assignedToUserId;
    if (data.assignedToContactId !== undefined)
      updateData.assignedToContactId = data.assignedToContactId;
    if (data.assignedToName !== undefined) updateData.assignedToName = data.assignedToName;
    if (data.isCompanyVisible !== undefined) updateData.isCompanyVisible = data.isCompanyVisible;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.completedNote !== undefined) updateData.completedNote = data.completedNote;

    // Si se está completando la tarea
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      } else if (data.status === 'PENDING' || data.status === 'IN_PROGRESS') {
        // Si se reabre, limpiar completedAt
        updateData.completedAt = null;
      }
    }

    // Resolver nombre del asignado si cambió
    if (
      (data.assignedToUserId !== undefined || data.assignedToContactId !== undefined) &&
      !data.assignedToName
    ) {
      if (data.assignedToUserId) {
        const assignedUser = await prisma.user.findUnique({
          where: { id: data.assignedToUserId },
          select: { name: true },
        });
        updateData.assignedToName = assignedUser?.name || null;
      } else if (data.assignedToContactId) {
        const assignedContact = await prisma.contact.findUnique({
          where: { id: data.assignedToContactId },
          select: { name: true },
        });
        updateData.assignedToName = assignedContact?.name || null;
      } else {
        updateData.assignedToName = null;
      }
    }

    // Actualizar tarea
    const task = await prisma.agendaTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, avatar: true },
        },
        assignedToUser: {
          select: { id: true, name: true, avatar: true },
        },
        assignedToContact: {
          select: { id: true, name: true, avatar: true },
        },
        group: {
          select: { id: true, name: true, color: true, icon: true },
        },
        reminders: {
          orderBy: { remindAt: 'asc' },
        },
        _count: {
          select: { comments: true, subtasks: true },
        },
      },
    });

    const subtasksDone = await prisma.agendaSubtask.count({
      where: { taskId, done: true },
    });

    // Transformar respuesta
    const response = {
      id: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate?.toISOString() || null,
      priority: task.priority,
      status: task.status,
      category: task.category,
      groupId: (task as any).groupId || null,
      group: (task as any).group || null,
      createdById: task.createdById,
      createdBy: task.createdBy,
      assignedToUserId: task.assignedToUserId,
      assignedToUser: task.assignedToUser,
      assignedToContactId: task.assignedToContactId,
      assignedToContact: task.assignedToContact,
      assignedToName: task.assignedToName,
      source: task.source,
      discordMessageId: task.discordMessageId,
      companyId: task.companyId,
      isCompanyVisible: (task as any).isCompanyVisible ?? false,
      externalNotified: (task as any).externalNotified ?? false,
      externalNotifiedAt: (task as any).externalNotifiedAt?.toISOString() || null,
      reminders: task.reminders.map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        remindAt: r.remindAt.toISOString(),
        notifyVia: r.notifyVia,
        isSent: r.isSent,
        sentAt: r.sentAt?.toISOString() || null,
        isRead: r.isRead,
        readAt: r.readAt?.toISOString() || null,
        taskId: r.taskId,
        userId: r.userId,
        companyId: r.companyId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      notes: task.notes,
      completedAt: task.completedAt?.toISOString() || null,
      completedNote: task.completedNote,
      _count: {
        comments: (task as any)._count?.comments ?? 0,
        subtasks: (task as any)._count?.subtasks ?? 0,
        subtasksDone,
      },
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };

    // Registrar actividad de cambios
    const changes: Record<string, { old: any; new: any }> = {};
    if (data.status && data.status !== existingTask.status) {
      changes.status = { old: existingTask.status, new: data.status };
    }
    if (data.assignedToUserId !== undefined && data.assignedToUserId !== existingTask.assignedToUserId) {
      changes.assignedToUserId = { old: existingTask.assignedToUserId, new: data.assignedToUserId };
    }
    if (data.priority && data.priority !== existingTask.priority) {
      changes.priority = { old: existingTask.priority, new: data.priority };
    }
    if (data.dueDate !== undefined) {
      const oldDate = existingTask.dueDate?.toISOString() || null;
      if (data.dueDate !== oldDate) {
        changes.dueDate = { old: oldDate, new: data.dueDate };
      }
    }
    if (data.title && data.title !== existingTask.title) {
      changes.title = { old: existingTask.title, new: data.title };
    }
    if (Object.keys(changes).length > 0) {
      logTaskUpdateActivity(taskId, existingTask.companyId, user.id, changes);
    }

    // Notificaciones según cambios
    try {
      const notifications: any[] = [];

      // Notificar reasignación
      if (
        data.assignedToUserId !== undefined &&
        data.assignedToUserId !== existingTask.assignedToUserId &&
        data.assignedToUserId &&
        data.assignedToUserId !== user.id
      ) {
        notifications.push({
          type: 'task_assigned',
          title: 'Te asignaron una tarea',
          message: `${user.name || 'Alguien'} te asignó la tarea "${task.title}"`,
          userId: data.assignedToUserId,
          companyId: task.companyId,
          priority: task.priority as any,
          metadata: { taskId: task.id, assignedBy: user.id, taskTitle: task.title },
        });
      }

      // Notificar cambio de status al creador (si el asignado cambia el status)
      if (data.status && !isCreator && existingTask.createdById !== user.id) {
        notifications.push({
          type: 'task_updated',
          title: `Tarea ${data.status === 'COMPLETED' ? 'completada' : 'actualizada'}`,
          message: `${user.name || 'Alguien'} cambió el estado de "${task.title}" a ${data.status}`,
          userId: existingTask.createdById,
          companyId: task.companyId,
          priority: task.priority as any,
          metadata: { taskId: task.id, updatedBy: user.id, taskTitle: task.title, newStatus: data.status },
        });
      }

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
    } catch (notifErr) {
      console.error('[API] Error creating update notifications:', notifErr);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Error updating agenda task:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/agenda/tasks/[id] - Eliminar tarea
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);

    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar permiso de rol
    if (!hasPermission('tasks.delete', { userId: user.id, userRole: user.role })) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar tareas' }, { status: 403 });
    }

    // Verificar que la tarea existe y que el usuario tiene acceso
    const existingTask = await prisma.agendaTask.findUnique({
      where: { id: taskId },
      select: { createdById: true, assignedToUserId: true, companyId: true },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const userCompanyIds = [
      ...(user.ownedCompanies ?? []).map((c: any) => c.id),
      ...(user.companies ?? []).map((c: any) => c.companyId),
    ];
    const canDelete =
      existingTask.createdById === user.id ||
      existingTask.assignedToUserId === user.id ||
      userCompanyIds.includes(existingTask.companyId);

    if (!canDelete) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Eliminar tarea (los recordatorios se eliminan en cascada)
    await prisma.agendaTask.delete({
      where: { id: taskId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting agenda task:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
