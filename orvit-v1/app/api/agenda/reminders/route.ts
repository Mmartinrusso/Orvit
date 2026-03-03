import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CreateReminderSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().max(1000).optional().nullable(),
  remindAt: z.string().datetime(),
  notifyVia: z.array(z.enum(['DISCORD', 'EMAIL', 'WEB_PUSH', 'SSE'])).optional(),
  taskId: z.number().int().positive().optional().nullable(),
  companyId: z.number().int().positive(),
});

// GET /api/agenda/reminders — Obtener recordatorios del usuario
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    if (!companyId) {
      return NextResponse.json({ error: 'CompanyId requerido' }, { status: 400 });
    }

    const taskId = searchParams.get('taskId')
      ? parseInt(searchParams.get('taskId')!)
      : undefined;
    const pending = searchParams.get('pending');

    const where: any = {
      userId: user.id,
      companyId,
    };

    if (taskId) {
      where.taskId = taskId;
    }

    if (pending === 'true') {
      where.isSent = false;
      where.remindAt = { gt: new Date() };
    } else if (pending === 'false') {
      where.isSent = true;
    }

    const reminders = await prisma.agendaReminder.findMany({
      where,
      include: {
        task: { select: { id: true, title: true, status: true } },
      },
      orderBy: { remindAt: 'asc' },
    });

    return NextResponse.json(
      reminders.map((r) => ({
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
        task: r.task,
        userId: r.userId,
        companyId: r.companyId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[API] Error fetching reminders:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/agenda/reminders — Crear recordatorio
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validation = CreateReminderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verificar que la tarea existe (si se vincula)
    if (data.taskId) {
      const task = await prisma.agendaTask.findUnique({
        where: { id: data.taskId },
        select: { id: true },
      });
      if (!task) {
        return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
      }
    }

    const reminder = await prisma.agendaReminder.create({
      data: {
        title: data.title,
        message: data.message || null,
        remindAt: new Date(data.remindAt),
        notifyVia: data.notifyVia || ['DISCORD'],
        taskId: data.taskId || null,
        userId: user.id,
        companyId: data.companyId,
      },
      include: {
        task: { select: { id: true, title: true, status: true } },
      },
    });

    return NextResponse.json(
      {
        id: reminder.id,
        title: reminder.title,
        message: reminder.message,
        remindAt: reminder.remindAt.toISOString(),
        notifyVia: reminder.notifyVia,
        isSent: reminder.isSent,
        sentAt: null,
        isRead: false,
        readAt: null,
        taskId: reminder.taskId,
        task: reminder.task,
        userId: reminder.userId,
        companyId: reminder.companyId,
        createdAt: reminder.createdAt.toISOString(),
        updatedAt: reminder.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error creating reminder:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/agenda/reminders — Eliminar recordatorio (por query param)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reminderId = parseInt(searchParams.get('id') || '0');
    if (!reminderId) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const reminder = await prisma.agendaReminder.findUnique({
      where: { id: reminderId },
      select: { userId: true },
    });

    if (!reminder) {
      return NextResponse.json({ error: 'Recordatorio no encontrado' }, { status: 404 });
    }

    if (reminder.userId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await prisma.agendaReminder.delete({ where: { id: reminderId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting reminder:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
