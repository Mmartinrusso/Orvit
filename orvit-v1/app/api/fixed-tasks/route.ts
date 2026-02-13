import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';

// Importar utilidades centralizadas
import {
  mapFrequencyToDb,
  mapFrequencyToFrontend,
  mapPriorityToDb,
  mapPriorityToFrontend,
  FREQUENCY_MAP,
} from '@/lib/tasks/constants';
import {
  getUserFromToken,
} from '@/lib/tasks/auth-helper';
import {
  validateFixedTaskCreate,
  sanitizeText,
  validateId,
} from '@/lib/tasks/validation';
import { fixedTaskLogger as logger } from '@/lib/tasks/logger';

export const dynamic = 'force-dynamic';

// GET /api/fixed-tasks - Obtener todas las tareas fijas de la empresa
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyIdParam = searchParams.get('companyId');

    if (!companyIdParam) {
      return NextResponse.json({ error: 'CompanyId requerido' }, { status: 400 });
    }

    const companyId = validateId(companyIdParam);
    if (!companyId) {
      return NextResponse.json({ error: 'CompanyId inválido' }, { status: 400 });
    }

    logger.debug('Buscando tareas fijas para empresa', { companyId });

    // Verificar que la empresa existe
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }

    // Obtener tareas fijas usando Prisma ORM (más seguro)
    const fixedTasks = await (prisma as any).fixedTask.findMany({
      where: { companyId },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        assignedWorker: {
          select: { id: true, name: true, specialty: true }
        },
        createdBy: {
          select: { id: true, name: true }
        },
        instructives: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transformar tareas al formato frontend
    const transformedTasks = fixedTasks.map((task: any) => ({
      id: task.id.toString(),
      title: task.title,
      description: task.description || '',
      frequency: mapFrequencyToFrontend(task.frequency),
      assignedTo: {
        id: (task.assignedToId || task.assignedWorkerId)?.toString() || '',
        name: task.assignedTo?.name || task.assignedWorker?.name || 'Sin asignar'
      },
      department: task.department || 'General',
      instructives: task.instructives.map((inst: any) => ({
        id: inst.id.toString(),
        title: inst.title,
        content: inst.content,
        attachments: inst.attachments || []
      })),
      estimatedTime: task.estimatedTime || 30,
      priority: mapPriorityToFrontend(task.priority),
      isActive: task.isActive,
      lastExecuted: task.lastExecuted?.toISOString() || null,
      nextExecution: task.nextExecution?.toISOString() || null,
      createdAt: task.createdAt?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
      isCompleted: task.isCompleted
    }));

    logger.debug('Tareas fijas encontradas', { count: transformedTasks.length });

    return NextResponse.json({
      success: true,
      tasks: transformedTasks,
      count: transformedTasks.length
    });

  } catch (error) {
    logger.error('Error en GET /api/fixed-tasks', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/fixed-tasks - Crear nueva tarea fija
export async function POST(request: NextRequest) {
  try {
    // Autenticación estricta - NO hay fallback
    const currentUser = await getUserFromToken(request);

    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar permisos
    if (!hasPermission('fixed_tasks.create', { userId: currentUser.id, userRole: currentUser.role })) {
      return NextResponse.json({ error: 'No tienes permiso para crear tareas fijas' }, { status: 403 });
    }

    const body = await request.json();
    logger.debug('Datos recibidos para crear tarea fija', { title: body.title });

    const {
      title,
      description,
      frequency,
      assignedTo,
      department,
      instructives,
      estimatedTime,
      priority,
      isActive,
      nextExecution,
      companyId
    } = body;

    // Validaciones
    const validation = validateFixedTaskCreate({
      title,
      frequency,
      nextExecution,
      companyId,
      description,
      priority,
      estimatedTime
    });

    if (!validation.isValid) {
      return NextResponse.json({
        error: validation.errors[0].message,
        errors: validation.errors
      }, { status: 400 });
    }

    // Mapear frecuencia y prioridad
    const dbFrequency = mapFrequencyToDb(frequency);
    const dbPriority = mapPriorityToDb(priority || 'media');

    // Validar frecuencia
    if (!FREQUENCY_MAP[frequency as keyof typeof FREQUENCY_MAP]) {
      return NextResponse.json({ error: 'Frecuencia inválida' }, { status: 400 });
    }

    // Procesar usuario asignado
    let assignedToId: number | null = null;
    let assignedWorkerId: number | null = null;

    if (assignedTo?.id) {
      let userId = assignedTo.id;
      let userType = 'USER';

      if (typeof assignedTo.id === 'string' && assignedTo.id.includes('-')) {
        const parts = assignedTo.id.split('-');
        userType = parts[0];
        userId = parts[1];
      }

      const parsedId = validateId(userId);
      if (!parsedId) {
        return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
      }

      if (userType === 'USER') {
        const user = await prisma.user.findUnique({ where: { id: parsedId } });
        if (user) {
          assignedToId = user.id;
        }
      } else if (userType === 'WORKER') {
        const worker = await prisma.worker.findUnique({ where: { id: parsedId } });
        if (worker) {
          assignedWorkerId = worker.id;
        }
      }
    }

    // Validar companyId
    const parsedCompanyId = validateId(companyId);
    if (!parsedCompanyId) {
      return NextResponse.json({ error: 'CompanyId inválido' }, { status: 400 });
    }

    // Validar fecha de próxima ejecución
    const nextExecDate = new Date(nextExecution);
    if (isNaN(nextExecDate.getTime())) {
      return NextResponse.json({ error: 'Fecha de próxima ejecución inválida' }, { status: 400 });
    }

    // Sanitizar datos de entrada
    const sanitizedTitle = sanitizeText(title.trim());
    const sanitizedDescription = description ? sanitizeText(description.trim()) : null;
    const sanitizedDepartment = department ? sanitizeText(department.trim()) : 'General';

    // Crear tarea fija usando Prisma ORM (seguro)
    const newTask = await (prisma as any).fixedTask.create({
      data: {
        title: sanitizedTitle,
        description: sanitizedDescription,
        frequency: dbFrequency,
        priority: dbPriority,
        estimatedTime: estimatedTime || 30,
        isActive: isActive !== undefined ? isActive : true,
        assignedToId,
        assignedWorkerId,
        createdById: currentUser.id,
        companyId: parsedCompanyId,
        department: sanitizedDepartment,
        nextExecution: nextExecDate,
        isCompleted: false
      }
    });

    logger.info('Tarea fija creada', { taskId: newTask.id });

    // Crear instructivos si existen
    if (instructives && Array.isArray(instructives) && instructives.length > 0) {
      logger.debug('Creando instructivos', { count: instructives.length });

      for (let i = 0; i < instructives.length; i++) {
        const inst = instructives[i];
        await (prisma as any).fixedTaskInstructive.create({
          data: {
            title: sanitizeText(inst.title || ''),
            content: sanitizeText(inst.content || ''),
            attachments: inst.attachments || [],
            fixedTaskId: newTask.id,
            order: i
          }
        });
      }
    }

    // Obtener nombre del usuario/worker asignado
    let assignedName = 'Sin asignar';
    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({ where: { id: assignedToId } });
      assignedName = assignedUser?.name || 'Usuario no encontrado';
    } else if (assignedWorkerId) {
      const assignedWorker = await prisma.worker.findUnique({ where: { id: assignedWorkerId } });
      assignedName = assignedWorker?.name || 'Worker no encontrado';
    }

    // Obtener instructivos creados
    const taskInstructives = await (prisma as any).fixedTaskInstructive.findMany({
      where: { fixedTaskId: newTask.id },
      orderBy: { order: 'asc' }
    });

    // Transformar para el frontend
    const transformedTask = {
      id: newTask.id.toString(),
      title: newTask.title,
      description: newTask.description || '',
      frequency: mapFrequencyToFrontend(newTask.frequency),
      assignedTo: {
        id: (assignedToId || assignedWorkerId)?.toString() || '',
        name: assignedName
      },
      department: newTask.department || 'General',
      instructives: taskInstructives.map((inst: any) => ({
        id: inst.id.toString(),
        title: inst.title,
        content: inst.content,
        attachments: inst.attachments || []
      })),
      estimatedTime: newTask.estimatedTime || 30,
      priority: mapPriorityToFrontend(newTask.priority),
      isActive: newTask.isActive,
      nextExecution: newTask.nextExecution?.toISOString() || null,
      createdAt: newTask.createdAt?.toISOString() || null,
      isCompleted: newTask.isCompleted
    };

    return NextResponse.json({
      success: true,
      task: transformedTask
    }, { status: 201 });

  } catch (error) {
    logger.error('Error en POST /api/fixed-tasks', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
