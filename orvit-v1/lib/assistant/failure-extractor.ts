/**
 * Extractor de Fallas desde Audio
 *
 * Usa OpenAI GPT para extraer datos estructurados de transcripciones
 * de audio y crear FailureOccurrences automáticamente.
 */

import { AI_CONFIG, FAILURE_EXTRACTION_PROMPTS } from './config'
import { prisma } from '@/lib/prisma'

// Tipos para la extracción
export type FailureCategory = 'MECANICA' | 'ELECTRICA' | 'HIDRAULICA' | 'NEUMATICA' | 'OTRA'

export interface ExtractedFailureData {
  machineIdentifier: string // Máquina principal (primera mencionada)
  additionalMachineIdentifiers?: string[] // Máquinas adicionales afectadas
  title: string
  description: string
  failureCategory: FailureCategory
  causedDowntime: boolean
  isIntermittent: boolean
  symptoms: string[]
  component?: string | null
  confidence: number
  notes?: string | null
  // Campos para flujo híbrido (resolución/asignación en el audio)
  wasResolved?: boolean // Usuario dice que ya lo solucionó
  solutionDescription?: string | null // Cómo lo solucionó
  needsWorkOrder?: boolean // Usuario pide crear OT / que venga alguien
  suggestedAssignee?: string | null // Nombre de persona mencionada para asignar
}

export interface FailureExtractionResult {
  success: boolean
  data?: ExtractedFailureData
  error?: string
}

export interface MachineInfo {
  id: number
  name: string
  nickname?: string | null
  aliases?: string[] | null
  sectorId?: number | null
  sectorName?: string | null
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
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
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
 * Formatea la lista de máquinas para el prompt
 * Incluye sector para que la IA pueda identificar mejor
 */
function formatMachineList(machines: MachineInfo[]): string {
  if (machines.length === 0) {
    return 'No hay máquinas disponibles'
  }

  return machines
    .map(m => {
      const parts = [`"${m.name}"`]
      if (m.nickname) parts.push(`apodo: "${m.nickname}"`)
      if (m.aliases && m.aliases.length > 0) {
        parts.push(`también conocida como: ${m.aliases.map(a => `"${a}"`).join(', ')}`)
      }
      if (m.sectorName) parts.push(`sector: "${m.sectorName}"`)
      return `- ${parts.join(', ')}`
    })
    .join('\n')
}

/**
 * Extrae datos estructurados de la falla desde la transcripción
 */
export async function extractFailureData(
  transcript: string,
  machines: MachineInfo[]
): Promise<FailureExtractionResult> {
  const openai = await getOpenAIClient()

  // Preparar prompts
  const machineListStr = formatMachineList(machines)
  const systemPrompt = FAILURE_EXTRACTION_PROMPTS.system.replace('{machineList}', machineListStr)
  const userPrompt = FAILURE_EXTRACTION_PROMPTS.user.replace('{transcript}', transcript)

  try {
    console.log('[FailureExtractor] Extrayendo datos de:', transcript.substring(0, 100) + '...')

    const response = await openai.chat.completions.create({
      model: AI_CONFIG.chat.model,
      messages: [
        { role: 'system', content: systemPrompt },
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

    console.log('[FailureExtractor] Respuesta GPT:', content)

    // Parsear JSON
    let data: ExtractedFailureData
    try {
      data = JSON.parse(content)
    } catch (parseError) {
      console.error('[FailureExtractor] Error parseando JSON:', parseError)
      return { success: false, error: 'Error parseando respuesta del modelo' }
    }

    // Validar estructura mínima
    if (!data.machineIdentifier || !data.title) {
      return { success: false, error: 'Datos extraídos incompletos: falta máquina o título' }
    }

    // Normalizar categoría
    const validCategories: FailureCategory[] = ['MECANICA', 'ELECTRICA', 'HIDRAULICA', 'NEUMATICA', 'OTRA']
    if (!validCategories.includes(data.failureCategory)) {
      data.failureCategory = 'OTRA'
    }

    // Normalizar booleanos
    data.causedDowntime = Boolean(data.causedDowntime)
    data.isIntermittent = Boolean(data.isIntermittent)

    // Normalizar síntomas
    if (!Array.isArray(data.symptoms)) {
      data.symptoms = []
    }

    // Asegurar confianza
    data.confidence = Number(data.confidence) || 50

    // Normalizar campos de flujo híbrido
    data.wasResolved = Boolean(data.wasResolved)
    data.needsWorkOrder = Boolean(data.needsWorkOrder)
    // solutionDescription y suggestedAssignee ya son string | null

    // Log detallado del flujo híbrido
    console.log('[FailureExtractor] Flujo híbrido detectado:', {
      wasResolved: data.wasResolved,
      solutionDescription: data.solutionDescription,
      needsWorkOrder: data.needsWorkOrder,
      suggestedAssignee: data.suggestedAssignee,
    })

    return { success: true, data }
  } catch (error: any) {
    console.error('[FailureExtractor] Error:', error)
    return { success: false, error: error.message || 'Error en extracción' }
  }
}

// Resultado extendido con info del componente
export interface CreateFailureResult {
  occurrence: any
  matchedComponent?: {
    id: number
    name: string
    parentName?: string | null
    isSubcomponent: boolean
  } | null
}

// Interface para fotos adjuntas
export interface PhotoAttachment {
  url: string
  fileName: string
  originalName: string
  contentType?: string
  size?: number
}

/**
 * Crea la FailureOccurrence en la base de datos
 */
export async function createFailureFromVoice(
  data: ExtractedFailureData,
  machineId: number,
  userId: number,
  companyId: number,
  voiceLogId?: number,
  photos?: PhotoAttachment[],
  additionalMachineIds?: number[]
): Promise<CreateFailureResult> {
  // Obtener criticidad del activo para prioridad inteligente
  let assetCriticality: string | null = null
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { criticalityScore: true },
    })
    // Mapear score a criticidad
    if (machine?.criticalityScore !== null && machine?.criticalityScore !== undefined) {
      if (machine.criticalityScore >= 80) assetCriticality = 'CRITICAL'
      else if (machine.criticalityScore >= 60) assetCriticality = 'HIGH'
      else if (machine.criticalityScore >= 40) assetCriticality = 'MEDIUM'
      else assetCriticality = 'LOW'
    }
  } catch (e) {
    console.warn('[FailureExtractor] No se pudo obtener criticidad del activo:', e)
  }

  // Detectar palabras de seguridad en título y descripción
  const safetyKeywords = ['peligro', 'seguridad', 'riesgo', 'lesión', 'accidente', 'incendio', 'fuga', 'gas', 'eléctric', 'electric', 'shock', 'atrapamiento', 'quemadura']
  const textToCheck = `${data.title} ${data.description}`.toLowerCase()
  const isSafetyRelated = safetyKeywords.some(kw => textToCheck.includes(kw))

  // Importar calculador de prioridad si existe
  let priority = 'P3' // Default
  let priorityReasons: string[] = []
  try {
    const { calculatePriority } = await import('@/lib/corrective/priority-calculator')
    const priorityResult = calculatePriority({
      assetCriticality,
      causedDowntime: data.causedDowntime,
      isIntermittent: data.isIntermittent,
      isSafetyRelated,
      isObservation: false,
    })
    priority = priorityResult.priority
    priorityReasons = priorityResult.reasons
    console.log(`[FailureExtractor] Prioridad calculada: ${priority} (score: ${priorityResult.score}) - ${priorityReasons.join(', ')}`)
  } catch (e) {
    // Si no existe el calculador, usar lógica simple mejorada
    if (isSafetyRelated) {
      priority = 'P1'
      priorityReasons = ['Riesgo de seguridad detectado']
    } else if (data.causedDowntime && assetCriticality === 'CRITICAL') {
      priority = 'P1'
      priorityReasons = ['Parada de producción en equipo crítico']
    } else if (data.causedDowntime) {
      priority = 'P2'
      priorityReasons = ['Causó parada de producción']
    } else if (assetCriticality === 'CRITICAL') {
      priority = 'P2'
      priorityReasons = ['Equipo crítico']
    } else {
      priority = 'P3'
    }
  }

  // Intentar matchear componente si se mencionó uno
  let matchedComponentId: number | null = null
  let matchedComponentInfo: CreateFailureResult['matchedComponent'] = null

  if (data.component) {
    try {
      const { findComponentForFailure } = await import('@/lib/discord/component-matcher')
      const componentResult = await findComponentForFailure(data.component, machineId)

      if (componentResult.found && componentResult.component) {
        matchedComponentId = componentResult.component.id
        matchedComponentInfo = {
          id: componentResult.component.id,
          name: componentResult.component.name,
          parentName: componentResult.component.parentName,
          isSubcomponent: componentResult.component.isSubcomponent,
        }
        console.log(
          `[FailureExtractor] Componente identificado: ${componentResult.component.name} (ID: ${componentResult.component.id})`
        )
      } else if (componentResult.alternatives && componentResult.alternatives.length > 0) {
        // Si hay alternativas pero no match exacto, tomar la mejor
        const best = componentResult.alternatives[0]
        if (best.similarity >= 0.7) {
          matchedComponentId = best.id
          matchedComponentInfo = {
            id: best.id,
            name: best.name,
            parentName: best.parentName,
            isSubcomponent: best.isSubcomponent,
          }
          console.log(
            `[FailureExtractor] Componente inferido: ${best.name} (similitud: ${(best.similarity * 100).toFixed(0)}%)`
          )
        }
      }
    } catch (componentError) {
      console.error('[FailureExtractor] Error buscando componente:', componentError)
      // Continuar sin componente, no es crítico
    }
  }

  // Preparar notas con info del componente
  let notes = ''
  if (data.component) {
    if (matchedComponentInfo) {
      notes = `Componente: ${matchedComponentInfo.name}`
      if (matchedComponentInfo.parentName) {
        notes += ` (${matchedComponentInfo.parentName})`
      }
    } else {
      notes = `Componente mencionado: ${data.component} (no identificado en sistema)`
    }
  }

  // Crear en transacción
  const occurrence = await prisma.$transaction(async tx => {
    // Crear la FailureOccurrence
    const newOccurrence = await tx.failureOccurrence.create({
      data: {
        companyId,
        machineId,
        additionalMachineIds: additionalMachineIds && additionalMachineIds.length > 0 ? additionalMachineIds : undefined,
        subcomponentId: matchedComponentId, // Vincular componente si se identificó
        title: data.title.substring(0, 255),
        description: `[Creado desde audio de voz] ${data.description}${data.notes ? `\n\nNotas: ${data.notes}` : ''}`,
        failureCategory: data.failureCategory,
        priority,
        isIntermittent: data.isIntermittent,
        causedDowntime: data.causedDowntime,
        reportedBy: userId,
        reportedAt: new Date(),
        status: 'OPEN',
        notes: notes || undefined,
        photos: photos && photos.length > 0 ? photos : undefined,
      },
      include: {
        machine: { select: { id: true, name: true, nickname: true, sectorId: true } },
        reporter: { select: { id: true, name: true } },
      },
    })

    // Si hay un log de voz, vincularlo
    if (voiceLogId) {
      await tx.voiceFailureLog.update({
        where: { id: voiceLogId },
        data: {
          failureOccurrenceId: newOccurrence.id,
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      })
    }

    return newOccurrence
  })

  console.log(`[FailureExtractor] Falla creada: F-${occurrence.id}`)

  // Notificar a Discord en el canal del sector
  try {
    if (occurrence.machine?.sectorId) {
      const { notifyNewFailure } = await import('@/lib/discord/notifications')
      await notifyNewFailure({
        id: occurrence.id,
        title: occurrence.title,
        machineName: occurrence.machine.name,
        machineId: occurrence.machineId,
        sectorId: occurrence.machine.sectorId,
        priority: occurrence.priority,
        category: occurrence.failureCategory,
        component: matchedComponentInfo?.name || data.component || undefined,
        reportedBy: occurrence.reporter?.name || 'Usuario',
        causedDowntime: occurrence.causedDowntime,
        description: data.description,
      })
      console.log(`[FailureExtractor] Notificación Discord enviada para F-${occurrence.id}`)
    }
  } catch (notifyError) {
    console.error('[FailureExtractor] Error al notificar a Discord:', notifyError)
    // No fallar la creación por error de notificación
  }

  return {
    occurrence,
    matchedComponent: matchedComponentInfo,
  }
}

/**
 * Resultado completo del procesamiento de voz
 */
export interface VoiceFailureProcessResult {
  success: boolean
  occurrence?: any
  transcript?: string
  extractedData?: ExtractedFailureData
  needsClarification?: boolean
  possibleMachines?: MachineInfo[]
  error?: string
  matchedComponent?: {
    id: number
    name: string
    parentName?: string | null
    isSubcomponent: boolean
  } | null
}

/**
 * Procesa un audio completo: transcribe, extrae y crea la falla
 * Si no puede identificar la máquina, retorna needsClarification=true
 */
export async function processVoiceToFailure(
  audioBuffer: Buffer,
  mimeType: string,
  userId: number,
  companyId: number,
  machines: MachineInfo[],
  voiceLogId?: number,
  findMatchingMachines?: (identifier: string, machines: MachineInfo[]) => MachineInfo[],
  photos?: PhotoAttachment[]
): Promise<VoiceFailureProcessResult> {
  try {
    // 1. Transcribir
    console.log('[FailureExtractor] Transcribiendo audio...')
    const transcript = await transcribeAudio(audioBuffer, mimeType)

    if (!transcript || transcript.trim().length === 0) {
      return { success: false, error: 'No se pudo transcribir el audio' }
    }

    console.log('[FailureExtractor] Transcripción:', transcript)

    // 2. Actualizar log con transcripción (si existe)
    if (voiceLogId) {
      await prisma.voiceFailureLog.update({
        where: { id: voiceLogId },
        data: {
          transcript,
          status: 'PROCESSING',
        },
      })
    }

    // 3. Extraer datos
    console.log('[FailureExtractor] Extrayendo datos...')
    const extraction = await extractFailureData(transcript, machines)

    if (!extraction.success || !extraction.data) {
      // Actualizar log con error
      if (voiceLogId) {
        await prisma.voiceFailureLog.update({
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
      await prisma.voiceFailureLog.update({
        where: { id: voiceLogId },
        data: {
          extractedData: extraction.data as any,
          confidence: extraction.data.confidence,
        },
      })
    }

    // 5. Identificar máquina
    console.log('[FailureExtractor] Identificando máquina:', extraction.data.machineIdentifier)

    let matchedMachines: MachineInfo[] = []
    if (findMatchingMachines) {
      matchedMachines = findMatchingMachines(extraction.data.machineIdentifier, machines)
    } else {
      // Búsqueda simple si no hay matcher
      const identifier = extraction.data.machineIdentifier.toLowerCase()
      matchedMachines = machines.filter(
        m =>
          m.name.toLowerCase().includes(identifier) ||
          (m.nickname && m.nickname.toLowerCase().includes(identifier))
      )
    }

    // 6. Evaluar resultado del matching
    if (matchedMachines.length === 0) {
      // No se encontró ninguna máquina - pedir clarificación con TODAS las máquinas
      console.log('[FailureExtractor] No se encontró máquina, pidiendo clarificación')

      if (voiceLogId) {
        await prisma.voiceFailureLog.update({
          where: { id: voiceLogId },
          data: {
            status: 'CLARIFICATION_NEEDED',
          },
        })
      }

      return {
        success: false,
        transcript,
        extractedData: extraction.data,
        needsClarification: true,
        possibleMachines: machines.slice(0, 10), // Mostrar primeras 10
        error: `No se encontró una máquina que coincida con "${extraction.data.machineIdentifier}"`,
      }
    }

    if (matchedMachines.length > 1) {
      // Múltiples coincidencias - pedir clarificación
      console.log('[FailureExtractor] Múltiples máquinas coinciden, pidiendo clarificación')

      if (voiceLogId) {
        await prisma.voiceFailureLog.update({
          where: { id: voiceLogId },
          data: {
            status: 'CLARIFICATION_NEEDED',
          },
        })
      }

      return {
        success: false,
        transcript,
        extractedData: extraction.data,
        needsClarification: true,
        possibleMachines: matchedMachines.slice(0, 5),
        error: `Se encontraron ${matchedMachines.length} máquinas que coinciden`,
      }
    }

    // 7. Una sola coincidencia - crear falla
    const matchedMachine = matchedMachines[0]
    console.log('[FailureExtractor] Máquina identificada:', matchedMachine.name)

    // 7.1 Identificar máquinas adicionales si las hay
    let additionalMachineIds: number[] = []
    if (extraction.data.additionalMachineIdentifiers && extraction.data.additionalMachineIdentifiers.length > 0) {
      console.log('[FailureExtractor] Buscando máquinas adicionales:', extraction.data.additionalMachineIdentifiers)

      for (const additionalIdentifier of extraction.data.additionalMachineIdentifiers) {
        let additionalMatches: MachineInfo[] = []
        if (findMatchingMachines) {
          additionalMatches = findMatchingMachines(additionalIdentifier, machines)
        } else {
          const id = additionalIdentifier.toLowerCase()
          additionalMatches = machines.filter(
            m => m.name.toLowerCase().includes(id) || (m.nickname && m.nickname.toLowerCase().includes(id))
          )
        }

        // Si hay exactamente una coincidencia y no es la máquina principal, agregarla
        if (additionalMatches.length === 1 && additionalMatches[0].id !== matchedMachine.id) {
          additionalMachineIds.push(additionalMatches[0].id)
          console.log(`[FailureExtractor] Máquina adicional identificada: ${additionalMatches[0].name}`)
        } else if (additionalMatches.length > 1) {
          console.log(`[FailureExtractor] Múltiples coincidencias para "${additionalIdentifier}", omitiendo`)
        } else {
          console.log(`[FailureExtractor] No se encontró máquina para "${additionalIdentifier}"`)
        }
      }
    }

    if (voiceLogId) {
      await prisma.voiceFailureLog.update({
        where: { id: voiceLogId },
        data: {
          machineMatchedId: matchedMachine.id,
        },
      })
    }

    // 8. Crear falla
    console.log('[FailureExtractor] Creando falla...')
    const result = await createFailureFromVoice(
      extraction.data,
      matchedMachine.id,
      userId,
      companyId,
      voiceLogId,
      photos,
      additionalMachineIds.length > 0 ? additionalMachineIds : undefined
    )

    return {
      success: true,
      occurrence: result.occurrence,
      transcript,
      extractedData: extraction.data,
      matchedComponent: result.matchedComponent,
    }
  } catch (error: any) {
    console.error('[FailureExtractor] Error procesando audio:', error)

    // Actualizar log con error
    if (voiceLogId) {
      await prisma.voiceFailureLog.update({
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

/**
 * Completa una falla que estaba esperando clarificación de máquina
 */
export async function completeFailureWithMachine(
  voiceLogIdOrData: number | ExtractedFailureData,
  machineId: number,
  userId: number,
  companyId: number,
  photos?: PhotoAttachment[]
): Promise<VoiceFailureProcessResult> {
  try {
    let extractedData: ExtractedFailureData
    let voiceLogId: number | undefined

    // Check if first param is a voiceLogId (number) or direct data
    if (typeof voiceLogIdOrData === 'number') {
      voiceLogId = voiceLogIdOrData

      // Obtener el log con datos extraídos
      const log = await prisma.voiceFailureLog.findUnique({
        where: { id: voiceLogId },
        select: {
          extractedData: true,
          status: true,
        },
      })

      if (!log) {
        return { success: false, error: 'Log no encontrado' }
      }

      if (log.status !== 'CLARIFICATION_NEEDED') {
        return { success: false, error: 'El log no está esperando clarificación' }
      }

      if (!log.extractedData) {
        return { success: false, error: 'No hay datos extraídos en el log' }
      }

      extractedData = log.extractedData as unknown as ExtractedFailureData

      // Actualizar log con máquina seleccionada
      await prisma.voiceFailureLog.update({
        where: { id: voiceLogId },
        data: {
          machineMatchedId: machineId,
          status: 'PROCESSING',
        },
      })
    } else {
      // Direct ExtractedFailureData provided (from button interactions)
      extractedData = voiceLogIdOrData
    }

    // Crear la falla
    const result = await createFailureFromVoice(extractedData, machineId, userId, companyId, voiceLogId, photos)

    return {
      success: true,
      occurrence: result.occurrence,
      extractedData,
      matchedComponent: result.matchedComponent,
    }
  } catch (error: any) {
    console.error('[FailureExtractor] Error completando falla:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// PROCESAMIENTO DE OT DIRECTA POR VOZ
// ============================================

export interface WorkOrderProcessResult {
  success: boolean
  workOrder?: { id: number; title: string; description?: string | null }
  // Datos para crear OT (cuando no se crea automáticamente)
  pendingOTData?: {
    machineId: number
    machineName: string
    title: string
    description: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    sectorId?: number | null
  }
  machineName?: string
  priority?: string
  transcript?: string
  extractedData?: ExtractedFailureData
  error?: string
  needsClarification?: boolean
  possibleMachines?: MachineInfo[]
}

/**
 * Procesa audio de voz para crear OT directamente (sin falla)
 */
export async function processVoiceToWorkOrder(
  audioBuffer: Buffer,
  mimeType: string,
  userId: number,
  companyId: number,
  machines: MachineInfo[],
  voiceLogId?: number,
  findMatchingMachines?: (identifier: string, machines: MachineInfo[]) => MachineInfo[],
  sectorId?: number
): Promise<WorkOrderProcessResult> {
  try {
    // 1. Transcribir
    console.log('[OTExtractor] Transcribiendo audio...')
    const transcript = await transcribeAudio(audioBuffer, mimeType)

    if (!transcript || transcript.trim().length === 0) {
      return { success: false, error: 'No se pudo transcribir el audio' }
    }

    console.log('[OTExtractor] Transcripción:', transcript)

    // 2. Actualizar log con transcripción (si existe)
    if (voiceLogId) {
      await prisma.voiceFailureLog.update({
        where: { id: voiceLogId },
        data: {
          transcript,
          status: 'PROCESSING',
        },
      })
    }

    // 3. Extraer datos (reutilizamos el extractor de fallas)
    console.log('[OTExtractor] Extrayendo datos...')
    const extraction = await extractFailureData(transcript, machines)

    if (!extraction.success || !extraction.data) {
      if (voiceLogId) {
        await prisma.voiceFailureLog.update({
          where: { id: voiceLogId },
          data: {
            status: 'FAILED',
            errorMessage: extraction.error,
          },
        })
      }
      return { success: false, transcript, error: extraction.error }
    }

    // 4. Identificar máquina
    console.log('[OTExtractor] Identificando máquina:', extraction.data.machineIdentifier)

    let matchedMachines: MachineInfo[] = []
    if (findMatchingMachines) {
      matchedMachines = findMatchingMachines(extraction.data.machineIdentifier, machines)
    } else {
      const identifier = extraction.data.machineIdentifier.toLowerCase()
      matchedMachines = machines.filter(
        m =>
          m.name.toLowerCase().includes(identifier) ||
          (m.nickname && m.nickname.toLowerCase().includes(identifier))
      )
    }

    // 5. Evaluar resultado del matching
    if (matchedMachines.length === 0) {
      console.log('[OTExtractor] No se encontró máquina, pidiendo clarificación')
      return {
        success: false,
        needsClarification: true,
        possibleMachines: machines,
        extractedData: extraction.data,
        transcript,
      }
    }

    if (matchedMachines.length > 1) {
      console.log(`[OTExtractor] Múltiples máquinas (${matchedMachines.length}), pidiendo clarificación`)
      return {
        success: false,
        needsClarification: true,
        possibleMachines: matchedMachines,
        extractedData: extraction.data,
        transcript,
      }
    }

    // 6. Máquina única encontrada
    const matchedMachine = matchedMachines[0]
    console.log('[OTExtractor] Máquina identificada:', matchedMachine.name)

    // 7. Calcular prioridad basada en la descripción
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM'
    const descLower = (extraction.data.description || '').toLowerCase()
    if (descLower.includes('urgente') || descLower.includes('crítico') || descLower.includes('paró')) {
      priority = 'URGENT'
    } else if (descLower.includes('alta') || descLower.includes('importante')) {
      priority = 'HIGH'
    } else if (descLower.includes('baja') || descLower.includes('cuando puedas')) {
      priority = 'LOW'
    }

    // 8. Retornar datos pendientes (NO crear OT aún - esperar selección de técnico)
    const title = extraction.data.title || `Trabajo en ${matchedMachine.name}`

    return {
      success: true,
      pendingOTData: {
        machineId: matchedMachine.id,
        machineName: matchedMachine.name,
        title,
        description: extraction.data.description || '',
        priority,
        sectorId: sectorId || matchedMachine.sectorId,
      },
      machineName: matchedMachine.name,
      priority,
      transcript,
      extractedData: extraction.data,
    }
  } catch (error: any) {
    console.error('[OTExtractor] Error procesando audio:', error)

    if (voiceLogId) {
      await prisma.voiceFailureLog.update({
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

/**
 * Crea una OT directamente desde datos extraídos de voz
 */
async function createWorkOrderFromVoice(
  data: ExtractedFailureData,
  machine: MachineInfo,
  userId: number,
  companyId: number,
  sectorId?: number,
  voiceLogId?: number
): Promise<{ id: number; title: string; description?: string | null; priority: string }> {
  // Mapear prioridad basada en la descripción o usar MEDIUM por defecto
  let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM'

  // Detectar prioridad de la descripción
  const descLower = (data.description || '').toLowerCase()
  if (descLower.includes('urgente') || descLower.includes('crítico') || descLower.includes('paró')) {
    priority = 'URGENT'
  } else if (descLower.includes('alta') || descLower.includes('importante')) {
    priority = 'HIGH'
  } else if (descLower.includes('baja') || descLower.includes('cuando puedas')) {
    priority = 'LOW'
  }

  // Crear título para la OT
  const title = data.title || `Trabajo en ${machine.name}`

  const workOrder = await prisma.workOrder.create({
    data: {
      companyId,
      machineId: machine.id,
      title,
      description: data.description || '',
      type: 'CORRECTIVE',
      priority,
      status: 'INCOMING',
      origin: 'FAILURE', // Usamos FAILURE porque viene de voz (similar flujo)
      createdById: userId,
      sectorId: sectorId || machine.sectorId || null,
    },
  })

  // Actualizar log con OT creada
  if (voiceLogId) {
    await prisma.voiceFailureLog.update({
      where: { id: voiceLogId },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
        machineMatchedId: machine.id,
      },
    })
  }

  console.log(`[OTExtractor] OT creada: OT-${workOrder.id} para ${machine.name}`)

  return {
    id: workOrder.id,
    title: workOrder.title,
    description: workOrder.description,
    priority: workOrder.priority,
  }
}

/**
 * Completa una OT que estaba esperando clarificación de máquina
 */
export async function completeWorkOrderWithMachine(
  extractedData: ExtractedFailureData,
  machineId: number,
  userId: number,
  companyId: number,
  sectorId?: number,
  machines?: MachineInfo[]
): Promise<WorkOrderProcessResult> {
  try {
    // Buscar la máquina
    let machine: MachineInfo | undefined

    if (machines) {
      machine = machines.find(m => m.id === machineId)
    }

    if (!machine) {
      const dbMachine = await prisma.machine.findUnique({
        where: { id: machineId },
        select: { id: true, name: true, nickname: true, sectorId: true },
      })

      if (!dbMachine) {
        return { success: false, error: 'Máquina no encontrada' }
      }

      machine = dbMachine
    }

    // Crear la OT
    const workOrder = await createWorkOrderFromVoice(
      extractedData,
      machine,
      userId,
      companyId,
      sectorId
    )

    return {
      success: true,
      workOrder: {
        id: workOrder.id,
        title: workOrder.title,
        description: workOrder.description,
      },
      machineName: machine.name,
      priority: workOrder.priority,
      extractedData,
    }
  } catch (error: any) {
    console.error('[OTExtractor] Error completando OT:', error)
    return { success: false, error: error.message }
  }
}
