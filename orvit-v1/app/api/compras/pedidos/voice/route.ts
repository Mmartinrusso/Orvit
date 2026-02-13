/**
 * API para crear pedidos de compra desde audio
 *
 * POST: Sube un audio y crea un pedido de compra automáticamente
 * GET: Obtiene el estado de un log de voz por ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { JWT_SECRET } from '@/lib/auth'
import { processVoiceToPurchaseRequest } from '@/lib/assistant/purchase-extractor'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET)

// Configuración
const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_AUDIO_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
  'audio/mp3',
]

async function getUserFromToken() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY)

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        companies: {
          select: { companyId: true },
          take: 1,
        },
      },
    })

    return user
  } catch {
    return null
  }
}

/**
 * POST - Crear pedido de compra desde audio
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Autenticación
    const user = await getUserFromToken()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = user.companies?.[0]?.companyId
    if (!companyId) {
      return NextResponse.json(
        { error: 'Usuario no tiene empresa asignada' },
        { status: 400 }
      )
    }

    // 2. Obtener form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Se requiere un archivo de audio' },
        { status: 400 }
      )
    }

    // 3. Validar tamaño
    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: `Audio muy grande. Máximo: ${MAX_AUDIO_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // 4. Validar tipo
    const mimeType = audioFile.type || 'audio/webm'
    const isValidType = VALID_AUDIO_TYPES.some(
      (t) => mimeType.startsWith(t) || mimeType.includes('audio')
    )
    if (!isValidType) {
      return NextResponse.json(
        { error: `Tipo de audio no soportado: ${mimeType}` },
        { status: 400 }
      )
    }

    // 5. Leer audio a buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    const audioHash = crypto.createHash('sha256').update(audioBuffer).digest('hex')

    // 6. Crear log de auditoría
    const voiceLog = await prisma.voicePurchaseLog.create({
      data: {
        companyId,
        userId: user.id,
        discordUserId: 'web-app', // Indicar que viene de la app web
        discordMessageId: `web-${Date.now()}-${audioHash.substring(0, 8)}`,
        discordAttachmentId: audioHash.substring(0, 20),
        audioHash,
        status: 'PROCESSING',
      },
    })

    console.log(`[VoicePurchaseAPI] Log creado: ${voiceLog.id} por usuario ${user.id}`)

    // 7. Procesar audio
    const result = await processVoiceToPurchaseRequest(
      audioBuffer,
      mimeType,
      user.id,
      companyId,
      voiceLog.id
    )

    const processingTimeMs = Date.now() - startTime

    // 8. Retornar resultado
    if (result.success && result.pedido) {
      return NextResponse.json({
        success: true,
        processingTimeMs,
        logId: voiceLog.id,
        pedido: {
          id: result.pedido.id,
          numero: result.pedido.numero,
          titulo: result.pedido.titulo,
          descripcion: result.pedido.descripcion,
          prioridad: result.pedido.prioridad,
          estado: result.pedido.estado,
          fechaNecesidad: result.pedido.fechaNecesidad,
          items: result.pedido.items.map((item: any) => ({
            id: item.id,
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad),
            unidad: item.unidad,
          })),
          solicitante: result.pedido.solicitante,
          createdAt: result.pedido.createdAt,
        },
        transcript: result.transcript,
        extractedData: result.extractedData,
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
    console.error('[VoicePurchaseAPI] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error procesando audio' },
      { status: 500 }
    )
  }
}

/**
 * GET - Obtener estado de un log de voz
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const logId = searchParams.get('logId')

    if (!logId) {
      // Listar últimos logs del usuario
      const logs = await prisma.voicePurchaseLog.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          confidence: true,
          transcript: true,
          errorMessage: true,
          purchaseRequestId: true,
          createdAt: true,
          processedAt: true,
          purchaseRequest: {
            select: {
              id: true,
              numero: true,
              titulo: true,
            },
          },
        },
      })

      return NextResponse.json({ logs })
    }

    // Obtener log específico
    const log = await prisma.voicePurchaseLog.findUnique({
      where: { id: parseInt(logId) },
      include: {
        purchaseRequest: {
          include: {
            items: true,
            solicitante: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!log) {
      return NextResponse.json({ error: 'Log no encontrado' }, { status: 404 })
    }

    // Verificar que pertenece al usuario o su empresa
    const companyId = user.companies?.[0]?.companyId
    if (log.userId !== user.id && log.companyId !== companyId) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
    }

    return NextResponse.json({ log })
  } catch (error: any) {
    console.error('[VoicePurchaseAPI] Error GET:', error)
    return NextResponse.json(
      { error: error.message || 'Error obteniendo log' },
      { status: 500 }
    )
  }
}
