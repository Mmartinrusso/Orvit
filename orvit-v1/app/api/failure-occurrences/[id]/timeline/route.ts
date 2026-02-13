/**
 * API: /api/failure-occurrences/[id]/timeline
 *
 * GET - Timeline unificado de una FailureOccurrence
 *       Combina: eventos de sistema, ocurrencias adicionales, cambios de estado,
 *       soluciones aplicadas, comentarios, etc.
 *
 * P5.1: Timeline Unificado
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Tipos de eventos en el timeline
type TimelineEventType =
  | 'REPORTED'           // Falla reportada inicialmente
  | 'OCCURRENCE'         // Nueva ocurrencia "pasó otra vez"
  | 'STATUS_CHANGE'      // Cambio de estado
  | 'PRIORITY_CHANGE'    // Cambio de prioridad
  | 'ASSIGNED'           // Asignación de técnico
  | 'WORK_ORDER_CREATED' // OT creada
  | 'WORK_ORDER_STARTED' // OT iniciada
  | 'WORK_ORDER_CLOSED'  // OT cerrada
  | 'SOLUTION_APPLIED'   // Solución aplicada
  | 'COMMENT_ADDED'      // Comentario agregado
  | 'ATTACHMENT_ADDED'   // Foto/archivo agregado
  | 'DOWNTIME_STARTED'   // Downtime iniciado
  | 'DOWNTIME_ENDED'     // Downtime finalizado
  | 'LINKED_DUPLICATE'   // Vinculado como duplicado
  | 'RCA_CREATED'        // RCA creado
  | 'CHECKLIST_COMPLETED'; // Checklist completado

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
 * GET /api/failure-occurrences/[id]/timeline
 * Obtiene el timeline unificado de una FailureOccurrence
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
    const failureOccurrenceId = parseInt(params.id);

    if (isNaN(failureOccurrenceId)) {
      return NextResponse.json(
        { error: 'ID de ocurrencia inválido' },
        { status: 400 }
      );
    }

    // Obtener la FailureOccurrence con relaciones
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: { id: failureOccurrenceId, companyId },
      include: {
        machine: { select: { id: true, name: true } },
        reporter: { select: { id: true, name: true } },
        workOrder: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            startedDate: true,
            completedDate: true,
            assignedTo: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } }
          }
        },
        linkedDuplicates: {
          select: {
            id: true,
            title: true,
            reportedAt: true,
            reporter: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Ocurrencia no encontrada' },
        { status: 404 }
      );
    }

    const timeline: TimelineEvent[] = [];

    // 1. Evento inicial: Falla reportada
    timeline.push({
      id: `reported-${occurrence.id}`,
      type: 'REPORTED',
      occurredAt: occurrence.reportedAt,
      title: 'Falla reportada',
      description: occurrence.title,
      performedBy: occurrence.reporter ? {
        id: occurrence.reporter.id,
        name: occurrence.reporter.name
      } : undefined,
      metadata: {
        machineId: occurrence.machineId,
        machineName: occurrence.machine?.name,
        priority: occurrence.priority,
        isObservation: occurrence.isObservation,
        causedDowntime: occurrence.causedDowntime
      }
    });

    // ✅ OPTIMIZADO: Ejecutar todas las queries adicionales en paralelo
    const [
      occurrenceEventsResult,
      activityEventsResult,
      solutionsResult,
      downtimesResult,
      rcaResult
    ] = await Promise.allSettled([
      prisma.failureOccurrenceEvent.findMany({
        where: { failureOccurrenceId, companyId },
        include: {
          createdBy: { select: { id: true, name: true } },
          workOrder: { select: { id: true, title: true } }
        },
        orderBy: { occurredAt: 'asc' }
      }),
      prisma.activityEvent.findMany({
        where: {
          companyId,
          entityType: 'FAILURE_OCCURRENCE',
          entityId: failureOccurrenceId
        },
        include: {
          performedBy: { select: { id: true, name: true } }
        },
        orderBy: { occurredAt: 'asc' }
      }),
      prisma.solutionApplied.findMany({
        where: { failureOccurrenceId, companyId },
        include: {
          performedBy: { select: { id: true, name: true } }
        },
        orderBy: { performedAt: 'asc' }
      }),
      prisma.downtimeLog.findMany({
        where: { failureOccurrenceId, companyId },
        include: {
          returnToProductionByUser: { select: { id: true, name: true } }
        },
        orderBy: { startedAt: 'asc' }
      }),
      prisma.rootCauseAnalysis.findFirst({
        where: { failureOccurrenceId, companyId },
        include: {
          createdBy: { select: { id: true, name: true } }
        }
      })
    ]);

    // 2. Procesar eventos de ocurrencia
    if (occurrenceEventsResult.status === 'fulfilled') {
      for (const event of occurrenceEventsResult.value) {
        timeline.push({
          id: `occurrence-${event.id}`,
          type: 'OCCURRENCE',
          occurredAt: event.occurredAt,
          title: 'Nueva ocurrencia reportada',
          description: event.notes || 'Ocurrencia adicional registrada',
          performedBy: event.createdBy ? {
            id: event.createdBy.id,
            name: event.createdBy.name
          } : undefined,
          metadata: {
            eventId: event.id,
            causedDowntime: event.causedDowntime,
            isSafetyRelated: event.isSafetyRelated,
            workOrderId: event.workOrderId,
            workOrderTitle: event.workOrder?.title
          }
        });
      }
    }

    // 3. Procesar activity events
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

    // 4. OT creada (ya viene del include principal)
    if (occurrence.workOrder) {
      timeline.push({
        id: `wo-created-${occurrence.workOrder.id}`,
        type: 'WORK_ORDER_CREATED',
        occurredAt: occurrence.workOrder.createdAt,
        title: 'OT creada',
        description: occurrence.workOrder.title,
        performedBy: occurrence.workOrder.createdBy ? {
          id: occurrence.workOrder.createdBy.id,
          name: occurrence.workOrder.createdBy.name
        } : undefined,
        metadata: {
          workOrderId: occurrence.workOrder.id,
          status: occurrence.workOrder.status
        }
      });

      if (occurrence.workOrder.startedDate) {
        timeline.push({
          id: `wo-started-${occurrence.workOrder.id}`,
          type: 'WORK_ORDER_STARTED',
          occurredAt: occurrence.workOrder.startedDate,
          title: 'OT iniciada',
          performedBy: occurrence.workOrder.assignedTo ? {
            id: occurrence.workOrder.assignedTo.id,
            name: occurrence.workOrder.assignedTo.name
          } : undefined,
          metadata: { workOrderId: occurrence.workOrder.id }
        });
      }

      if (occurrence.workOrder.completedDate) {
        timeline.push({
          id: `wo-completed-${occurrence.workOrder.id}`,
          type: 'WORK_ORDER_CLOSED',
          occurredAt: occurrence.workOrder.completedDate,
          title: 'OT completada',
          performedBy: occurrence.workOrder.assignedTo ? {
            id: occurrence.workOrder.assignedTo.id,
            name: occurrence.workOrder.assignedTo.name
          } : undefined,
          metadata: {
            workOrderId: occurrence.workOrder.id,
            finalStatus: occurrence.workOrder.status
          }
        });
      }
    }

    // 5. Duplicados vinculados (ya viene del include principal)
    for (const dup of occurrence.linkedDuplicates || []) {
      timeline.push({
        id: `linked-${dup.id}`,
        type: 'LINKED_DUPLICATE',
        occurredAt: dup.reportedAt,
        title: 'Reporte vinculado como duplicado',
        description: dup.title,
        performedBy: dup.reporter ? {
          id: dup.reporter.id,
          name: dup.reporter.name
        } : undefined,
        metadata: { duplicateId: dup.id }
      });
    }

    // 6. Procesar soluciones
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

    // 7. Procesar downtimes
    if (downtimesResult.status === 'fulfilled') {
      for (const dt of downtimesResult.value) {
        timeline.push({
          id: `downtime-start-${dt.id}`,
          type: 'DOWNTIME_STARTED',
          occurredAt: dt.startedAt,
          title: 'Downtime iniciado',
          description: dt.reason || 'Parada de producción',
          metadata: {
            downtimeId: dt.id,
            category: dt.category
          }
        });

        if (dt.endedAt) {
          timeline.push({
            id: `downtime-end-${dt.id}`,
            type: 'DOWNTIME_ENDED',
            occurredAt: dt.endedAt,
            title: 'Retorno a producción',
            description: `Duración: ${dt.totalMinutes || '?'} minutos`,
            performedBy: dt.returnToProductionByUser ? {
              id: dt.returnToProductionByUser.id,
              name: dt.returnToProductionByUser.name
            } : undefined,
            metadata: {
              downtimeId: dt.id,
              totalMinutes: dt.totalMinutes
            }
          });
        }
      }
    }

    // 8. Procesar RCA
    if (rcaResult.status === 'fulfilled' && rcaResult.value) {
      const rca = rcaResult.value;
      timeline.push({
        id: `rca-${rca.id}`,
        type: 'RCA_CREATED',
        occurredAt: rca.createdAt,
        title: 'Análisis de Causa Raíz iniciado',
        description: rca.rootCause || 'RCA en progreso',
        performedBy: rca.createdBy ? {
          id: rca.createdBy.id,
          name: rca.createdBy.name
        } : undefined,
        metadata: {
          rcaId: rca.id,
          status: rca.status,
          whysCount: Array.isArray(rca.whys) ? (rca.whys as any[]).length : 0
        }
      });
    }

    // Ordenar timeline por fecha
    timeline.sort((a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    return NextResponse.json({
      occurrence: {
        id: occurrence.id,
        title: occurrence.title,
        status: occurrence.status,
        priority: occurrence.priority,
        machine: occurrence.machine,
        isObservation: occurrence.isObservation
      },
      timeline,
      totalEvents: timeline.length,
      generatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences/[id]/timeline:', error);
    return NextResponse.json(
      { error: 'Error al obtener timeline', detail: error.message },
      { status: 500 }
    );
  }
}
