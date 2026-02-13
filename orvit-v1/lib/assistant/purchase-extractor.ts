/**
 * Extractor de Pedidos de Compra desde Audio
 *
 * Usa OpenAI GPT para extraer datos estructurados de transcripciones
 * de audio y crear PurchaseRequests automáticamente.
 */

import { AI_CONFIG, PURCHASE_EXTRACTION_PROMPTS } from './config'
import { prisma } from '@/lib/prisma'
import { RequestPriority, PurchaseRequestStatus } from '@prisma/client'

// Tipos para la extracción
export interface ExtractedItem {
  descripcion: string
  cantidad: number
  unidad: string
}

export interface ExtractedPurchaseData {
  titulo: string
  descripcion: string
  prioridad: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE'
  fechaNecesidad: string | null
  items: ExtractedItem[]
  confianza: number
  notas?: string
}

export interface ExtractionResult {
  success: boolean
  data?: ExtractedPurchaseData
  error?: string
}

// Cliente OpenAI (lazy initialization)
let openaiClient: any = null

async function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está configurada')
    }
    const OpenAI = (await import('openai')).default
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

/**
 * Transcribe audio usando Whisper
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = 'audio/webm'
): Promise<string> {
  const openai = await getOpenAIClient()

  // Determinar extensión del archivo
  const extensionMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/x-m4a': 'm4a',
  }
  const extension = extensionMap[mimeType] || 'webm'

  // Crear un File-like object para la API
  const audioFile = new File([audioBuffer], `audio.${extension}`, { type: mimeType })

  const response = await openai.audio.transcriptions.create({
    model: AI_CONFIG.voice.model,
    file: audioFile,
    language: AI_CONFIG.voice.language,
  })

  return response.text
}

/**
 * Extrae datos estructurados del pedido desde la transcripción
 */
export async function extractPurchaseData(transcript: string): Promise<ExtractionResult> {
  const openai = await getOpenAIClient()

  // Preparar fecha de hoy para el prompt
  const today = new Date().toISOString().split('T')[0]
  const userPrompt = PURCHASE_EXTRACTION_PROMPTS.user
    .replace('{transcript}', transcript)
    .replace('{today}', today)

  try {
    console.log('[PurchaseExtractor] Extrayendo datos de:', transcript.substring(0, 100) + '...')

    const response = await openai.chat.completions.create({
      model: AI_CONFIG.chat.model,
      messages: [
        { role: 'system', content: PURCHASE_EXTRACTION_PROMPTS.system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Baja temperatura para más precisión
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0].message.content
    if (!content) {
      return { success: false, error: 'No se recibió respuesta del modelo' }
    }

    console.log('[PurchaseExtractor] Respuesta GPT:', content)

    // Parsear JSON
    let data: ExtractedPurchaseData
    try {
      data = JSON.parse(content)
    } catch (parseError) {
      console.error('[PurchaseExtractor] Error parseando JSON:', parseError)
      return { success: false, error: 'Error parseando respuesta del modelo' }
    }

    // Validar estructura mínima
    if (!data.titulo || !data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return { success: false, error: 'Datos extraídos incompletos: falta título o items' }
    }

    // Normalizar prioridad
    const validPriorities = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE']
    if (!validPriorities.includes(data.prioridad)) {
      data.prioridad = 'NORMAL'
    }

    // Validar y normalizar items
    data.items = data.items.map(item => ({
      descripcion: String(item.descripcion || 'Item sin descripción'),
      cantidad: Number(item.cantidad) || 1,
      unidad: String(item.unidad || 'UN').toUpperCase(),
    }))

    // Asegurar confianza
    data.confianza = Number(data.confianza) || 50

    return { success: true, data }
  } catch (error: any) {
    console.error('[PurchaseExtractor] Error:', error)
    return { success: false, error: error.message || 'Error en extracción' }
  }
}

/**
 * Genera el número de pedido: REQ-2026-00001
 */
async function generateRequestNumber(companyId: number, tx?: any): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `REQ-${year}-`

  const client = tx || prisma
  const lastRequest = await client.purchaseRequest.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix },
    },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })

  let nextNumber = 1
  if (lastRequest?.numero) {
    const parts = lastRequest.numero.split('-')
    const lastNum = parseInt(parts[2] || '0', 10)
    nextNumber = lastNum + 1
  }

  return `${prefix}${String(nextNumber).padStart(5, '0')}`
}

/**
 * Crea el PurchaseRequest en la base de datos
 */
export async function createPurchaseRequestFromAudio(
  data: ExtractedPurchaseData,
  userId: number,
  companyId: number,
  voiceLogId?: number
): Promise<any> {
  // Mapear prioridad
  const priorityMap: Record<string, RequestPriority> = {
    BAJA: 'BAJA',
    NORMAL: 'NORMAL',
    ALTA: 'ALTA',
    URGENTE: 'URGENTE',
  }

  // Parsear fecha de necesidad
  let fechaNecesidad: Date | null = null
  if (data.fechaNecesidad) {
    fechaNecesidad = new Date(data.fechaNecesidad)
    if (isNaN(fechaNecesidad.getTime())) {
      fechaNecesidad = null
    }
  }

  // Crear en transacción
  const pedido = await prisma.$transaction(async (tx) => {
    const numero = await generateRequestNumber(companyId, tx)

    // Crear el pedido
    const newPedido = await tx.purchaseRequest.create({
      data: {
        numero,
        titulo: data.titulo.substring(0, 200),
        descripcion: `[Creado desde audio] ${data.descripcion}${data.notas ? `\n\nNotas: ${data.notas}` : ''}`,
        estado: 'ENVIADA' as PurchaseRequestStatus, // Directo a ENVIADA sin revisión
        prioridad: priorityMap[data.prioridad] || 'NORMAL',
        solicitanteId: userId,
        fechaNecesidad,
        companyId,
        items: {
          create: data.items.map(item => ({
            descripcion: item.descripcion.substring(0, 500),
            cantidad: item.cantidad,
            unidad: item.unidad.substring(0, 50),
          })),
        },
      },
      include: {
        items: true,
        solicitante: {
          select: { id: true, name: true },
        },
      },
    })

    // Comentario de sistema indicando origen
    await tx.purchaseComment.create({
      data: {
        entidad: 'request',
        entidadId: newPedido.id,
        tipo: 'SISTEMA',
        contenido: `Pedido creado automáticamente desde mensaje de voz (confianza: ${data.confianza}%)`,
        companyId,
        userId,
      },
    })

    // Si hay un log de voz, vincularlo
    if (voiceLogId) {
      await tx.voicePurchaseLog.update({
        where: { id: voiceLogId },
        data: {
          purchaseRequestId: newPedido.id,
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      })
    }

    return newPedido
  })

  console.log(`[PurchaseExtractor] Pedido creado: ${pedido.numero}`)
  return pedido
}

/**
 * Procesa un audio completo: transcribe, extrae y crea el pedido
 */
export async function processVoiceToPurchaseRequest(
  audioBuffer: Buffer,
  mimeType: string,
  userId: number,
  companyId: number,
  voiceLogId?: number
): Promise<{
  success: boolean
  pedido?: any
  transcript?: string
  extractedData?: ExtractedPurchaseData
  error?: string
}> {
  try {
    // 1. Transcribir
    console.log('[PurchaseExtractor] Transcribiendo audio...')
    const transcript = await transcribeAudio(audioBuffer, mimeType)

    if (!transcript || transcript.trim().length === 0) {
      return { success: false, error: 'No se pudo transcribir el audio' }
    }

    console.log('[PurchaseExtractor] Transcripción:', transcript)

    // 2. Actualizar log con transcripción (si existe)
    if (voiceLogId) {
      await prisma.voicePurchaseLog.update({
        where: { id: voiceLogId },
        data: {
          transcript,
          status: 'PROCESSING',
        },
      })
    }

    // 3. Extraer datos
    console.log('[PurchaseExtractor] Extrayendo datos...')
    const extraction = await extractPurchaseData(transcript)

    if (!extraction.success || !extraction.data) {
      // Actualizar log con error
      if (voiceLogId) {
        await prisma.voicePurchaseLog.update({
          where: { id: voiceLogId },
          data: {
            status: 'FAILED',
            errorMessage: extraction.error,
          },
        })
      }
      return { success: false, transcript, error: extraction.error }
    }

    // 4. Actualizar log con datos extraídos
    if (voiceLogId) {
      await prisma.voicePurchaseLog.update({
        where: { id: voiceLogId },
        data: {
          extractedData: extraction.data as any,
          confidence: extraction.data.confianza,
        },
      })
    }

    // 5. Crear pedido
    console.log('[PurchaseExtractor] Creando pedido...')
    const pedido = await createPurchaseRequestFromAudio(
      extraction.data,
      userId,
      companyId,
      voiceLogId
    )

    return {
      success: true,
      pedido,
      transcript,
      extractedData: extraction.data,
    }
  } catch (error: any) {
    console.error('[PurchaseExtractor] Error procesando audio:', error)

    // Actualizar log con error
    if (voiceLogId) {
      await prisma.voicePurchaseLog.update({
        where: { id: voiceLogId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      })
    }

    return { success: false, error: error.message }
  }
}
