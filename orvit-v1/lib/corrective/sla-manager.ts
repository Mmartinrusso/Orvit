/**
 * P4: Sistema de SLA y Escalamiento Automático
 *
 * Gestiona:
 * - Cálculo de deadlines basados en prioridad
 * - Detección de violaciones de SLA
 * - Escalamiento automático (notificación, cambio de prioridad)
 */

import { prisma } from '@/lib/prisma';

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export interface SLAConfig {
  slaP1Hours: number;
  slaP2Hours: number;
  slaP3Hours: number;
  slaP4Hours: number;
}

export interface SLAStatus {
  priority: Priority;
  slaHours: number;
  deadline: Date;
  isOverdue: boolean;
  timeRemaining: number | null; // minutos, null si ya venció
  percentUsed: number;
  escalationLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OVERDUE';
}

export interface EscalationResult {
  escalated: boolean;
  newPriority?: Priority;
  notificationsSent: string[];
  reason: string;
}

/**
 * Obtiene configuración de SLA para una empresa
 */
export async function getSLAConfig(companyId: number): Promise<SLAConfig> {
  const settings = await prisma.correctiveSettings.findUnique({
    where: { companyId }
  });

  return {
    slaP1Hours: settings?.slaP1Hours ?? 4,    // 4 horas default
    slaP2Hours: settings?.slaP2Hours ?? 8,    // 8 horas default
    slaP3Hours: settings?.slaP3Hours ?? 24,   // 24 horas default
    slaP4Hours: settings?.slaP4Hours ?? 72,   // 72 horas default
  };
}

/**
 * Obtiene horas de SLA para una prioridad
 */
export function getSLAHoursForPriority(config: SLAConfig, priority: Priority | string): number {
  const normalizedPriority = normalizePriority(priority);

  switch (normalizedPriority) {
    case 'P1':
      return config.slaP1Hours;
    case 'P2':
      return config.slaP2Hours;
    case 'P3':
      return config.slaP3Hours;
    case 'P4':
      return config.slaP4Hours;
    default:
      return config.slaP3Hours; // Default a P3
  }
}

/**
 * Normaliza prioridad legacy (URGENT/HIGH/MEDIUM/LOW) a P1-P4
 */
function normalizePriority(priority: Priority | string): Priority {
  if (['P1', 'P2', 'P3', 'P4'].includes(priority)) {
    return priority as Priority;
  }

  const mapping: Record<string, Priority> = {
    'URGENT': 'P1',
    'HIGH': 'P2',
    'MEDIUM': 'P3',
    'LOW': 'P4'
  };

  return mapping[priority.toUpperCase()] ?? 'P3';
}

/**
 * Calcula el deadline de SLA basado en la fecha de creación y prioridad
 */
export function calculateSLADeadline(createdAt: Date, slaHours: number): Date {
  const deadline = new Date(createdAt);
  deadline.setHours(deadline.getHours() + slaHours);
  return deadline;
}

/**
 * Calcula el estado actual de SLA de una OT/Falla
 */
export function calculateSLAStatus(
  createdAt: Date,
  priority: Priority | string,
  config: SLAConfig,
  resolvedAt?: Date | null
): SLAStatus {
  const normalizedPriority = normalizePriority(priority);
  const slaHours = getSLAHoursForPriority(config, normalizedPriority);
  const deadline = calculateSLADeadline(createdAt, slaHours);

  const now = resolvedAt || new Date();
  const isOverdue = now > deadline;

  // Tiempo restante en minutos
  const timeRemaining = isOverdue
    ? null
    : Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60));

  // Porcentaje del SLA usado
  const totalMinutes = slaHours * 60;
  const usedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
  const percentUsed = Math.min(Math.round((usedMinutes / totalMinutes) * 100), 100);

  // Nivel de escalamiento
  let escalationLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OVERDUE';
  if (isOverdue) {
    escalationLevel = 'OVERDUE';
  } else if (percentUsed >= 90) {
    escalationLevel = 'CRITICAL';
  } else if (percentUsed >= 75) {
    escalationLevel = 'WARNING';
  } else {
    escalationLevel = 'NORMAL';
  }

  return {
    priority: normalizedPriority,
    slaHours,
    deadline,
    isOverdue,
    timeRemaining,
    percentUsed,
    escalationLevel
  };
}

/**
 * Procesa escalamiento automático para una OT
 */
export async function processEscalation(params: {
  workOrderId: number;
  slaStatus: SLAStatus;
  companyId: number;
}): Promise<EscalationResult> {
  const { workOrderId, slaStatus, companyId } = params;
  const notificationsSent: string[] = [];

  // Si no hay problema de SLA, no escalar
  if (slaStatus.escalationLevel === 'NORMAL') {
    return {
      escalated: false,
      notificationsSent: [],
      reason: 'SLA dentro de límites normales'
    };
  }

  // Obtener la OT
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });

  if (!workOrder) {
    return {
      escalated: false,
      notificationsSent: [],
      reason: 'Orden de trabajo no encontrada'
    };
  }

  let newPriority: Priority | undefined;

  // Escalamiento según nivel
  switch (slaStatus.escalationLevel) {
    case 'WARNING':
      // Notificar al técnico asignado
      if (workOrder.assignedTo) {
        await createNotification({
          userId: workOrder.assignedTo.id,
          type: 'SLA_WARNING',
          title: 'SLA próximo a vencer',
          message: `La OT #${workOrderId} tiene ${slaStatus.timeRemaining} minutos restantes`,
          workOrderId,
          companyId
        });
        notificationsSent.push(`Técnico: ${workOrder.assignedTo.name}`);
      }
      break;

    case 'CRITICAL':
      // Notificar al técnico y al creador
      if (workOrder.assignedTo) {
        await createNotification({
          userId: workOrder.assignedTo.id,
          type: 'SLA_CRITICAL',
          title: 'SLA CRÍTICO',
          message: `La OT #${workOrderId} está en estado crítico (${slaStatus.percentUsed}% del SLA)`,
          workOrderId,
          companyId
        });
        notificationsSent.push(`Técnico: ${workOrder.assignedTo.name}`);
      }

      if (workOrder.createdBy) {
        await createNotification({
          userId: workOrder.createdBy.id,
          type: 'SLA_CRITICAL',
          title: 'SLA crítico en OT que creaste',
          message: `La OT #${workOrderId} está próxima a vencer su SLA`,
          workOrderId,
          companyId
        });
        notificationsSent.push(`Creador: ${workOrder.createdBy.name}`);
      }
      break;

    case 'OVERDUE':
      // Escalar prioridad si es P3 o P4
      if (slaStatus.priority === 'P3') {
        newPriority = 'P2';
      } else if (slaStatus.priority === 'P4') {
        newPriority = 'P3';
      }

      // Actualizar prioridad si cambió
      if (newPriority) {
        await prisma.workOrder.update({
          where: { id: workOrderId },
          data: {
            priority: newPriority === 'P1' ? 'URGENT' :
                      newPriority === 'P2' ? 'HIGH' :
                      newPriority === 'P3' ? 'MEDIUM' : 'LOW',
            notes: prisma.$queryRaw`CONCAT(COALESCE(notes, ''), '\n[ESCALADO] SLA vencido - prioridad aumentada automáticamente')`
          }
        }).catch(() => {
          // Fallback sin CONCAT
          return prisma.workOrder.update({
            where: { id: workOrderId },
            data: {
              priority: newPriority === 'P1' ? 'URGENT' :
                        newPriority === 'P2' ? 'HIGH' :
                        newPriority === 'P3' ? 'MEDIUM' : 'LOW'
            }
          });
        });
      }

      // Notificar a supervisores del área
      const supervisors = await prisma.userOnCompany.findMany({
        where: {
          companyId,
          role: {
            name: { contains: 'Supervisor', mode: 'insensitive' }
          }
        },
        include: {
          user: { select: { id: true, name: true } }
        },
        take: 3
      });

      for (const sup of supervisors) {
        await createNotification({
          userId: sup.userId,
          type: 'SLA_OVERDUE',
          title: 'SLA VENCIDO',
          message: `La OT #${workOrderId} ha superado su SLA${newPriority ? ` (escalada a ${newPriority})` : ''}`,
          workOrderId,
          companyId
        });
        notificationsSent.push(`Supervisor: ${sup.user.name}`);
      }
      break;
  }

  return {
    escalated: slaStatus.escalationLevel !== 'NORMAL',
    newPriority,
    notificationsSent,
    reason: `Escalamiento ${slaStatus.escalationLevel}: ${slaStatus.percentUsed}% del SLA usado`
  };
}

/**
 * Crea una notificación en el sistema
 */
async function createNotification(params: {
  userId: number;
  type: string;
  title: string;
  message: string;
  workOrderId: number;
  companyId: number;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: JSON.stringify({ workOrderId: params.workOrderId }),
        isRead: false,
        companyId: params.companyId
      }
    });
  } catch (error) {
    console.warn('⚠️ Error creando notificación:', error);
  }
}

/**
 * Obtiene OTs con SLA próximo a vencer o vencido
 */
export async function getWorkOrdersWithSLAIssues(companyId: number): Promise<{
  warning: any[];
  critical: any[];
  overdue: any[];
}> {
  const config = await getSLAConfig(companyId);

  // Obtener OTs abiertas
  const workOrders = await prisma.workOrder.findMany({
    where: {
      companyId,
      status: { in: ['PENDING', 'IN_PROGRESS'] }
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      machine: { select: { id: true, name: true } },
      failureOccurrences: { select: { id: true, priority: true } }
    }
  });

  const warning: any[] = [];
  const critical: any[] = [];
  const overdue: any[] = [];

  for (const wo of workOrders) {
    // Usar prioridad de FailureOccurrence si existe, sino la de WorkOrder
    const priority = wo.failureOccurrences[0]?.priority || wo.priority;
    const slaStatus = calculateSLAStatus(wo.createdAt, priority, config);

    const woWithSLA = {
      ...wo,
      slaStatus
    };

    switch (slaStatus.escalationLevel) {
      case 'WARNING':
        warning.push(woWithSLA);
        break;
      case 'CRITICAL':
        critical.push(woWithSLA);
        break;
      case 'OVERDUE':
        overdue.push(woWithSLA);
        break;
    }
  }

  return { warning, critical, overdue };
}
