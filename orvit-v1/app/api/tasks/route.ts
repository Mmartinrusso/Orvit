import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAndSendInstantNotification } from '@/lib/instant-notifications';
import { Prisma } from '@prisma/client';
import { getStringParam, getPaginationParams } from '@/lib/api-utils';

// Importar utilidades centralizadas
import {
  mapStatusToDb,
  mapStatusToFrontend,
  mapPriorityToDb,
  mapPriorityToFrontend,
  STATUS_MAP,
  PRIORITY_MAP,
  PAGINATION,
} from '@/lib/tasks/constants';
import {
  authenticateAndGetCompany,
  getUserFromToken,
} from '@/lib/tasks/auth-helper';
import {
  validateTaskCreate,
  sanitizeText,
  escapeLikePattern,
  validateId,
} from '@/lib/tasks/validation';
import { taskApiLogger as logger } from '@/lib/tasks/logger';

export const dynamic = 'force-dynamic';

// GET /api/tasks - Obtener tareas con paginación y filtros seguros
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAndGetCompany(request);

    if (auth.error && auth.status === 401) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!auth.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logger.debug('Usuario autenticado', { name: auth.user.name, role: auth.user.role });

    // SUPERADMIN no tiene tareas específicas
    if (auth.user.role === 'SUPERADMIN') {
      return NextResponse.json({ data: [], pagination: null });
    }

    // ADMIN sin empresa
    if (!auth.companyId && auth.user.role === 'ADMIN') {
      return NextResponse.json({ data: [], pagination: null });
    }

    if (!auth.companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 403 });
    }

    // Obtener parámetros de filtro y paginación
    const { searchParams } = new URL(request.url);
    const status = getStringParam(searchParams, 'status');
    const priority = getStringParam(searchParams, 'priority');
    const assignedTo = getStringParam(searchParams, 'assignedTo');
    const dateRange = getStringParam(searchParams, 'dateRange');
    const search = getStringParam(searchParams, 'search');
    const { page, pageSize } = getPaginationParams(searchParams, {
      defaultPageSize: PAGINATION.DEFAULT_PAGE_SIZE,
      maxPageSize: PAGINATION.MAX_PAGE_SIZE,
    });

    logger.debug('Filtros recibidos', { status, priority, assignedTo, dateRange, search, page, pageSize });

    // Construir condiciones WHERE de forma segura usando Prisma
    const whereConditions: Prisma.TaskWhereInput = {
      companyId: auth.companyId,
    };

    // Filtro de status (seguro)
    if (status && status !== 'all') {
      const dbStatus = STATUS_MAP[status as keyof typeof STATUS_MAP];
      if (dbStatus) {
        whereConditions.status = dbStatus as any;
      }
    }

    // Filtro de prioridad (seguro)
    if (priority && priority !== 'all') {
      const dbPriority = PRIORITY_MAP[priority as keyof typeof PRIORITY_MAP];
      if (dbPriority) {
        whereConditions.priority = dbPriority as any;
      }
    }

    // Filtro de usuario asignado (seguro - validamos que sea número)
    if (assignedTo && assignedTo !== 'all') {
      const assignedToId = validateId(assignedTo);
      if (assignedToId) {
        whereConditions.assignedToId = assignedToId;
      }
    }

    // Filtro de búsqueda (seguro - escapamos caracteres especiales)
    if (search && search.trim()) {
      const sanitizedSearch = escapeLikePattern(sanitizeText(search.trim()));
      whereConditions.OR = [
        { title: { contains: sanitizedSearch, mode: 'insensitive' } },
        { description: { contains: sanitizedSearch, mode: 'insensitive' } },
      ];
    }

    // Filtros de fecha (seguros)
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (dateRange) {
        case 'yesterday': {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          whereConditions.dueDate = {
            gte: yesterday,
            lt: today,
          };
          break;
        }
        case 'today': {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          whereConditions.dueDate = {
            gte: today,
            lt: tomorrow,
          };
          break;
        }
        case 'week': {
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 7);
          whereConditions.dueDate = {
            gte: weekStart,
            lt: weekEnd,
          };
          break;
        }
        case 'month': {
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          whereConditions.dueDate = {
            gte: monthStart,
            lt: nextMonthStart,
          };
          break;
        }
        case 'overdue': {
          whereConditions.dueDate = { lt: today };
          whereConditions.status = { not: 'DONE' as any };
          break;
        }
      }
    }

    // Contar total de registros para paginación
    const total = await prisma.task.count({ where: whereConditions });

    // Obtener tareas con paginación usando Prisma ORM (seguro)
    const tasks = await prisma.task.findMany({
      where: whereConditions,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        subtasks: {
          select: { id: true, title: true, completed: true }
        },
        attachments: {
          select: { id: true, name: true, url: true, size: true, type: true },
          orderBy: { uploadedAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    logger.debug('Tareas encontradas', { count: tasks.length, total });

    // Transformar tareas al formato frontend
    const transformedTasks = tasks.map((task) => ({
      id: task.id.toString(),
      title: task.title,
      description: task.description,
      status: mapStatusToFrontend(task.status),
      priority: mapPriorityToFrontend(task.priority),
      dueDate: task.dueDate?.toISOString(),
      assignedTo: task.assignedTo,
      createdBy: task.createdBy,
      tags: (task.tags as string[]) || [],
      progress: task.progress || 0,
      subtasks: task.subtasks.map((st) => ({
        id: st.id.toString(),
        title: st.title,
        completed: st.completed,
      })),
      files: task.attachments.map((f) => ({
        id: f.id.toString(),
        name: f.name,
        url: f.url,
        size: f.size,
        type: f.type,
      })),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));

    // Respuesta con paginación
    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      data: transformedTasks,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    });

  } catch (error) {
    logger.error('Error obteniendo tareas:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Crear nueva tarea
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // SUPERADMIN no puede crear tareas
    if (user.role === 'SUPERADMIN') {
      return NextResponse.json({
        error: "SUPERADMIN no puede crear tareas específicas de empresa"
      }, { status: 403 });
    }

    // Obtener empresa del usuario
    let companyId: number;
    if (user.ownedCompanies && user.ownedCompanies.length > 0) {
      companyId = user.ownedCompanies[0].id;
    } else if (user.companies && user.companies.length > 0) {
      companyId = user.companies[0].company.id;
    } else {
      if (user.role === 'ADMIN') {
        return NextResponse.json({
          error: "Los administradores deben estar asociados a una empresa para crear tareas"
        }, { status: 403 });
      }
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 403 });
    }

    const data = await request.json();

    // Validar datos de entrada
    const validation = validateTaskCreate(data);
    if (!validation.isValid) {
      return NextResponse.json({
        error: validation.errors[0].message,
        errors: validation.errors
      }, { status: 400 });
    }

    // Sanitizar título y descripción
    const sanitizedTitle = sanitizeText(data.title.trim());
    const sanitizedDescription = data.description ? sanitizeText(data.description.trim()) : null;

    // Validar usuario asignado
    const assignedToId = validateId(data.assignedToId);
    if (!assignedToId) {
      return NextResponse.json({ error: "ID de usuario asignado inválido" }, { status: 400 });
    }

    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedToId }
    });

    if (!assignedUser) {
      return NextResponse.json({ error: "Usuario asignado no válido" }, { status: 400 });
    }

    // Mapear prioridad y status
    const dbPriority = mapPriorityToDb(data.priority || 'media');
    const dbStatus = mapStatusToDb(data.status || 'pendiente');

    // Crear tarea usando Prisma ORM (seguro)
    const newTask = await prisma.task.create({
      data: {
        title: sanitizedTitle,
        description: sanitizedDescription,
        status: dbStatus as any,
        priority: dbPriority as any,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        assignedToId: assignedToId,
        createdById: user.id,
        companyId: companyId,
        tags: data.tags || [],
        progress: data.progress || 0
      }
    });

    // Crear subtareas si existen
    if (data.subtasks && Array.isArray(data.subtasks) && data.subtasks.length > 0) {
      await prisma.subtask.createMany({
        data: data.subtasks.map((subtask: { title: string; completed?: boolean }) => ({
          title: sanitizeText(subtask.title),
          completed: subtask.completed || false,
          taskId: newTask.id,
        }))
      });
    }

    // Crear attachments si existen
    if (data.attachments && Array.isArray(data.attachments) && data.attachments.length > 0) {
      await (prisma as any).taskAttachment.createMany({
        data: data.attachments.map((att: { name: string; url: string; size?: number; type?: string }) => ({
          name: att.name,
          url: att.url,
          size: att.size || null,
          type: att.type || null,
          taskId: newTask.id,
          uploadedById: user.id,
        }))
      });
    }

    // Notificación de asignación (si no es auto-asignación)
    if (newTask.assignedToId && newTask.assignedToId !== user.id) {
      await createAndSendInstantNotification(
        'TASK_ASSIGNED',
        newTask.assignedToId,
        companyId,
        newTask.id,
        null,
        'Nueva tarea asignada',
        `Se te ha asignado la tarea: ${newTask.title}`,
        dbPriority === 'URGENT' ? 'urgent' : dbPriority === 'HIGH' ? 'high' : 'medium',
        {
          createdBy: user.name,
          createdById: user.id,
          priority: dbPriority,
          dueDate: data.dueDate,
          taskTitle: newTask.title
        }
      );
    }

    logger.info('Tarea creada exitosamente', { taskId: newTask.id });

    // Formatear respuesta
    const transformedTask = {
      id: newTask.id.toString(),
      title: newTask.title,
      description: newTask.description,
      status: mapStatusToFrontend(newTask.status),
      priority: mapPriorityToFrontend(newTask.priority),
      dueDate: newTask.dueDate?.toISOString(),
      assignedTo: {
        id: assignedUser.id,
        name: assignedUser.name,
        email: assignedUser.email
      },
      createdBy: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      tags: (newTask.tags as string[]) || [],
      progress: newTask.progress || 0,
      subtasks: [],
      files: [],
      createdAt: newTask.createdAt.toISOString(),
      updatedAt: newTask.updatedAt.toISOString(),
    };

    return NextResponse.json(transformedTask, { status: 201 });

  } catch (error) {
    logger.error('Error creando tarea:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
