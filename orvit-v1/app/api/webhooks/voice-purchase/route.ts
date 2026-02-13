/**
 * Webhook para Pedidos de Compra por Voz
 *
 * Recibe audio desde chatbots externos y crea pedidos de compra.
 * Autenticación: HMAC-SHA256
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { processVoiceToPurchaseRequest } from '@/lib/assistant/purchase-extractor'

export const dynamic = 'force-dynamic'

// Configuración
const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a']

/**
 * Verifica la firma HMAC-SHA256 del webhook
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Calcula hash SHA256
 */
function calculateHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Verificar secret configurado
    const webhookSecret = process.env.VOICE_PURCHASE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('[VoicePurchaseWebhook] VOICE_PURCHASE_WEBHOOK_SECRET no configurado')
      return NextResponse.json(
        { error: 'Webhook no configurado' },
        { status: 500 }
      )
    }

    // 2. Verificar firma
    const signature = request.headers.get('x-signature')
    const timestamp = request.headers.get('x-timestamp')

    if (!signature) {
      return NextResponse.json(
        { error: 'Falta header x-signature' },
        { status: 401 }
      )
    }

    // 3. Obtener form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const userId = formData.get('userId') as string | null
    const companyId = formData.get('companyId') as string | null
    const externalId = formData.get('externalId') as string | null // ID externo para idempotencia

    // 4. Validar campos requeridos
    if (!audioFile || !userId || !companyId) {
      return NextResponse.json(
        { error: 'Campos requeridos: audio, userId, companyId' },
        { status: 400 }
      )
    }

    // 5. Verificar firma con payload serializado
    const payloadForSignature = `${userId}:${companyId}:${timestamp || ''}`
    if (!verifySignature(payloadForSignature, signature, webhookSecret)) {
      console.warn('[VoicePurchaseWebhook] Firma inválida')
      return NextResponse.json(
        { error: 'Firma inválida' },
        { status: 401 }
      )
    }

    // 6. Validar usuario y permisos
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        name: true,
        isActive: true,
        companies: {
          where: { companyId: parseInt(companyId) },
          select: { companyId: true },
        },
      },
    })

    if (!user || !user.isActive || user.companies.length === 0) {
      return NextResponse.json(
        { error: 'Usuario no válido o sin acceso a la empresa' },
        { status: 403 }
      )
    }

    // 7. Validar audio
    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: `Audio muy grande. Máximo: ${MAX_AUDIO_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    const mimeType = audioFile.type || 'audio/webm'
    if (!VALID_AUDIO_TYPES.some(t => mimeType.startsWith(t.split('/')[0]))) {
      return NextResponse.json(
        { error: `Tipo de audio no soportado: ${mimeType}` },
        { status: 400 }
      )
    }

    // 8. Verificar idempotencia si hay externalId
    if (externalId) {
      const existingLog = await prisma.voicePurchaseLog.findFirst({
        where: {
          discordMessageId: externalId, // Reutilizamos este campo
          companyId: parseInt(companyId),
        },
      })

      if (existingLog) {
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          logId: existingLog.id,
          purchaseRequestId: existingLog.purchaseRequestId,
          status: existingLog.status,
        })
      }
    }

    // 9. Leer audio a buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    const audioHash = calculateHash(audioBuffer)

    // 10. Crear log de auditoría
    const voiceLog = await prisma.voicePurchaseLog.create({
      data: {
        companyId: parseInt(companyId),
        userId: parseInt(userId),
        discordUserId: 'webhook', // Indicar que viene de webhook
        discordMessageId: externalId || `webhook-${Date.now()}-${audioHash.substring(0, 8)}`,
        discordAttachmentId: audioHash.substring(0, 20),
        audioHash,
        status: 'PROCESSING',
      },
    })

    console.log(`[VoicePurchaseWebhook] Log creado: ${voiceLog.id}`)

    // 11. Procesar audio
    const result = await processVoiceToPurchaseRequest(
      audioBuffer,
      mimeType,
      parseInt(userId),
      parseInt(companyId),
      voiceLog.id
    )

    const processingTimeMs = Date.now() - startTime

    // 12. Retornar resultado
    if (result.success && result.pedido) {
      return NextResponse.json({
        success: true,
        processingTimeMs,
        logId: voiceLog.id,
        pedido: {
          id: result.pedido.id,
          numero: result.pedido.numero,
          titulo: result.pedido.titulo,
          prioridad: result.pedido.prioridad,
          fechaNecesidad: result.pedido.fechaNecesidad,
          items: result.pedido.items.map((item: any) => ({
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            unidad: item.unidad,
          })),
        },
        transcript: result.transcript,
        confidence: result.extractedData?.confianza,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          processingTimeMs,
          logId: voiceLog.id,
          error: result.error,
          transcript: result.transcript,
        },
        { status: 422 }
      )
    }
  } catch (error: any) {
    console.error('[VoicePurchaseWebhook] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error procesando audio' },
      { status: 500 }
    )
  }
}

/**
 * GET para verificar que el webhook está activo
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/webhooks/voice-purchase',
    methods: ['POST'],
    requiredHeaders: ['x-signature', 'x-timestamp'],
    requiredFields: ['audio', 'userId', 'companyId'],
    optionalFields: ['externalId'],
  })
}
