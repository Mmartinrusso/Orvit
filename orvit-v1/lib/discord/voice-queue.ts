/**
 * Cola de Procesamiento de Audio para Pedidos de Compra
 *
 * Sistema de cola en memoria para procesar audios de forma asíncrona.
 * Evita bloquear el listener de Discord y maneja timeouts.
 */

import { prisma } from '@/lib/prisma'
import { processVoicePurchase } from './voice-handler'

// Cola de procesamiento
interface QueueItem {
  logId: number
  addedAt: Date
}

const processingQueue: QueueItem[] = []
let isProcessing = false
let workerStarted = false

// Configuración
const CONFIG = {
  maxConcurrent: 1, // Procesar uno a la vez por simplicidad
  maxRetries: 2,
  retryDelayMs: 5000,
  maxQueueSize: 50,
  processingTimeoutMs: 120000, // 2 minutos máximo por audio
}

/**
 * Agrega un log a la cola de procesamiento
 */
export function enqueueVoicePurchase(logId: number): boolean {
  // Verificar tamaño de cola
  if (processingQueue.length >= CONFIG.maxQueueSize) {
    console.warn('[VoiceQueue] Cola llena, rechazando logId:', logId)
    return false
  }

  // Verificar si ya está en cola
  if (processingQueue.some(item => item.logId === logId)) {
    console.log('[VoiceQueue] LogId ya en cola:', logId)
    return true
  }

  processingQueue.push({
    logId,
    addedAt: new Date(),
  })

  console.log(`[VoiceQueue] Encolado logId: ${logId}, tamaño cola: ${processingQueue.length}`)

  // Iniciar worker si no está corriendo
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
    console.log('[VoiceQueue] Cola vacía, worker detenido')
    return
  }

  isProcessing = true
  const item = processingQueue.shift()!

  console.log(`[VoiceQueue] Procesando logId: ${item.logId}`)

  try {
    // Timeout para el procesamiento
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout de procesamiento')), CONFIG.processingTimeoutMs)
    })

    // Procesar con timeout
    await Promise.race([
      processVoicePurchase(item.logId),
      timeoutPromise,
    ])

    console.log(`[VoiceQueue] Completado logId: ${item.logId}`)
  } catch (error: any) {
    console.error(`[VoiceQueue] Error procesando logId ${item.logId}:`, error)

    // Marcar como fallido
    try {
      await prisma.voicePurchaseLog.update({
        where: { id: item.logId },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Error en procesamiento',
        },
      })
    } catch (dbError) {
      console.error('[VoiceQueue] Error actualizando log:', dbError)
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
  console.log(`[VoiceQueue] Cola limpiada, ${cleared} items removidos`)
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

  const failedLogs = await prisma.voicePurchaseLog.findMany({
    where,
    select: { id: true },
    take: 10, // Máximo 10 a la vez
    orderBy: { createdAt: 'desc' },
  })

  let enqueued = 0
  for (const log of failedLogs) {
    // Resetear estado
    await prisma.voicePurchaseLog.update({
      where: { id: log.id },
      data: {
        status: 'PENDING',
        errorMessage: null,
      },
    })

    if (enqueueVoicePurchase(log.id)) {
      enqueued++
    }
  }

  console.log(`[VoiceQueue] Reprocesando ${enqueued} logs fallidos`)
  return enqueued
}

/**
 * Inicia el worker de la cola
 * Debe llamarse al iniciar la aplicación si hay items pendientes
 */
export async function startQueueWorker(): Promise<void> {
  if (workerStarted) {
    console.log('[VoiceQueue] Worker ya iniciado')
    return
  }

  workerStarted = true
  console.log('[VoiceQueue] Iniciando worker...')

  // Buscar logs pendientes que quedaron de una sesión anterior
  const pendingLogs = await prisma.voicePurchaseLog.findMany({
    where: {
      status: { in: ['PENDING', 'PROCESSING'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: CONFIG.maxQueueSize,
  })

  if (pendingLogs.length > 0) {
    console.log(`[VoiceQueue] Encontrados ${pendingLogs.length} logs pendientes`)

    // Resetear los que estaban en PROCESSING (probablemente fallaron)
    await prisma.voicePurchaseLog.updateMany({
      where: { status: 'PROCESSING' },
      data: { status: 'PENDING' },
    })

    // Encolar todos
    for (const log of pendingLogs) {
      enqueueVoicePurchase(log.id)
    }
  }
}
