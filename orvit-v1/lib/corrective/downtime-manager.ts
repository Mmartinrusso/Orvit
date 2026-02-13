/**
 * Gestión de Downtime (Tiempo Muerto) y Retorno a Producción
 *
 * Funciones:
 * - handleDowntime: Crea DowntimeLog cuando hay parada de producción
 * - confirmReturnToProduction: Cierra DowntimeLog y confirma retorno
 * - validateCanClose: Valida que WorkOrder puede cerrarse (verifica retorno)
 * - Helper functions para cálculos y queries
 */

import { prisma } from '@/lib/prisma';
import { getCorrectiveSettings } from './qa-rules';
import {
  validate,
  handleDowntimeParamsSchema,
  confirmReturnParamsSchema,
  validateCanCloseParamsSchema
} from './validations';
import { notifyDowntimeStart, notifyDowntimeEnd } from '@/lib/discord/notifications';

export interface HandleDowntimeParams {
  failureOccurrenceId: number;
  workOrderId?: number;
  machineId: number;
  causedDowntime: boolean;
  companyId: number;
  category?: 'UNPLANNED' | 'PLANNED' | 'EXTERNAL';
  reason?: string;
  productionImpact?: string;
}

export interface ConfirmReturnParams {
  downtimeLogId: number;
  workOrderId?: number;
  returnedById: number;
  companyId: number;
  notes?: string;
}

/**
 * Crea DowntimeLog cuando una falla causa parada de producción
 * Marca WorkOrder.requiresReturnToProduction = true
 */
export async function handleDowntime(params: HandleDowntimeParams) {
  // ✅ Validar parámetros
  const validated = validate(handleDowntimeParamsSchema, params);
  const {
    failureOccurrenceId,
    workOrderId,
    machineId,
    causedDowntime,
    companyId,
    category = 'UNPLANNED',
    reason,
    productionImpact
  } = validated;

  // Si no causó downtime, no hacer nada
  if (!causedDowntime) {
    return null;
  }

  // 1. Crear DowntimeLog
  const downtime = await prisma.downtimeLog.create({
    data: {
      failureOccurrenceId,
      workOrderId: workOrderId || null,
      machineId,
      startedAt: new Date(),
      category,
      reason,
      productionImpact,
      companyId
    }
  });

  // 2. Si hay WorkOrder asociada, marcar como requiere retorno a producción
  if (workOrderId) {
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { requiresReturnToProduction: true }
    });
  }

  // 3. Notificación Discord - Downtime iniciado
  // NOTA: Desactivada porque la notificación de "Nueva Falla" ya incluye info de downtime
  // Si se quiere notificación separada de downtime, descomentar el bloque siguiente
  /*
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { name: true, sectorId: true }
    });

    const failure = await prisma.failureOccurrence.findUnique({
      where: { id: failureOccurrenceId },
      select: { id: true, title: true }
    });

    if (machine?.sectorId) {
      await notifyDowntimeStart({
        machineId,
        machineName: machine.name,
        sectorId: machine.sectorId,
        failureId: failure?.id,
        failureTitle: failure?.title,
        startedAt: new Date(),
        cause: reason
      });
    }
  } catch (discordError) {
    console.warn('⚠️ Error enviando notificación Discord downtime:', discordError);
  }
  */

  return downtime;
}

/**
 * Confirma Retorno a Producción:
 * 1. Cierra DowntimeLog (endedAt, totalMinutes)
 * 2. Marca WorkOrder.returnToProductionConfirmed = true
 * 3. Si QA requiere confirmación, también marca QA
 */
export async function confirmReturnToProduction(params: ConfirmReturnParams) {
  // ✅ Validar parámetros
  const validated = validate(confirmReturnParamsSchema, params);
  const { downtimeLogId, workOrderId, returnedById, companyId, notes } = validated;

  // 1. Obtener DowntimeLog
  const downtime = await prisma.downtimeLog.findUnique({
    where: { id: downtimeLogId }
  });

  if (!downtime) {
    throw new Error('DowntimeLog no encontrado');
  }

  if (downtime.endedAt) {
    throw new Error('Este downtime ya fue cerrado');
  }

  // 2. Calcular duración en minutos
  const endedAt = new Date();
  const totalMinutes = Math.round((endedAt.getTime() - downtime.startedAt.getTime()) / 1000 / 60);

  // 3. Cerrar DowntimeLog
  await prisma.downtimeLog.update({
    where: { id: downtimeLogId },
    data: {
      endedAt,
      returnToProductionBy: returnedById,
      returnToProductionAt: endedAt,
      totalMinutes
    }
  });

  // 4. Marcar WorkOrder.returnToProductionConfirmed = true
  if (workOrderId) {
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        returnToProductionConfirmed: true
      }
    });

    // 5. Si QA requiere confirmación de retorno, también marcar
    const qa = await prisma.qualityAssurance.findUnique({
      where: { workOrderId }
    });

    const settings = await getCorrectiveSettings(companyId);

    if (qa && qa.isRequired && settings.requireReturnConfirmationOnQA) {
      await prisma.qualityAssurance.update({
        where: { workOrderId },
        data: {
          returnToProductionConfirmed: true,
          returnConfirmedById: returnedById,
          returnConfirmedAt: endedAt
        }
      });
    }
  }

  // 6. Notificación Discord - Downtime finalizado
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: downtime.machineId },
      select: { name: true, sectorId: true }
    });

    const failure = downtime.failureOccurrenceId
      ? await prisma.failureOccurrence.findUnique({
          where: { id: downtime.failureOccurrenceId },
          select: { id: true, title: true }
        })
      : null;

    if (machine?.sectorId) {
      await notifyDowntimeEnd({
        machineId: downtime.machineId,
        machineName: machine.name,
        sectorId: machine.sectorId,
        failureId: failure?.id,
        failureTitle: failure?.title,
        startedAt: downtime.startedAt,
        endedAt,
        durationMinutes: totalMinutes,
        cause: downtime.reason || undefined
      });
    }
  } catch (discordError) {
    console.warn('⚠️ Error enviando notificación Discord downtime fin:', discordError);
  }

  return {
    downtimeLogId,
    totalMinutes,
    endedAt
  };
}

/**
 * Valida que un WorkOrder puede cerrarse
 * Verifica:
 * 1. Si requiresReturnToProduction=true, debe tener returnToProductionConfirmed=true
 * 2. Todos los DowntimeLogs deben estar cerrados
 * 3. Si QA está activo, debe estar aprobado
 * 4. Si QA requiere confirmación de retorno, debe estar confirmado
 */
export async function validateCanClose(params: {
  workOrderId: number;
  companyId: number;
}): Promise<{ valid: boolean; error?: string }> {
  // ✅ Validar parámetros
  const validated = validate(validateCanCloseParamsSchema, params);
  const { workOrderId, companyId } = validated;

  // Obtener WorkOrder con QA
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      qualityAssurance: true
    }
  });

  if (!workOrder) {
    return { valid: false, error: 'WorkOrder no encontrada' };
  }

  const settings = await getCorrectiveSettings(companyId);

  // ✅ VALIDACIÓN 1: Si requiresReturnToProduction=true, debe estar confirmado
  if (workOrder.requiresReturnToProduction) {
    if (!workOrder.returnToProductionConfirmed) {
      return {
        valid: false,
        error: 'Debe confirmar Retorno a Producción antes de cerrar la orden'
      };
    }

    // Verificar que todos los downtimes estén cerrados
    const openDowntime = await prisma.downtimeLog.findFirst({
      where: {
        workOrderId,
        endedAt: null
      }
    });

    if (openDowntime) {
      return {
        valid: false,
        error: 'Debe cerrar todos los registros de downtime con Retorno a Producción'
      };
    }
  }

  // ✅ VALIDACIÓN 2: Si QA está activo, debe estar aprobado
  if (workOrder.qualityAssurance?.isRequired) {
    if (workOrder.qualityAssurance.status !== 'APPROVED') {
      return {
        valid: false,
        error: `El QA debe estar aprobado antes de cerrar (estado actual: ${workOrder.qualityAssurance.status})`
      };
    }

    // ✅ VALIDACIÓN 3: Si QA requiere confirmación de retorno, verificar
    if (settings.requireReturnConfirmationOnQA) {
      if (!workOrder.qualityAssurance.returnToProductionConfirmed) {
        return {
          valid: false,
          error: 'El QA requiere confirmación de Retorno a Producción antes de cerrar'
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Obtiene todos los downtimes abiertos (sin cerrar) de una WorkOrder
 */
export async function getOpenDowntimes(workOrderId: number) {
  return await prisma.downtimeLog.findMany({
    where: {
      workOrderId,
      endedAt: null
    },
    orderBy: {
      startedAt: 'desc'
    }
  });
}

/**
 * Obtiene todos los downtimes de una WorkOrder (abiertos y cerrados)
 */
export async function getAllDowntimes(workOrderId: number) {
  return await prisma.downtimeLog.findMany({
    where: {
      workOrderId
    },
    orderBy: {
      startedAt: 'desc'
    }
  });
}

/**
 * Calcula el downtime total de una WorkOrder (en minutos)
 */
export async function calculateTotalDowntime(workOrderId: number): Promise<number> {
  const downtimes = await prisma.downtimeLog.findMany({
    where: {
      workOrderId,
      endedAt: { not: null }
    },
    select: {
      totalMinutes: true
    }
  });

  return downtimes.reduce((total, dt) => total + (dt.totalMinutes || 0), 0);
}

/**
 * Obtiene estadísticas de downtime por máquina
 */
export async function getDowntimeStatsByMachine(params: {
  machineId: number;
  companyId: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const { machineId, companyId, startDate, endDate } = params;

  const downtimes = await prisma.downtimeLog.findMany({
    where: {
      machineId,
      companyId,
      endedAt: { not: null },
      ...(startDate && { startedAt: { gte: startDate } }),
      ...(endDate && { startedAt: { lte: endDate } })
    },
    select: {
      totalMinutes: true,
      category: true
    }
  });

  const total = downtimes.reduce((sum, dt) => sum + (dt.totalMinutes || 0), 0);
  const byCategory = downtimes.reduce((acc, dt) => {
    const cat = dt.category || 'UNPLANNED';
    acc[cat] = (acc[cat] || 0) + (dt.totalMinutes || 0);
    return acc;
  }, {} as Record<string, number>);

  return {
    totalMinutes: total,
    totalHours: Math.round(total / 60 * 10) / 10,
    occurrenceCount: downtimes.length,
    byCategory
  };
}

/**
 * Verifica si una falla actualmente tiene downtime activo
 */
export async function hasActiveDowntime(failureOccurrenceId: number): Promise<boolean> {
  const activeDowntime = await prisma.downtimeLog.findFirst({
    where: {
      failureOccurrenceId,
      endedAt: null
    }
  });

  return !!activeDowntime;
}

/**
 * Obtiene el downtime activo de una falla (si existe)
 */
export async function getActiveDowntime(failureOccurrenceId: number) {
  return await prisma.downtimeLog.findFirst({
    where: {
      failureOccurrenceId,
      endedAt: null
    }
  });
}

/**
 * Formatea minutos a formato legible (ej: "2h 30m", "45m")
 */
export function formatDowntimeMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}
