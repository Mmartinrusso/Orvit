import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { hasPermission } from '@/lib/permissions';
import { z } from 'zod';
import { triggerCompanyEvent } from '@/lib/chat/pusher';

export const dynamic = 'force-dynamic';

const BulkUpdateSchema = z.object({
  taskIds: z.array(z.number().int().positive()).min(1).max(100),
  action: z.enum(['updateStatus', 'delete', 'assignUser', 'changePriority']),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED']).optional(),
  assignedToUserId: z.number().int().positive().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

// PATCH /api/agenda/tasks/bulk — Acciones masivas
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validation = BulkUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { taskIds, action, status, assignedToUserId, priority } = validation.data;

    // Verificar permisos
    const permKey = action === 'delete' ? 'tasks.delete' : 'tasks.edit';
    if (!hasPermission(permKey, { userId: user.id, userRole: user.role })) {
      return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
    }

    // Verificar que el usuario tenga acceso a todas las tareas
    const tasks = await prisma.agendaTask.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, createdById: true, assignedToUserId: true, companyId: true, title: true },
    });

    const accessibleIds = tasks
      .filter((t) => t.createdById === user.id || t.assignedToUserId === user.id)
      .map((t) => t.id);

    if (accessibleIds.length === 0) {
      return NextResponse.json({ error: 'Sin acceso a las tareas indicadas' }, { status: 403 });
    }

    let affected = 0;

    switch (action) {
      case 'updateStatus': {
        if (!status) {
          return NextResponse.json({ error: 'Se requiere status' }, { status: 400 });
        }
        const updateData: any = { status };
        if (status === 'COMPLETED') updateData.completedAt = new Date();
        if (status === 'PENDING' || status === 'IN_PROGRESS') updateData.completedAt = null;

        const result = await prisma.agendaTask.updateMany({
          where: { id: { in: accessibleIds } },
          data: updateData,
        });
        affected = result.count;
        break;
      }

      case 'delete': {
        const result = await prisma.agendaTask.deleteMany({
          where: { id: { in: accessibleIds } },
        });
        affected = result.count;
        break;
      }

      case 'assignUser': {
        let assignedToName: string | null = null;
        if (assignedToUserId) {
          const assignedUser = await prisma.user.findUnique({
            where: { id: assignedToUserId },
            select: { name: true },
          });
          assignedToName = assignedUser?.name || null;
        }

        const result = await prisma.agendaTask.updateMany({
          where: { id: { in: accessibleIds } },
          data: {
            assignedToUserId: assignedToUserId ?? null,
            assignedToName,
          },
        });
        affected = result.count;

        // Notificar al nuevo asignado
        if (assignedToUserId && assignedToUserId !== user.id) {
          try {
            await prisma.notification.create({
              data: {
                type: 'task_assigned',
                title: 'Te asignaron tareas',
                message: `${user.name || 'Alguien'} te asignó ${affected} tarea(s)`,
                userId: assignedToUserId,
                companyId: tasks[0]?.companyId ?? 0,
                metadata: { taskIds: accessibleIds, assignedBy: user.id },
              },
            });
          } catch {
            // best-effort
          }
        }
        break;
      }

      case 'changePriority': {
        if (!priority) {
          return NextResponse.json({ error: 'Se requiere priority' }, { status: 400 });
        }
        const result = await prisma.agendaTask.updateMany({
          where: { id: { in: accessibleIds } },
          data: { priority },
        });
        affected = result.count;
        break;
      }
    }

    // Pusher realtime trigger for each affected task
    const companyId = tasks[0]?.companyId;
    if (companyId) {
      const eventName = action === 'delete' ? 'task:deleted' : 'task:updated';
      for (const id of accessibleIds) {
        triggerCompanyEvent(companyId, "tasks", eventName, { id });
      }
    }

    return NextResponse.json({
      success: true,
      affected,
      requested: taskIds.length,
      accessible: accessibleIds.length,
    });
  } catch (error) {
    console.error('[API] Error in bulk task action:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
