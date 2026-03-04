/**
 * Handler de Reporte de Fallas por Voz desde Discord
 *
 * Procesa el flujo completo de reporte de fallas:
 * 1. Usuario envía "Falla" por DM
 * 2. Bot responde con instrucciones
 * 3. Usuario envía audio
 * 4. Bot procesa y crea la falla
 */

import { prisma } from '@/lib/prisma'
import {
  processVoiceToFailure,
  completeFailureWithMachine,
  processVoiceToWorkOrder,
  completeWorkOrderWithMachine,
  ExtractedFailureData,
  MachineInfo,
  PhotoAttachment,
} from '@/lib/assistant/failure-extractor'
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  VoiceFailureSession,
  SectorInfo,
  startCleanupWorker,
} from './voice-session'
import { enqueueVoiceFailure, setProcessCallback } from './failure-voice-queue'
import { getMachinesForUser, findMatchingMachines, MachineMatch } from './machine-matcher'
import {
  createSectorButtons,
  createMachineSelectMenu,
  createPostFailureButtons,
  createTechnicianSelectMenu,
  createRetryButton,
  disableAllComponents,
  parseCustomId,
} from './discord-components'
import {
  notifyOTCreated,
  sendTechnicianDM,
} from './notifications'

// Tipos de Discord (para evitar import directo)
type DiscordMessage = any
type DiscordAttachment = any
type DiscordEmbed = any

// Colores para embeds
const DISCORD_COLORS = {
  SUCCESS: 0x57f287, // Verde
  ERROR: 0xed4245, // Rojo
  WARNING: 0xfee75c, // Amarillo
  INFO: 0x5865f2, // Azul Discord
  PROCESSING: 0x9b59b6, // Morado
}

// Configuración
const CONFIG = {
  maxAudioSizeBytes: 10 * 1024 * 1024, // 10MB
  maxPhotoSizeBytes: 8 * 1024 * 1024, // 8MB
  validAudioTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a'],
  validExtensions: ['.webm', '.mp4', '.mp3', '.wav', '.ogg', '.m4a', '.oga'],
  validImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  validImageExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
}

// Inicializar sistema
let initialized = false

export function initializeFailureVoiceHandler(): void {
  if (initialized) return
  initialized = true

  // Iniciar limpieza de sesiones
  startCleanupWorker()

  // Registrar callback de procesamiento en la cola
  setProcessCallback(processFailureFromQueue)

  console.log('[FailureVoiceHandler] Inicializado')
}

/**
 * Verifica si un attachment es un archivo de audio válido
 */
export function isValidAudioAttachment(attachment: DiscordAttachment): boolean {
  if (
    attachment.contentType &&
    CONFIG.validAudioTypes.some(t => attachment.contentType.startsWith(t.split('/')[0]))
  ) {
    return true
  }

  if (attachment.name) {
    const ext = '.' + attachment.name.split('.').pop()?.toLowerCase()
    return CONFIG.validExtensions.includes(ext)
  }

  return false
}

/**
 * Verifica si un attachment es una imagen válida
 */
export function isValidImageAttachment(attachment: DiscordAttachment): boolean {
  if (attachment.contentType && CONFIG.validImageTypes.includes(attachment.contentType)) {
    return true
  }

  if (attachment.name) {
    const ext = '.' + attachment.name.split('.').pop()?.toLowerCase()
    return CONFIG.validImageExtensions.includes(ext)
  }

  return false
}

/**
 * Verifica si un mensaje tiene audio adjunto
 */
export function hasAudioAttachment(message: DiscordMessage): DiscordAttachment | null {
  if (!message.attachments || message.attachments.size === 0) {
    return null
  }

  for (const [, attachment] of message.attachments) {
    if (isValidAudioAttachment(attachment)) {
      return attachment
    }
  }

  return null
}

/**
 * Obtiene todas las imágenes adjuntas en un mensaje
 */
export function getImageAttachments(message: DiscordMessage): DiscordAttachment[] {
  if (!message.attachments || message.attachments.size === 0) {
    return []
  }

  const images: DiscordAttachment[] = []

  for (const [, attachment] of message.attachments) {
    if (isValidImageAttachment(attachment)) {
      // Verificar tamaño
      if (attachment.size <= CONFIG.maxPhotoSizeBytes) {
        images.push(attachment)
      }
    }
  }

  return images
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
async function getUserByDiscordId(
  discordUserId: string
): Promise<{
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

// ============================================
// EMBEDS
// ============================================

/**
 * Embed de instrucciones iniciales
 * @param machines Lista de máquinas disponibles
 * @param hideSector Si true, no muestra el sector (porque ya está seleccionado)
 */
function buildInstructionsEmbed(machines: MachineInfo[], hideSector = false): DiscordEmbed {
  // Solo mostrar sector si no está ya seleccionado
  const machineListText =
    machines.length > 0
      ? machines
          .slice(0, 15)
          .map(m => {
            const sectorInfo = !hideSector && m.sectorName ? ` [${m.sectorName}]` : ''
            return `• **${m.name}**${m.nickname ? ` (${m.nickname})` : ''}${sectorInfo}`
          })
          .join('\n') + (machines.length > 15 ? `\n...y ${machines.length - 15} más` : '')
      : 'No hay máquinas disponibles'

  return {
    title: '🔴 Reportar Falla por Voz',
    description: `Para reportar una falla, envía un **audio** describiendo:

📋 **Información necesaria:**
1. **Máquina** - Di el **nombre exacto** como aparece en la lista
2. **Problema** - Qué está pasando (ruido, vibración, fuga, etc.)
3. **¿Paró producción?** - ¿Tuviste que detener la máquina?

⚠️ **IMPORTANTE:** Di el nombre de la máquina **claramente** para evitar confusiones.

💡 **Ejemplo de audio:**
_"Falla en la CNC Haas del sector Mecanizado, tiene un ruido fuerte en el motor y tuvimos que pararla"_

📷 **Puedes adjuntar fotos** junto con el audio para documentar la falla.`,
    color: DISCORD_COLORS.INFO,
    fields: [
      {
        name: '🏭 Máquinas disponibles',
        value: machineListText,
        inline: false,
      },
      {
        name: '⏱️ Tiempo límite',
        value: 'Tienes 5 minutos para enviar el audio',
        inline: true,
      },
    ],
    footer: { text: '🎙️ Audio + 📷 Fotos opcionales | "cancelar" para salir' },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed de instrucciones para OT directa
 */
function buildOTInstructionsEmbed(machines: MachineInfo[], hideSector = false): DiscordEmbed {
  const machineListText =
    machines.length > 0
      ? machines
          .slice(0, 15)
          .map(m => {
            const sectorInfo = !hideSector && m.sectorName ? ` [${m.sectorName}]` : ''
            return `• **${m.name}**${m.nickname ? ` (${m.nickname})` : ''}${sectorInfo}`
          })
          .join('\n') + (machines.length > 15 ? `\n...y ${machines.length - 15} más` : '')
      : 'No hay máquinas disponibles'

  return {
    title: '🔧 Crear Orden de Trabajo por Voz',
    description: `Para crear una OT, envía un **audio** describiendo:

📋 **Información necesaria:**
1. **Máquina** - Di el **nombre exacto** como aparece en la lista
2. **Trabajo a realizar** - Qué hay que hacer
3. **Prioridad** - Urgente, alta, media o baja (opcional)

💡 **Ejemplo de audio:**
_"Crear OT para la prensa hidráulica, hay que cambiar el aceite y revisar los filtros, prioridad media"_`,
    color: DISCORD_COLORS.INFO,
    fields: [
      {
        name: '🏭 Máquinas disponibles',
        value: machineListText,
        inline: false,
      },
      {
        name: '⏱️ Tiempo límite',
        value: 'Tienes 5 minutos para enviar el audio',
        inline: true,
      },
    ],
    footer: { text: '🎙️ Audio | "cancelar" para salir' },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed de procesando
 */
function buildProcessingEmbed(): DiscordEmbed {
  return {
    title: '⏳ Procesando reporte de falla...',
    description: 'Estoy transcribiendo y analizando tu audio. Esto puede tomar unos segundos.',
    color: DISCORD_COLORS.PROCESSING,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed de procesando OT
 */
function buildOTProcessingEmbed(): DiscordEmbed {
  return {
    title: '⏳ Procesando orden de trabajo...',
    description: 'Estoy transcribiendo y analizando tu audio. Esto puede tomar unos segundos.',
    color: DISCORD_COLORS.PROCESSING,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Info del componente matcheado
 */
interface MatchedComponentInfo {
  id: number
  name: string
  parentName?: string | null
  isSubcomponent: boolean
}

/**
 * Embed de falla creada
 */
export function buildFailureCreatedEmbed(
  occurrence: any,
  extractedData: ExtractedFailureData,
  matchedComponent?: MatchedComponentInfo | null
): DiscordEmbed {
  const priorityEmoji: Record<string, string> = {
    P1: '🔴',
    P2: '🟠',
    P3: '🟡',
    P4: '🟢',
  }

  const categoryEmoji: Record<string, string> = {
    MECANICA: '⚙️',
    ELECTRICA: '⚡',
    HIDRAULICA: '💧',
    NEUMATICA: '💨',
    OTRA: '🔧',
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.orvit.com'
  const failureUrl = `${baseUrl}/mantenimiento/incidentes/${occurrence.id}`

  // Construir texto de componente
  let componentText: string | null = null
  if (matchedComponent) {
    componentText = matchedComponent.name
    if (matchedComponent.parentName) {
      componentText = `${matchedComponent.parentName} > ${matchedComponent.name}`
    }
  } else if (extractedData.component) {
    componentText = `${extractedData.component} (no identificado)`
  }

  const fields = [
    {
      name: '🏭 Máquina',
      value: occurrence.machine?.name || 'Sin máquina',
      inline: true,
    },
    {
      name: `${categoryEmoji[extractedData.failureCategory] || '🔧'} Categoría`,
      value: extractedData.failureCategory,
      inline: true,
    },
    {
      name: `${priorityEmoji[occurrence.priority] || '⚪'} Prioridad`,
      value: occurrence.priority,
      inline: true,
    },
  ]

  // Agregar componente si hay
  if (componentText) {
    fields.push({
      name: '🔩 Componente',
      value: componentText,
      inline: true,
    })
  }

  fields.push(
    {
      name: '⏱️ ¿Paró producción?',
      value: extractedData.causedDowntime ? '✅ Sí' : '❌ No',
      inline: true,
    },
    {
      name: '🤖 Confianza IA',
      value: `${extractedData.confidence}%`,
      inline: true,
    },
    {
      name: '🔗 Ver falla',
      value: `[Abrir en ORVIT](${failureUrl})`,
      inline: false,
    }
  )

  return {
    title: `✅ Falla Reportada - F-${occurrence.id}`,
    description: `**${occurrence.title}**`,
    color: DISCORD_COLORS.SUCCESS,
    fields,
    footer: { text: `Reportado por ${occurrence.reporter?.name || 'Usuario'}` },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed de pregunta post-falla (¿solucionado o crear OT?)
 */
function buildPostFailureEmbed(failureId: number, failureTitle: string): DiscordEmbed {
  return {
    title: '📋 ¿Qué hacemos con la falla?',
    description: `**F-${failureId}**: ${failureTitle}`,
    color: DISCORD_COLORS.INFO,
    fields: [
      {
        name: '✅ Ya la solucioné',
        value: 'Si ya lo arreglaste y quedó funcionando',
        inline: true,
      },
      {
        name: '🔧 Crear OT',
        value: 'Si necesita trabajo posterior',
        inline: true,
      },
      {
        name: '👍 Listo',
        value: 'Dejar abierta por ahora',
        inline: true,
      },
    ],
    footer: { text: 'Usa los botones para continuar' },
  }
}

/**
 * Embed de falla marcada como resuelta
 */
function buildResolvedEmbed(failureId: number): DiscordEmbed {
  return {
    title: '✅ Falla Resuelta',
    description: `La falla **F-${failureId}** ha sido marcada como **resuelta inmediatamente**.`,
    color: DISCORD_COLORS.SUCCESS,
    footer: { text: '¡Buen trabajo!' },
  }
}

/**
 * Embed de OT creada
 */
function buildOTCreatedEmbed(failureId: number, workOrderId: number): DiscordEmbed {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.orvit.com'
  const otUrl = `${baseUrl}/mantenimiento/ordenes-trabajo/${workOrderId}`

  return {
    title: '🔧 Orden de Trabajo Creada',
    description: `Se creó la **OT-${workOrderId}** para resolver la falla F-${failureId}.`,
    color: DISCORD_COLORS.INFO,
    fields: [
      {
        name: '🔗 Ver OT',
        value: `[Abrir en ORVIT](${otUrl})`,
        inline: false,
      },
    ],
    footer: { text: 'Se notificará cuando se asigne un técnico' },
  }
}

/**
 * Embed para OT creada directamente (sin falla asociada)
 */
function buildDirectOTCreatedEmbed(
  workOrder: { id: number; title: string; description?: string | null },
  machineName: string,
  priority: string
): DiscordEmbed {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.orvit.com'
  const otUrl = `${baseUrl}/mantenimiento/ordenes-trabajo/${workOrder.id}`

  const priorityLabels: Record<string, string> = {
    LOW: '🟢 Baja',
    MEDIUM: '🟡 Media',
    HIGH: '🟠 Alta',
    URGENT: '🔴 Urgente',
  }

  return {
    title: '🔧 Orden de Trabajo Creada',
    description: `**OT-${workOrder.id}**: ${workOrder.title}`,
    color: DISCORD_COLORS.SUCCESS,
    fields: [
      {
        name: '🏭 Máquina',
        value: machineName,
        inline: true,
      },
      {
        name: '📊 Prioridad',
        value: priorityLabels[priority] || priority,
        inline: true,
      },
      {
        name: '📝 Descripción',
        value: workOrder.description || 'Sin descripción adicional',
        inline: false,
      },
      {
        name: '🔗 Ver OT',
        value: `[Abrir en ORVIT](${otUrl})`,
        inline: false,
      },
    ],
    footer: { text: 'OT creada por voz' },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed de clarificación de máquina (muestra sector si hay nombres duplicados)
 */
function buildClarificationEmbed(possibleMachines: MachineInfo[], originalText: string): DiscordEmbed {
  return {
    title: '🤔 ¿Qué máquina?',
    description: `No pude identificar con certeza la máquina mencionada: "${originalText}"

Selecciona la máquina correcta en el menú:`,
    color: DISCORD_COLORS.WARNING,
    footer: { text: 'Usa el menú desplegable para seleccionar' },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed pidiendo descripción de la solución
 */
function buildAwaitingSolutionEmbed(failureId: number, failureTitle: string): DiscordEmbed {
  return {
    title: '📝 ¿Cómo se solucionó?',
    description: `**F-${failureId}**: ${failureTitle}

Describe qué hiciste para solucionar el problema.
Puedes enviar un **audio** 🎙️ o escribir:`,
    color: DISCORD_COLORS.INFO,
    fields: [
      {
        name: '💡 Ejemplos',
        value: `• "Reemplacé el fusible quemado"\n• "Ajusté la tensión de la correa"\n• "Reinicié el PLC y quedó funcionando"`,
        inline: false,
      },
    ],
    footer: { text: '🎙️ Audio o texto | "cancelar" para dejarlo abierto' },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed para seleccionar técnico para la OT
 */
function buildTechnicianSelectionEmbed(
  technicians: { id: number; name: string }[],
  failureId: number
): DiscordEmbed {
  if (technicians.length === 0) {
    return {
      title: '⚠️ Sin técnicos disponibles',
      description: `No hay técnicos registrados para asignar la OT de la falla F-${failureId}.

La OT se creará sin asignar.`,
      color: DISCORD_COLORS.WARNING,
      footer: { text: 'Escribe "ok" para continuar o "cancelar"' },
    }
  }

  const options = technicians
    .map((t, i) => `**${i + 1}.** ${t.name}`)
    .join('\n')

  return {
    title: '👷 ¿A quién asignamos la OT?',
    description: `Falla: **F-${failureId}**

Selecciona el técnico que se encargará:`,
    color: DISCORD_COLORS.INFO,
    fields: [
      {
        name: '🧑‍🔧 Técnicos disponibles',
        value: options,
        inline: false,
      },
      {
        name: '0️⃣ Sin asignar',
        value: 'Crear OT sin asignar a nadie',
        inline: false,
      },
    ],
    footer: { text: `Responde con el número (0-${technicians.length}) o "cancelar"` },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed de error
 */
function buildErrorEmbed(error: string, suggestion?: string): DiscordEmbed {
  const fields = suggestion ? [{ name: '💡 Sugerencia', value: suggestion, inline: false }] : []

  return {
    title: '❌ Error',
    description: error,
    color: DISCORD_COLORS.ERROR,
    fields,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed de sesión expirada
 */
function buildSessionExpiredEmbed(): DiscordEmbed {
  return {
    title: '⏰ Sesión expirada',
    description: 'Tu sesión de reporte expiró. Escribe **"Falla"** para comenzar de nuevo.',
    color: DISCORD_COLORS.WARNING,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed de cancelación
 */
function buildCancelledEmbed(): DiscordEmbed {
  return {
    title: '🚫 Reporte cancelado',
    description: 'Has cancelado el reporte de falla. Escribe **"Falla"** cuando quieras reportar otra.',
    color: DISCORD_COLORS.INFO,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Embed para selección de sector (cuando usuario tiene múltiples sectores)
 */
function buildSectorSelectionEmbed(sectors: { id: number; name: string }[]): DiscordEmbed {
  return {
    title: '🏭 ¿De qué sector quieres reportar?',
    description: `Tienes acceso a ${sectors.length} sectores. Selecciona uno:`,
    color: DISCORD_COLORS.INFO,
    footer: { text: 'Usa los botones para seleccionar' },
    timestamp: new Date().toISOString(),
  }
}

// ============================================
// HANDLERS
// ============================================

/**
 * Detecta si un mensaje es el comando "Falla"
 */
export function isFailureCommand(message: DiscordMessage): boolean {
  const content = message.content?.toLowerCase().trim()
  return content === 'falla' || content === 'fallo' || content === 'reportar falla'
}

/**
 * Detecta si un mensaje es un comando de OT directa
 */
export function isOTCommand(message: DiscordMessage): boolean {
  const content = message.content?.toLowerCase().trim()
  return content === 'ot' || content === 'orden' || content === 'crear ot' || content === 'orden de trabajo'
}

/**
 * Detecta si un mensaje es "cancelar"
 */
function isCancelCommand(message: DiscordMessage): boolean {
  const content = message.content?.toLowerCase().trim()
  return content === 'cancelar' || content === 'cancel' || content === 'salir'
}

/**
 * Obtiene los sectores a los que tiene acceso un usuario vía Discord
 */
async function getUserSectors(userId: number): Promise<SectorInfo[]> {
  const userWithSectors = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      discordSectorAccess: {
        select: {
          sector: {
            select: { id: true, name: true },
          },
        },
      },
    },
  })

  if (!userWithSectors?.discordSectorAccess) {
    return []
  }

  return userWithSectors.discordSectorAccess.map(a => ({
    id: a.sector.id,
    name: a.sector.name,
  }))
}

/**
 * Handler para el comando inicial "Falla"
 */
export async function handleFailureCommand(message: DiscordMessage): Promise<void> {
  const discordUserId = message.author.id

  try {
    // Buscar usuario vinculado
    const user = await getUserByDiscordId(discordUserId)

    if (!user) {
      await message.reply({
        embeds: [
          buildErrorEmbed(
            'Tu cuenta de Discord no está vinculada a ORVIT.',
            'Pide a un administrador que vincule tu cuenta de Discord.'
          ),
        ],
      })
      return
    }

    // Eliminar sesión anterior si existe
    deleteSession(discordUserId)

    // Obtener sectores del usuario
    const userSectors = await getUserSectors(user.id)

    // Caso: Usuario tiene múltiples sectores → preguntar cuál
    if (userSectors.length > 1) {
      createSession(discordUserId, {
        discordMessageId: message.id,
        userId: user.id,
        companyId: user.companyId,
        status: 'AWAITING_SECTOR',
        type: 'FAILURE',
        availableSectors: userSectors,
      })

      // Crear botones para selección de sector
      const sectorComponents = await createSectorButtons(userSectors)

      await message.reply({
        embeds: [buildSectorSelectionEmbed(userSectors)],
        components: sectorComponents,
      })

      console.log(`[FailureVoiceHandler] Usuario ${discordUserId} tiene ${userSectors.length} sectores, pidiendo selección`)
      return
    }

    // Caso: Usuario tiene 1 sector → filtrar máquinas de ese sector
    // Caso: Usuario tiene 0 sectores → mostrar todas las máquinas de la empresa
    let machines: MachineInfo[]
    let selectedSectorId: number | undefined

    if (userSectors.length === 1) {
      // Filtrar máquinas por el único sector del usuario
      selectedSectorId = userSectors[0].id
      machines = await getMachinesForUser(user.id, user.companyId)
      machines = machines.filter(m => m.sectorId === selectedSectorId)

      console.log(`[FailureVoiceHandler] Usuario ${discordUserId} tiene 1 sector (${userSectors[0].name}), ${machines.length} máquinas filtradas`)
    } else {
      // Sin sectores asignados → todas las máquinas de la empresa
      machines = await getMachinesForUser(user.id, user.companyId)
      console.log(`[FailureVoiceHandler] Usuario ${discordUserId} sin sectores específicos, ${machines.length} máquinas totales`)
    }

    if (machines.length === 0) {
      await message.reply({
        embeds: [
          buildErrorEmbed(
            'No tienes máquinas asignadas en tu sector.',
            'Contacta a un administrador para que te asigne acceso a máquinas.'
          ),
        ],
      })
      return
    }

    // Crear sesión con máquinas (ya filtradas si aplica)
    createSession(discordUserId, {
      discordMessageId: message.id,
      userId: user.id,
      companyId: user.companyId,
      status: 'AWAITING_AUDIO',
      type: 'FAILURE',
      availableMachines: machines,
      selectedSectorId,
    })

    // Responder con instrucciones
    await message.reply({
      embeds: [buildInstructionsEmbed(machines)],
    })

    console.log(`[FailureVoiceHandler] Sesión creada para ${discordUserId}, ${machines.length} máquinas disponibles`)
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error en handleFailureCommand:', error)
    await message.reply({
      embeds: [buildErrorEmbed('Error procesando tu solicitud. Intenta de nuevo.')],
    })
  }
}

/**
 * Handler para iniciar falla desde interacción de botón (menú Hola)
 * Hace el mismo setup que handleFailureCommand pero responde a la interacción
 */
export async function handleFailureCommandFromInteraction(interaction: any): Promise<void> {
  const discordUserId = interaction.user.id

  try {
    // Buscar usuario vinculado
    const user = await getUserByDiscordId(discordUserId)

    if (!user) {
      await interaction.update({
        embeds: [
          buildErrorEmbed(
            'Tu cuenta de Discord no está vinculada a ORVIT.',
            'Pide a un administrador que vincule tu cuenta de Discord.'
          ),
        ],
        components: [],
      })
      return
    }

    // Eliminar sesión anterior si existe
    deleteSession(discordUserId)

    // Obtener sectores del usuario
    const userSectors = await getUserSectors(user.id)

    // Caso: Usuario tiene múltiples sectores → preguntar cuál
    if (userSectors.length > 1) {
      createSession(discordUserId, {
        discordMessageId: interaction.message?.id,
        userId: user.id,
        companyId: user.companyId,
        status: 'AWAITING_SECTOR',
        type: 'FAILURE',
        availableSectors: userSectors,
      })

      // Crear botones para selección de sector
      const sectorComponents = await createSectorButtons(userSectors)

      await interaction.update({
        embeds: [buildSectorSelectionEmbed(userSectors)],
        components: sectorComponents,
      })

      console.log(`[FailureVoiceHandler] Usuario ${discordUserId} tiene ${userSectors.length} sectores, pidiendo selección (desde interacción)`)
      return
    }

    // Caso: Usuario tiene 1 sector → filtrar máquinas de ese sector
    // Caso: Usuario tiene 0 sectores → mostrar todas las máquinas de la empresa
    let machines: MachineInfo[]
    let selectedSectorId: number | undefined

    if (userSectors.length === 1) {
      // Filtrar máquinas por el único sector del usuario
      selectedSectorId = userSectors[0].id
      machines = await getMachinesForUser(user.id, user.companyId)
      machines = machines.filter(m => m.sectorId === selectedSectorId)

      console.log(`[FailureVoiceHandler] Usuario ${discordUserId} tiene 1 sector (${userSectors[0].name}), ${machines.length} máquinas filtradas (desde interacción)`)
    } else {
      // Sin sectores asignados → todas las máquinas de la empresa
      machines = await getMachinesForUser(user.id, user.companyId)
      console.log(`[FailureVoiceHandler] Usuario ${discordUserId} sin sectores específicos, ${machines.length} máquinas totales (desde interacción)`)
    }

    if (machines.length === 0) {
      await interaction.update({
        embeds: [
          buildErrorEmbed(
            'No tienes máquinas asignadas en tu sector.',
            'Contacta a un administrador para que te asigne acceso a máquinas.'
          ),
        ],
        components: [],
      })
      return
    }

    // Crear sesión con máquinas (ya filtradas si aplica)
    createSession(discordUserId, {
      discordMessageId: interaction.message?.id,
      userId: user.id,
      companyId: user.companyId,
      status: 'AWAITING_AUDIO',
      type: 'FAILURE',
      availableMachines: machines,
      selectedSectorId,
    })

    // Responder con instrucciones
    await interaction.update({
      embeds: [buildInstructionsEmbed(machines)],
      components: [],
    })

    console.log(`[FailureVoiceHandler] Sesión creada para ${discordUserId} (desde interacción), ${machines.length} máquinas disponibles`)
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error en handleFailureCommandFromInteraction:', error)
    try {
      await interaction.update({
        embeds: [buildErrorEmbed('Error procesando tu solicitud. Intenta de nuevo.')],
        components: [],
      })
    } catch {
      // Si ya respondió, intentar con followUp
      await interaction.followUp({
        embeds: [buildErrorEmbed('Error procesando tu solicitud. Intenta de nuevo.')],
        ephemeral: true,
      })
    }
  }
}

/**
 * Handler para crear OT desde interacción de menú (menú Hola)
 * Similar a handleFailureCommandFromInteraction pero para OT directa
 */
export async function handleOTCommandFromInteraction(interaction: any): Promise<void> {
  const discordUserId = interaction.user.id

  try {
    // Buscar usuario vinculado
    const user = await getUserByDiscordId(discordUserId)

    if (!user) {
      await interaction.update({
        embeds: [
          buildErrorEmbed(
            'Tu cuenta de Discord no está vinculada a ORVIT.',
            'Pide a un administrador que vincule tu cuenta de Discord.'
          ),
        ],
        components: [],
      })
      return
    }

    // Eliminar sesión anterior si existe
    deleteSession(discordUserId)

    // Obtener sectores del usuario
    const userSectors = await getUserSectors(user.id)

    // Caso: Usuario tiene múltiples sectores → preguntar cuál
    if (userSectors.length > 1) {
      createSession(discordUserId, {
        discordMessageId: interaction.message?.id,
        userId: user.id,
        companyId: user.companyId,
        status: 'AWAITING_SECTOR',
        type: 'WORK_ORDER',
        availableSectors: userSectors,
      })

      // Crear botones para selección de sector
      const sectorComponents = await createSectorButtons(userSectors)

      await interaction.update({
        embeds: [{
          ...buildSectorSelectionEmbed(userSectors),
          title: '🔧 Crear OT - Selecciona Sector',
        }],
        components: sectorComponents,
      })

      console.log(`[OTHandler] Usuario ${discordUserId} tiene ${userSectors.length} sectores, pidiendo selección`)
      return
    }

    // Caso: Usuario tiene 1 sector → filtrar máquinas de ese sector
    // Caso: Usuario tiene 0 sectores → mostrar todas las máquinas de la empresa
    let machines: MachineInfo[]
    let selectedSectorId: number | undefined

    if (userSectors.length === 1) {
      selectedSectorId = userSectors[0].id
      machines = await getMachinesForUser(user.id, user.companyId)
      machines = machines.filter(m => m.sectorId === selectedSectorId)

      console.log(`[OTHandler] Usuario ${discordUserId} tiene 1 sector (${userSectors[0].name}), ${machines.length} máquinas filtradas`)
    } else {
      machines = await getMachinesForUser(user.id, user.companyId)
      console.log(`[OTHandler] Usuario ${discordUserId} sin sectores específicos, ${machines.length} máquinas totales`)
    }

    if (machines.length === 0) {
      await interaction.update({
        embeds: [
          buildErrorEmbed(
            'No tienes máquinas asignadas en tu sector.',
            'Contacta a un administrador para que te asigne acceso a máquinas.'
          ),
        ],
        components: [],
      })
      return
    }

    // Crear sesión para OT
    createSession(discordUserId, {
      discordMessageId: interaction.message?.id,
      userId: user.id,
      companyId: user.companyId,
      status: 'AWAITING_AUDIO',
      type: 'WORK_ORDER',
      availableMachines: machines,
      selectedSectorId,
    })

    // Responder con instrucciones de OT
    await interaction.update({
      embeds: [buildOTInstructionsEmbed(machines, userSectors.length === 1)],
      components: [],
    })

    console.log(`[OTHandler] Sesión OT creada para ${discordUserId}, ${machines.length} máquinas disponibles`)
  } catch (error: any) {
    console.error('[OTHandler] Error en handleOTCommandFromInteraction:', error)
    try {
      await interaction.update({
        embeds: [buildErrorEmbed('Error procesando tu solicitud. Intenta de nuevo.')],
        components: [],
      })
    } catch {
      await interaction.followUp({
        embeds: [buildErrorEmbed('Error procesando tu solicitud. Intenta de nuevo.')],
        ephemeral: true,
      })
    }
  }
}

/**
 * Handler para comando "OT" directo por mensaje de texto
 * Similar a handleFailureCommand pero para OT directa
 */
export async function handleOTCommand(message: DiscordMessage): Promise<void> {
  const discordUserId = message.author.id

  try {
    // Buscar usuario vinculado
    const user = await getUserByDiscordId(discordUserId)

    if (!user) {
      await message.reply({
        embeds: [
          buildErrorEmbed(
            'Tu cuenta de Discord no está vinculada a ORVIT.',
            'Pide a un administrador que vincule tu cuenta de Discord.'
          ),
        ],
      })
      return
    }

    // Eliminar sesión anterior si existe
    deleteSession(discordUserId)

    // Obtener sectores del usuario
    const userSectors = await getUserSectors(user.id)

    // Caso: Usuario tiene múltiples sectores → preguntar cuál
    if (userSectors.length > 1) {
      createSession(discordUserId, {
        discordMessageId: message.id,
        userId: user.id,
        companyId: user.companyId,
        status: 'AWAITING_SECTOR',
        type: 'WORK_ORDER',
        availableSectors: userSectors,
      })

      // Crear botones para selección de sector
      const sectorComponents = await createSectorButtons(userSectors)

      await message.reply({
        embeds: [{
          ...buildSectorSelectionEmbed(userSectors),
          title: '🔧 Crear OT - Selecciona Sector',
        }],
        components: sectorComponents,
      })

      console.log(`[OTHandler] Usuario ${discordUserId} tiene ${userSectors.length} sectores, pidiendo selección`)
      return
    }

    // Caso: Usuario tiene 1 sector → filtrar máquinas de ese sector
    // Caso: Usuario tiene 0 sectores → mostrar todas las máquinas de la empresa
    let machines: MachineInfo[]
    let selectedSectorId: number | undefined

    if (userSectors.length === 1) {
      selectedSectorId = userSectors[0].id
      machines = await getMachinesForUser(user.id, user.companyId)
      machines = machines.filter(m => m.sectorId === selectedSectorId)

      console.log(`[OTHandler] Usuario ${discordUserId} tiene 1 sector (${userSectors[0].name}), ${machines.length} máquinas filtradas`)
    } else {
      machines = await getMachinesForUser(user.id, user.companyId)
      console.log(`[OTHandler] Usuario ${discordUserId} sin sectores específicos, ${machines.length} máquinas totales`)
    }

    if (machines.length === 0) {
      await message.reply({
        embeds: [
          buildErrorEmbed(
            'No tienes máquinas asignadas en tu sector.',
            'Contacta a un administrador para que te asigne acceso a máquinas.'
          ),
        ],
      })
      return
    }

    // Crear sesión para OT
    createSession(discordUserId, {
      discordMessageId: message.id,
      userId: user.id,
      companyId: user.companyId,
      status: 'AWAITING_AUDIO',
      type: 'WORK_ORDER',
      availableMachines: machines,
      selectedSectorId,
    })

    // Responder con instrucciones de OT
    await message.reply({
      embeds: [buildOTInstructionsEmbed(machines, userSectors.length === 1)],
    })

    console.log(`[OTHandler] Sesión OT creada para ${discordUserId}, ${machines.length} máquinas disponibles`)
  } catch (error: any) {
    console.error('[OTHandler] Error en handleOTCommand:', error)
    await message.reply({
      embeds: [buildErrorEmbed('Error procesando tu solicitud. Intenta de nuevo.')],
    })
  }
}

/**
 * Handler para audio recibido en sesión activa
 */
export async function handleFailureAudio(
  message: DiscordMessage,
  audioAttachment: DiscordAttachment,
  session: VoiceFailureSession
): Promise<void> {
  const discordUserId = message.author.id

  try {
    // Verificar tamaño
    if (audioAttachment.size > CONFIG.maxAudioSizeBytes) {
      await message.reply({
        embeds: [
          buildErrorEmbed(
            `El audio es muy grande (${Math.round(audioAttachment.size / 1024 / 1024)}MB).`,
            'El tamaño máximo es 10MB.'
          ),
        ],
      })
      return
    }

    // Recolectar fotos adjuntas (si las hay)
    const imageAttachments = getImageAttachments(message)
    const photos: PhotoAttachment[] = imageAttachments.map(att => ({
      url: att.url,
      fileName: att.name || `photo_${Date.now()}.jpg`,
      originalName: att.name || 'photo.jpg',
      contentType: att.contentType,
      size: att.size,
    }))

    if (photos.length > 0) {
      console.log(`[FailureVoiceHandler] ${photos.length} fotos adjuntas detectadas`)
    }

    // Verificar idempotencia
    const existingLog = await prisma.voiceFailureLog.findUnique({
      where: { discordMessageId: message.id },
    })

    if (existingLog) {
      if (existingLog.status === 'COMPLETED' && existingLog.failureOccurrenceId) {
        await message.reply({
          content: `Este audio ya fue procesado. Falla: F-${existingLog.failureOccurrenceId}`,
        })
      } else if (existingLog.status === 'PROCESSING') {
        await message.reply({
          content: 'Este audio ya está siendo procesado. Espera un momento.',
        })
      }
      return
    }

    // Reaccionar que estamos procesando
    await message.react('⏳')

    // Crear log de auditoría
    const voiceLog = await prisma.voiceFailureLog.create({
      data: {
        companyId: session.companyId,
        userId: session.userId,
        discordUserId,
        discordMessageId: message.id,
        discordAttachmentId: audioAttachment.id,
        discordChannelId: message.channel?.id,
        audioUrl: audioAttachment.url,
        audioSize: audioAttachment.size,
        mimeType: audioAttachment.contentType || 'audio/webm',
        status: 'QUEUED',
        queuedAt: new Date(),
      },
    })

    // Actualizar sesión con logId y fotos (si las hay)
    updateSession(discordUserId, {
      logId: voiceLog.id,
      pendingPhotos: photos.length > 0 ? photos : undefined,
    })

    // Responder con embed de procesando (según tipo de sesión)
    const isWorkOrderSession = session.type === 'WORK_ORDER'
    const processingReply = await message.reply({
      embeds: [isWorkOrderSession ? buildOTProcessingEmbed() : buildProcessingEmbed()],
    })

    // Guardar referencia al mensaje de respuesta para actualizarlo después
    // Lo hacemos guardando en una variable global temporal (simplificación)
    pendingReplies.set(voiceLog.id, {
      message,
      reply: processingReply,
      session: { ...session, pendingPhotos: photos.length > 0 ? photos : undefined },
      photos,
    })

    // Encolar para procesamiento
    enqueueVoiceFailure(voiceLog.id)

    console.log(`[FailureVoiceHandler] Audio encolado, logId: ${voiceLog.id}`)
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error en handleFailureAudio:', error)
    await message.reactions.removeAll().catch(() => {})
    await message.react('❌')
    await message.reply({
      embeds: [buildErrorEmbed('Error procesando el audio. Intenta de nuevo.')],
    })
  }
}

/**
 * Handler para clarificación de máquina
 */
export async function handleMachineClarification(
  message: DiscordMessage,
  session: VoiceFailureSession
): Promise<void> {
  const discordUserId = message.author.id
  const content = message.content?.trim()

  try {
    // Verificar cancelación
    if (isCancelCommand(message)) {
      deleteSession(discordUserId)
      await message.reply({
        embeds: [buildCancelledEmbed()],
      })
      return
    }

    // Parsear número
    const num = parseInt(content, 10)

    if (isNaN(num) || num < 1 || num > (session.possibleMachines?.length || 0)) {
      await message.reply({
        content: `Responde con un número del 1 al ${session.possibleMachines?.length || 5}, o escribe "cancelar".`,
      })
      return
    }

    const selectedMachine = session.possibleMachines![num - 1]

    if (!selectedMachine || !session.logId) {
      await message.reply({
        embeds: [buildErrorEmbed('Error: datos de sesión incompletos. Escribe "Falla" para comenzar de nuevo.')],
      })
      deleteSession(discordUserId)
      return
    }

    // Reaccionar procesando
    await message.react('⏳')

    // Completar la falla con la máquina seleccionada
    const result = await completeFailureWithMachine(
      session.logId,
      selectedMachine.id,
      session.userId,
      session.companyId
    )

    await message.reactions.removeAll().catch(() => {})

    if (result.success && result.occurrence) {
      await message.react('✅')
      await message.reply({
        embeds: [buildFailureCreatedEmbed(result.occurrence, result.extractedData!, result.matchedComponent)],
      })

      // FLUJO HÍBRIDO DESHABILITADO TEMPORALMENTE
      // TODO: Re-habilitar cuando esté estable
      const extracted = result.extractedData!

      // Debug: mostrar valores del flujo híbrido (para análisis)
      console.log('[FailureVoiceHandler] Clarificación - Datos híbridos (deshabilitado):', {
        wasResolved: extracted.wasResolved,
        solutionDescription: extracted.solutionDescription,
        needsWorkOrder: extracted.needsWorkOrder,
        suggestedAssignee: extracted.suggestedAssignee,
      })

      // Siempre ir al flujo normal POST_FAILURE
      updateSession(discordUserId, {
        status: 'POST_FAILURE',
        createdFailureId: result.occurrence.id,
        createdFailureTitle: result.occurrence.title,
      })

      // Crear botones post-falla
      const postButtons = await createPostFailureButtons(result.occurrence.id)

      await message.channel.send({
        embeds: [buildPostFailureEmbed(result.occurrence.id, result.occurrence.title)],
        components: [postButtons],
      })

      /* FLUJO HÍBRIDO COMENTADO - Descomentar cuando esté listo
      if (extracted.wasResolved && extracted.solutionDescription) {
        await handleAutoResolution(...)
      } else if (extracted.needsWorkOrder) {
        await handleAutoWorkOrder(...)
      } else {
        // flujo normal POST_FAILURE
      }
      */
    } else {
      await message.react('❌')
      await message.reply({
        embeds: [buildErrorEmbed(result.error || 'Error creando la falla.')],
      })
      deleteSession(discordUserId)
    }
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error en handleMachineClarification:', error)
    await message.reply({
      embeds: [buildErrorEmbed('Error procesando tu selección. Intenta de nuevo.')],
    })
  }
}

/**
 * Handler para selección de sector
 */
export async function handleSectorSelection(
  message: DiscordMessage,
  session: VoiceFailureSession
): Promise<void> {
  const discordUserId = message.author.id
  const content = message.content?.trim()

  try {
    // Verificar cancelación
    if (isCancelCommand(message)) {
      deleteSession(discordUserId)
      await message.reply({
        embeds: [buildCancelledEmbed()],
      })
      return
    }

    // Parsear número
    const num = parseInt(content, 10)
    const maxOption = session.availableSectors?.length || 0

    if (isNaN(num) || num < 1 || num > maxOption) {
      await message.reply({
        content: `Responde con un número del 1 al ${maxOption}, o escribe "cancelar".`,
      })
      return
    }

    const selectedSector = session.availableSectors![num - 1]

    if (!selectedSector) {
      await message.reply({
        embeds: [buildErrorEmbed('Error: sector no encontrado. Escribe "Falla" para comenzar de nuevo.')],
      })
      deleteSession(discordUserId)
      return
    }

    // Reaccionar procesando
    await message.react('⏳')

    // Obtener máquinas filtradas por el sector seleccionado
    const allMachines = await getMachinesForUser(session.userId, session.companyId)
    const filteredMachines = allMachines.filter(m => m.sectorId === selectedSector.id)

    await message.reactions.removeAll().catch(() => {})

    if (filteredMachines.length === 0) {
      await message.reply({
        embeds: [
          buildErrorEmbed(
            `No hay máquinas disponibles en el sector "${selectedSector.name}".`,
            'Selecciona otro sector o contacta a un administrador.'
          ),
        ],
      })
      // Volver a mostrar opciones de sector
      await message.channel.send({
        embeds: [buildSectorSelectionEmbed(session.availableSectors!)],
      })
      return
    }

    // Actualizar sesión con el sector seleccionado y máquinas filtradas
    updateSession(discordUserId, {
      status: 'AWAITING_AUDIO',
      type: 'FAILURE',
      selectedSectorId: selectedSector.id,
      availableMachines: filteredMachines,
    })

    await message.react('✅')

    // Mostrar instrucciones con máquinas del sector seleccionado
    await message.reply({
      embeds: [
        {
          ...buildInstructionsEmbed(filteredMachines, true),
          title: `🔴 Reportar Falla - ${selectedSector.name}`,
        },
      ],
    })

    console.log(
      `[FailureVoiceHandler] Sector seleccionado: ${selectedSector.name}, ${filteredMachines.length} máquinas`
    )
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error en handleSectorSelection:', error)
    await message.reply({
      embeds: [buildErrorEmbed('Error procesando tu selección. Intenta de nuevo.')],
    })
  }
}

/**
 * Handler para mensajes de cancelación
 */
export async function handleCancelCommand(message: DiscordMessage): Promise<void> {
  const discordUserId = message.author.id
  const session = getSession(discordUserId)

  if (session) {
    deleteSession(discordUserId)
    await message.reply({
      embeds: [buildCancelledEmbed()],
    })
  }
}

/**
 * Handler para respuesta post-falla (solucionado / crear OT)
 */
export async function handlePostFailureResponse(
  message: DiscordMessage,
  session: VoiceFailureSession
): Promise<void> {
  const discordUserId = message.author.id
  const content = message.content?.trim().toLowerCase()

  try {
    // Verificar cancelación o "dejar abierta"
    if (isCancelCommand(message) || content === '3' || content === 'cancelar' || content === 'dejar') {
      deleteSession(discordUserId)
      await message.reply({
        content: `✅ La falla **F-${session.createdFailureId}** queda abierta. Puedes gestionarla desde ORVIT.`,
      })
      return
    }

    // Opción 1: Solucionado - pedir descripción de la solución
    if (content === '1' || content === 'solucionado' || content === 'resuelto' || content === 'arreglado') {
      updateSession(discordUserId, {
        status: 'AWAITING_SOLUTION',
      })

      await message.reply({
        embeds: [buildAwaitingSolutionEmbed(session.createdFailureId!, session.createdFailureTitle!)],
      })
      return
    }

    // Opción 2: Crear OT - obtener técnicos y preguntar a quién asignar
    if (content === '2' || content === 'ot' || content === 'orden') {
      await message.react('⏳')

      // Obtener técnicos disponibles de la empresa
      const technicians = await prisma.user.findMany({
        where: {
          companies: { some: { companyId: session.companyId } },
          isActive: true,
          role: { in: ['USER', 'SUPERVISOR', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERADMIN'] },
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 10, // Limitar a 10 técnicos
      })

      await message.reactions.removeAll().catch(() => {})

      // Actualizar sesión con técnicos disponibles
      updateSession(discordUserId, {
        status: 'AWAITING_TECHNICIAN',
        availableTechnicians: technicians,
      })

      await message.reply({
        embeds: [buildTechnicianSelectionEmbed(technicians, session.createdFailureId!)],
      })
      return
    }

    // Respuesta no reconocida
    await message.reply({
      content: 'Responde con **1** (solucionado), **2** (crear OT), o **3** (dejar abierta).',
    })
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error en handlePostFailureResponse:', error)
    await message.reply({
      embeds: [buildErrorEmbed('Error procesando tu respuesta. Intenta de nuevo.')],
    })
  }
}

/**
 * Handler para respuesta de solución (cuando el usuario describe cómo solucionó)
 * Acepta texto o audio
 */
export async function handleSolutionResponse(
  message: DiscordMessage,
  session: VoiceFailureSession
): Promise<void> {
  const discordUserId = message.author.id
  let solutionText = message.content?.trim() || ''

  try {
    // Verificar cancelación
    if (isCancelCommand(message)) {
      deleteSession(discordUserId)
      await message.reply({
        content: `✅ La falla **F-${session.createdFailureId}** queda abierta. Puedes gestionarla desde ORVIT.`,
      })
      return
    }

    // Verificar si hay audio para transcribir
    const audioAttachment = hasAudioAttachment(message)
    if (audioAttachment) {
      await message.react('⏳')

      try {
        // Descargar y transcribir audio
        const audioBuffer = await downloadAttachment(audioAttachment.url)
        const { transcribeAudio } = await import('@/lib/assistant/failure-extractor')
        solutionText = await transcribeAudio(audioBuffer, audioAttachment.contentType || 'audio/webm')

        console.log(`[FailureVoiceHandler] Solución transcrita: "${solutionText.substring(0, 100)}..."`)
      } catch (transcribeError) {
        console.error('[FailureVoiceHandler] Error transcribiendo solución:', transcribeError)
        await message.reactions.removeAll().catch(() => {})
        await message.reply({
          embeds: [buildErrorEmbed('No pude transcribir el audio. Intenta de nuevo o escribe la solución.')],
        })
        return
      }
    }

    // Validar que hay contenido
    if (!solutionText || solutionText.length < 3) {
      await message.reply({
        content: 'Por favor describe qué hiciste para solucionar. Puedes enviar un **audio** o escribir.',
      })
      return
    }

    if (!audioAttachment) {
      await message.react('⏳')
    }

    // Validar que tenemos el ID de la falla
    if (!session.createdFailureId) {
      await message.reactions.removeAll().catch(() => {})
      await message.reply({
        embeds: [buildErrorEmbed('Error: sesión inválida. Escribe "Falla" para comenzar de nuevo.')],
      })
      deleteSession(discordUserId)
      return
    }

    // Marcar falla como resuelta y crear registro de solución aplicada
    const now = new Date()
    const failureId = session.createdFailureId

    // Usar transacción para garantizar consistencia
    await prisma.$transaction(async (tx) => {
      // Actualizar estado de la falla
      await tx.failureOccurrence.update({
        where: { id: failureId },
        data: {
          status: 'RESOLVED',
          resolvedAt: now,
          resolvedImmediately: true,
          notes: solutionText,
        },
      })

      // Crear registro de solución aplicada
      await tx.solutionApplied.create({
        data: {
          failureOccurrence: { connect: { id: failureId } },
          company: { connect: { id: session.companyId } },
          diagnosis: audioAttachment
            ? 'Resolución inmediata vía Discord (audio transcrito)'
            : 'Resolución inmediata vía Discord',
          solution: solutionText,
          outcome: 'WORKED',
          performedBy: { connect: { id: session.userId } },
          performedAt: now,
          fixType: 'DEFINITIVA',
        },
      })
    })

    await message.reactions.removeAll().catch(() => {})
    await message.react('✅')

    // Limpiar sesión
    deleteSession(discordUserId)

    await message.reply({
      embeds: [buildResolvedEmbed(failureId)],
    })

    console.log(`[FailureVoiceHandler] Falla F-${failureId} marcada como resuelta con solución`)
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error en handleSolutionResponse:', error)
    await message.reactions.removeAll().catch(() => {})
    await message.reply({
      embeds: [buildErrorEmbed('Error al guardar la solución. Intenta de nuevo.')],
    })
  }
}

/**
 * Handler para selección de técnico para la OT
 */
export async function handleTechnicianSelection(
  message: DiscordMessage,
  session: VoiceFailureSession
): Promise<void> {
  const discordUserId = message.author.id
  const content = message.content?.trim().toLowerCase()

  try {
    // Verificar cancelación
    if (isCancelCommand(message)) {
      deleteSession(discordUserId)
      await message.reply({
        content: `✅ La falla **F-${session.createdFailureId}** queda abierta sin OT. Puedes gestionarla desde ORVIT.`,
      })
      return
    }

    // Si no hay técnicos y responde "ok", crear OT sin asignar
    if ((!session.availableTechnicians || session.availableTechnicians.length === 0) && content === 'ok') {
      await createWorkOrderForFailure(message, session, null)
      return
    }

    // Parsear número
    const num = parseInt(content, 10)
    const maxOption = session.availableTechnicians?.length || 0

    if (isNaN(num) || num < 0 || num > maxOption) {
      await message.reply({
        content: `Responde con un número del 0 al ${maxOption}, o escribe "cancelar".`,
      })
      return
    }

    // 0 = sin asignar
    const selectedTechnician = num === 0 ? null : session.availableTechnicians![num - 1]

    await createWorkOrderForFailure(message, session, selectedTechnician)
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error en handleTechnicianSelection:', error)
    await message.reply({
      embeds: [buildErrorEmbed('Error al crear la OT. Intenta de nuevo.')],
    })
  }
}

/**
 * Crea una OT para la falla con el técnico seleccionado
 */
async function createWorkOrderForFailure(
  message: DiscordMessage,
  session: VoiceFailureSession,
  technician: { id: number; name: string } | null
): Promise<void> {
  const discordUserId = message.author.id

  try {
    // Validar sesión
    if (!session.createdFailureId) {
      await message.reply({
        embeds: [buildErrorEmbed('Error: sesión inválida. Escribe "Falla" para comenzar de nuevo.')],
      })
      deleteSession(discordUserId)
      return
    }

    await message.react('⏳')

    const failureId = session.createdFailureId

    // Obtener datos de la falla con sector de la máquina
    const failure = await prisma.failureOccurrence.findUnique({
      where: { id: failureId },
      include: {
        machine: {
          select: { id: true, name: true, sectorId: true },
        },
      },
    })

    if (!failure) {
      throw new Error('Falla no encontrada')
    }

    // Mapear prioridad de la falla (P1/P2/P3/P4 o MEDIUM/HIGH/etc) a WorkOrder priority
    const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
      P1: 'URGENT',
      P2: 'HIGH',
      P3: 'MEDIUM',
      P4: 'LOW',
      URGENT: 'URGENT',
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    }
    const workOrderPriority = priorityMap[failure.priority || 'MEDIUM'] || 'MEDIUM'

    // Usar transacción para crear OT y actualizar falla
    const workOrder = await prisma.$transaction(async (tx) => {
      // Crear OT
      const newWorkOrder = await tx.workOrder.create({
        data: {
          companyId: session.companyId,
          machineId: failure.machineId,
          title: `OT por falla: ${failure.title}`,
          description: failure.description || '',
          type: 'CORRECTIVE',
          priority: workOrderPriority,
          status: 'INCOMING',
          origin: 'FAILURE',
          createdById: session.userId,
          assignedToId: technician?.id || null,
          sectorId: failure.machine?.sectorId || null,
        },
      })

      // Actualizar falla con referencia a la OT
      await tx.failureOccurrence.update({
        where: { id: failure.id },
        data: {
          status: 'IN_PROGRESS',
          failureId: newWorkOrder.id,
        },
      })

      return newWorkOrder
    })

    await message.reactions.removeAll().catch(() => {})
    await message.react('✅')

    // Limpiar sesión
    deleteSession(discordUserId)

    const assignedText = technician
      ? `Asignada a: **${technician.name}**`
      : 'Sin asignar (pendiente de asignación)'

    const baseEmbed = buildOTCreatedEmbed(failureId, workOrder.id)
    await message.reply({
      embeds: [
        {
          ...baseEmbed,
          fields: [
            ...baseEmbed.fields,
            {
              name: '👷 Asignación',
              value: assignedText,
              inline: false,
            },
          ],
        },
      ],
    })

    console.log(
      `[FailureVoiceHandler] OT-${workOrder.id} creada para F-${failureId}, técnico: ${technician?.name || 'sin asignar'}`
    )
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error creando OT:', error)
    await message.reactions.removeAll().catch(() => {})
    throw error
  }
}

// ============================================
// FLUJO HÍBRIDO - Auto resolución y OT
// ============================================

/**
 * Resuelve automáticamente la falla cuando el usuario dijo que ya la solucionó
 */
async function handleAutoResolution(
  message: DiscordMessage,
  discordUserId: string,
  failureId: number,
  userId: number,
  companyId: number,
  solutionDescription: string,
  failureTitle?: string
): Promise<void> {
  try {
    const now = new Date()

    // Usar transacción para garantizar consistencia
    await prisma.$transaction(async (tx) => {
      // Actualizar estado de la falla
      await tx.failureOccurrence.update({
        where: { id: failureId },
        data: {
          status: 'RESOLVED',
          resolvedAt: now,
          resolvedImmediately: true,
          notes: solutionDescription,
        },
      })

      // Crear registro de solución aplicada
      await tx.solutionApplied.create({
        data: {
          failureOccurrence: { connect: { id: failureId } },
          company: { connect: { id: companyId } },
          diagnosis: 'Resolución inmediata vía Discord (detectado en audio)',
          solution: solutionDescription,
          outcome: 'WORKED',
          performedBy: { connect: { id: userId } },
          performedAt: now,
          fixType: 'DEFINITIVA',
        },
      })
    })

    // Limpiar sesión
    deleteSession(discordUserId)

    // Notificar
    await message.channel.send({
      embeds: [
        {
          title: '✅ Falla Resuelta Automáticamente',
          description: `La falla **F-${failureId}** fue marcada como resuelta.\n\n**Solución:** ${solutionDescription}`,
          color: DISCORD_COLORS.SUCCESS,
          footer: { text: 'Detectado automáticamente desde el audio' },
        },
      ],
    })

    console.log(`[FailureVoiceHandler] Auto-resolución: F-${failureId} con "${solutionDescription}"`)
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error en auto-resolución:', error.message || error)

    // Fallback a flujo normal - pedir solución manualmente
    updateSession(discordUserId, {
      status: 'AWAITING_SOLUTION',
      createdFailureId: failureId,
      createdFailureTitle: failureTitle || 'Falla reportada',
    })

    await message.channel.send({
      embeds: [
        {
          title: '⚠️ No pude guardar la solución automáticamente',
          description: `Por favor, describe nuevamente cómo solucionaste el problema.`,
          color: DISCORD_COLORS.WARNING,
          footer: { text: 'Puedes enviar un audio o escribir' },
        },
      ],
    })
  }
}

/**
 * Inicia el flujo de OT cuando el usuario pidió que venga alguien
 */
async function handleAutoWorkOrder(
  message: DiscordMessage,
  discordUserId: string,
  failureId: number,
  failureTitle: string,
  userId: number,
  companyId: number,
  suggestedAssignee?: string | null
): Promise<void> {
  try {
    // Obtener técnicos disponibles
    const technicians = await prisma.user.findMany({
      where: {
        companies: { some: { companyId } },
        isActive: true,
        role: { in: ['USER', 'SUPERVISOR', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERADMIN'] },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 10,
    })

    // Si mencionó un nombre, intentar encontrar coincidencia
    if (suggestedAssignee && technicians.length > 0) {
      const normalizedSuggestion = suggestedAssignee.toLowerCase().trim()
      const matchedTech = technicians.find(
        t =>
          t.name.toLowerCase().includes(normalizedSuggestion) ||
          normalizedSuggestion.includes(t.name.toLowerCase().split(' ')[0])
      )

      if (matchedTech) {
        // Encontramos al técnico mencionado - crear OT directamente
        console.log(`[FailureVoiceHandler] Auto-OT: técnico encontrado "${matchedTech.name}"`)

        updateSession(discordUserId, {
          status: 'AWAITING_TECHNICIAN',
          createdFailureId: failureId,
          createdFailureTitle: failureTitle,
          availableTechnicians: technicians,
        })

        // Confirmar asignación
        await message.channel.send({
          embeds: [
            {
              title: '👷 Técnico Detectado',
              description: `Detecté que mencionaste a **${matchedTech.name}**.\n\n¿Confirmas asignar la OT a esta persona?`,
              color: DISCORD_COLORS.INFO,
              fields: [
                { name: '1️⃣ Sí, asignar', value: `Crear OT asignada a ${matchedTech.name}`, inline: false },
                { name: '2️⃣ No, elegir otro', value: 'Ver lista de técnicos', inline: false },
              ],
              footer: { text: 'Responde 1 o 2' },
            },
          ],
        })
        return
      }
    }

    // No encontramos coincidencia o no mencionó nombre - mostrar lista
    updateSession(discordUserId, {
      status: 'AWAITING_TECHNICIAN',
      createdFailureId: failureId,
      createdFailureTitle: failureTitle,
      availableTechnicians: technicians,
    })

    await message.channel.send({
      embeds: [buildTechnicianSelectionEmbed(technicians, failureId)],
    })

    console.log(`[FailureVoiceHandler] Auto-OT: mostrando lista de técnicos para F-${failureId}`)
  } catch (error) {
    console.error('[FailureVoiceHandler] Error en auto-OT:', error)
    // Fallback a flujo normal
    updateSession(discordUserId, {
      status: 'POST_FAILURE',
      createdFailureId: failureId,
      createdFailureTitle: failureTitle,
    })
    const fallbackButtons = await createPostFailureButtons(failureId)
    await message.channel.send({
      embeds: [buildPostFailureEmbed(failureId, failureTitle)],
      components: [fallbackButtons],
    })
  }
}

// ============================================
// PROCESAMIENTO DE COLA
// ============================================

// Mapa temporal de respuestas pendientes
const pendingReplies = new Map<
  number,
  {
    message: DiscordMessage
    reply: DiscordMessage
    session: VoiceFailureSession
    photos?: PhotoAttachment[]
  }
>()

/**
 * Procesa un item de la cola (llamado por failure-voice-queue)
 */
async function processFailureFromQueue(logId: number): Promise<void> {
  console.log(`[FailureVoiceHandler] Procesando desde cola: logId ${logId}`)

  // Obtener log
  const log = await prisma.voiceFailureLog.findUnique({
    where: { id: logId },
  })

  if (!log) {
    console.error(`[FailureVoiceHandler] Log no encontrado: ${logId}`)
    return
  }

  // Obtener referencia al mensaje de respuesta
  const pending = pendingReplies.get(logId)

  try {
    // Descargar audio
    if (!log.audioUrl) {
      throw new Error('URL de audio no disponible')
    }

    const audioBuffer = await downloadAttachment(log.audioUrl)
    const audioHash = await calculateHash(audioBuffer)

    // Verificar duplicado por hash
    const duplicateByHash = await prisma.voiceFailureLog.findFirst({
      where: {
        audioHash,
        id: { not: logId },
        status: 'COMPLETED',
      },
      select: { failureOccurrenceId: true },
    })

    if (duplicateByHash?.failureOccurrenceId) {
      console.log(`[FailureVoiceHandler] Duplicado detectado por hash: F-${duplicateByHash.failureOccurrenceId}`)
      await prisma.voiceFailureLog.update({
        where: { id: logId },
        data: {
          audioHash,
          status: 'FAILED',
          errorMessage: `Duplicado: mismo audio ya procesado como F-${duplicateByHash.failureOccurrenceId}`,
          processedAt: new Date(),
        },
      })

      if (pending) {
        await pending.message.reactions.removeAll().catch(() => {})
        await pending.message.react('⚠️')
        await pending.reply.edit({
          embeds: [
            buildErrorEmbed(
              `Este audio ya fue procesado anteriormente.`,
              `Ver falla existente: F-${duplicateByHash.failureOccurrenceId}`
            ),
          ],
        })
        pendingReplies.delete(logId)
      }
      return
    }

    // Actualizar hash
    await prisma.voiceFailureLog.update({
      where: { id: logId },
      data: { audioHash },
    })

    // Obtener máquinas - usar las filtradas de la sesión si están disponibles
    // Esto respeta el filtro de sector que el usuario seleccionó
    let machines: MachineInfo[]
    if (pending?.session?.availableMachines && pending.session.availableMachines.length > 0) {
      machines = pending.session.availableMachines
      console.log(`[FailureVoiceHandler] Usando ${machines.length} máquinas filtradas de la sesión`)
    } else {
      machines = await getMachinesForUser(log.userId, log.companyId)
      console.log(`[FailureVoiceHandler] Usando ${machines.length} máquinas del usuario (sin filtro de sector)`)
    }

    // Obtener fotos si las hay
    const photos = pending?.photos || pending?.session?.pendingPhotos

    // Detectar tipo de sesión
    const isWorkOrderSession = pending?.session?.type === 'WORK_ORDER'

    if (isWorkOrderSession) {
      // ============================================
      // FLUJO DE ORDEN DE TRABAJO DIRECTA
      // ============================================
      console.log('[OTHandler] Procesando audio para OT directa...')

      const otResult = await processVoiceToWorkOrder(
        audioBuffer,
        log.mimeType || 'audio/webm',
        log.userId,
        log.companyId,
        machines,
        logId,
        (identifier, machineList) => findMatchingMachines(identifier, machineList),
        pending?.session?.selectedSectorId
      )

      if (pending) {
        await pending.message.reactions.removeAll().catch(() => {})
      }

      if (otResult.success && otResult.pendingOTData) {
        // Éxito - mostrar menú de técnicos antes de crear la OT
        if (pending) {
          await pending.message.react('✅')

          // Obtener técnicos disponibles
          const technicians = await getTechniciansForSector(
            log.companyId,
            otResult.pendingOTData.sectorId,
            otResult.pendingOTData.machineId
          )

          // Guardar datos en sesión
          updateSession(log.discordUserId, {
            status: 'AWAITING_OT_TECHNICIAN',
            type: 'WORK_ORDER',
            pendingOTData: otResult.pendingOTData,
            availableTechnicians: technicians,
          })

          // Crear menú de técnicos
          const techComponents = await createTechnicianSelectMenu(technicians, 0, 'ot_direct')

          await pending.reply.edit({
            embeds: [
              {
                title: '🔧 OT Lista - Selecciona Técnico',
                description: `**${otResult.pendingOTData.title}**\n\n📋 ${otResult.pendingOTData.description}\n\n🏭 Máquina: **${otResult.pendingOTData.machineName}**`,
                color: DISCORD_COLORS.INFO,
                footer: { text: 'Selecciona a quién asignar la OT' },
              },
            ],
            components: techComponents,
          })

          console.log(`[OTHandler] Esperando selección de técnico para OT en ${otResult.pendingOTData.machineName}`)
        }
      } else if (otResult.needsClarification) {
        // Necesita clarificación de máquina
        if (pending) {
          await pending.message.react('🤔')
          updateSession(log.discordUserId, {
            status: 'CLARIFICATION_NEEDED',
            type: 'WORK_ORDER', // Mantener tipo
            possibleMachines: otResult.possibleMachines,
            pendingExtractedData: otResult.extractedData,
            logId,
          })

          const machineComponents = await createMachineSelectMenu(otResult.possibleMachines || machines)
          await pending.reply.edit({
            embeds: [buildClarificationEmbed(otResult.possibleMachines || machines, otResult.extractedData?.machineIdentifier || '')],
            components: machineComponents,
          })
        }
      } else {
        // Error
        if (pending) {
          await pending.message.react('❌')
          const retryComponents = await createRetryButton('voice')
          await pending.reply.edit({
            embeds: [buildErrorEmbed(otResult.error || 'Error procesando el audio.', 'Puedes intentar de nuevo')],
            components: [retryComponents],
          })
        }
        deleteSession(log.discordUserId)
      }
      return // Salir del flujo de fallas
    }

    // ============================================
    // FLUJO DE FALLA NORMAL
    // ============================================

    // Procesar audio (con fotos si las hay)
    const result = await processVoiceToFailure(
      audioBuffer,
      log.mimeType || 'audio/webm',
      log.userId,
      log.companyId,
      machines,
      logId,
      (identifier, machineList) => findMatchingMachines(identifier, machineList),
      photos
    )

    if (pending) {
      await pending.message.reactions.removeAll().catch(() => {})
    }

    if (result.success && result.occurrence) {
      // Éxito
      if (pending) {
        await pending.message.react('✅')
        await pending.reply.edit({
          embeds: [buildFailureCreatedEmbed(result.occurrence, result.extractedData!, result.matchedComponent)],
        })

        // FLUJO HÍBRIDO DESHABILITADO TEMPORALMENTE
        const extracted = result.extractedData!

        // Debug: mostrar valores (para análisis futuro)
        console.log('[FailureVoiceHandler] Procesamiento directo - Datos híbridos (deshabilitado):', {
          wasResolved: extracted.wasResolved,
          solutionDescription: extracted.solutionDescription,
          needsWorkOrder: extracted.needsWorkOrder,
          suggestedAssignee: extracted.suggestedAssignee,
        })

        // Siempre ir al flujo normal POST_FAILURE
        updateSession(log.discordUserId, {
          status: 'POST_FAILURE',
          createdFailureId: result.occurrence.id,
          createdFailureTitle: result.occurrence.title,
        })

        // Crear botones post-falla
        const queuePostButtons = await createPostFailureButtons(result.occurrence.id)

        await pending.message.channel.send({
          embeds: [buildPostFailureEmbed(result.occurrence.id, result.occurrence.title)],
          components: [queuePostButtons],
        })
      } else {
        // Si no hay pending, igual limpiar sesión
        deleteSession(log.discordUserId)
      }
    } else if (result.needsClarification) {
      // Necesita clarificación de máquina
      if (pending) {
        await pending.message.react('🤔')

        // Actualizar sesión para clarificación (preservar fotos)
        updateSession(log.discordUserId, {
          status: 'CLARIFICATION_NEEDED',
          possibleMachines: result.possibleMachines,
          pendingExtractedData: result.extractedData,
          logId,
          pendingPhotos: photos, // Preservar fotos para cuando se complete
        })

        // Crear select menu de máquinas
        const machineComponents = await createMachineSelectMenu(result.possibleMachines || machines)

        await pending.reply.edit({
          embeds: [
            buildClarificationEmbed(result.possibleMachines || machines, result.extractedData?.machineIdentifier || ''),
          ],
          components: machineComponents,
        })
      }
    } else {
      // Error - agregar botón de reintento
      if (pending) {
        await pending.message.react('❌')
        const retryComponents = await createRetryButton('voice')
        await pending.reply.edit({
          embeds: [buildErrorEmbed(result.error || 'Error procesando el audio.', 'Puedes intentar de nuevo con el botón o enviar "Falla"')],
          components: [retryComponents],
        })
      }

      deleteSession(log.discordUserId)
    }
  } catch (error: any) {
    console.error(`[FailureVoiceHandler] Error procesando logId ${logId}:`, error)

    await prisma.voiceFailureLog.update({
      where: { id: logId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
        processedAt: new Date(),
      },
    })

    if (pending) {
      await pending.message.reactions.removeAll().catch(() => {})
      await pending.message.react('❌')
      const retryComponents = await createRetryButton('voice')
      await pending.reply.edit({
        embeds: [buildErrorEmbed(error.message || 'Error procesando el audio.', 'Puedes intentar de nuevo con el botón o enviar "Falla"')],
        components: [retryComponents],
      })
    }

    deleteSession(log.discordUserId)
  } finally {
    pendingReplies.delete(logId)
  }
}

/**
 * Verifica si un mensaje debe procesarse como parte del flujo de fallas
 */
export function shouldProcessAsFailureFlow(
  message: DiscordMessage,
  _botUserId: string
): {
  isFailureCommand: boolean
  isOTCommand: boolean
  hasAudio: boolean
  audioAttachment?: DiscordAttachment
  hasActiveSession: boolean
  isCancelCommand: boolean
} {
  const discordUserId = message.author.id
  const session = getSession(discordUserId)
  const audioAtt = hasAudioAttachment(message)

  return {
    isFailureCommand: isFailureCommand(message),
    isOTCommand: isOTCommand(message),
    hasAudio: !!audioAtt,
    audioAttachment: audioAtt || undefined,
    hasActiveSession: !!session,
    isCancelCommand: isCancelCommand(message),
  }
}

// ============================================
// INTERACTION HANDLER (Buttons & Select Menus)
// ============================================

/**
 * Handler principal para interacciones de botones y select menus
 */
export async function handleFailureInteraction(interaction: any): Promise<boolean> {
  // Solo manejar interacciones en DMs
  if (interaction.guild) return false

  const discordUserId = interaction.user.id
  const customId = interaction.customId

  console.log(`[FailureVoiceHandler] Interacción recibida: ${customId} de ${discordUserId}`)

  try {
    // Parsear el customId
    const { action, id, extra } = parseCustomId(customId)

    // === CANCELAR FLUJO ===
    if (action === 'cancel' || customId === 'cancel_flow' || customId === 'cancel_ot') {
      const session = getSession(discordUserId)
      if (session) {
        deleteSession(discordUserId)
      }

      await interaction.update({
        embeds: [buildCancelledEmbed()],
        components: [], // Remover botones
      })
      return true
    }

    // === SELECCIÓN DE SECTOR ===
    if (action === 'sector' && id) {
      return await handleSectorButtonClick(interaction, discordUserId, id)
    }

    // Selector de sector (dropdown)
    if (customId === 'sector_select' && interaction.values?.[0]) {
      const sectorId = parseInt(interaction.values[0].replace('sector_', ''), 10)
      if (!isNaN(sectorId)) {
        return await handleSectorButtonClick(interaction, discordUserId, sectorId)
      }
    }

    // === SELECCIÓN DE MÁQUINA ===
    if (customId === 'machine_select' && interaction.values?.[0]) {
      const machineId = parseInt(interaction.values[0].replace('machine_', ''), 10)
      if (!isNaN(machineId)) {
        return await handleMachineSelectClick(interaction, discordUserId, machineId)
      }
    }

    // === BOTONES POST-FALLA ===
    if (action === 'resolve' && id) {
      return await handleResolveButtonClick(interaction, discordUserId, id)
    }

    if (action === 'create' && extra === 'ot' && id) {
      // customId: create_ot_123
      const failureId = parseInt(customId.split('_')[2], 10)
      return await handleCreateOTButtonClick(interaction, discordUserId, failureId)
    }

    // Parsear create_ot_123 directamente
    if (customId.startsWith('create_ot_')) {
      const failureId = parseInt(customId.replace('create_ot_', ''), 10)
      if (!isNaN(failureId)) {
        return await handleCreateOTButtonClick(interaction, discordUserId, failureId)
      }
    }

    if (action === 'done' && id) {
      return await handleDoneButtonClick(interaction, discordUserId, id)
    }

    // === SELECCIÓN DE TÉCNICO ===
    if (customId === 'technician_select' && interaction.values?.[0]) {
      return await handleTechnicianSelectClick(interaction, discordUserId, interaction.values[0])
    }

    if (customId.startsWith('ot_no_assign_')) {
      const failureId = parseInt(customId.replace('ot_no_assign_', ''), 10)
      if (!isNaN(failureId)) {
        return await handleTechnicianSelectClick(interaction, discordUserId, `tech_none_${failureId}`)
      }
    }

    // === SELECCIÓN DE TÉCNICO PARA OT DIRECTA ===
    if (customId === 'ot_direct_tech_select' && interaction.values?.[0]) {
      return await handleOTDirectTechnicianSelect(interaction, discordUserId, interaction.values[0])
    }

    if (customId === 'ot_direct_no_assign') {
      return await handleOTDirectTechnicianSelect(interaction, discordUserId, 'ot_direct_none')
    }

    // === REINTENTO ===
    if (action === 'retry') {
      return await handleRetryButtonClick(interaction, discordUserId, extra || '')
    }

    console.log(`[FailureVoiceHandler] Interacción no manejada: ${customId}`)
    return false
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error en handleFailureInteraction:', error)

    try {
      await interaction.reply({
        content: '❌ Ocurrió un error. Escribe "Falla" para comenzar de nuevo.',
        ephemeral: true,
      })
    } catch {
      // Ignorar si ya se respondió
    }

    return true
  }
}

/**
 * Handler para click en botón de sector
 */
async function handleSectorButtonClick(
  interaction: any,
  discordUserId: string,
  sectorId: number
): Promise<boolean> {
  const session = getSession(discordUserId)

  if (!session || session.status !== 'AWAITING_SECTOR') {
    await interaction.reply({
      content: '⚠️ Sesión expirada. Escribe "Falla" para comenzar de nuevo.',
      ephemeral: true,
    })
    return true
  }

  const selectedSector = session.availableSectors?.find(s => s.id === sectorId)
  if (!selectedSector) {
    await interaction.reply({
      content: '❌ Sector no encontrado.',
      ephemeral: true,
    })
    return true
  }

  // Deferir la respuesta mientras procesamos
  await interaction.deferUpdate()

  // Obtener máquinas del sector
  const allMachines = await getMachinesForUser(session.userId, session.companyId)
  const filteredMachines = allMachines.filter(m => m.sectorId === sectorId)

  if (filteredMachines.length === 0) {
    await interaction.editReply({
      embeds: [
        buildErrorEmbed(
          `No hay máquinas en el sector "${selectedSector.name}".`,
          'Selecciona otro sector o contacta a un administrador.'
        ),
      ],
      components: await createSectorButtons(session.availableSectors!),
    })
    return true
  }

  // Preservar el tipo de sesión original (FAILURE o WORK_ORDER)
  const sessionType = session.type || 'FAILURE'
  const isWorkOrder = sessionType === 'WORK_ORDER'

  // Actualizar sesión
  updateSession(discordUserId, {
    status: 'AWAITING_AUDIO',
    type: sessionType,
    selectedSectorId: sectorId,
    availableMachines: filteredMachines,
  })

  // Actualizar mensaje con instrucciones según el tipo
  if (isWorkOrder) {
    await interaction.editReply({
      embeds: [
        {
          ...buildOTInstructionsEmbed(filteredMachines, true),
          title: `🔧 Crear OT - ${selectedSector.name}`,
        },
      ],
      components: [], // Remover botones de sector
    })
    console.log(`[OTHandler] Sector seleccionado vía botón: ${selectedSector.name}`)
  } else {
    await interaction.editReply({
      embeds: [
        {
          ...buildInstructionsEmbed(filteredMachines, true),
          title: `🔴 Reportar Falla - ${selectedSector.name}`,
        },
      ],
      components: [], // Remover botones de sector
    })
    console.log(`[FailureVoiceHandler] Sector seleccionado vía botón: ${selectedSector.name}`)
  }
  return true
}

/**
 * Handler para selección de máquina vía select menu
 */
async function handleMachineSelectClick(
  interaction: any,
  discordUserId: string,
  machineId: number
): Promise<boolean> {
  const session = getSession(discordUserId)

  if (!session || session.status !== 'CLARIFICATION_NEEDED') {
    await interaction.reply({
      content: '⚠️ Sesión expirada. Escribe "Falla" para comenzar de nuevo.',
      ephemeral: true,
    })
    return true
  }

  // Deferrir mientras procesamos
  await interaction.deferUpdate()

  // Encontrar la máquina en las opciones
  const machine = session.possibleMachines?.find(m => m.id === machineId)
  if (!machine) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('Máquina no encontrada. Escribe "Falla" para comenzar de nuevo.')],
      components: [],
    })
    deleteSession(discordUserId)
    return true
  }

  // Detectar si es sesión de WORK_ORDER
  if (session.type === 'WORK_ORDER') {
    // Calcular prioridad
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM'
    const descLower = (session.pendingExtractedData?.description || '').toLowerCase()
    if (descLower.includes('urgente') || descLower.includes('crítico') || descLower.includes('paró')) {
      priority = 'URGENT'
    } else if (descLower.includes('alta') || descLower.includes('importante')) {
      priority = 'HIGH'
    } else if (descLower.includes('baja') || descLower.includes('cuando puedas')) {
      priority = 'LOW'
    }

    const title = session.pendingExtractedData?.title || `Trabajo en ${machine.name}`

    // Obtener técnicos disponibles
    const technicians = await getTechniciansForSector(
      session.companyId,
      session.selectedSectorId || machine.sectorId,
      machine.id
    )

    // Guardar datos en sesión y mostrar menú de técnicos
    updateSession(discordUserId, {
      status: 'AWAITING_OT_TECHNICIAN',
      type: 'WORK_ORDER',
      pendingOTData: {
        machineId: machine.id,
        machineName: machine.name,
        title,
        description: session.pendingExtractedData?.description || '',
        priority,
        sectorId: session.selectedSectorId || machine.sectorId,
      },
      availableTechnicians: technicians,
    })

    // Crear menú de técnicos
    const techComponents = await createTechnicianSelectMenu(technicians, 0, 'ot_direct')

    await interaction.editReply({
      embeds: [
        {
          title: '🔧 OT Lista - Selecciona Técnico',
          description: `**${title}**\n\n📋 ${session.pendingExtractedData?.description || ''}\n\n🏭 Máquina: **${machine.name}**`,
          color: DISCORD_COLORS.INFO,
          footer: { text: 'Selecciona a quién asignar la OT' },
        },
      ],
      components: techComponents,
    })

    console.log(`[OTHandler] Esperando selección de técnico para OT en ${machine.name}`)
    return true
  }

  // Completar la falla con la máquina seleccionada (incluir fotos si las hay)
  const result = await completeFailureWithMachine(
    session.pendingExtractedData!,
    machine.id,
    session.userId,
    session.companyId,
    session.pendingPhotos
  )

  if (result.success && result.occurrence) {
    // Crear botones post-falla
    const postFailureButtons = await createPostFailureButtons(result.occurrence.id)

    await interaction.editReply({
      embeds: [buildFailureCreatedEmbed(result.occurrence, result.extractedData!, result.matchedComponent)],
      components: [postFailureButtons],
    })

    // Actualizar sesión a POST_FAILURE
    updateSession(discordUserId, {
      status: 'POST_FAILURE',
      createdFailureId: result.occurrence.id,
      createdFailureTitle: result.occurrence.title,
    })

    console.log(`[FailureVoiceHandler] Falla creada vía select: F-${result.occurrence.id}`)
  } else {
    await interaction.editReply({
      embeds: [buildErrorEmbed(result.error || 'Error creando la falla.')],
      components: [],
    })
    deleteSession(discordUserId)
  }

  return true
}

/**
 * Handler para selección de técnico en OT directa
 */
async function handleOTDirectTechnicianSelect(
  interaction: any,
  discordUserId: string,
  value: string
): Promise<boolean> {
  const session = getSession(discordUserId)

  if (!session || session.status !== 'AWAITING_OT_TECHNICIAN' || !session.pendingOTData) {
    await interaction.reply({
      content: '⚠️ Sesión expirada. Escribe "OT" para comenzar de nuevo.',
      ephemeral: true,
    })
    return true
  }

  await interaction.deferUpdate()

  // Parsear el valor seleccionado
  let technicianId: number | null = null
  let technicianName: string | null = null

  if (value !== 'ot_direct_none') {
    // Formato: ot_direct_{techId}
    technicianId = parseInt(value.replace('ot_direct_', ''), 10)
    if (!isNaN(technicianId)) {
      const tech = session.availableTechnicians?.find(t => t.id === technicianId)
      technicianName = tech?.name || null
    }
  }

  try {
    // Crear la OT
    const workOrder = await prisma.workOrder.create({
      data: {
        companyId: session.companyId,
        machineId: session.pendingOTData.machineId,
        title: session.pendingOTData.title,
        description: session.pendingOTData.description,
        type: 'CORRECTIVE',
        priority: session.pendingOTData.priority as any,
        status: 'INCOMING',
        origin: 'FAILURE',
        createdById: session.userId,
        assignedToId: technicianId,
        sectorId: session.pendingOTData.sectorId || null,
      },
    })

    console.log(`[OTHandler] OT-${workOrder.id} creada, asignada a: ${technicianName || 'sin asignar'}`)

    // Enviar notificación al servidor
    if (session.pendingOTData.sectorId) {
      try {
        await notifyOTCreated({
          id: workOrder.id,
          title: workOrder.title,
          type: 'CORRECTIVA',
          priority: session.pendingOTData.priority,
          machineName: session.pendingOTData.machineName,
          sectorId: session.pendingOTData.sectorId,
          assignedTo: technicianName || undefined,
          origin: 'Voz',
        })
      } catch (notifyError) {
        console.error('[OTHandler] Error notificando OT:', notifyError)
      }
    }

    // Notificar al técnico asignado
    if (technicianId && technicianName) {
      try {
        const priorityLabels: Record<string, string> = {
          LOW: '🟢 Baja',
          MEDIUM: '🟡 Media',
          HIGH: '🟠 Alta',
          URGENT: '🔴 Urgente',
        }
        await sendTechnicianDM(technicianId, {
          embed: {
            title: '🔧 Nueva OT Asignada',
            description: `**${workOrder.title}**\n\n${session.pendingOTData.description || 'Sin descripción'}`,
            color: 0x6366f1,
            fields: [
              { name: '🏭 Máquina', value: session.pendingOTData.machineName, inline: true },
              { name: '📊 Prioridad', value: priorityLabels[session.pendingOTData.priority] || session.pendingOTData.priority, inline: true },
            ],
            footer: `OT #${workOrder.id}`,
            timestamp: true,
          },
        })
      } catch (dmError) {
        console.error('[OTHandler] Error enviando DM a técnico:', dmError)
      }
    }

    // Mostrar confirmación
    await interaction.editReply({
      embeds: [buildDirectOTCreatedEmbed(
        { id: workOrder.id, title: workOrder.title, description: workOrder.description },
        session.pendingOTData.machineName,
        session.pendingOTData.priority
      )],
      components: [],
    })

    deleteSession(discordUserId)
    return true
  } catch (error: any) {
    console.error('[OTHandler] Error creando OT:', error)
    await interaction.editReply({
      embeds: [buildErrorEmbed('Error creando la OT. Intenta de nuevo.')],
      components: [],
    })
    deleteSession(discordUserId)
    return true
  }
}

/**
 * Handler para botón "Ya la solucioné"
 */
async function handleResolveButtonClick(
  interaction: any,
  discordUserId: string,
  failureId: number
): Promise<boolean> {
  const session = getSession(discordUserId)

  if (!session) {
    await interaction.reply({
      content: '⚠️ Sesión expirada.',
      ephemeral: true,
    })
    return true
  }

  // Actualizar sesión para esperar descripción de solución
  updateSession(discordUserId, {
    status: 'AWAITING_SOLUTION',
    createdFailureId: failureId,
  })

  await interaction.update({
    embeds: [
      {
        title: '✅ ¿Cómo solucionaste el problema?',
        description: 'Describe brevemente qué hiciste para solucionar la falla.\n\nPuedes enviar un **audio** o escribir un **mensaje de texto**.',
        color: DISCORD_COLORS.SUCCESS,
        footer: { text: 'Escribe "cancelar" para volver' },
      },
    ],
    components: [], // Remover botones
  })

  return true
}

/**
 * Handler para botón "Crear OT"
 */
async function handleCreateOTButtonClick(
  interaction: any,
  discordUserId: string,
  failureId: number
): Promise<boolean> {
  const session = getSession(discordUserId)

  if (!session) {
    await interaction.reply({
      content: '⚠️ Sesión expirada.',
      ephemeral: true,
    })
    return true
  }

  await interaction.deferUpdate()

  // Obtener la falla para saber el sector y máquina
  const failure = await prisma.failureOccurrence.findUnique({
    where: { id: failureId },
    select: {
      machineId: true,
      causedDowntime: true,
      machine: {
        select: {
          id: true,
          name: true,
          sectorId: true,
          sector: { select: { name: true } },
        },
      },
    },
  })

  const sectorId = failure?.machine?.sectorId || session.selectedSectorId
  const sectorName = failure?.machine?.sector?.name
  const machineId = failure?.machineId
  const machineName = failure?.machine?.name

  // Obtener técnicos del sector con historial de la máquina
  const technicians = await getTechniciansForSector(session.companyId, sectorId, machineId)

  // Crear select menu de técnicos
  const techComponents = await createTechnicianSelectMenu(technicians, failureId)

  // Actualizar sesión
  updateSession(discordUserId, {
    status: 'AWAITING_TECHNICIAN',
    createdFailureId: failureId,
  })

  // Formatear lista con info completa
  const techListFormatted = technicians.slice(0, 8).map(t => {
    const parts: string[] = [`• ${t.name}`]
    if (t.machineHistory > 0) {
      parts.push(`⭐${t.machineHistory}`)
    }
    parts.push(`(${t.pendingOTs} OTs)`)
    if (!t.isAvailable) {
      parts.push('🔴')
    }
    return parts.join(' ')
  }).join('\n')

  // Encontrar el técnico recomendado (primero de la lista ordenada que esté disponible)
  const recommended = technicians.find(t => t.isAvailable && t.machineHistory > 0)
  const recommendedText = recommended
    ? `💡 **Recomendado:** ${recommended.name} (${recommended.machineHistory} trabajos previos en esta máquina)`
    : ''

  await interaction.editReply({
    embeds: [
      {
        title: '🔧 Crear Orden de Trabajo',
        description: technicians.length > 0
          ? `Selecciona a quién asignar la OT para la falla **F-${failureId}**:\n${recommendedText}`
          : 'No hay técnicos con acceso a este sector. Puedes crear la OT sin asignar.',
        color: DISCORD_COLORS.INFO,
        fields: [
          ...(sectorName ? [{
            name: '🏭 Sector',
            value: sectorName,
            inline: true,
          }] : []),
          ...(machineName ? [{
            name: '⚙️ Máquina',
            value: machineName,
            inline: true,
          }] : []),
          ...(technicians.length > 0 ? [{
            name: '👷 Técnicos (⭐=exp. en máquina)',
            value: techListFormatted + (technicians.length > 8 ? `\n...y ${technicians.length - 8} más` : ''),
            inline: false,
          }] : []),
        ],
        footer: { text: '⭐ = trabajos completados en esta máquina | 🔴 = no disponible' },
      },
    ],
    components: techComponents,
  })

  return true
}

/**
 * Handler para botón "Listo" (cerrar sin acción adicional)
 */
async function handleDoneButtonClick(
  interaction: any,
  discordUserId: string,
  failureId: number
): Promise<boolean> {
  deleteSession(discordUserId)

  await interaction.update({
    embeds: [
      {
        title: '👍 ¡Listo!',
        description: `La falla **F-${failureId}** ha sido registrada.\n\nPuedes verla en ORVIT o reportar otra falla escribiendo **"Falla"**.`,
        color: DISCORD_COLORS.SUCCESS,
        timestamp: new Date().toISOString(),
      },
    ],
    components: [],
  })

  return true
}

/**
 * Handler para selección de técnico
 */
async function handleTechnicianSelectClick(
  interaction: any,
  discordUserId: string,
  value: string
): Promise<boolean> {
  const session = getSession(discordUserId)

  if (!session || !session.createdFailureId) {
    await interaction.reply({
      content: '⚠️ Sesión expirada.',
      ephemeral: true,
    })
    return true
  }

  await interaction.deferUpdate()

  // Parsear value: tech_123_456 o tech_none_456
  const parts = value.split('_')
  const techId = parts[1] === 'none' ? null : parseInt(parts[1], 10)
  const failureId = session.createdFailureId

  let technician: { id: number; name: string } | null = null

  if (techId) {
    const tech = await prisma.user.findUnique({
      where: { id: techId },
      select: { id: true, name: true },
    })
    if (tech) {
      technician = tech
    }
  }

  // Crear la OT
  try {
    const failure = await prisma.failureOccurrence.findUnique({
      where: { id: failureId },
      include: {
        machine: { select: { id: true, name: true, sectorId: true } },
      },
    })

    if (!failure) {
      throw new Error('Falla no encontrada')
    }

    const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
      P1: 'URGENT',
      P2: 'HIGH',
      P3: 'MEDIUM',
      P4: 'LOW',
    }
    const priority = priorityMap[failure.priority || 'MEDIUM'] || 'MEDIUM'

    const workOrder = await prisma.$transaction(async (tx) => {
      const newWO = await tx.workOrder.create({
        data: {
          companyId: session.companyId,
          machineId: failure.machineId,
          title: `OT por falla: ${failure.title}`,
          description: failure.description || '',
          type: 'CORRECTIVE',
          priority,
          status: 'INCOMING',
          origin: 'FAILURE',
          createdById: session.userId,
          assignedToId: technician?.id || null,
          sectorId: failure.machine?.sectorId || null,
        },
      })

      // Vincular la falla con la OT creada
      await tx.failureOccurrence.update({
        where: { id: failureId },
        data: {
          status: 'IN_PROGRESS',
          failureId: newWO.id, // Vincular OT con la falla
        },
      })

      return newWO
    })

    deleteSession(discordUserId)

    await interaction.editReply({
      embeds: [
        {
          title: '🔧 Orden de Trabajo Creada',
          description: `Se creó la **OT-${workOrder.id}** para la falla **F-${failureId}**.`,
          color: DISCORD_COLORS.SUCCESS,
          fields: [
            {
              name: '📋 Detalles',
              value: `**Máquina:** ${failure.machine?.name || 'N/A'}\n**Prioridad:** ${priority}\n**Asignado a:** ${technician?.name || 'Sin asignar'}`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      components: [],
    })

    console.log(`[FailureVoiceHandler] OT-${workOrder.id} creada vía select, técnico: ${technician?.name || 'sin asignar'}`)

    // === NOTIFICACIONES ===
    const sectorId = failure.machine?.sectorId

    // 1. Notificar al canal del sector (OT creada)
    if (sectorId) {
      try {
        await notifyOTCreated({
          id: workOrder.id,
          title: workOrder.title,
          type: 'CORRECTIVA',
          priority: failure.priority || 'P3',
          machineName: failure.machine?.name,
          sectorId,
          assignedTo: technician?.name,
          origin: 'Falla por voz Discord',
        })
        console.log(`[FailureVoiceHandler] Notificación OT enviada al canal del sector ${sectorId}`)
      } catch (notifyErr) {
        console.warn('[FailureVoiceHandler] Error enviando notificación al canal:', notifyErr)
      }
    }

    // 2. Enviar DM al técnico asignado
    if (technician?.id) {
      try {
        const dmResult = await sendTechnicianDM(technician.id, {
          embed: {
            title: `🔧 Nueva OT Asignada - OT-${workOrder.id}`,
            description: `Se te ha asignado una nueva orden de trabajo por falla.\n\n**${failure.title}**`,
            color: 0x5865f2,
            fields: [
              { name: '⚙️ Máquina', value: failure.machine?.name || 'N/A', inline: true },
              { name: '📊 Prioridad', value: failure.priority || 'P3', inline: true },
              { name: '📋 Origen', value: 'Falla por voz Discord', inline: true },
            ],
            footer: 'Revisa ORVIT para más detalles',
            timestamp: true,
          },
        })
        if (dmResult.success) {
          console.log(`[FailureVoiceHandler] DM enviado al técnico ${technician.name}`)
        } else {
          console.warn(`[FailureVoiceHandler] No se pudo enviar DM al técnico: ${dmResult.error}`)
        }
      } catch (dmErr) {
        console.warn('[FailureVoiceHandler] Error enviando DM al técnico:', dmErr)
      }
    }
  } catch (error: any) {
    console.error('[FailureVoiceHandler] Error creando OT:', error)
    await interaction.editReply({
      embeds: [buildErrorEmbed('Error al crear la Orden de Trabajo.')],
      components: [],
    })
    deleteSession(discordUserId)
  }

  return true
}

/**
 * Handler para botón de reintento
 */
async function handleRetryButtonClick(
  interaction: any,
  discordUserId: string,
  action: string
): Promise<boolean> {
  // Por ahora, simplemente reiniciar el flujo
  deleteSession(discordUserId)

  await interaction.update({
    embeds: [
      {
        title: '🔄 Reiniciando...',
        description: 'Escribe **"Falla"** para comenzar de nuevo.',
        color: DISCORD_COLORS.INFO,
      },
    ],
    components: [],
  })

  return true
}

// Tipo para técnico con info extendida
interface TechnicianInfo {
  id: number
  name: string
  pendingOTs: number
  machineHistory: number // Cuántas OTs completó en esta máquina
  isAvailable: boolean // Disponible (no en vacaciones/licencia)
  discordUserId?: string | null // Para notificaciones DM
}

/**
 * Obtiene los técnicos disponibles para un sector específico
 * Incluye historial con la máquina y disponibilidad
 */
async function getTechniciansForSector(
  companyId: number,
  sectorId?: number | null,
  machineId?: number | null
): Promise<TechnicianInfo[]> {
  // Base query para usuarios (filtrado por empresa a través de la relación)
  // Roles válidos: USER, ADMIN, ADMIN_ENTERPRISE, SUPERADMIN, SUPERVISOR
  const baseWhere = {
    isActive: true,
    role: { in: ['USER', 'SUPERVISOR', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERADMIN'] as const },
    companies: {
      some: {
        companyId,
      },
    },
  }

  // Si hay sector, filtrar por acceso
  let userIds: number[] | undefined
  if (sectorId) {
    const usersWithAccess = await prisma.userDiscordAccess.findMany({
      where: {
        sectorId,
        user: {
          is: baseWhere,
        },
      },
      select: { userId: true },
    })
    userIds = usersWithAccess.map(ua => ua.userId)

    if (userIds.length === 0) {
      return []
    }
  }

  // Obtener técnicos con conteos
  const users = await prisma.user.findMany({
    where: {
      ...baseWhere,
      ...(userIds ? { id: { in: userIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      discordUserId: true,
      _count: {
        select: {
          assignedWorkOrders: {
            where: {
              status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Si hay máquina, obtener historial de cada técnico con esa máquina
  let machineHistoryMap: Map<number, number> = new Map()
  if (machineId) {
    const historyData = await prisma.workOrder.groupBy({
      by: ['assignedToId'],
      where: {
        machineId,
        assignedToId: { in: users.map(u => u.id) },
        status: { in: ['COMPLETED'] },
      },
      _count: { id: true },
    })

    historyData.forEach(h => {
      if (h.assignedToId) {
        machineHistoryMap.set(h.assignedToId, h._count.id)
      }
    })
  }

  // TODO: Verificar disponibilidad (vacaciones, licencias, turnos)
  // Por ahora todos disponibles
  const availabilityMap: Map<number, boolean> = new Map()
  users.forEach(u => availabilityMap.set(u.id, true))

  // Construir resultado con toda la info
  const result: TechnicianInfo[] = users.map(u => ({
    id: u.id,
    name: u.name,
    discordUserId: u.discordUserId,
    pendingOTs: u._count.assignedWorkOrders,
    machineHistory: machineHistoryMap.get(u.id) || 0,
    isAvailable: availabilityMap.get(u.id) ?? true,
  }))

  // Ordenar: primero los que tienen historial con la máquina, luego por menos OTs pendientes
  return result.sort((a, b) => {
    // Primero disponibles
    if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1
    // Luego por historial con la máquina (más experiencia primero)
    if (a.machineHistory !== b.machineHistory) return b.machineHistory - a.machineHistory
    // Luego por menos carga de trabajo
    if (a.pendingOTs !== b.pendingOTs) return a.pendingOTs - b.pendingOTs
    // Finalmente alfabético
    return a.name.localeCompare(b.name)
  })
}
