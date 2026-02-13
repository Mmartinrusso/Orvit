/**
 * Cola de Procesamiento de Audio para Reporte de Fallas
 *
 * Sistema de cola en memoria para procesar audios de forma asíncrona.
 * Evita bloquear el listener de Discord y maneja timeouts.
 */

import { prisma } from '@/lib/prisma'

// Cola de procesamiento
interface QueueItem {
  logId: number
  addedAt: Date
}

const processingQueue: QueueItem[] = []
let isProcessing = false
let workerStarted = false

// Callback para procesar un item (se inyecta desde failure-voice-handler)
let processCallback: ((logId: number) => Promise<void>) | null = null

// Configuración
const CONFIG = {
  maxConcurrent: 1, // Procesar uno a la vez por simplicidad
  maxRetries: 2,
  retryDelayMs: 5000,
  maxQueueSize: 50,
  processingTimeoutMs: 120000, // 2 minutos máximo por audio
}

/**
 * Registra el callback de procesamiento
 * Debe llamarse antes de usar la cola
 */
export function setProcessCallback(callback: (logId: number) => Promise<void>): void {
  processCallback = callback
  console.log('[FailureVoiceQueue] Callback de procesamiento registrado')
}

/**
 * Agrega un log a la cola de procesamiento
 */
export function enqueueVoiceFailure(logId: number): boolean {
  // Verificar tamaño de cola
  if (processingQueue.length >= CONFIG.maxQueueSize) {
    console.warn('[FailureVoiceQueue] Cola llena, rechazando logId:', logId)
    return false
  }

  // Verificar si ya está en cola
  if (processingQueue.some(item => item.logId === logId)) {
    console.log('[FailureVoiceQueue] LogId ya en cola:', logId)
    return true
  }

  processingQueue.push({
    logId,
    addedAt: new Date(),
  })

  console.log(`[FailureVoiceQueue] Encolado logId: ${logId}, tamaño cola: ${processingQueue.length}`)

  // Iniciar procesamiento si no está corriendo
  if (!isProcessing) {
    processNext()
  }

  return true
}

/**
 * Procesa el siguiente item de la cola
 */
async function processNext(): Promise<void> {
  if (processingQueue.length === 0) {
    isProcessing = false
    console.log('[FailureVoiceQueue] Cola vacía, worker detenido')
    return
  }

  if (!processCallback) {
    console.error('[FailureVoiceQueue] No hay callback registrado!')
    isProcessing = false
    return
  }

  isProcessing = true
  const item = processingQueue.shift()!

  console.log(`[FailureVoiceQueue] Procesando logId: ${item.logId}`)

  try {
    // Actualizar estado a PROCESSING
    await prisma.voiceFailureLog.update({
      where: { id: item.logId },
      data: {
        status: 'PROCESSING',
        processingStartedAt: new Date(),
      },
    })

    // Timeout para el procesamiento
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout de procesamiento')), CONFIG.processingTimeoutMs)
    })

    // Procesar con timeout
    await Promise.race([processCallback(item.logId), timeoutPromise])

    console.log(`[FailureVoiceQueue] Completado logId: ${item.logId}`)
  } catch (error: any) {
    console.error(`[FailureVoiceQueue] Error procesando logId ${item.logId}:`, error)

    // Verificar si debe reintentar
    const log = await prisma.voiceFailureLog.findUnique({
      where: { id: item.logId },
      select: { retryCount: true },
    })

    if (log && log.retryCount < CONFIG.maxRetries) {
      // Incrementar retry y re-encolar
      await prisma.voiceFailureLog.update({
        where: { id: item.logId },
        data: {
          retryCount: { increment: 1 },
          status: 'PENDING',
          errorMessage: `Reintento ${log.retryCount + 1}: ${error.message}`,
        },
      })

      // Re-encolar con delay
      setTimeout(() => {
        enqueueVoiceFailure(item.logId)
      }, CONFIG.retryDelayMs)

      console.log(`[FailureVoiceQueue] Re-encolado logId ${item.logId} para reintento ${log.retryCount + 1}`)
    } else {
      // Marcar como fallido definitivamente
      await prisma.voiceFailureLog.update({
        where: { id: item.logId },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Error en procesamiento',
          processedAt: new Date(),
        },
      })
    }
  }

  // Pequeña pausa entre procesos
  await new Promise(resolve => setTimeout(resolve, 500))

  // Procesar siguiente
  processNext()
}

/**
 * Obtiene el estado actual de la cola
 */
export function getQueueStatus(): {
  queueLength: number
  isProcessing: boolean
  items: { logId: number; waitingMs: number }[]
} {
  const now = Date.now()
  return {
    queueLength: processingQueue.length,
    isProcessing,
    items: processingQueue.map(item => ({
      logId: item.logId,
      waitingMs: now - item.addedAt.getTime(),
    })),
  }
}

/**
 * Limpia la cola (para emergencias)
 */
export function clearQueue(): number {
  const cleared = processingQueue.length
  processingQueue.length = 0
  console.log(`[FailureVoiceQueue] Cola limpiada, ${cleared} items removidos`)
  return cleared
}

/**
 * Reprocesa logs fallidos
 */
export async function reprocessFailedLogs(companyId?: number): Promise<number> {
  const where: any = { status: 'FAILED' }
  if (companyId) {
    where.companyId = companyId
  }

  const failedLogs = await prisma.voiceFailureLog.findMany({
    where,
    select: { id: true },
    take: 10, // Máximo 10 a la vez
    orderBy: { createdAt: 'desc' },
  })

  let enqueued = 0
  for (const log of failedLogs) {
    // Resetear estado
    await prisma.voiceFailureLog.update({
      where: { id: log.id },
      data: {
        status: 'PENDING',
        errorMessage: null,
        retryCount: 0,
      },
    })

    if (enqueueVoiceFailure(log.id)) {
      enqueued++
    }
  }

  console.log(`[FailureVoiceQueue] Reprocesando ${enqueued} logs fallidos`)
  return enqueued
}

/**
 * Inicia el worker de la cola
 * Debe llamarse al iniciar la aplicación si hay items pendientes
 */
export async function startQueueWorker(): Promise<void> {
  if (workerStarted) {
    console.log('[FailureVoiceQueue] Worker ya iniciado')
    return
  }

  workerStarted = true
  console.log('[FailureVoiceQueue] Iniciando worker...')

  // Buscar logs pendientes que quedaron de una sesión anterior
  const pendingLogs = await prisma.voiceFailureLog.findMany({
    where: {
      status: { in: ['PENDING', 'PROCESSING', 'QUEUED'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: CONFIG.maxQueueSize,
  })

  if (pendingLogs.length > 0) {
    console.log(`[FailureVoiceQueue] Encontrados ${pendingLogs.length} logs pendientes`)

    // Resetear los que estaban en PROCESSING (probablemente fallaron)
    await prisma.voiceFailureLog.updateMany({
      where: { status: 'PROCESSING' },
      data: { status: 'PENDING' },
    })

    // Encolar todos
    for (const log of pendingLogs) {
      enqueueVoiceFailure(log.id)
    }
  }
}

/**
 * Detiene el worker
 */
export function stopQueueWorker(): void {
  workerStarted = false
  isProcessing = false
  console.log('[FailureVoiceQueue] Worker detenido')
}
