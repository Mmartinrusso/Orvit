import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { deleteS3File } from '@/lib/s3-utils';
import { cookies } from 'next/headers';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';

// Importar utilidades centralizadas
import {
  mapStatusToDb,
  mapStatusToFrontend,
  mapPriorityToDb,
  mapPriorityToFrontend,
} from '@/lib/tasks/constants';
import {
  getUserFromToken,
  getUserCompanyId,
} from '@/lib/tasks/auth-helper';
import {
  validateTaskUpdate,
  sanitizeText,
  validateId,
} from '@/lib/tasks/validation';
import { taskApiLogger as logger } from '@/lib/tasks/logger';

// Los helpers getUserFromToken y getUserCompanyId ahora se importan de @/lib/tasks/auth-helper

// GET /api/tasks/[id] - Obtener tarea específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const taskId = validateId(params.id);
    if (!taskId) {
      return NextResponse.json({ error: "ID de tarea inválido" }, { status: 400 });
    }

    // Obtener la tarea con todos sus detalles
    const task = await (prisma.task as any).findUnique({
      where: { id: taskId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        attachments: {
          orderBy: { uploadedAt: 'asc' }
        },
        subtasks: {
          orderBy: { createdAt: 'asc' }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Verificar que el usuario tenga acceso a la tarea (misma empresa)
    const userCompanyIds = [
      ...(user.ownedCompanies?.map(c => c.id) || []),
      ...(user.companies?.map(c => c.company.id) || [])
    ];

    if (!userCompanyIds.includes(task.companyId)) {
      return NextResponse.json({ 
        error: "No tienes acceso a esta tarea" 
      }, { status: 403 });
    }

    // Formatear respuesta
    const formattedTask = {
      id: task.id.toString(),
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString(),
      assignedTo: task.assignedTo,
      createdBy: task.createdBy,
      tags: task.tags as string[] || [],
      progress: task.progress || 0,
      subtasks: task.subtasks.map((st: any) => ({
        id: st.id.toString(),
        title: st.title,
        completed: st.completed,
      })),
      files: task.attachments.map((att: any) => ({
        id: att.id.toString(),
        name: att.name,
        url: att.url,
        size: att.size,
        type: att.type,
      })),
      comments: task.comments.map((comment: any) => ({
        id: comment.id.toString(),
        content: comment.content,
        userId: comment.user.id.toString(),
        userName: comment.user.name,
        userEmail: comment.user.email,
        createdAt: comment.createdAt.toISOString()
      })),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };

    return NextResponse.json(formattedTask);

  } catch (error) {
    console.error('❌ Error getting task:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[id] - Actualizar una tarea
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    logger.debug('PUT /api/tasks/[id] - Iniciando actualización');

    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logger.debug('Usuario autenticado', { name: user.name, id: user.id });

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 401 });
    }

    const taskId = validateId(params.id);
    if (!taskId) {
      return NextResponse.json({ error: "ID de tarea inválido" }, { status: 400 });
    }

    const data = await request.json();

    // Validar datos de actualización
    const validation = validateTaskUpdate(data);
    if (!validation.isValid) {
      return NextResponse.json({
        error: validation.errors[0].message,
        errors: validation.errors
      }, { status: 400 });
    }

    logger.debug('Datos recibidos para actualización', { taskId, title: data.title });

    // Verificar que la tarea existe y pertenece a la empresa usando Prisma ORM (seguro)
    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        companyId: companyId
      }
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const oldTask = existingTask;
    logger.debug('Tarea existente encontrada', { id: oldTask.id, title: oldTask.title });

    // Preparar el assignedToId correctamente
    let assignedToId: number | null;
    if (data.assignedToId !== undefined) {
      assignedToId = data.assignedToId ? validateId(data.assignedToId) : null;
    } else {
      assignedToId = oldTask.assignedToId;
    }

    // Sanitizar y preparar datos para actualización
    const updateData = {
      title: data.title ? sanitizeText(data.title.trim()) : oldTask.title,
      description: data.description !== undefined
        ? (data.description ? sanitizeText(data.description.trim()) : null)
        : oldTask.description,
      status: data.status ? mapStatusToDb(data.status) as any : oldTask.status,
      priority: data.priority ? mapPriorityToDb(data.priority) as any : oldTask.priority,
      dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : oldTask.dueDate,
      assignedToId: assignedToId,
      tags: data.tags ? data.tags : (oldTask.tags as string[] || []),
      progress: data.progress !== undefined ? data.progress : oldTask.progress,
      updatedAt: new Date()
    };

    logger.debug('Datos preparados para actualización', { title: updateData.title, status: updateData.status });

    // Actualizar la tarea usando Prisma ORM (seguro)
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData
    });

    logger.info('Tarea actualizada exitosamente', { id: updatedTask.id });

    // Actualizar subtareas si se enviaron en el body
    if (data.subtasks && Array.isArray(data.subtasks)) {
      for (const subtask of data.subtasks) {
        const subtaskId = validateId(subtask.id);
        if (subtaskId) {
          await prisma.subtask.update({
            where: { id: subtaskId },
            data: {
              completed: subtask.completed === true || subtask.completed === 'true' || subtask.done === true,
              updatedAt: new Date()
            }
          });
        } else if (subtask.title) {
          // Si no tiene ID válido, es una nueva subtarea
          await prisma.subtask.create({
            data: {
              taskId: taskId,
              title: sanitizeText(subtask.title),
              completed: subtask.completed === true || subtask.completed === 'true' || subtask.done === true
            }
          });
        }
      }
    }

    // Si se completó la tarea, crear notificación instantánea al creador
    if (data.status === 'realizada' && oldTask.status !== 'DONE') {
      await createAndSendInstantNotification(
        'TASK_COMPLETED',
        oldTask.createdById,
        companyId,
        taskId,
        null, // no es reminder
        'Tarea completada',
        `La tarea "${updatedTask.title}" ha sido completada`,
        'medium',
        {
          completedBy: user.name,
          completedById: user.id,
          completedAt: new Date().toISOString(),
          taskTitle: updatedTask.title
        }
      );
    }

    // Si se reasignó la tarea, crear notificación instantánea al nuevo asignado
    if (assignedToId && assignedToId !== oldTask.assignedToId && assignedToId !== user.id) {
      await createAndSendInstantNotification(
        'TASK_ASSIGNED',
        assignedToId,
        companyId,
        taskId,
        null, // no es reminder
        'Tarea reasignada',
        `Se te ha asignado la tarea: ${updatedTask.title}`,
        'medium',
        {
          reassignedBy: user.name,
          reassignedById: user.id,
          previousAssignee: oldTask.assignedToId,
          taskTitle: updatedTask.title
        }
      );
    }

    // Si hubo cambios significativos, notificar a los involucrados
    const hasSignificantChanges = 
      data.title !== oldTask.title ||
      data.description !== oldTask.description ||
      data.priority !== oldTask.priority ||
      data.dueDate !== oldTask.dueDate;

    if (hasSignificantChanges) {
      // Notificar instantáneamente al asignado (si no es quien hizo el cambio)
      if (oldTask.assignedToId && oldTask.assignedToId !== user.id) {
        await createAndSendInstantNotification(
          'TASK_UPDATED',
          oldTask.assignedToId,
          companyId,
          taskId,
          null, // no es reminder
          'Tarea actualizada',
          `La tarea "${updatedTask.title}" ha sido modificada`,
          'medium',
          {
            updatedBy: user.name,
            updatedById: user.id,
            taskTitle: updatedTask.title,
            changes: {
              title: data.title !== oldTask.title,
              description: data.description !== oldTask.description,
              priority: data.priority !== oldTask.priority,
              dueDate: data.dueDate !== oldTask.dueDate
            }
          }
        );
      }

      // Notificar instantáneamente al creador (si no es quien hizo el cambio y no es el asignado)
      if (oldTask.createdById && oldTask.createdById !== user.id && oldTask.createdById !== oldTask.assignedToId) {
        await createAndSendInstantNotification(
          'TASK_UPDATED',
          oldTask.createdById,
          companyId,
          taskId,
          null, // no es reminder
          'Tarea actualizada',
          `La tarea "${updatedTask.title}" que creaste ha sido modificada`,
          'medium',
          {
            updatedBy: user.name,
            updatedById: user.id,
            taskTitle: updatedTask.title,
            changes: {
              title: data.title !== oldTask.title,
              description: data.description !== oldTask.description,
              priority: data.priority !== oldTask.priority,
              dueDate: data.dueDate !== oldTask.dueDate
            }
          }
        );
      }
    }

    // Obtener datos completos actualizados
    const assignedUserData = await prisma.$queryRaw`
      SELECT id, name, email FROM "User" WHERE id = ${updatedTask.assignedToId}
    ` as any[];

    // Eliminar esta consulta ya que requestedById no existe en el modelo Task
    // const requestedUserData = await prisma.$queryRaw`
    //   SELECT id, name, email FROM "User" WHERE id = ${updatedTask.requestedById}
    // ` as any[];

    const subtasks = await prisma.$queryRaw`
      SELECT id, title, completed 
      FROM "Subtask" 
      WHERE "taskId" = ${taskId}
    ` as any[];

    const files = await prisma.$queryRaw`
      SELECT id, name, url, size 
      FROM "TaskAttachment" 
      WHERE "taskId" = ${taskId}
    ` as any[];

    // Transformar tarea para respuesta usando funciones centralizadas
    const transformedTask = {
      id: updatedTask.id.toString(),
      title: updatedTask.title,
      description: updatedTask.description,
      status: mapStatusToFrontend(updatedTask.status),
      priority: mapPriorityToFrontend(updatedTask.priority),
      dueDate: updatedTask.dueDate?.toISOString(),
      assignedTo: assignedUserData[0],
      tags: Array.isArray(updatedTask.tags) ? updatedTask.tags : JSON.parse(updatedTask.tags as string || '[]'),
      progress: updatedTask.progress,
      subtasks: subtasks.map((st: any) => ({
        id: st.id.toString(),
        title: st.title,
        completed: st.completed,
      })),
      files: files.map((f: any) => ({
        id: f.id.toString(),
        name: f.name,
        url: f.url,
        size: f.size,
      })),
      createdAt: updatedTask.createdAt.toISOString(),
      updatedAt: updatedTask.updatedAt.toISOString(),
    };

    return NextResponse.json(transformedTask);
  } catch (error) {
    logger.error('Error updating task', error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Eliminar tarea
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const taskId = validateId(params.id);
    if (!taskId) {
      return NextResponse.json({ error: "ID de tarea inválido" }, { status: 400 });
    }

    logger.debug('DELETE /api/tasks/[id]', { taskId });

    // Verificar que la tarea existe y obtener información
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        createdBy: true,
        assignedTo: true,
        company: true
      }
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Verificar permisos: solo el creador puede eliminar la tarea
    if (task.createdById !== user.id) {
      return NextResponse.json({ 
        error: "No tienes permisos para eliminar esta tarea" 
      }, { status: 403 });
    }

    // **GUARDAR EN HISTORIAL ANTES DE ELIMINAR**
    try {
      // Obtener archivos adjuntos y comentarios antes de eliminar
      const attachments = await (prisma as any).taskAttachment.findMany({
        where: { taskId: taskId },
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      const comments = await (prisma as any).taskComment.findMany({
        where: { taskId: taskId },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      // Transformar archivos para el historial
      const formattedAttachments = attachments.map((attachment: any) => ({
        id: attachment.id.toString(),
        name: attachment.name,
        url: attachment.url,
        size: attachment.size,
        type: attachment.type,
        uploadedAt: attachment.uploadedAt.toISOString(),
        uploadedBy: attachment.uploadedBy ? {
          id: attachment.uploadedBy.id,
          name: attachment.uploadedBy.name,
          email: attachment.uploadedBy.email
        } : null
      }));

      // Transformar comentarios para el historial
      const formattedComments = comments.map((comment: any) => ({
        id: comment.id.toString(),
        content: comment.content,
        userId: comment.user.id.toString(),
        userName: comment.user.name,
        userEmail: comment.user.email,
        createdAt: comment.createdAt.toISOString()
      }));

      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tasks/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `token=${cookies().get('token')?.value}`
        },
        body: JSON.stringify({
          taskData: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate?.toISOString(),
            assignedTo: task.assignedTo ? {
              id: task.assignedTo.id,
              name: task.assignedTo.name,
              email: task.assignedTo.email
            } : null,
            createdBy: {
              id: task.createdBy.id,
              name: task.createdBy.name,
              email: task.createdBy.email
            },
            company: {
              id: task.company.id,
              name: task.company.name
            },
            companyId: task.companyId,
            tags: task.tags,
            progress: task.progress,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
            // Incluir archivos y comentarios en el historial
            files: formattedAttachments,
            comments: formattedComments
          }
        })
      });
      logger.debug('Tarea guardada en historial');
    } catch (error) {
      logger.warn('Error guardando en historial, continuando con eliminación', error);
      // Continuar con la eliminación aunque falle el historial
    }

    // Obtener attachments para eliminarlos de S3
    const attachments = await (prisma as any).taskAttachment.findMany({
      where: { taskId: taskId }
    });

    // Eliminar archivos de S3
    if (attachments.length > 0) {
      try {
        await Promise.all(attachments.map(async (attachment: any) => {
          if (attachment.url) {
            await deleteS3File(attachment.url);
          }
        }));
      } catch (error) {
        logger.warn('Error eliminando archivos de S3', error);
        // Continuar con la eliminación de la tarea aunque falle S3
      }
    }

    // Eliminar comentarios
    await (prisma as any).taskComment.deleteMany({
      where: { taskId: taskId }
    });

    // Eliminar attachments
    await (prisma as any).taskAttachment.deleteMany({
      where: { taskId: taskId }
    });

    // Eliminar subtareas
    await (prisma as any).subtask.deleteMany({
      where: { taskId: taskId }
    });

    // **ELIMINAR NOTIFICACIONES RELACIONADAS CON LA TAREA**
    try {
      await prisma.$executeRaw`
        DELETE FROM "Notification" 
        WHERE "metadata"->>'taskId' = ${taskId.toString()}
          AND "companyId" = ${task.companyId}
      `;
      logger.debug('Notificaciones relacionadas con la tarea eliminadas');
    } catch (error) {
      logger.warn('Error eliminando notificaciones de la tarea', error);
      // Continuar con la eliminación aunque falle la limpieza de notificaciones
    }

    // Notificar instantáneamente a los involucrados antes de eliminar
    if (task.assignedTo && task.assignedTo.id !== user.id) {
      await createAndSendInstantNotification(
        'TASK_DELETED',
        task.assignedTo.id,
        task.companyId,
        taskId,
        null, // no es reminder
        'Tarea eliminada',
        `La tarea "${task.title}" que tenías asignada ha sido eliminada`,
        'high', // Eliminar es alta prioridad
        {
          deletedBy: user.name,
          deletedById: user.id,
          taskTitle: task.title,
          reason: 'Task deleted by creator'
        }
      );
    }

    // Eliminar la tarea
    await prisma.task.delete({
      where: { id: taskId }
    });

    logger.info('Tarea eliminada exitosamente', { taskId });

    return NextResponse.json({
      message: "Tarea eliminada exitosamente y guardada en el historial"
    });

  } catch (error) {
    logger.error('Error deleting task', error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    );
  }
} 