/**
 * CMMS Health Score Calculator
 * Calcula el health score (0-100) de una máquina basado en múltiples factores
 *
 * Factores de penalización:
 * - Fallas últimos 30 días: -5 por falla
 * - PM vencidos: -10 por cada uno
 * - Reincidencias: -15 por reincidencia
 * - Tendencia MTTR empeorando: -10
 * - Downtime alto (>umbral): -5 por cada 1% sobre umbral
 */

import { prisma } from '@/lib/prisma'

export interface HealthScoreFactors {
  baseScore: number
  failuresPenalty: number
  overduePMPenalty: number
  recurrencePenalty: number
  mttrTrendPenalty: number
  downtimePenalty: number
  totalScore: number
  details: {
    failuresLast30Days: number
    overduePMs: number
    recurrences: number
    mttrTrend: 'improving' | 'stable' | 'worsening'
    downtimePercent: number
  }
}

export interface CriticalityScore {
  total: number
  production: number
  safety: number
  quality: number
  cost: number
}

const DOWNTIME_THRESHOLD_PERCENT = 5 // Umbral de downtime aceptable

/**
 * Cuenta PMs vencidos combinando legacy (MaintenanceChecklist) y nuevo (PreventiveInstance)
 */
async function countOverduePMs(machineId: number, now: Date): Promise<number> {
  const [legacyOverdue, preventiveOverdue] = await Promise.all([
    // Legacy: MaintenanceChecklist con nextDueDate pasada
    prisma.maintenanceChecklist.count({
      where: { machineId, nextDueDate: { lt: now }, isActive: true }
    }),
    // Nuevo: PreventiveInstance OVERDUE o PENDING con fecha pasada, para templates de esta máquina
    prisma.preventiveInstance.count({
      where: {
        template: { machineId, isActive: true },
        scheduledDate: { lt: now },
        status: { in: ['PENDING', 'OVERDUE'] }
      }
    })
  ])
  return legacyOverdue + preventiveOverdue
}

/**
 * Calcula el health score de una máquina
 */
export async function calculateHealthScore(machineId: number): Promise<HealthScoreFactors> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  // Ejecutar todas las queries en paralelo para reducir latencia ~5x
  const [
    recentFailures,
    overduePMs,
    recurrences,
    mttrTrend,
    downtimePercent
  ] = await Promise.all([
    // 1. Fallas de los últimos 30 días
    prisma.failureOccurrence.count({
      where: { machineId, reportedAt: { gte: thirtyDaysAgo }, status: { not: 'CANCELLED' } }
    }).catch(e => { console.warn('Could not fetch failure occurrences for health score', e); return 0; }),

    // 2. PMs vencidos (legacy checklists + PreventiveTemplate/Instance)
    countOverduePMs(machineId, now)
      .catch(e => { console.warn('Could not fetch overdue PMs for health score', e); return 0; }),

    // 3. Reincidencias (misma máquina + mismo componente en 7 días)
    detectRecurrences(machineId, thirtyDaysAgo)
      .catch(e => { console.warn('Could not detect recurrences for health score', e); return 0; }),

    // 4. Tendencia de MTTR
    calculateMTTRTrend(machineId, thirtyDaysAgo, sixtyDaysAgo)
      .catch(e => { console.warn('Could not calculate MTTR trend for health score', e); return 'stable' as const; }),

    // 5. Porcentaje de downtime
    calculateDowntimePercent(machineId, thirtyDaysAgo)
      .catch(e => { console.warn('Could not calculate downtime for health score', e); return 0; })
  ]);

  // Calcular penalizaciones
  const failuresPenalty = recentFailures * 5
  const overduePMPenalty = overduePMs * 10
  const recurrencePenalty = recurrences * 15
  const mttrTrendPenalty = mttrTrend === 'worsening' ? 10 : 0
  const downtimePenalty = Math.max(0, Math.floor((downtimePercent - DOWNTIME_THRESHOLD_PERCENT) * 5))

  // Calcular score final (mínimo 0)
  const totalPenalty = failuresPenalty + overduePMPenalty + recurrencePenalty + mttrTrendPenalty + downtimePenalty
  const totalScore = Math.max(0, 100 - totalPenalty)

  return {
    baseScore: 100,
    failuresPenalty,
    overduePMPenalty,
    recurrencePenalty,
    mttrTrendPenalty,
    downtimePenalty,
    totalScore,
    details: {
      failuresLast30Days: recentFailures,
      overduePMs,
      recurrences,
      mttrTrend,
      downtimePercent
    }
  }
}

/**
 * Detecta reincidencias: fallas repetidas en el mismo componente dentro de 7 días
 */
async function detectRecurrences(machineId: number, since: Date): Promise<number> {
  const failures = await prisma.failureOccurrence.findMany({
    where: {
      machineId,
      reportedAt: { gte: since },
      status: { not: 'CANCELLED' }
    },
    select: {
      componentId: true,
      reportedAt: true
    },
    orderBy: { reportedAt: 'asc' }
  })

  let recurrenceCount = 0
  const componentLastFailure: Record<number, Date> = {}

  for (const failure of failures) {
    if (!failure.componentId) continue

    const lastFailure = componentLastFailure[failure.componentId]
    if (lastFailure) {
      const daysDiff = (failure.reportedAt.getTime() - lastFailure.getTime()) / (1000 * 60 * 60 * 24)
      if (daysDiff <= 7) {
        recurrenceCount++
      }
    }
    componentLastFailure[failure.componentId] = failure.reportedAt
  }

  return recurrenceCount
}

/**
 * Calcula la tendencia del MTTR comparando últimos 30 días vs 30-60 días anteriores
 */
async function calculateMTTRTrend(
  machineId: number,
  thirtyDaysAgo: Date,
  sixtyDaysAgo: Date
): Promise<'improving' | 'stable' | 'worsening'> {
  // MTTR reciente (últimos 30 días)
  const recentWOs = await prisma.workOrder.findMany({
    where: {
      machineId,
      completedDate: { gte: thirtyDaysAgo },
      type: 'CORRECTIVE',
      actualHours: { not: null }
    },
    select: { actualHours: true }
  })

  // MTTR anterior (30-60 días)
  const previousWOs = await prisma.workOrder.findMany({
    where: {
      machineId,
      completedDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      type: 'CORRECTIVE',
      actualHours: { not: null }
    },
    select: { actualHours: true }
  })

  const recentMTTR = recentWOs.length > 0
    ? recentWOs.reduce((sum, wo) => sum + (wo.actualHours || 0), 0) / recentWOs.length
    : 0

  const previousMTTR = previousWOs.length > 0
    ? previousWOs.reduce((sum, wo) => sum + (wo.actualHours || 0), 0) / previousWOs.length
    : 0

  // Si no hay datos anteriores, consideramos estable
  if (previousMTTR === 0) return 'stable'

  const changePercent = ((recentMTTR - previousMTTR) / previousMTTR) * 100

  if (changePercent > 20) return 'worsening'
  if (changePercent < -20) return 'improving'
  return 'stable'
}

/**
 * Calcula el porcentaje de downtime de los últimos 30 días
 */
async function calculateDowntimePercent(machineId: number, since: Date): Promise<number> {
  const downtimeLogs = await prisma.downtimeLog.findMany({
    where: {
      machineId,
      startedAt: { gte: since }
    },
    select: {
      startedAt: true,
      endedAt: true
    }
  })

  const totalDowntimeMinutes = downtimeLogs.reduce((sum, log) => {
    const end = log.endedAt || new Date()
    const minutes = (end.getTime() - log.startedAt.getTime()) / (1000 * 60)
    return sum + minutes
  }, 0)

  // Asumiendo operación 24/7, 30 días = 43200 minutos
  const totalMinutesInPeriod = 30 * 24 * 60
  return (totalDowntimeMinutes / totalMinutesInPeriod) * 100
}

/**
 * Calcula el score de criticidad basado en los 4 factores
 */
export function calculateCriticalityScore(
  production: number | null,
  safety: number | null,
  quality: number | null,
  cost: number | null
): number {
  const p = production || 5
  const s = safety || 5
  const q = quality || 5
  const c = cost || 5

  // Ponderación: Producción 40%, Seguridad 30%, Calidad 20%, Costo 10%
  return Math.round((p * 0.4 + s * 0.3 + q * 0.2 + c * 0.1))
}

/**
 * Actualiza el health score de una máquina en la base de datos
 */
export async function updateMachineHealthScore(machineId: number): Promise<HealthScoreFactors> {
  const healthData = await calculateHealthScore(machineId)

  await prisma.machine.update({
    where: { id: machineId },
    data: {
      healthScore: healthData.totalScore,
      healthScoreUpdatedAt: new Date()
    }
  })

  return healthData
}

/**
 * Actualiza el health score de todas las máquinas de una empresa
 */
export async function updateAllMachinesHealthScore(companyId: number): Promise<number> {
  const machines = await prisma.machine.findMany({
    where: { companyId, status: 'ACTIVE' },
    select: { id: true }
  })

  let updated = 0
  for (const machine of machines) {
    try {
      await updateMachineHealthScore(machine.id)
      updated++
    } catch (error) {
      console.error(`Error updating health score for machine ${machine.id}:`, error)
    }
  }

  return updated
}

/**
 * Obtiene el badge de salud según el score
 */
export function getHealthBadge(score: number | null): {
  label: string
  color: 'green' | 'yellow' | 'red' | 'gray'
  emoji: string
} {
  if (score === null) {
    return { label: 'Sin datos', color: 'gray', emoji: '⚪' }
  }
  if (score >= 80) {
    return { label: 'Bueno', color: 'green', emoji: '🟢' }
  }
  if (score >= 50) {
    return { label: 'Regular', color: 'yellow', emoji: '🟡' }
  }
  return { label: 'Crítico', color: 'red', emoji: '🔴' }
}
