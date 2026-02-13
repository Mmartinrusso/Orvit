/**
 * Handler de Pedidos de Compra por Voz desde Discord
 *
 * Procesa mensajes con audio que mencionan al bot y crea
 * pedidos de compra automáticamente.
 */

import { prisma } from '@/lib/prisma'
import { processVoiceToPurchaseRequest, ExtractedPurchaseData } from '@/lib/assistant/purchase-extractor'
import { enqueueVoicePurchase } from './voice-queue'

// Tipos de Discord (para evitar import directo)
type DiscordMessage = any
type DiscordAttachment = any
type DiscordEmbed = any

// Colores para embeds
const DISCORD_COLORS = {
  SUCCESS: 0x57F287,   // Verde
  ERROR: 0xED4245,     // Rojo
  WARNING: 0xFEE75C,   // Amarillo
  INFO: 0x5865F2,      // Azul Discord
  PROCESSING: 0x9B59B6, // Morado
}

// Configuración
const CONFIG = {
  maxAudioSizeBytes: 10 * 1024 * 1024, // 10MB
  validAudioTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a'],
  validExtensions: ['.webm', '.mp4', '.mp3', '.wav', '.ogg', '.m4a', '.oga'],
}

/**
 * Verifica si un attachment es un archivo de audio válido
 */
function isValidAudioAttachment(attachment: DiscordAttachment): boolean {
  // Verificar por content type
  if (attachment.contentType && CONFIG.validAudioTypes.some(t => attachment.contentType.startsWith(t.split('/')[0]))) {
    return true
  }

  // Verificar por extensión
  if (attachment.name) {
    const ext = '.' + attachment.name.split('.').pop()?.toLowerCase()
    return CONFIG.validExtensions.includes(ext)
  }

  return false
}

/**
 * Descarga un attachment de Discord
 */
async function downloadAttachment(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Error descargando audio: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Calcula hash SHA256 de un buffer usando Web Crypto API
 */
async function calculateHash(buffer: Buffer): Promise<string> {
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Busca usuario por Discord ID
 */
async function getUserByDiscordId(discordUserId: string): Promise<{
  id: number
  name: string
  companyId: number
} | null> {
  const user = await prisma.user.findUnique({
    where: { discordUserId },
    select: {
      id: true,
      name: true,
      companies: {
        select: { companyId: true },
        take: 1,
      },
    },
  })

  if (!user || !user.companies[0]) {
    return null
  }

  return {
    id: user.id,
    name: user.name,
    companyId: user.companies[0].companyId,
  }
}

/**
 * Verifica idempotencia por message ID
 */
async function checkIdempotency(discordMessageId: string): Promise<any | null> {
  return prisma.voicePurchaseLog.findUnique({
    where: { discordMessageId },
  })
}

/**
 * Construye el embed de confirmación de pedido creado
 */
export function buildPurchaseCreatedEmbed(
  pedido: any,
  extractedData: ExtractedPurchaseData
): DiscordEmbed {
  // Formatear lista de items
  const itemsList = pedido.items
    .map((item: any, i: number) => `• ${item.cantidad} ${item.unidad} - ${item.descripcion}`)
    .join('\n')

  // Mapear prioridad a emoji
  const prioridadEmoji: Record<string, string> = {
    BAJA: '🟢',
    NORMAL: '🔵',
    ALTA: '🟠',
    URGENTE: '🔴',
  }

  const fechaNecesidad = pedido.fechaNecesidad
    ? new Date(pedido.fechaNecesidad).toLocaleDateString('es-AR')
    : 'No especificada'

  return {
    title: `✅ Pedido de Compra Creado - ${pedido.numero}`,
    description: pedido.titulo,
    color: DISCORD_COLORS.SUCCESS,
    fields: [
      {
        name: '📦 Items',
        value: itemsList || 'Sin items',
        inline: false,
      },
      {
        name: '🎯 Prioridad',
        value: `${prioridadEmoji[pedido.prioridad] || '⚪'} ${pedido.prioridad}`,
        inline: true,
      },
      {
        name: '📅 Necesidad',
        value: fechaNecesidad,
        inline: true,
      },
      {
        name: '🤖 Confianza IA',
        value: `${extractedData.confianza}%`,
        inline: true,
      },
    ],
    footer: {
      text: `Solicitante: ${pedido.solicitante?.name || 'Usuario'}`,
    },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Construye embed de error
 */
function buildErrorEmbed(error: string): DiscordEmbed {
  return {
    title: '❌ Error procesando audio',
    description: error,
    color: DISCORD_COLORS.ERROR,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Construye embed de procesando
 */
function buildProcessingEmbed(): DiscordEmbed {
  return {
    title: '⏳ Procesando pedido de compra...',
    description: 'Estoy transcribiendo y analizando tu audio. Esto puede tomar unos segundos.',
    color: DISCORD_COLORS.PROCESSING,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Handler principal para comandos de voz de compra
 * Se llama cuando el bot es mencionado con un audio adjunto
 */
export async function handleVoicePurchaseCommand(
  message: DiscordMessage,
  audioAttachment: DiscordAttachment
): Promise<void> {
  const startTime = Date.now()

  try {
    // 1. Reaccionar para indicar que recibimos el mensaje
    await message.react('⏳')

    // 2. Verificar tamaño del audio
    if (audioAttachment.size > CONFIG.maxAudioSizeBytes) {
      await message.reply({
        embeds: [buildErrorEmbed(`El audio es muy grande. Máximo permitido: ${CONFIG.maxAudioSizeBytes / 1024 / 1024}MB`)],
      })
      await message.reactions.removeAll().catch(() => {})
      await message.react('❌')
      return
    }

    // 3. Buscar usuario ORVIT vinculado
    const user = await getUserByDiscordId(message.author.id)
    if (!user) {
      await message.reply({
        embeds: [buildErrorEmbed('Tu cuenta de Discord no está vinculada a ORVIT. Contacta al administrador.')],
      })
      await message.reactions.removeAll().catch(() => {})
      await message.react('❌')
      return
    }

    // 4. Verificar idempotencia
    const existingLog = await checkIdempotency(message.id)
    if (existingLog) {
      if (existingLog.status === 'COMPLETED' && existingLog.purchaseRequestId) {
        await message.reply({
          content: `Este audio ya fue procesado. Pedido: ${existingLog.purchaseRequestId}`,
        })
      } else if (existingLog.status === 'PROCESSING' || existingLog.status === 'PENDING') {
        await message.reply({
          content: 'Este audio ya está siendo procesado. Por favor espera.',
        })
      } else {
        await message.reply({
          content: `Este audio ya fue procesado pero falló: ${existingLog.errorMessage}`,
        })
      }
      return
    }

    // 5. Responder con embed de procesando
    const processingReply = await message.reply({
      embeds: [buildProcessingEmbed()],
    })

    // 6. Descargar audio
    console.log(`[VoiceHandler] Descargando audio de ${audioAttachment.url}`)
    const audioBuffer = await downloadAttachment(audioAttachment.url)
    const audioHash = await calculateHash(audioBuffer)

    // 7. Crear log de auditoría
    const voiceLog = await prisma.voicePurchaseLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        discordUserId: message.author.id,
        discordMessageId: message.id,
        discordAttachmentId: audioAttachment.id,
        discordChannelId: message.channel.id,
        audioUrl: audioAttachment.url,
        audioHash,
        status: 'PENDING',
      },
    })

    console.log(`[VoiceHandler] Log creado: ${voiceLog.id}`)

    // 8. Determinar content type
    let contentType = audioAttachment.contentType || 'audio/webm'
    if (!contentType.startsWith('audio/')) {
      // Inferir por extensión
      const ext = audioAttachment.name?.split('.').pop()?.toLowerCase()
      const extMap: Record<string, string> = {
        webm: 'audio/webm',
        mp4: 'audio/mp4',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        m4a: 'audio/x-m4a',
      }
      contentType = extMap[ext || ''] || 'audio/webm'
    }

    // 9. Procesar audio
    const result = await processVoiceToPurchaseRequest(
      audioBuffer,
      contentType,
      user.id,
      user.companyId,
      voiceLog.id
    )

    // 10. Actualizar respuesta
    if (result.success && result.pedido && result.extractedData) {
      // Éxito - mostrar embed con detalles
      await processingReply.edit({
        embeds: [buildPurchaseCreatedEmbed(result.pedido, result.extractedData)],
      })
      await message.reactions.removeAll().catch(() => {})
      await message.react('✅')

      console.log(`[VoiceHandler] Pedido creado: ${result.pedido.numero} en ${Date.now() - startTime}ms`)
    } else {
      // Error
      await processingReply.edit({
        embeds: [buildErrorEmbed(result.error || 'Error desconocido procesando el audio')],
      })
      await message.reactions.removeAll().catch(() => {})
      await message.react('❌')

      console.error(`[VoiceHandler] Error: ${result.error}`)
    }
  } catch (error: any) {
    console.error('[VoiceHandler] Error no manejado:', error)

    try {
      await message.reply({
        embeds: [buildErrorEmbed('Error inesperado. Por favor intenta de nuevo.')],
      })
      await message.reactions.removeAll().catch(() => {})
      await message.react('❌')
    } catch {
      // Ignorar errores al responder
    }
  }
}

/**
 * Procesa un log de voz pendiente (llamado desde la cola)
 */
export async function processVoicePurchase(logId: number): Promise<void> {
  console.log(`[VoiceHandler] Procesando log: ${logId}`)

  // Obtener log
  const log = await prisma.voicePurchaseLog.findUnique({
    where: { id: logId },
  })

  if (!log) {
    throw new Error(`Log ${logId} no encontrado`)
  }

  if (log.status === 'COMPLETED') {
    console.log(`[VoiceHandler] Log ${logId} ya completado`)
    return
  }

  if (!log.audioUrl) {
    throw new Error('Log sin URL de audio')
  }

  // Actualizar estado
  await prisma.voicePurchaseLog.update({
    where: { id: logId },
    data: { status: 'PROCESSING' },
  })

  // Descargar audio
  const audioBuffer = await downloadAttachment(log.audioUrl)

  // Inferir content type
  const contentType = 'audio/ogg' // Discord usa OGG por defecto

  // Procesar
  const result = await processVoiceToPurchaseRequest(
    audioBuffer,
    contentType,
    log.userId,
    log.companyId,
    logId
  )

  if (!result.success) {
    throw new Error(result.error || 'Error procesando audio')
  }

  console.log(`[VoiceHandler] Log ${logId} procesado exitosamente`)
}

/**
 * Exporta función para verificar si un mensaje debe procesarse
 */
export function shouldProcessMessage(
  message: DiscordMessage,
  botUserId: string
): { shouldProcess: boolean; audioAttachment?: DiscordAttachment; reason?: string } {
  // Ignorar mensajes del bot
  if (message.author.bot) {
    return { shouldProcess: false, reason: 'Mensaje de bot' }
  }

  // Verificar que menciona al bot
  if (!message.mentions.has(botUserId)) {
    return { shouldProcess: false, reason: 'No menciona al bot' }
  }

  // Buscar attachment de audio
  const audioAttachment = message.attachments.find((att: DiscordAttachment) =>
    isValidAudioAttachment(att)
  )

  if (!audioAttachment) {
    return { shouldProcess: false, reason: 'Sin audio adjunto' }
  }

  return { shouldProcess: true, audioAttachment }
}
