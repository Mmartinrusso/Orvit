import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  triggerWorkOrderStatusChanged,
  triggerWorkOrderAssigned
} from '@/lib/automation/engine';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { UpdateWorkOrderSchema } from '@/lib/validations/work-orders';
import { trackCount, trackDuration } from '@/lib/metrics';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

// GET /api/work-orders/[id]
export const GET = withGuards(async (request: NextRequest, { user, params: _p }, routeContext) => {
  const { params } = routeContext!;
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const includeParam = searchParams.get('include') || '';
    const includes = includeParam.split(',').filter(Boolean);

    // Base includes
    const includeConfig: Record<string, unknown> = {
      machine: true,
      component: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignedWorker: {
        select: {
          id: true,
          name: true,
          phone: true,
          specialty: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      sector: true,
      attachments: true,
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    };

    // Optional includes based on query param
    if (includes.includes('watchers')) {
      includeConfig.watchers = {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      };
    }

    if (includes.includes('downtimeLogs')) {
      includeConfig.downtimeLogs = {
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          totalMinutes: true,
          category: true,
          reason: true,
        },
      };
    }

    if (includes.includes('failureOccurrences')) {
      includeConfig.failureOccurrences = {
        select: {
          id: true,
          title: true,
          causedDowntime: true,
          status: true,
          priority: true,
          affectedComponents: true,
        },
      };
    }

    if (includes.includes('counts')) {
      includeConfig._count = {
        select: {
          workLogs: true,
          comments: true,
        },
      };
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: Number(id) },
      include: includeConfig,
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Si hay failureOccurrences, expandir los subcomponentes
    let responseData: any = workOrder;
    if (includes.includes('failureOccurrences') && workOrder.failureOccurrences) {
      const allSubcomponentIds: number[] = [];

      // Recopilar todos los IDs de subcomponentes
      for (const fo of workOrder.failureOccurrences as any[]) {
        const affectedComponents = fo.affectedComponents as any;
        if (affectedComponents?.subcomponentIds?.length) {
          allSubcomponentIds.push(...affectedComponents.subcomponentIds);
        }
      }

      const uniqueSubIds = [...new Set(allSubcomponentIds)];
      const failureIds = (workOrder.failureOccurrences as any[]).map(fo => fo.id);

      // ✅ OPTIMIZADO: Ejecutar queries en paralelo
      const [subcomponentsResult, solutionsResult] = await Promise.allSettled([
        // Query subcomponentes
        uniqueSubIds.length > 0
          ? prisma.component.findMany({
              where: { id: { in: uniqueSubIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        // Query solutionsApplied
        failureIds.length > 0
          ? prisma.solutionApplied.findMany({
              where: { failureOccurrenceId: { in: failureIds } },
              select: {
                id: true,
                diagnosis: true,
                solution: true,
                outcome: true,
                performedAt: true,
              },
              orderBy: { performedAt: 'desc' },
              take: 1,
            })
          : Promise.resolve([]),
      ]);

      // Procesar subcomponentes
      const subcomponentsMap: Map<number, { id: number; name: string }> = new Map();
      if (subcomponentsResult.status === 'fulfilled') {
        subcomponentsResult.value.forEach(s => subcomponentsMap.set(s.id, s));
      }

      // Agregar subcomponents a cada failureOccurrence
      responseData = {
        ...workOrder,
        failureOccurrences: (workOrder.failureOccurrences as any[]).map((fo: any) => {
          const affectedComponents = fo.affectedComponents as any;
          const subIds = affectedComponents?.subcomponentIds || [];
          return {
            ...fo,
            subcomponents: subIds.map((id: number) => subcomponentsMap.get(id)).filter(Boolean),
          };
        }),
        subcomponents: [...subcomponentsMap.values()],
        solutionsApplied: solutionsResult.status === 'fulfilled' ? solutionsResult.value : [],
      };
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error en GET /api/work-orders/[id]:', error);
    return NextResponse.json({ error: 'Error al obtener orden de trabajo' }, { status: 500 });
  }
}, { requiredPermissions: ['work_orders.view'], permissionMode: 'any' });

// PUT /api/work-orders/[id]
export const PUT = withGuards(async (request: NextRequest, { user, params: _p }, routeContext) => {
  const { params } = routeContext!;
  try {
    const { id } = params;
    const body = await request.json();

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'ID de orden de trabajo inválido' }, { status: 400 });
    }

    const validation = validateRequest(UpdateWorkOrderSchema, body);
    if (!validation.success) return validation.response;

    const {
      title, description, status, priority, type, machineId, componentId,
      assignedToId, scheduledDate, startedDate, completedDate,
      estimatedHours, actualHours, cost, notes, sectorId,
    } = validation.data;

    // Obtener datos originales antes de la actualización para detectar cambios
    const originalWorkOrder = await prisma.workOrder.findUnique({
      where: { id: Number(id) },
      select: { assignedToId: true, title: true, type: true, createdById: true, status: true, companyId: true }
    });

    if (!originalWorkOrder) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Validaciones solo si se están actualizando campos obligatorios
    // Permitir actualizaciones parciales (ej: solo cambiar status)
    const finalTitle = title ?? originalWorkOrder.title;
    const finalType = type ?? originalWorkOrder.type;

    if (!finalTitle || !finalType) {
      return NextResponse.json({ error: 'Título y tipo son requeridos' }, { status: 400 });
    }

    // Construir datos de actualización solo con campos proporcionados
    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status.toUpperCase(); // Normalizar a mayúsculas
    if (priority !== undefined) updateData.priority = priority;
    if (type !== undefined) updateData.type = type;
    if (machineId !== undefined) updateData.machineId = machineId ? Number(machineId) : null;
    if (componentId !== undefined) updateData.componentId = componentId ? Number(componentId) : null;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId ? Number(assignedToId) : null;
    if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;
    if (startedDate !== undefined) updateData.startedDate = startedDate ? new Date(startedDate) : null;
    if (estimatedHours !== undefined) updateData.estimatedHours = estimatedHours ? Number(estimatedHours) : null;
    if (actualHours !== undefined) updateData.actualHours = actualHours ? Number(actualHours) : null;
    if (cost !== undefined) updateData.cost = cost ? Number(cost) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (sectorId !== undefined) updateData.sectorId = sectorId ? Number(sectorId) : null;

    // Auto-completar fechas según el estado (normalizar a mayúsculas para comparar)
    const normalizedStatus = status?.toUpperCase?.();
    if (normalizedStatus === 'IN_PROGRESS' && !startedDate) {
      updateData.startedDate = new Date();
    }
    if (normalizedStatus === 'COMPLETED' && !completedDate) {
      updateData.completedDate = new Date();
    }
    if (completedDate) {
      updateData.completedDate = new Date(completedDate);
    }

    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        machine: true,
        component: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedWorker: {
          select: {
            id: true,
            name: true,
            phone: true,
            specialty: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sector: true,
        attachments: true,
      },
    });

    // Métricas: completar OT y tiempo de resolución (fire-and-forget)
    if (normalizedStatus === 'COMPLETED' && originalWorkOrder.status !== 'COMPLETED') {
      trackCount('work_orders_completed', updatedWorkOrder.companyId, {
        tags: { type: updatedWorkOrder.type, priority: updatedWorkOrder.priority },
        userId: user.userId,
      }).catch(() => {});

      if (updatedWorkOrder.createdAt && updatedWorkOrder.completedDate) {
        const resolutionMs = new Date(updatedWorkOrder.completedDate).getTime() - new Date(updatedWorkOrder.createdAt).getTime();
        trackDuration('resolution_time', resolutionMs, updatedWorkOrder.companyId, {
          tags: { type: updatedWorkOrder.type },
          userId: user.userId,
        }).catch(() => {});
      }
    }

    // Verificar si cambió la asignación para enviar notificación
    if (assignedToId &&
        originalWorkOrder?.assignedToId !== Number(assignedToId) &&
        Number(assignedToId) !== originalWorkOrder.createdById) {
      try {
        await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'work_order_assigned',
            title: '🔄 Orden de Trabajo Reasignada',
            message: `Se te ha reasignado la orden: "${updatedWorkOrder.title}"`,
            userId: Number(assignedToId),
            workOrderId: updatedWorkOrder.id,
            priority: updatedWorkOrder.priority.toLowerCase(),
            metadata: {
              workOrderTitle: updatedWorkOrder.title,
              previousAssignee: originalWorkOrder?.assignedToId,
              newStatus: status,
              updatedAt: updatedWorkOrder.updatedAt
            }
          })
        });
      } catch (notificationError) {
        console.error('Error enviando notificación de reasignación:', notificationError);
      }
    }

    // Procesar automatizaciones por cambio de estado
    if (status && originalWorkOrder.status !== normalizedStatus) {
      try {
        await triggerWorkOrderStatusChanged(
          updatedWorkOrder.companyId,
          updatedWorkOrder as unknown as Record<string, unknown>,
          originalWorkOrder.status,
          normalizedStatus
        );
      } catch (automationError) {
        console.error('Error procesando automatización de cambio de estado:', automationError);
      }
    }

    // Procesar automatizaciones por asignación
    if (assignedToId && originalWorkOrder.assignedToId !== Number(assignedToId)) {
      try {
        await triggerWorkOrderAssigned(
          updatedWorkOrder.companyId,
          updatedWorkOrder as unknown as Record<string, unknown>,
          Number(assignedToId)
        );
      } catch (automationError) {
        console.error('Error procesando automatización de asignación:', automationError);
      }
    }

    return NextResponse.json(updatedWorkOrder);
  } catch (error) {
    console.error('PUT /api/work-orders/[id] - error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar orden de trabajo', details: error },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['work_orders.edit'], permissionMode: 'any' });

// DELETE /api/work-orders/[id]
export const DELETE = withGuards(async (request: NextRequest, { user, params: _p }, routeContext) => {
  const { params } = routeContext!;
  try {
    const { id } = params;

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: Number(id) },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Transacción atómica: eliminar dependencias y la orden de trabajo
    await prisma.$transaction(async (tx) => {
      // Eliminar attachments primero (cascade debería manejarlo, pero por seguridad)
      await tx.workOrderAttachment.deleteMany({
        where: { workOrderId: Number(id) },
      });

      // Eliminar la orden de trabajo
      await tx.workOrder.delete({
        where: { id: Number(id) },
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/work-orders/[id] - error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar orden de trabajo', details: error },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['work_orders.delete'], permissionMode: 'any' });
