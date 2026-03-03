/**
 * Helper para registrar eventos de actividad en tareas de agenda
 * Usa el modelo ActivityEvent con entityType: 'AGENDA_TASK'
 */

import { prisma } from '@/lib/prisma';

export type TaskActivityType =
  | 'CREATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED'
  | 'PRIORITY_CHANGED'
  | 'DUE_DATE_CHANGED'
  | 'TITLE_CHANGED'
  | 'COMMENTED'
  | 'SUBTASK_ADDED'
  | 'SUBTASK_COMPLETED'
  | 'COMPLETED'
  | 'REOPENED'
  | 'DELETED'
  | 'DUPLICATED';

interface LogActivityParams {
  taskId: number;
  companyId: number;
  userId: number;
  eventType: TaskActivityType;
  description?: string;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
}

/**
 * Registrar un evento de actividad para una tarea (best-effort, nunca falla)
 */
export async function logTaskActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        entityType: 'AGENDA_TASK',
        entityId: params.taskId,
        companyId: params.companyId,
        eventType: params.eventType,
        description: params.description || null,
        previousValue: params.previousValue || null,
        newValue: params.newValue || null,
        metadata: params.metadata || null,
        performedById: params.userId,
      },
    });
  } catch (error) {
    console.error('[ActivityLogger] Error logging task activity:', error);
  }
}

/**
 * Registrar múltiples cambios de una actualización de tarea
 */
export async function logTaskUpdateActivity(
  taskId: number,
  companyId: number,
  userId: number,
  changes: Record<string, { old: any; new: any }>
): Promise<void> {
  const events: LogActivityParams[] = [];

  if (changes.status) {
    const isCompleted = changes.status.new === 'COMPLETED';
    const isReopened = changes.status.old === 'COMPLETED' && changes.status.new !== 'COMPLETED';
    events.push({
      taskId,
      companyId,
      userId,
      eventType: isCompleted ? 'COMPLETED' : isReopened ? 'REOPENED' : 'STATUS_CHANGED',
      description: `Cambió el estado de ${changes.status.old} a ${changes.status.new}`,
      previousValue: changes.status.old,
      newValue: changes.status.new,
    });
  }

  if (changes.assignedToUserId) {
    events.push({
      taskId,
      companyId,
      userId,
      eventType: 'ASSIGNED',
      description: 'Cambió el asignado',
      previousValue: changes.assignedToUserId.old?.toString(),
      newValue: changes.assignedToUserId.new?.toString(),
    });
  }

  if (changes.priority) {
    events.push({
      taskId,
      companyId,
      userId,
      eventType: 'PRIORITY_CHANGED',
      description: `Cambió la prioridad de ${changes.priority.old} a ${changes.priority.new}`,
      previousValue: changes.priority.old,
      newValue: changes.priority.new,
    });
  }

  if (changes.dueDate) {
    events.push({
      taskId,
      companyId,
      userId,
      eventType: 'DUE_DATE_CHANGED',
      description: 'Cambió la fecha de vencimiento',
      previousValue: changes.dueDate.old,
      newValue: changes.dueDate.new,
    });
  }

  if (changes.title) {
    events.push({
      taskId,
      companyId,
      userId,
      eventType: 'TITLE_CHANGED',
      description: `Cambió el título`,
      previousValue: changes.title.old,
      newValue: changes.title.new,
    });
  }

  for (const event of events) {
    await logTaskActivity(event);
  }
}
