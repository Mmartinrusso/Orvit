import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateAgendaTaskSchema } from '@/lib/validations/agenda-tasks';
import { getIntParam, getStringParam, getDateParam, getPaginationParams } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/agenda/tasks - Obtener tareas del usuario
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = getIntParam(searchParams, 'companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'CompanyId requerido' }, { status: 400 });
    }

    // Filtros
    const status = getStringParam(searchParams, 'status');
    const priority = getStringParam(searchParams, 'priority');
    const assigneeId = getStringParam(searchParams, 'assigneeId');
    const assigneeType = getStringParam(searchParams, 'assigneeType');
    const startDate = getDateParam(searchParams, 'startDate');
    const endDate = getDateParam(searchParams, 'endDate');
    const search = getStringParam(searchParams, 'search');
    const category = getStringParam(searchParams, 'category');

    // Construir where clause
    const where: any = {
      companyId,
      createdById: user.id, // Solo tareas creadas por el usuario actual
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (priority && priority !== 'all') {
      where.priority = priority;
    }

    if (assigneeId && assigneeType) {
      const parsedAssigneeId = parseInt(assigneeId);
      if (!isNaN(parsedAssigneeId)) {
        if (assigneeType === 'user') {
          where.assignedToUserId = parsedAssigneeId;
        } else if (assigneeType === 'contact') {
          where.assignedToContactId = parsedAssigneeId;
        }
      }
    }

    if (startDate && endDate) {
      where.dueDate = {
        gte: startDate,
        lte: endDate,
      };
    } else if (startDate) {
      where.dueDate = { gte: startDate };
    } else if (endDate) {
      where.dueDate = { lte: endDate };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { assignedToName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    // Pagination
    const { page, pageSize } = getPaginationParams(searchParams, {
      defaultPageSize: 100,
      maxPageSize: 200,
    });

    // Obtener tareas
    const [tasks, totalCount] = await Promise.all([
      prisma.agendaTask.findMany({
        where,
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
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.agendaTask.count({ where }),
    ]);

    // Transformar respuesta
    const transformedTasks = tasks.map((task) => ({
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
    }));

    return NextResponse.json({
      data: transformedTasks,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error('[API] Error fetching agenda tasks:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/agenda/tasks - Crear nueva tarea
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateRequest(CreateAgendaTaskSchema, body);
    if (!validation.success) return validation.response;

    const data = validation.data;

    // Resolver nombre del asignado si no se proporcionó
    let assignedToName = data.assignedToName;
    if (!assignedToName) {
      if (data.assignedToUserId) {
        const assignedUser = await prisma.user.findUnique({
          where: { id: data.assignedToUserId },
          select: { name: true },
        });
        assignedToName = assignedUser?.name || null;
      } else if (data.assignedToContactId) {
        const assignedContact = await prisma.contact.findUnique({
          where: { id: data.assignedToContactId },
          select: { name: true },
        });
        assignedToName = assignedContact?.name || null;
      }
    }

    // Crear tarea con recordatorios en transacción
    const task = await prisma.agendaTask.create({
      data: {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority,
        category: data.category,
        status: 'PENDING',
        source: 'WEB',
        createdById: user.id,
        companyId: data.companyId,
        assignedToUserId: data.assignedToUserId,
        assignedToContactId: data.assignedToContactId,
        assignedToName,
        reminders: data.reminders
          ? {
              create: data.reminders.map((r) => ({
                title: r.title || `Recordatorio: ${data.title}`,
                message: r.message,
                remindAt: new Date(r.remindAt),
                notifyVia: r.notifyVia || ['DISCORD'],
                userId: user.id,
                companyId: data.companyId,
              })),
            }
          : undefined,
      },
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
        reminders: true,
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

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating agenda task:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
