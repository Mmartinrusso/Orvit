// ============================================
// Módulo de Métricas para el Asistente IA
// ============================================

import { prisma } from '@/lib/prisma'
import { AssistantContext } from './types'

/**
 * Tipos de métricas disponibles
 */
export type MetricType =
  | 'work_orders_count'
  | 'work_orders_by_status'
  | 'work_orders_by_priority'
  | 'failures_count'
  | 'failures_by_status'
  | 'preventives_pending'
  | 'preventives_overdue'
  | 'machines_count'
  | 'technician_workload'

/**
 * Periodos para comparaciones temporales
 */
export type ComparisonPeriod = 'day' | 'week' | 'month' | 'year'

/**
 * Resultado de una consulta de métricas
 */
export interface MetricsResult {
  type: MetricType
  title: string
  data: Record<string, number | string> | number
  period?: string
  breakdown?: { label: string; value: number }[]
  comparison?: {
    previousPeriod: string
    previousValue: number | Record<string, number>
    change: number // Porcentaje de cambio
    trend: 'up' | 'down' | 'stable'
  }
}

/**
 * Patrones para detectar consultas de métricas
 * IMPORTANTE: Los patrones son flexibles para capturar preguntas coloquiales
 */
const METRIC_PATTERNS: { pattern: RegExp; metrics: MetricType[] }[] = [
  // ============ ESTADO GENERAL / RESUMEN ============
  // "como estamos", "que onda", "como viene", "que hay", etc.
  {
    pattern: /^(che\s*)?(como|que)\s*(andamos|estamos|venimos|va|viene|onda)/i,
    metrics: ['work_orders_by_status', 'failures_by_status', 'preventives_pending'],
  },
  {
    pattern: /(estado|resumen|panorama|situacion|reporte)/i,
    metrics: ['work_orders_by_status', 'failures_by_status', 'preventives_pending', 'preventives_overdue'],
  },
  {
    pattern: /(como\s*esta|que\s*tal)\s*(el\s*)?(dia|hoy|la\s*cosa|todo|mantenimiento)/i,
    metrics: ['work_orders_by_status', 'failures_by_status', 'preventives_pending'],
  },
  {
    pattern: /^(que\s*hay|hay\s*algo|algo\s*nuevo|novedades)/i,
    metrics: ['work_orders_by_status', 'failures_by_status'],
  },

  // ============ OTs / ORDENES DE TRABAJO ============
  // Preguntas directas
  {
    pattern: /(cuant[ao]s?|hay|tenemos|tiene[ns]?)\s*.{0,10}(ot|ordenes?|trabajos?)/i,
    metrics: ['work_orders_count', 'work_orders_by_status'],
  },
  // "ots pendientes", "ordenes abiertas", etc.
  {
    pattern: /(ot|ordenes?)\s*.{0,5}(pendiente|abierta|nueva|sin\s*(cerrar|terminar|completar))/i,
    metrics: ['work_orders_count', 'work_orders_by_status'],
  },
  // "que ots hay", "las ots", "mostrame ots"
  {
    pattern: /(que|las|mostrar?me?|ver|dame)\s*(las\s*)?(ot|ordenes)/i,
    metrics: ['work_orders_count', 'work_orders_by_status'],
  },
  // "hay laburo", "mucho trabajo", "que hay para hacer"
  {
    pattern: /(hay|mucho|poco|cuanto)\s*(laburo|trabajo|para\s*hacer)/i,
    metrics: ['work_orders_count', 'work_orders_by_status', 'technician_workload'],
  },

  // ============ FALLAS ============
  {
    pattern: /(cuant[ao]s?|hay|tenemos|hubieron?|hubo)\s*.{0,10}(falla|problema|incidente|averia)/i,
    metrics: ['failures_count', 'failures_by_status'],
  },
  {
    pattern: /(falla|problema|incidente|averia)s?\s*.{0,5}(abierta|pendiente|sin\s*resolver|nueva)/i,
    metrics: ['failures_count', 'failures_by_status'],
  },
  {
    pattern: /(que|las|mostrar?me?|ver)\s*(las\s*)?(falla|problema|incidente)s?/i,
    metrics: ['failures_count', 'failures_by_status'],
  },
  // "algo roto", "algo fallando", "que se rompio"
  {
    pattern: /(algo|que)\s*(se\s*)?(roto|rompio|fallo|fallando|parado)/i,
    metrics: ['failures_count', 'failures_by_status'],
  },

  // ============ PREVENTIVOS ============
  {
    pattern: /(cuant[ao]s?|hay|tenemos)\s*.{0,10}preventivo/i,
    metrics: ['preventives_pending', 'preventives_overdue'],
  },
  {
    pattern: /preventivos?\s*.{0,5}(pendiente|vencido|atrasado|por\s*hacer)/i,
    metrics: ['preventives_pending', 'preventives_overdue'],
  },
  {
    pattern: /(que|los|mostrar?me?|ver)\s*(los\s*)?preventivos?/i,
    metrics: ['preventives_pending', 'preventives_overdue'],
  },
  // "estamos al dia con preventivos", "atrasados con..."
  {
    pattern: /(al\s*dia|atrasados?|vencidos?)\s*.{0,10}preventivo/i,
    metrics: ['preventives_pending', 'preventives_overdue'],
  },

  // ============ URGENTES / PRIORIDAD ============
  {
    pattern: /(algo|hay|tenemos|que)\s*.{0,5}(urgente|critico|importante|prioritario)/i,
    metrics: ['work_orders_by_priority', 'failures_by_status'],
  },
  {
    pattern: /(urgente|critico|prioridad)s?\s*(hay|pendiente|abierto)?/i,
    metrics: ['work_orders_by_priority'],
  },

  // ============ CARGA DE TRABAJO / TECNICOS ============
  {
    pattern: /(carga|laburo|trabajo)\s*.{0,10}(tecnico|equipo|gente)/i,
    metrics: ['technician_workload'],
  },
  {
    pattern: /(tecnico|quien|quienes?)\s*.{0,10}(mas|menos|libre|ocupado|disponible|cargado)/i,
    metrics: ['technician_workload'],
  },
  {
    pattern: /(como\s*estan?|que\s*tal)\s*(los\s*)?(tecnico|equipo|muchachos|chicos)/i,
    metrics: ['technician_workload'],
  },
  // "a quien le asigno", "quien esta libre"
  {
    pattern: /(quien|a\s*quien)\s*.{0,10}(asigno|asignar|libre|disponible)/i,
    metrics: ['technician_workload'],
  },

  // ============ MAQUINAS / EQUIPOS ============
  {
    pattern: /(cuant[ao]s?|hay|tenemos)\s*.{0,10}(maquina|equipo)/i,
    metrics: ['machines_count'],
  },

  // ============ NUMEROS / METRICAS GENERICAS ============
  // "dame los numeros", "metricas", "estadisticas"
  {
    pattern: /(numeros?|metricas?|estadisticas?|datos|kpis?)/i,
    metrics: ['work_orders_by_status', 'failures_by_status', 'preventives_pending', 'technician_workload'],
  },
]

/**
 * Patrones para detectar solicitudes de comparación temporal
 */
const COMPARISON_PATTERNS: { pattern: RegExp; period: ComparisonPeriod }[] = [
  // Comparación con día anterior
  { pattern: /(comparar?|vs|versus|contra|respecto|diferencia).{0,10}(ayer|dia\s*anterior)/i, period: 'day' },
  { pattern: /(ayer|dia\s*anterior).{0,10}(comparar?|vs|versus|contra)/i, period: 'day' },
  // Comparación con semana anterior
  { pattern: /(comparar?|vs|versus|contra|respecto|diferencia).{0,10}(semana\s*pasada|semana\s*anterior)/i, period: 'week' },
  { pattern: /(semana\s*pasada|semana\s*anterior).{0,10}(comparar?|vs|versus|contra)/i, period: 'week' },
  // Comparación con mes anterior
  { pattern: /(comparar?|vs|versus|contra|respecto|diferencia).{0,10}(mes\s*pasado|mes\s*anterior)/i, period: 'month' },
  { pattern: /(mes\s*pasado|mes\s*anterior).{0,10}(comparar?|vs|versus|contra)/i, period: 'month' },
  { pattern: /como\s*(se\s*)?compara.{0,10}(mes|semana|ayer)/i, period: 'month' },
  // Variaciones comunes
  { pattern: /mejor\s*o\s*peor\s*(que|vs).{0,10}(ayer|semana|mes)/i, period: 'week' },
  { pattern: /(subio|bajo|aumento|disminuyo|cambio).{0,15}(comparado|respecto)/i, period: 'week' },
  { pattern: /tendencia|evolucion|progreso/i, period: 'week' },
]

/**
 * Detecta si el mensaje es una consulta de métricas
 */
export function detectMetricsQuery(message: string): MetricType[] | null {
  const msgLower = message.toLowerCase()

  for (const { pattern, metrics } of METRIC_PATTERNS) {
    if (pattern.test(msgLower)) {
      return metrics
    }
  }

  return null
}

/**
 * Detecta si el mensaje solicita una comparación temporal
 */
export function detectComparisonRequest(message: string): ComparisonPeriod | null {
  const msgLower = message.toLowerCase()

  for (const { pattern, period } of COMPARISON_PATTERNS) {
    if (pattern.test(msgLower)) {
      return period
    }
  }

  return null
}

/**
 * Obtiene métricas de órdenes de trabajo
 */
async function getWorkOrderMetrics(
  context: AssistantContext,
  options: { period?: 'today' | 'week' | 'month' | 'all' } = {}
): Promise<MetricsResult[]> {
  const { period = 'all' } = options
  const results: MetricsResult[] = []

  // Calcular rango de fechas
  let dateFilter: { gte?: Date } = {}
  const now = new Date()

  if (period === 'today') {
    dateFilter.gte = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (period === 'week') {
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    dateFilter.gte = weekAgo
  } else if (period === 'month') {
    const monthAgo = new Date(now)
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    dateFilter.gte = monthAgo
  }

  // Conteo por estado
  const statusCounts = await prisma.workOrder.groupBy({
    by: ['status'],
    where: {
      companyId: context.companyId,
      ...(dateFilter.gte ? { createdAt: dateFilter } : {}),
    },
    _count: { id: true },
  })

  const statusMap: Record<string, number> = {}
  let total = 0
  let pending = 0

  for (const item of statusCounts) {
    statusMap[item.status] = item._count.id
    total += item._count.id
    if (['INCOMING', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING'].includes(item.status)) {
      pending += item._count.id
    }
  }

  results.push({
    type: 'work_orders_by_status',
    title: 'Órdenes de Trabajo por Estado',
    data: { total, pendientes: pending, completadas: statusMap['COMPLETED'] || 0 },
    period: period === 'all' ? 'Total' : period === 'today' ? 'Hoy' : period === 'week' ? 'Última semana' : 'Último mes',
    breakdown: [
      { label: 'Nuevas', value: statusMap['INCOMING'] || 0 },
      { label: 'Pendientes', value: statusMap['PENDING'] || 0 },
      { label: 'Planificadas', value: statusMap['SCHEDULED'] || 0 },
      { label: 'En progreso', value: statusMap['IN_PROGRESS'] || 0 },
      { label: 'En espera', value: statusMap['WAITING'] || 0 },
      { label: 'Completadas', value: statusMap['COMPLETED'] || 0 },
      { label: 'Canceladas', value: statusMap['CANCELLED'] || 0 },
    ].filter(b => b.value > 0),
  })

  // Conteo por prioridad (solo pendientes)
  const priorityCounts = await prisma.workOrder.groupBy({
    by: ['priority'],
    where: {
      companyId: context.companyId,
      status: { in: ['INCOMING', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING'] },
    },
    _count: { id: true },
  })

  const priorityMap: Record<string, number> = {}
  for (const item of priorityCounts) {
    priorityMap[item.priority] = item._count.id
  }

  results.push({
    type: 'work_orders_by_priority',
    title: 'OTs Pendientes por Prioridad',
    data: priorityMap,
    breakdown: [
      { label: 'Urgentes', value: priorityMap['URGENT'] || 0 },
      { label: 'Alta', value: priorityMap['HIGH'] || 0 },
      { label: 'Media', value: priorityMap['MEDIUM'] || 0 },
      { label: 'Baja', value: priorityMap['LOW'] || 0 },
    ].filter(b => b.value > 0),
  })

  return results
}

/**
 * Obtiene métricas de fallas
 */
async function getFailureMetrics(
  context: AssistantContext,
  options: { period?: 'today' | 'week' | 'month' | 'all' } = {}
): Promise<MetricsResult[]> {
  const { period = 'month' } = options
  const results: MetricsResult[] = []

  // Calcular rango de fechas
  let dateFilter: { gte?: Date } = {}
  const now = new Date()

  if (period === 'today') {
    dateFilter.gte = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (period === 'week') {
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    dateFilter.gte = weekAgo
  } else if (period === 'month') {
    const monthAgo = new Date(now)
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    dateFilter.gte = monthAgo
  }

  // Conteo por estado
  const statusCounts = await prisma.failureOccurrence.groupBy({
    by: ['status'],
    where: {
      companyId: context.companyId,
      ...(dateFilter.gte ? { createdAt: dateFilter } : {}),
    },
    _count: { id: true },
  })

  const statusMap: Record<string, number> = {}
  let total = 0

  for (const item of statusCounts) {
    const status = item.status || 'OPEN'
    statusMap[status] = item._count.id
    total += item._count.id
  }

  results.push({
    type: 'failures_by_status',
    title: 'Fallas por Estado',
    data: { total, abiertas: statusMap['OPEN'] || 0, resueltas: statusMap['RESOLVED'] || 0 },
    period: period === 'all' ? 'Total' : period === 'today' ? 'Hoy' : period === 'week' ? 'Última semana' : 'Último mes',
    breakdown: [
      { label: 'Abiertas', value: statusMap['OPEN'] || 0 },
      { label: 'En progreso', value: statusMap['IN_PROGRESS'] || 0 },
      { label: 'Resueltas', value: statusMap['RESOLVED'] || 0 },
    ].filter(b => b.value > 0),
  })

  return results
}

/**
 * Obtiene métricas de preventivos
 */
async function getPreventiveMetrics(context: AssistantContext): Promise<MetricsResult[]> {
  const results: MetricsResult[] = []
  const now = new Date()
  const weekFromNow = new Date(now)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  // Preventivos pendientes esta semana
  const pendingThisWeek = await prisma.fixedTaskExecution.count({
    where: {
      fixedTask: { companyId: context.companyId },
      status: 'PENDING',
      executedAt: { lte: weekFromNow },
    },
  })

  // Preventivos vencidos (pasaron la fecha y siguen pendientes)
  const overdue = await prisma.fixedTaskExecution.count({
    where: {
      fixedTask: { companyId: context.companyId },
      status: 'PENDING',
      executedAt: { lt: now },
    },
  })

  // Total de tareas preventivas activas
  const totalTasks = await prisma.fixedTask.count({
    where: {
      companyId: context.companyId,
      isActive: true,
    },
  })

  results.push({
    type: 'preventives_pending',
    title: 'Preventivos Pendientes',
    data: {
      pendientes_semana: pendingThisWeek,
      vencidos: overdue,
      tareas_activas: totalTasks,
    },
    breakdown: [
      { label: 'Pendientes esta semana', value: pendingThisWeek },
      { label: 'Vencidos', value: overdue },
    ],
  })

  return results
}

/**
 * Obtiene carga de trabajo por técnico
 */
async function getTechnicianWorkload(context: AssistantContext): Promise<MetricsResult[]> {
  const results: MetricsResult[] = []

  // OTs asignadas por técnico (solo pendientes)
  const workload = await prisma.workOrder.groupBy({
    by: ['assignedToId'],
    where: {
      companyId: context.companyId,
      status: { in: ['INCOMING', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING'] },
      assignedToId: { not: null },
    },
    _count: { id: true },
  })

  // Obtener nombres de técnicos
  const technicianIds = workload.map(w => w.assignedToId).filter((id): id is number => id !== null)

  const technicians = await prisma.user.findMany({
    where: { id: { in: technicianIds } },
    select: { id: true, name: true },
  })

  const technicianMap = new Map(technicians.map(t => [t.id, t.name]))

  const breakdown = workload
    .map(w => ({
      label: technicianMap.get(w.assignedToId!) || `Técnico ${w.assignedToId}`,
      value: w._count.id,
    }))
    .sort((a, b) => b.value - a.value)

  // OTs sin asignar
  const unassigned = await prisma.workOrder.count({
    where: {
      companyId: context.companyId,
      status: { in: ['INCOMING', 'PENDING'] },
      assignedToId: null,
    },
  })

  if (unassigned > 0) {
    breakdown.push({ label: 'Sin asignar', value: unassigned })
  }

  results.push({
    type: 'technician_workload',
    title: 'Carga de Trabajo por Técnico',
    data: { total_ots_pendientes: breakdown.reduce((sum, b) => sum + b.value, 0) },
    breakdown,
  })

  return results
}

/**
 * Obtiene métricas según los tipos solicitados
 */
export async function getMetrics(
  context: AssistantContext,
  metricTypes: MetricType[]
): Promise<MetricsResult[]> {
  const results: MetricsResult[] = []

  const uniqueTypes = Array.from(new Set(metricTypes))

  for (const type of uniqueTypes) {
    try {
      switch (type) {
        case 'work_orders_count':
        case 'work_orders_by_status':
        case 'work_orders_by_priority':
          const woMetrics = await getWorkOrderMetrics(context)
          results.push(...woMetrics)
          break

        case 'failures_count':
        case 'failures_by_status':
          const failureMetrics = await getFailureMetrics(context)
          results.push(...failureMetrics)
          break

        case 'preventives_pending':
        case 'preventives_overdue':
          const preventiveMetrics = await getPreventiveMetrics(context)
          results.push(...preventiveMetrics)
          break

        case 'machines_count':
          const machineCount = await prisma.machine.count({
            where: { companyId: context.companyId },
          })
          results.push({
            type: 'machines_count',
            title: 'Total de Máquinas',
            data: machineCount,
          })
          break

        case 'technician_workload':
          const workloadMetrics = await getTechnicianWorkload(context)
          results.push(...workloadMetrics)
          break
      }
    } catch (error) {
      console.error(`[Metrics] Error getting ${type}:`, error)
    }
  }

  // Eliminar duplicados por tipo
  const seen = new Set<string>()
  return results.filter(r => {
    if (seen.has(r.type)) return false
    seen.add(r.type)
    return true
  })
}

/**
 * Calcula métricas con comparación temporal
 */
export async function getMetricsWithComparison(
  context: AssistantContext,
  metricTypes: MetricType[],
  comparisonPeriod: ComparisonPeriod
): Promise<MetricsResult[]> {
  const results: MetricsResult[] = []
  const now = new Date()

  // Calcular rangos de fecha para periodo actual y anterior
  const periodRanges = getPeriodRanges(now, comparisonPeriod)

  for (const type of Array.from(new Set(metricTypes))) {
    try {
      if (type === 'work_orders_count' || type === 'work_orders_by_status') {
        // OTs actuales
        const currentOTs = await prisma.workOrder.count({
          where: {
            companyId: context.companyId,
            createdAt: { gte: periodRanges.current.start, lte: periodRanges.current.end },
          },
        })

        // OTs periodo anterior
        const previousOTs = await prisma.workOrder.count({
          where: {
            companyId: context.companyId,
            createdAt: { gte: periodRanges.previous.start, lte: periodRanges.previous.end },
          },
        })

        const change = previousOTs > 0 ? ((currentOTs - previousOTs) / previousOTs) * 100 : 0

        results.push({
          type: 'work_orders_count',
          title: 'Órdenes de Trabajo - Comparación',
          data: { actual: currentOTs, anterior: previousOTs },
          period: periodRanges.currentLabel,
          comparison: {
            previousPeriod: periodRanges.previousLabel,
            previousValue: previousOTs,
            change: Math.round(change),
            trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
          },
        })
      }

      if (type === 'failures_count' || type === 'failures_by_status') {
        // Fallas actuales
        const currentFailures = await prisma.failureOccurrence.count({
          where: {
            companyId: context.companyId,
            createdAt: { gte: periodRanges.current.start, lte: periodRanges.current.end },
          },
        })

        // Fallas periodo anterior
        const previousFailures = await prisma.failureOccurrence.count({
          where: {
            companyId: context.companyId,
            createdAt: { gte: periodRanges.previous.start, lte: periodRanges.previous.end },
          },
        })

        const change = previousFailures > 0 ? ((currentFailures - previousFailures) / previousFailures) * 100 : 0

        results.push({
          type: 'failures_count',
          title: 'Fallas - Comparación',
          data: { actual: currentFailures, anterior: previousFailures },
          period: periodRanges.currentLabel,
          comparison: {
            previousPeriod: periodRanges.previousLabel,
            previousValue: previousFailures,
            change: Math.round(change),
            trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
          },
        })
      }
    } catch (error) {
      console.error(`[Metrics] Error getting comparison for ${type}:`, error)
    }
  }

  return results
}

/**
 * Obtiene rangos de fechas para comparación
 */
function getPeriodRanges(now: Date, period: ComparisonPeriod) {
  const current = { start: new Date(), end: new Date() }
  const previous = { start: new Date(), end: new Date() }
  let currentLabel = ''
  let previousLabel = ''

  switch (period) {
    case 'day':
      // Hoy vs ayer
      current.start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      current.end = now
      previous.start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      previous.end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      currentLabel = 'Hoy'
      previousLabel = 'Ayer'
      break

    case 'week':
      // Esta semana vs semana pasada
      const dayOfWeek = now.getDay()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - dayOfWeek)
      startOfWeek.setHours(0, 0, 0, 0)

      current.start = startOfWeek
      current.end = now

      const startOfLastWeek = new Date(startOfWeek)
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)
      previous.start = startOfLastWeek
      previous.end = startOfWeek

      currentLabel = 'Esta semana'
      previousLabel = 'Semana pasada'
      break

    case 'month':
      // Este mes vs mes pasado
      current.start = new Date(now.getFullYear(), now.getMonth(), 1)
      current.end = now

      previous.start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      previous.end = new Date(now.getFullYear(), now.getMonth(), 0)

      currentLabel = 'Este mes'
      previousLabel = 'Mes pasado'
      break

    case 'year':
      // Este año vs año pasado
      current.start = new Date(now.getFullYear(), 0, 1)
      current.end = now

      previous.start = new Date(now.getFullYear() - 1, 0, 1)
      previous.end = new Date(now.getFullYear() - 1, 11, 31)

      currentLabel = 'Este año'
      previousLabel = 'Año pasado'
      break
  }

  return { current, previous, currentLabel, previousLabel }
}

/**
 * Formatea métricas para el LLM
 */
export function formatMetricsForLLM(metrics: MetricsResult[]): string {
  if (metrics.length === 0) return ''

  const parts: string[] = ['MÉTRICAS DEL SISTEMA:']

  for (const metric of metrics) {
    parts.push(`\n## ${metric.title}${metric.period ? ` (${metric.period})` : ''}`)

    if (typeof metric.data === 'number') {
      parts.push(`Total: ${metric.data}`)
    } else {
      for (const [key, value] of Object.entries(metric.data)) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        parts.push(`- ${label}: ${value}`)
      }
    }

    if (metric.breakdown && metric.breakdown.length > 0) {
      parts.push('\nDesglose:')
      for (const item of metric.breakdown) {
        parts.push(`  • ${item.label}: ${item.value}`)
      }
    }

    // Agregar información de comparación si existe
    if (metric.comparison) {
      const { previousPeriod, previousValue, change, trend } = metric.comparison
      const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️'
      const trendText = trend === 'up' ? 'aumentó' : trend === 'down' ? 'disminuyó' : 'se mantuvo'

      parts.push(`\n📊 Comparación con ${previousPeriod}:`)
      if (typeof previousValue === 'number') {
        parts.push(`  • Valor anterior: ${previousValue}`)
      }
      parts.push(`  • ${trendIcon} ${trendText} ${Math.abs(change)}%`)
    }
  }

  return parts.join('\n')
}
