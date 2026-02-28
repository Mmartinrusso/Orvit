import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateAgendaTaskSchema } from '@/lib/validations/agenda-tasks';

export const dynamic = 'force-dynamic';

// GET /api/agenda/tasks - Obtener tareas del usuario
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

    // Filtros
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assigneeId = searchParams.get('assigneeId');
    const assigneeType = searchParams.get('assigneeType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const groupId = searchParams.get('groupId');

    // Acceso: el usuario ve sus tareas personales + todas las tareas de empresa (grupo o visibles)
    const accessFilter = {
      OR: [
        { createdById: user.id },
        { assignedToUserId: user.id },
        { isCompanyVisible: true },
        { groupId: { not: null } },
      ],
    };

    // Filtros adicionales acumulados en AND
    const andFilters: any[] = [accessFilter];

    if (status && status !== 'all') {
      andFilters.push({ status });
    }

    if (priority && priority !== 'all') {
      andFilters.push({ priority });
    }

    if (assigneeId && assigneeType) {
      if (assigneeType === 'user') {
        andFilters.push({ assignedToUserId: parseInt(assigneeId) });
      } else if (assigneeType === 'contact') {
        andFilters.push({ assignedToContactId: parseInt(assigneeId) });
      }
    }

    if (startDate && endDate) {
      andFilters.push({ dueDate: { gte: new Date(startDate), lte: new Date(endDate) } });
    } else if (startDate) {
      andFilters.push({ dueDate: { gte: new Date(startDate) } });
    } else if (endDate) {
      andFilters.push({ dueDate: { lte: new Date(endDate) } });
    }

    if (search) {
      andFilters.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { assignedToName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (category) {
      andFilters.push({ category });
    }

    if (groupId) {
      andFilters.push({ groupId: groupId === 'null' ? null : parseInt(groupId) });
    }

    const where: any = {
      companyId,
      AND: andFilters,
    };

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || '100')), 200);

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
          group: {
            select: { id: true, name: true, color: true, icon: true },
          },
          reminders: {
            orderBy: { remindAt: 'asc' },
          },
          _count: {
            select: { comments: true },
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
      isCompanyVisible: (task as any).isCompanyVisible ?? false,
      externalNotified: (task as any).externalNotified ?? false,
      externalNotifiedAt: (task as any).externalNotifiedAt?.toISOString() || null,
      _count: { comments: (task as any)._count?.comments ?? 0 },
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
    const user = await getUserFromToken();
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
        groupId: data.groupId || null,
        status: 'PENDING',
        source: 'WEB',
        createdById: user.id,
        companyId: data.companyId,
        assignedToUserId: data.assignedToUserId,
        assignedToContactId: data.assignedToContactId,
        assignedToName,
        isCompanyVisible: data.isCompanyVisible ?? false,
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
        group: {
          select: { id: true, name: true, color: true, icon: true },
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
      isCompanyVisible: (task as any).isCompanyVisible ?? false,
      externalNotified: (task as any).externalNotified ?? false,
      externalNotifiedAt: (task as any).externalNotifiedAt?.toISOString() || null,
      _count: { comments: 0 },
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating agenda task:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
