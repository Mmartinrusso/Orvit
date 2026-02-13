/**
 * Sistema de Sesiones para Reporte de Fallas por Voz
 *
 * Gestiona sesiones en memoria con TTL para mantener el contexto
 * entre el comando inicial "Falla" y el audio posterior.
 */

export interface MachineInfo {
  id: number
  name: string
  nickname?: string | null
}

export interface SectorInfo {
  id: number
  name: string
}

export interface PhotoInfo {
  url: string
  fileName: string
  originalName: string
  contentType?: string
  size?: number
}

export interface VoiceFailureSession {
  discordUserId: string
  discordMessageId: string // Para responder al mensaje original
  userId: number
  companyId: number
  type?: 'FAILURE' | 'WORK_ORDER' | 'TASK' // Tipo de sesión
  status:
    | 'AWAITING_SECTOR' // Nuevo: esperando que elija sector
    | 'AWAITING_AUDIO'
    | 'AWAITING_TEXT'
    | 'CLARIFICATION_NEEDED'
    | 'POST_FAILURE'
    | 'POST_WORK_ORDER' // Después de crear OT
    | 'AWAITING_SOLUTION'
    | 'AWAITING_TECHNICIAN'
    | 'AWAITING_OT_TECHNICIAN' // Esperando selección de técnico para OT directa
  createdAt: Date
  expiresAt: Date

  // Sectores del usuario (si tiene múltiples)
  availableSectors?: SectorInfo[]
  selectedSectorId?: number // Sector seleccionado

  // Máquinas disponibles para el usuario (filtradas por sector si aplica)
  availableMachines?: MachineInfo[]

  // Para clarificación de máquina
  possibleMachines?: MachineInfo[]
  pendingTranscript?: string
  pendingExtractedData?: any

  // Log ID para actualizar
  logId?: number

  // Para flujo post-falla
  createdFailureId?: number
  createdFailureTitle?: string

  // Para asignación de OT
  pendingWorkOrderId?: number
  availableTechnicians?: { id: number; name: string }[]

  // Para OT directa (antes de crear, esperando selección de técnico)
  pendingOTData?: {
    machineId: number
    machineName: string
    title: string
    description: string
    priority: string
  }

  // Fotos adjuntas (se guardan durante el flujo para clarificación)
  pendingPhotos?: PhotoInfo[]
}

// Mapa de sesiones en memoria (key: discordUserId)
const sessions = new Map<string, VoiceFailureSession>()

// TTL: 5 minutos para sesiones normales
const SESSION_TTL_MS = 5 * 60 * 1000

// TTL: 2 minutos para clarificación
const CLARIFICATION_TTL_MS = 2 * 60 * 1000

// Intervalo de limpieza (60 segundos)
const CLEANUP_INTERVAL_MS = 60 * 1000

let cleanupInterval: NodeJS.Timeout | null = null

/**
 * Crea una nueva sesión para un usuario
 */
export function createSession(
  discordUserId: string,
  data: Omit<VoiceFailureSession, 'discordUserId' | 'createdAt' | 'expiresAt'>
): VoiceFailureSession {
  const now = new Date()
  const ttl = data.status === 'CLARIFICATION_NEEDED' ? CLARIFICATION_TTL_MS : SESSION_TTL_MS

  const session: VoiceFailureSession = {
    ...data,
    discordUserId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttl),
  }

  sessions.set(discordUserId, session)
  console.log(
    `[VoiceSession] Sesión creada para ${discordUserId}, expira en ${ttl / 1000}s, status: ${session.status}`
  )

  return session
}

/**
 * Obtiene una sesión activa para un usuario
 * Retorna null si no existe o si expiró
 */
export function getSession(discordUserId: string): VoiceFailureSession | null {
  const session = sessions.get(discordUserId)

  if (!session) {
    return null
  }

  if (!isSessionValid(session)) {
    console.log(`[VoiceSession] Sesión expirada para ${discordUserId}, eliminando`)
    sessions.delete(discordUserId)
    return null
  }

  return session
}

/**
 * Actualiza una sesión existente
 */
export function updateSession(
  discordUserId: string,
  data: Partial<Omit<VoiceFailureSession, 'discordUserId' | 'createdAt'>>
): VoiceFailureSession | null {
  const session = sessions.get(discordUserId)

  if (!session) {
    console.log(`[VoiceSession] No se encontró sesión para actualizar: ${discordUserId}`)
    return null
  }

  // Si cambia a un estado interactivo, ajustar TTL
  const interactiveStates = ['CLARIFICATION_NEEDED', 'POST_FAILURE', 'AWAITING_SOLUTION', 'AWAITING_TECHNICIAN']
  if (data.status && interactiveStates.includes(data.status) && !interactiveStates.includes(session.status)) {
    data.expiresAt = new Date(Date.now() + CLARIFICATION_TTL_MS)
  }

  const updatedSession: VoiceFailureSession = {
    ...session,
    ...data,
  }

  sessions.set(discordUserId, updatedSession)
  console.log(`[VoiceSession] Sesión actualizada para ${discordUserId}, status: ${updatedSession.status}`)

  return updatedSession
}

/**
 * Elimina una sesión
 */
export function deleteSession(discordUserId: string): boolean {
  const existed = sessions.has(discordUserId)
  sessions.delete(discordUserId)

  if (existed) {
    console.log(`[VoiceSession] Sesión eliminada para ${discordUserId}`)
  }

  return existed
}

/**
 * Verifica si una sesión es válida (no expirada)
 */
export function isSessionValid(session: VoiceFailureSession): boolean {
  return new Date() < session.expiresAt
}

/**
 * Extiende el TTL de una sesión
 */
export function extendSession(discordUserId: string, additionalMs?: number): boolean {
  const session = sessions.get(discordUserId)

  if (!session) {
    return false
  }

  const ttl = additionalMs ?? (session.status === 'CLARIFICATION_NEEDED' ? CLARIFICATION_TTL_MS : SESSION_TTL_MS)

  session.expiresAt = new Date(Date.now() + ttl)
  console.log(`[VoiceSession] TTL extendido para ${discordUserId}, nuevo expiry: ${session.expiresAt.toISOString()}`)

  return true
}

/**
 * Limpia sesiones expiradas
 */
export function cleanupExpiredSessions(): number {
  const now = new Date()
  let cleaned = 0

  for (const [discordUserId, session] of sessions.entries()) {
    if (now >= session.expiresAt) {
      sessions.delete(discordUserId)
      cleaned++
      console.log(`[VoiceSession] Limpieza automática: sesión ${discordUserId} eliminada`)
    }
  }

  if (cleaned > 0) {
    console.log(`[VoiceSession] Limpieza completada: ${cleaned} sesiones eliminadas`)
  }

  return cleaned
}

/**
 * Inicia el worker de limpieza automática
 */
export function startCleanupWorker(): void {
  if (cleanupInterval) {
    console.log('[VoiceSession] Worker de limpieza ya está corriendo')
    return
  }

  cleanupInterval = setInterval(() => {
    cleanupExpiredSessions()
  }, CLEANUP_INTERVAL_MS)

  console.log(`[VoiceSession] Worker de limpieza iniciado (cada ${CLEANUP_INTERVAL_MS / 1000}s)`)
}

/**
 * Detiene el worker de limpieza
 */
export function stopCleanupWorker(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    console.log('[VoiceSession] Worker de limpieza detenido')
  }
}

/**
 * Obtiene estadísticas de sesiones
 */
export function getSessionStats(): {
  total: number
  awaitingSector: number
  awaitingAudio: number
  clarificationNeeded: number
  postFailure: number
  awaitingSolution: number
  awaitingTechnician: number
  expired: number
} {
  const now = new Date()
  let awaitingSector = 0
  let awaitingAudio = 0
  let clarificationNeeded = 0
  let postFailure = 0
  let awaitingSolution = 0
  let awaitingTechnician = 0
  let expired = 0

  for (const session of sessions.values()) {
    if (now >= session.expiresAt) {
      expired++
    } else if (session.status === 'AWAITING_SECTOR') {
      awaitingSector++
    } else if (session.status === 'AWAITING_AUDIO') {
      awaitingAudio++
    } else if (session.status === 'CLARIFICATION_NEEDED') {
      clarificationNeeded++
    } else if (session.status === 'POST_FAILURE') {
      postFailure++
    } else if (session.status === 'AWAITING_SOLUTION') {
      awaitingSolution++
    } else if (session.status === 'AWAITING_TECHNICIAN') {
      awaitingTechnician++
    }
  }

  return {
    total: sessions.size,
    awaitingSector,
    awaitingAudio,
    clarificationNeeded,
    postFailure,
    awaitingSolution,
    awaitingTechnician,
    expired,
  }
}

/**
 * Verifica si hay una sesión activa para un usuario
 */
export function hasActiveSession(discordUserId: string): boolean {
  return getSession(discordUserId) !== null
}

/**
 * Obtiene todas las sesiones activas (para debugging)
 */
export function getAllSessions(): VoiceFailureSession[] {
  return Array.from(sessions.values()).filter(isSessionValid)
}
