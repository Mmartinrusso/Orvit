import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema de validación para actualizar tarea
const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED']).optional(),
  category: z.string().max(100).optional().nullable(),
  assignedToUserId: z.number().optional().nullable(),
  assignedToContactId: z.number().optional().nullable(),
  assignedToName: z.string().max(200).optional().nullable(),
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
        reminders: {
          orderBy: { remindAt: 'asc' },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Verificar que el usuario sea el creador
    if (task.createdById !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Transformar respuesta
    const response = {
      id: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate?.toISOString() || null,
      priority: task.priority,
      status: task.status,
      category: task.category,
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

    // Verificar que la tarea existe y es del usuario
    const existingTask = await prisma.agendaTask.findUnique({
      where: { id: taskId },
      select: { createdById: true },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    if (existingTask.createdById !== user.id) {
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

    // Preparar datos de actualización
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.assignedToUserId !== undefined) updateData.assignedToUserId = data.assignedToUserId;
    if (data.assignedToContactId !== undefined)
      updateData.assignedToContactId = data.assignedToContactId;
    if (data.assignedToName !== undefined) updateData.assignedToName = data.assignedToName;
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
        reminders: {
          orderBy: { remindAt: 'asc' },
        },
      },
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
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };

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

    // Verificar que la tarea existe y es del usuario
    const existingTask = await prisma.agendaTask.findUnique({
      where: { id: taskId },
      select: { createdById: true },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    if (existingTask.createdById !== user.id) {
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
