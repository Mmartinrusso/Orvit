/**
 * API: /api/failure-occurrences/[id]/create-work-order
 *
 * POST - Crear OT manual desde una FailureOccurrence (especialmente observaciones)
 *
 * Casos de uso:
 * 1. Observación que requiere acción (isObservation=true, failureId=null)
 * 2. Falla que necesita nueva OT (OT anterior cerrada/cancelada)
 * 3. Escalación manual de cualquier ocurrencia
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { calculatePriority } from '@/lib/corrective/priority-calculator';
import { notifyOTCreated, notifyOTAssigned } from '@/lib/discord/notifications';
import { hasUserPermission } from '@/lib/permissions-helpers';
export const dynamic = 'force-dynamic';

/**
 * Schema de validación para crear OT desde observación
 */
const createWorkOrderSchema = z.object({
  title: z.string().min(5).max(255).optional(), // Si no se provee, se genera automáticamente
  description: z.string().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  assignedToId: z.number().int().positive().optional(),
  scheduledDate: z.string().datetime().optional(),
  startImmediately: z.boolean().default(false),
  notes: z.string().optional(),
});

/**
 * POST /api/failure-occurrences/[id]/create-work-order
 * Crear OT manual desde una FailureOccurrence
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;

    // Permission check: work_orders.create
    const hasPerm = await hasUserPermission(userId, companyId, 'work_orders.create');
    if (!hasPerm) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const failureOccurrenceId = parseInt(params.id);

    if (isNaN(failureOccurrenceId)) {
      return NextResponse.json(
        { error: 'ID de ocurrencia inválido' },
        { status: 400 }
      );
    }

    // Parsear y validar body
    const body = await request.json();
    const validationResult = createWorkOrderSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Obtener la FailureOccurrence con su máquina
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: { id: failureOccurrenceId, companyId },
      include: {
        machine: { select: { id: true, name: true, criticality: true } },
        workOrder: { select: { id: true, title: true, status: true } }
      }
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Ocurrencia no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que no haya una OT activa para esta ocurrencia
    if (occurrence.workOrder) {
      const activeStatuses = ['PENDING', 'IN_PROGRESS', 'ON_HOLD'];
      if (activeStatuses.includes(occurrence.workOrder.status)) {
        return NextResponse.json(
          {
            error: 'Ya existe una OT activa para esta falla',
            existingWorkOrder: {
              id: occurrence.workOrder.id,
              title: occurrence.workOrder.title,
              status: occurrence.workOrder.status
            }
          },
          { status: 400 }
        );
      }
    }

    // Calcular prioridad si no se provee
    let workOrderPriority = data.priority;
    if (!workOrderPriority) {
      const priorityResult = calculatePriority({
        assetCriticality: occurrence.machine?.criticality,
        causedDowntime: occurrence.causedDowntime || false,
        isSafetyRelated: occurrence.isSafetyRelated || false,
        isIntermittent: occurrence.isIntermittent || false,
        isObservation: occurrence.isObservation || false
      });

      workOrderPriority = priorityResult.priority === 'P1' ? 'URGENT' :
                          priorityResult.priority === 'P2' ? 'HIGH' :
                          priorityResult.priority === 'P3' ? 'MEDIUM' : 'LOW';
    }

    // Generar título si no se provee
    const workOrderTitle = data.title ||
      (occurrence.isObservation
        ? `Atender observación — ${occurrence.title}`
        : `Solucionar — ${occurrence.title}`);

    // Crear la OT (transacción)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear la WorkOrder
      const workOrder = await tx.workOrder.create({
        data: {
          title: workOrderTitle,
          description: data.description || occurrence.description || `Falla: ${occurrence.title}`,
          type: 'CORRECTIVE',
          status: data.startImmediately ? 'IN_PROGRESS' : 'PENDING',
          priority: workOrderPriority!,
          origin: 'FAILURE',
          machineId: occurrence.machineId,
          componentId: occurrence.subcomponentId, // Si hay subcomponente, usarlo
          companyId,
          createdById: userId,
          assignedToId: data.assignedToId,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
          startedDate: data.startImmediately ? new Date() : undefined,
          failureDescription: occurrence.title,
          notes: data.notes,
          isSafetyRelated: occurrence.isSafetyRelated || false,
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          machine: {
            select: {
              id: true,
              name: true,
              sectorId: true,
              sector: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          component: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          sector: { select: { id: true, name: true } }
        }
      });

      // 2. Vincular la FailureOccurrence a la nueva OT
      await tx.failureOccurrence.update({
        where: { id: failureOccurrenceId },
        data: {
          failureId: workOrder.id,
          status: data.startImmediately ? 'IN_PROGRESS' : 'OPEN'
        }
      });

      // 3. Registrar en timeline
      try {
        await tx.activityEvent.create({
          data: {
            companyId,
            eventType: 'WORK_ORDER_CREATED',
            entityType: 'FAILURE_OCCURRENCE',
            entityId: failureOccurrenceId,
            newValue: workOrder.id.toString(),
            metadata: {
              workOrderId: workOrder.id,
              workOrderTitle: workOrder.title,
              fromObservation: occurrence.isObservation,
              startedImmediately: data.startImmediately
            },
            performedById: userId
          }
        });

        // También registrar en el timeline de la OT
        await tx.activityEvent.create({
          data: {
            companyId,
            eventType: 'WORK_ORDER_CREATED',
            entityType: 'WORK_ORDER',
            entityId: workOrder.id,
            metadata: {
              failureOccurrenceId,
              failureTitle: occurrence.title,
              createdFrom: occurrence.isObservation ? 'OBSERVATION' : 'FAILURE'
            },
            performedById: userId
          }
        });
      } catch (e) {
        console.warn('⚠️ No se pudo crear ActivityEvent (tabla puede no existir)');
      }

      return { workOrder };
    });

    console.log(`✅ OT creada desde ${occurrence.isObservation ? 'observación' : 'falla'}: ` +
      `WO#${result.workOrder.id} para FO#${failureOccurrenceId}`);

    // Enviar notificación interna si hay usuario asignado
    if (result.workOrder.assignedToId && result.workOrder.assignedToId !== userId) {
      try {
        await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'work_order_assigned',
            title: '🔧 Nueva Orden de Trabajo Asignada',
            message: `Se te ha asignado la orden: "${result.workOrder.title}"`,
            userId: result.workOrder.assignedToId,
            workOrderId: result.workOrder.id,
            priority: result.workOrder.priority.toLowerCase(),
            metadata: {
              workOrderTitle: result.workOrder.title,
              assignedBy: result.workOrder.createdBy?.name || 'Sistema',
              machineId: result.workOrder.machine?.id,
              machineName: result.workOrder.machine?.name || 'Sin máquina',
              createdAt: result.workOrder.createdAt
            }
          })
        });
      } catch (notificationError) {
        console.error('Error enviando notificación interna:', notificationError);
      }
    }

    // Notificación Discord (fire-and-forget)
    const sendDiscordNotifications = async () => {
      try {
        const sectorId = result.workOrder.machine?.sectorId;
        if (!sectorId) return;

        // Notificar OT creada
        await notifyOTCreated({
          id: result.workOrder.id,
          title: result.workOrder.title,
          type: result.workOrder.type,
          priority: result.workOrder.priority,
          machineName: result.workOrder.machine?.name,
          sectorId,
          assignedTo: result.workOrder.assignedTo?.name,
          origin: occurrence.isObservation ? 'OBSERVACIÓN' : 'FALLA',
        });

        // Si hay técnico asignado, enviar notificación + DM
        if (result.workOrder.assignedTo) {
          await notifyOTAssigned({
            id: result.workOrder.id,
            title: result.workOrder.title,
            priority: result.workOrder.priority,
            machineName: result.workOrder.machine?.name,
            sectorId,
            assignedTo: result.workOrder.assignedTo.name,
            assignedToId: result.workOrder.assignedToId || undefined,
            assignedBy: result.workOrder.createdBy?.name || 'Sistema',
          });
        }
      } catch (discordError) {
        console.warn('⚠️ Error enviando notificación Discord:', discordError);
      }
    };
    sendDiscordNotifications().catch(() => {});

    return NextResponse.json({
      success: true,
      message: occurrence.isObservation
        ? 'OT creada desde observación'
        : 'OT creada exitosamente',
      workOrder: {
        id: result.workOrder.id,
        title: result.workOrder.title,
        status: result.workOrder.status,
        priority: result.workOrder.priority,
        type: result.workOrder.type,
        assignedTo: result.workOrder.assignedTo,
        machine: result.workOrder.machine,
        scheduledDate: result.workOrder.scheduledDate,
        startedDate: result.workOrder.startedDate
      },
      occurrence: {
        id: failureOccurrenceId,
        title: occurrence.title,
        wasObservation: occurrence.isObservation
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/[id]/create-work-order:', error);
    return NextResponse.json(
      { error: 'Error al crear OT', detail: error.message },
      { status: 500 }
    );
  }
}
