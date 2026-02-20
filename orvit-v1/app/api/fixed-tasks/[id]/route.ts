import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import {
  mapFrequencyToDb,
  mapFrequencyToFrontend,
  mapPriorityToDb,
  mapPriorityToFrontend,
  FREQUENCY_MAP,
  REVERSE_FREQUENCY_MAP,
  REVERSE_PRIORITY_MAP,
} from '@/lib/tasks/constants';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { sanitizeText, validateId } from '@/lib/tasks/validation';

export const dynamic = 'force-dynamic';

// PUT /api/fixed-tasks/[id] - Actualizar tarea fija
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Autenticación y permisos PRIMERO
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (!hasPermission('fixed_tasks.edit', { userId: user.id, userRole: user.role })) {
      return NextResponse.json({ error: 'No tienes permiso para editar tareas fijas' }, { status: 403 });
    }

    const taskId = parseInt(params.id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID de tarea inválido' }, { status: 400 });
    }

    const body = await request.json();
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
      executionTime,
      isCompleted,
      completedAt,
    } = body;

    // Validar y mapear frecuencia
    const dbFrequency = mapFrequencyToDb(frequency);
    if (!dbFrequency) {
      return NextResponse.json({ error: 'Frecuencia inválida' }, { status: 400 });
    }

    // Validar y mapear prioridad
    const dbPriority = priority ? mapPriorityToDb(priority) : 'MEDIUM';
    if (priority && !dbPriority) {
      return NextResponse.json({ error: 'Prioridad inválida' }, { status: 400 });
    }

    // Resolver assignedTo (usuario o worker)
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

      const parsedId = parseInt(userId);
      if (isNaN(parsedId)) {
        return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
      }

      if (userType === 'USER') {
        const userCheck = await prisma.user.findUnique({ where: { id: parsedId } });
        if (userCheck) assignedToId = userCheck.id;
      } else if (userType === 'WORKER') {
        const worker = await prisma.worker.findUnique({ where: { id: parsedId } });
        if (worker) assignedWorkerId = worker.id;
      }
    }

    const nextExecDate = nextExecution ? new Date(nextExecution) : null;

    // 2. Operación atómica: UPDATE + DELETE instructivos + INSERT instructivos
    await prisma.$transaction(async (tx) => {
      await (tx as any).fixedTask.update({
        where: { id: taskId },
        data: {
          title: sanitizeText(title?.trim() || ''),
          description: description ? sanitizeText(description.trim()) : null,
          frequency: dbFrequency,
          priority: dbPriority,
          estimatedTime: estimatedTime || 30,
          isActive: isActive !== undefined ? isActive : true,
          assignedToId,
          assignedWorkerId,
          department: department ? sanitizeText(department.trim()) : 'General',
          nextExecution: nextExecDate,
          executionTime: executionTime || null,
          isCompleted: isCompleted || false,
          completedAt: completedAt ? new Date(completedAt) : null,
          updatedAt: new Date(),
        },
      });

      // Reemplazar instructivos atómicamente
      await (tx as any).fixedTaskInstructive.deleteMany({ where: { fixedTaskId: taskId } });

      if (instructives && Array.isArray(instructives) && instructives.length > 0) {
        await (tx as any).fixedTaskInstructive.createMany({
          data: instructives.map((inst: any, i: number) => ({
            title: sanitizeText(inst.title || ''),
            content: sanitizeText(inst.content || ''),
            attachments: inst.attachments || [],
            fixedTaskId: taskId,
            order: i,
          })),
        });
      }
    });

    // 3. Obtener la tarea actualizada con ORM
    const updatedTask = await (prisma as any).fixedTask.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedWorker: { select: { id: true, name: true, specialty: true } },
        instructives: { orderBy: { order: 'asc' } },
      },
    });

    if (!updatedTask) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const transformedTask = {
      id: updatedTask.id.toString(),
      title: updatedTask.title,
      description: updatedTask.description || '',
      frequency: mapFrequencyToFrontend(updatedTask.frequency),
      assignedTo: {
        id: (updatedTask.assignedToId || updatedTask.assignedWorkerId)?.toString() || '',
        name: updatedTask.assignedTo?.name || updatedTask.assignedWorker?.name || 'Sin asignar',
      },
      department: updatedTask.department || 'General',
      instructives: updatedTask.instructives.map((inst: any) => ({
        id: inst.id.toString(),
        title: inst.title,
        content: inst.content,
        attachments: inst.attachments || [],
      })),
      estimatedTime: updatedTask.estimatedTime || 30,
      priority: mapPriorityToFrontend(updatedTask.priority),
      isActive: updatedTask.isActive,
      executionTime: updatedTask.executionTime || '08:00',
      lastExecuted: updatedTask.lastExecuted?.toISOString() || null,
      nextExecution: updatedTask.nextExecution?.toISOString() || null,
      createdAt: updatedTask.createdAt?.toISOString() || null,
      completedAt: updatedTask.completedAt?.toISOString() || null,
      isCompleted: updatedTask.isCompleted,
    };

    return NextResponse.json({ success: true, task: transformedTask });
  } catch (error) {
    console.error('[API] Error en PUT /api/fixed-tasks/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/fixed-tasks/[id] - Eliminar tarea fija
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth y permisos PRIMERO
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (!hasPermission('fixed_tasks.delete', { userId: user.id, userRole: user.role })) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar tareas fijas' }, { status: 403 });
    }

    const taskId = parseInt(params.id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID de tarea inválido' }, { status: 400 });
    }

    // Verificar que la tarea existe
    const taskExists = await (prisma as any).fixedTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });

    if (!taskExists) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Eliminar en transacción: instructivos + notificaciones + tarea
    await prisma.$transaction(async (tx) => {
      await (tx as any).fixedTaskInstructive.deleteMany({ where: { fixedTaskId: taskId } });

      // Limpiar notificaciones relacionadas (best-effort)
      try {
        await tx.$executeRaw`
          DELETE FROM "Notification"
          WHERE "metadata"->>'taskId' = ${taskId.toString()}
            OR ("type" = 'TASK_AUTO_RESET' AND "metadata"->>'fixedTaskId' = ${taskId.toString()})
        `;
      } catch {
        // No bloquear la eliminación si falla la limpieza de notificaciones
      }

      await (tx as any).fixedTask.delete({ where: { id: taskId } });
    });

    return NextResponse.json({ success: true, message: 'Tarea eliminada exitosamente' });
  } catch (error) {
    console.error('[API] Error en DELETE /api/fixed-tasks/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
