/**
 * API: /api/work-orders/[id]/timeline
 *
 * GET - Timeline unificado de una WorkOrder
 *       Combina: creación, asignaciones, cambios de estado, work logs,
 *       soluciones, checklists, QA, etc.
 *
 * P5.1: Timeline Unificado
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Tipos de eventos en el timeline de OT
type TimelineEventType =
  | 'CREATED'            // OT creada
  | 'ASSIGNED'           // Asignada a técnico
  | 'SCHEDULED'          // Fecha programada
  | 'STARTED'            // Iniciada
  | 'STATUS_CHANGE'      // Cambio de estado
  | 'ON_HOLD'            // Puesta en espera
  | 'RESUMED'            // Reanudada
  | 'WORK_LOG'           // Registro de trabajo
  | 'SOLUTION_APPLIED'   // Solución aplicada
  | 'CHECKLIST_STARTED'  // Checklist iniciado
  | 'CHECKLIST_COMPLETED'// Checklist completado
  | 'QA_REQUIRED'        // QA requerido
  | 'QA_APPROVED'        // QA aprobado
  | 'QA_REJECTED'        // QA rechazado
  | 'RETURN_TO_PROD'     // Retorno a producción
  | 'COMPLETED'          // Completada
  | 'CANCELLED'          // Cancelada
  | 'COMMENT_ADDED'      // Comentario agregado
  | 'ATTACHMENT_ADDED';  // Foto/archivo agregado

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  occurredAt: Date;
  title: string;
  description?: string;
  performedBy?: {
    id: number;
    name: string;
  };
  metadata?: Record<string, any>;
}

/**
 * GET /api/work-orders/[id]/timeline
 * Obtiene el timeline unificado de una WorkOrder
 */
export async function GET(
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
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    // Obtener la WorkOrder con relaciones
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId },
      include: {
        machine: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        failureOccurrences: {
          select: {
            id: true,
            title: true,
            reportedAt: true,
            reporter: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    const timeline: TimelineEvent[] = [];

    // 1. Evento inicial: OT creada
    timeline.push({
      id: `created-${workOrder.id}`,
      type: 'CREATED',
      occurredAt: workOrder.createdAt,
      title: 'Orden de trabajo creada',
      description: workOrder.title,
      performedBy: workOrder.createdBy ? {
        id: workOrder.createdBy.id,
        name: workOrder.createdBy.name
      } : undefined,
      metadata: {
        type: workOrder.type,
        priority: workOrder.priority,
        origin: workOrder.origin,
        machineId: workOrder.machineId,
        machineName: workOrder.machine?.name
      }
    });

    // 2. Fallas asociadas
    for (const fo of workOrder.failureOccurrences || []) {
      timeline.push({
        id: `failure-${fo.id}`,
        type: 'CREATED',
        occurredAt: fo.reportedAt,
        title: 'Falla asociada',
        description: fo.title,
        performedBy: fo.reporter ? {
          id: fo.reporter.id,
          name: fo.reporter.name
        } : undefined,
        metadata: { failureOccurrenceId: fo.id }
      });
    }

    // 3. Asignación (si hay assignedTo y es diferente del creador)
    if (workOrder.assignedToId && workOrder.assignedTo) {
      // Usamos createdAt como aproximación si no hay fecha de asignación específica
      timeline.push({
        id: `assigned-${workOrder.id}`,
        type: 'ASSIGNED',
        occurredAt: workOrder.createdAt,
        title: 'Asignada a técnico',
        description: `Asignada a ${workOrder.assignedTo.name}`,
        metadata: {
          assignedToId: workOrder.assignedToId,
          assignedToName: workOrder.assignedTo.name
        }
      });
    }

    // 4. Fecha programada
    if (workOrder.scheduledDate) {
      timeline.push({
        id: `scheduled-${workOrder.id}`,
        type: 'SCHEDULED',
        occurredAt: workOrder.createdAt, // Aproximación
        title: 'Fecha programada',
        description: `Programada para ${new Date(workOrder.scheduledDate).toLocaleDateString()}`,
        metadata: { scheduledDate: workOrder.scheduledDate }
      });
    }

    // 5. Iniciada
    if (workOrder.startedDate) {
      timeline.push({
        id: `started-${workOrder.id}`,
        type: 'STARTED',
        occurredAt: workOrder.startedDate,
        title: 'Trabajo iniciado',
        performedBy: workOrder.assignedTo ? {
          id: workOrder.assignedTo.id,
          name: workOrder.assignedTo.name
        } : undefined,
        metadata: {}
      });
    }

    // ✅ OPTIMIZADO: Ejecutar todas las queries en paralelo
    const [
      activityEventsResult,
      workLogsResult,
      solutionsResult,
      qaResult,
      checklistsResult
    ] = await Promise.allSettled([
      prisma.activityEvent.findMany({
        where: {
          companyId,
          entityType: 'WORK_ORDER',
          entityId: workOrderId
        },
        include: {
          performedBy: { select: { id: true, name: true } }
        },
        orderBy: { occurredAt: 'asc' }
      }),
      prisma.workLog.findMany({
        where: { workOrderId },
        include: {
          performedBy: { select: { id: true, name: true } }
        },
        orderBy: { startedAt: 'asc' }
      }),
      prisma.solutionApplied.findMany({
        where: { workOrderId, companyId },
        include: {
          performedBy: { select: { id: true, name: true } }
        },
        orderBy: { performedAt: 'asc' }
      }),
      prisma.qualityAssurance.findFirst({
        where: { workOrderId },
        include: {
          verifiedBy: { select: { id: true, name: true } },
          returnConfirmedBy: { select: { id: true, name: true } }
        }
      }),
      prisma.workOrderChecklist.findMany({
        where: { workOrderId, companyId },
        include: {
          completedBy: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    // 6. Procesar ActivityEvents
    if (activityEventsResult.status === 'fulfilled') {
      for (const event of activityEventsResult.value) {
        let title = event.eventType.replace(/_/g, ' ').toLowerCase();
        title = title.charAt(0).toUpperCase() + title.slice(1);

        timeline.push({
          id: `activity-${event.id}`,
          type: event.eventType as TimelineEventType,
          occurredAt: event.occurredAt,
          title,
          description: event.newValue || undefined,
          performedBy: event.performedBy ? {
            id: event.performedBy.id,
            name: event.performedBy.name
          } : undefined,
          metadata: event.metadata as Record<string, any> || {}
        });
      }
    }

    // 7. Procesar Work Logs
    if (workLogsResult.status === 'fulfilled') {
      for (const log of workLogsResult.value) {
        timeline.push({
          id: `worklog-${log.id}`,
          type: 'WORK_LOG',
          occurredAt: log.startedAt,
          title: 'Registro de trabajo',
          description: log.description || `${log.activityType} - ${log.actualMinutes || '?'} min`,
          performedBy: log.performedBy ? {
            id: log.performedBy.id,
            name: log.performedBy.name
          } : undefined,
          metadata: {
            workLogId: log.id,
            activityType: log.activityType,
            startedAt: log.startedAt,
            endedAt: log.endedAt,
            actualMinutes: log.actualMinutes
          }
        });
      }
    }

    // 8. Procesar Soluciones aplicadas
    if (solutionsResult.status === 'fulfilled') {
      for (const sol of solutionsResult.value) {
        timeline.push({
          id: `solution-${sol.id}`,
          type: 'SOLUTION_APPLIED',
          occurredAt: sol.performedAt,
          title: 'Solución aplicada',
          description: sol.diagnosis,
          performedBy: sol.performedBy ? {
            id: sol.performedBy.id,
            name: sol.performedBy.name
          } : undefined,
          metadata: {
            solutionId: sol.id,
            outcome: sol.outcome,
            fixType: sol.fixType,
            effectiveness: sol.effectiveness
          }
        });
      }
    }

    // 9. Procesar QualityAssurance
    if (qaResult.status === 'fulfilled' && qaResult.value) {
      const qa = qaResult.value;
      if (qa.isRequired) {
        timeline.push({
          id: `qa-required-${qa.id}`,
          type: 'QA_REQUIRED',
          occurredAt: workOrder.createdAt,
          title: 'QA requerido',
          description: qa.requiredReason || 'Verificación de calidad requerida',
          metadata: { qaId: qa.id, reason: qa.requiredReason }
        });
      }

      if (qa.verifiedAt && qa.status === 'APPROVED') {
        timeline.push({
          id: `qa-approved-${qa.id}`,
          type: 'QA_APPROVED',
          occurredAt: qa.verifiedAt,
          title: 'QA aprobado',
          description: qa.notes || 'Verificación de calidad aprobada',
          performedBy: qa.verifiedBy ? {
            id: qa.verifiedBy.id,
            name: qa.verifiedBy.name
          } : undefined,
          metadata: { qaId: qa.id }
        });
      }

      if (qa.verifiedAt && qa.status === 'REJECTED') {
        timeline.push({
          id: `qa-rejected-${qa.id}`,
          type: 'QA_REJECTED',
          occurredAt: qa.verifiedAt,
          title: 'QA rechazado',
          description: qa.notes || 'Verificación de calidad rechazada',
          performedBy: qa.verifiedBy ? {
            id: qa.verifiedBy.id,
            name: qa.verifiedBy.name
          } : undefined,
          metadata: { qaId: qa.id }
        });
      }

      if (qa.returnToProductionConfirmed && qa.returnConfirmedAt) {
        timeline.push({
          id: `return-prod-${qa.id}`,
          type: 'RETURN_TO_PROD',
          occurredAt: qa.returnConfirmedAt,
          title: 'Retorno a producción confirmado',
          performedBy: qa.returnConfirmedBy ? {
            id: qa.returnConfirmedBy.id,
            name: qa.returnConfirmedBy.name
          } : undefined,
          metadata: { qaId: qa.id }
        });
      }
    }

    // 10. Procesar Checklists
    if (checklistsResult.status === 'fulfilled') {
      for (const cl of checklistsResult.value) {
        timeline.push({
          id: `checklist-created-${cl.id}`,
          type: 'CHECKLIST_STARTED',
          occurredAt: cl.createdAt,
          title: 'Checklist iniciado',
          description: cl.name,
          metadata: { checklistId: cl.id, templateId: cl.templateId }
        });

        if (cl.completedAt) {
          timeline.push({
            id: `checklist-completed-${cl.id}`,
            type: 'CHECKLIST_COMPLETED',
            occurredAt: cl.completedAt,
            title: 'Checklist completado',
            description: cl.name,
            performedBy: cl.completedBy ? {
              id: cl.completedBy.id,
              name: cl.completedBy.name
            } : undefined,
            metadata: { checklistId: cl.id }
          });
        }
      }
    }

    // 11. Completada
    if (workOrder.completedDate) {
      timeline.push({
        id: `completed-${workOrder.id}`,
        type: 'COMPLETED',
        occurredAt: workOrder.completedDate,
        title: 'Orden completada',
        performedBy: workOrder.assignedTo ? {
          id: workOrder.assignedTo.id,
          name: workOrder.assignedTo.name
        } : undefined,
        metadata: { finalStatus: workOrder.status }
      });
    }

    // 12. Cancelada
    if (workOrder.status === 'CANCELLED') {
      timeline.push({
        id: `cancelled-${workOrder.id}`,
        type: 'CANCELLED',
        occurredAt: workOrder.updatedAt,
        title: 'Orden cancelada',
        metadata: {}
      });
    }

    // Ordenar timeline por fecha
    timeline.sort((a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    return NextResponse.json({
      workOrder: {
        id: workOrder.id,
        title: workOrder.title,
        status: workOrder.status,
        priority: workOrder.priority,
        type: workOrder.type,
        machine: workOrder.machine
      },
      timeline,
      totalEvents: timeline.length,
      generatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/work-orders/[id]/timeline:', error);
    return NextResponse.json(
      { error: 'Error al obtener timeline', detail: error.message },
      { status: 500 }
    );
  }
}
