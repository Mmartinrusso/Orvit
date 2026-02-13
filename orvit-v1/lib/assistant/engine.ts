// ============================================
// Motor del Asistente IA
// ============================================

import { AI_CONFIG, SYSTEM_PROMPTS, getPageContext } from './config'
import {
  searchKnowledge,
  formatSearchResultsForLLM,
  detectMachineMention,
  getMachineActiveFailures,
  getDeepMachineContext,
  formatDeepMachineContextForLLM,
  ActiveFailure,
} from './knowledge'
import { detectMetricsQuery, detectComparisonRequest, getMetrics, getMetricsWithComparison, formatMetricsForLLM } from './metrics'
import {
  AssistantContext,
  AssistantIntent,
  AssistantResponse,
  ConversationMessage,
  ROLE_CONFIGS,
} from './types'

// Respuesta con selección interactiva
export interface InteractiveSelection {
  type: 'failure_selection'
  machineId: number
  machineName: string
  failures: ActiveFailure[]
}

// Cliente de OpenAI (lazy initialization)
let openaiClient: any = null

async function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('[Assistant] OPENAI_API_KEY not configured')
      throw new Error('OpenAI API key not configured')
    }
    console.log('[Assistant] Initializing OpenAI client with key:', apiKey.substring(0, 10) + '...')
    const OpenAI = (await import('openai')).default
    openaiClient = new OpenAI({
      apiKey,
    })
  }
  return openaiClient
}

/**
 * Procesa un mensaje del usuario y genera una respuesta
 */
export async function processMessage(
  message: string,
  context: AssistantContext,
  conversationHistory: ConversationMessage[] = []
): Promise<AssistantResponse> {
  // 1. Detectar intención
  const intent = await detectIntent(message)

  // 2. Procesar según la intención
  switch (intent.type) {
    case 'query':
      return handleQuery(message, context, conversationHistory)

    case 'action':
      return handleAction(intent, context)

    case 'help':
      return handleHelp()

    case 'unclear':
    default:
      return handleUnclear(message)
  }
}

/**
 * Detecta la intención del mensaje del usuario
 */
export async function detectIntent(message: string): Promise<AssistantIntent> {
  const openai = await getOpenAIClient()

  try {
    console.log('[Assistant] Detecting intent for:', message)

    const response = await openai.chat.completions.create({
      model: AI_CONFIG.chat.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS.intentDetection },
        { role: 'user', content: message },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0].message.content
    console.log('[Assistant] Intent response:', content)

    const result = JSON.parse(content || '{}')

    // Mapear resultado a tipo de intención
    if (result.type === 'action' && result.action) {
      console.log('[Assistant] Detected action:', result.action)
      return {
        type: 'action',
        action: result.action,
        params: result.params || {},
      }
    }

    if (result.type === 'query') {
      console.log('[Assistant] Detected query:', result.subject)
      return {
        type: 'query',
        subject: result.subject || message,
      }
    }

    if (result.type === 'help') {
      console.log('[Assistant] Detected help request')
      return { type: 'help' }
    }

    // Si no matchea ningún tipo conocido, tratar como query
    console.log('[Assistant] Unknown intent type, defaulting to query:', result)
    return { type: 'query', subject: message }
  } catch (error) {
    console.error('[Assistant] Error detecting intent:', error)
    // Por defecto, tratar como consulta
    return { type: 'query', subject: message }
  }
}

/**
 * Maneja una consulta de búsqueda/información
 */
async function handleQuery(
  message: string,
  context: AssistantContext,
  conversationHistory: ConversationMessage[]
): Promise<AssistantResponse> {
  const openai = await getOpenAIClient()
  const msgLower = message.toLowerCase().trim()

  // Detectar saludos para dar una respuesta rápida sin búsqueda
  const greetings = ['hola', 'buenas', 'buen dia', 'buen día', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches', 'que tal', 'qué tal', 'hey', 'hi']
  const isGreeting = greetings.some(g => msgLower === g || msgLower.startsWith(g + ' ') || msgLower.startsWith(g + ','))

  if (isGreeting) {
    return {
      message: `¡Hola! Soy ORVIT, tu asistente de mantenimiento. ¿En qué puedo ayudarte hoy?

Puedo ayudarte a:
- Buscar soluciones a problemas de mantenimiento
- Consultar historial de fallas y OTs
- Crear órdenes de trabajo
- Analizar patrones de fallas

¿Qué necesitás?`,
    }
  }

  // Detectar si es una pregunta de seguimiento que necesita contexto de conversación anterior
  const followUpPatterns = [
    'como lo resolverias', 'cómo lo resolverías', 'como resolverias', 'cómo resolverías',
    'como lo solucionarias', 'cómo lo solucionarías', 'como solucionarias', 'cómo solucionarías',
    'que harias', 'qué harías', 'que harias vos', 'qué harías vos',
    'como hubieras', 'cómo hubieras', 'como hubieses', 'cómo hubieses',
    'dame un plan', 'armame un plan', 'arma un plan',
    'como se resuelve eso', 'cómo se resuelve eso', 'como arreglo eso', 'cómo arreglo eso',
    'que me recomendas', 'qué me recomendás', 'que recomiendas', 'qué recomendás',
  ]

  const isFollowUp = followUpPatterns.some(p => msgLower.includes(p)) ||
    (msgLower.includes('eso') && (msgLower.includes('resolver') || msgLower.includes('solucionar') || msgLower.includes('arreglar')))

  // Si es pregunta de seguimiento, extraer contexto de conversación anterior
  let enrichedMessage = message
  let conversationContext = ''

  if (isFollowUp && conversationHistory.length > 0) {
    console.log('[Assistant] Detected follow-up question, extracting context from history')

    // Buscar en el historial información relevante (fallas, máquinas, problemas mencionados)
    const recentMessages = conversationHistory.slice(-6) // Últimos 6 mensajes
    const contextParts: string[] = []

    for (const msg of recentMessages) {
      const content = msg.content.toLowerCase()
      // Buscar menciones de fallas, problemas, máquinas
      if (content.includes('falla') || content.includes('problema') || content.includes('error') ||
          content.includes('avería') || content.includes('no funciona') || content.includes('roto') ||
          content.includes('panel') || content.includes('bomba') || content.includes('motor') ||
          content.includes('eléctric') || content.includes('mecánic') || content.includes('hidráulic')) {
        contextParts.push(msg.content)
      }
    }

    if (contextParts.length > 0) {
      conversationContext = contextParts.join('\n')
      enrichedMessage = `Contexto de la conversación anterior:\n${conversationContext}\n\nPregunta actual del usuario: ${message}`
      console.log('[Assistant] Enriched message with conversation context')
    }
  }

  // Detectar tipos de entidad mencionados para filtrar la búsqueda
  const entityTypeKeywords: Record<string, string[]> = {
    failure_occurrence: ['falla', 'fallas', 'incidente', 'incidentes', 'avería', 'averías', 'problema', 'problemas'],
    failure_solution: ['solución', 'soluciones', 'solucion', 'soluciones', 'arreglo', 'reparación'],
    work_order: ['orden', 'ordenes', 'órdenes', 'ot', 'ots', 'trabajo', 'trabajos'],
    machine: ['máquina', 'maquina', 'máquinas', 'maquinas', 'equipo', 'equipos'],
    component: ['componente', 'componentes', 'parte', 'partes', 'pieza', 'piezas'],
    fixed_task: ['preventivo', 'preventivos', 'tarea', 'tareas', 'rutina', 'rutinas'],
    maintenance_checklist: ['checklist', 'checklists', 'lista', 'listas', 'verificación'],
  }

  // Usar el mensaje enriquecido para detección de entidades (incluye contexto de conversación)
  const textForEntityDetection = (enrichedMessage + ' ' + conversationContext).toLowerCase()
  const detectedEntityTypes: string[] = []

  for (const [entityType, keywords] of Object.entries(entityTypeKeywords)) {
    if (keywords.some(kw => textForEntityDetection.includes(kw))) {
      detectedEntityTypes.push(entityType)
    }
  }

  // Si es pregunta de seguimiento sobre resolver algo, agregar failure_solution
  if (isFollowUp && !detectedEntityTypes.includes('failure_solution')) {
    detectedEntityTypes.push('failure_solution')
  }

  console.log('[Assistant] Detected entity types:', detectedEntityTypes)
  console.log('[Assistant] Is follow-up question:', isFollowUp)

  // Detectar si es una consulta de métricas
  const detectedMetrics = detectMetricsQuery(message)
  const comparisonPeriod = detectComparisonRequest(message)
  let metricsContext = ''

  if (detectedMetrics && detectedMetrics.length > 0) {
    console.log('[Assistant] Detected metrics query:', detectedMetrics)
    console.log('[Assistant] Comparison period:', comparisonPeriod || 'none')
    try {
      let metricsResults
      if (comparisonPeriod) {
        // Si se solicita comparación, obtener métricas con comparación temporal
        metricsResults = await getMetricsWithComparison(context, detectedMetrics, comparisonPeriod)
        // También obtener métricas actuales para contexto completo
        const currentMetrics = await getMetrics(context, detectedMetrics)
        metricsResults = [...metricsResults, ...currentMetrics]
      } else {
        metricsResults = await getMetrics(context, detectedMetrics)
      }
      metricsContext = formatMetricsForLLM(metricsResults)
      console.log('[Assistant] Metrics context generated:', metricsContext.substring(0, 200))
    } catch (metricsError) {
      console.error('[Assistant] Error getting metrics:', metricsError)
    }
  }

  // Buscar en la base de conocimiento usando el mensaje enriquecido
  let searchResults: Awaited<ReturnType<typeof searchKnowledge>> = []
  let formattedContext = ''

  try {
    // Usar mensaje enriquecido para búsqueda más precisa
    searchResults = await searchKnowledge(enrichedMessage, context, {
      limit: 10,
      entityTypes: detectedEntityTypes.length > 0 ? detectedEntityTypes as any[] : undefined,
    })
    formattedContext = formatSearchResultsForLLM(searchResults)

    // Si hay métricas, agregarlas al contexto
    if (metricsContext) {
      formattedContext = metricsContext + '\n\n' + formattedContext
    }

    // Si no hay resultados ni métricas, indicar explícitamente para que use conocimiento general
    if ((!formattedContext || formattedContext.trim() === '' || searchResults.length === 0) && !metricsContext) {
      formattedContext = 'NO SE ENCONTRARON DATOS HISTÓRICOS EN EL SISTEMA para esta consulta. Por favor, responde usando tu conocimiento técnico de mantenimiento industrial y aclara que es una recomendación basada en buenas prácticas generales.'
    }
  } catch (searchError) {
    console.error('[Assistant] Error in knowledge search:', searchError)
    // Si hay métricas, usarlas aunque falle la búsqueda
    if (metricsContext) {
      formattedContext = metricsContext
    } else {
      formattedContext = 'No se pudo realizar la búsqueda en la base de conocimiento. Responde usando tu conocimiento técnico de mantenimiento industrial y aclara que es una recomendación general.'
    }
  }

  // Obtener configuración de rol
  const roleConfig = ROLE_CONFIGS[context.userRole] || ROLE_CONFIGS.supervisor

  // Construir historial de conversación para contexto
  const historyMessages = conversationHistory.slice(-AI_CONFIG.limits.maxConversationHistory)
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  // Obtener contexto de página
  const pageContext = getPageContext(context.currentPage)
  const pageContextPrompt = pageContext ? `\n\nCONTEXTO DE PÁGINA:\n${pageContext}` : ''

  // Generar respuesta
  const systemPrompt = SYSTEM_PROMPTS.main + `\n\nAdapta tu respuesta para un rol de: ${context.userRole}` + pageContextPrompt

  // Usar mensaje enriquecido que incluye contexto de conversación si es follow-up
  const userPrompt = SYSTEM_PROMPTS.responseGeneration
    .replace('{context}', formattedContext)
    .replace('{question}', enrichedMessage)
    .replace('{role}', context.userRole)

  try {
    console.log('[Assistant] Generating response for query:', message.substring(0, 50))
    console.log('[Assistant] Using enriched message:', isFollowUp ? 'YES' : 'NO')
    console.log('[Assistant] Search results count:', searchResults.length)
    console.log('[Assistant] Context being sent to LLM:', formattedContext.substring(0, 500))

    const response = await openai.chat.completions.create({
      model: AI_CONFIG.chat.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: userPrompt },
      ],
      temperature: AI_CONFIG.chat.temperature,
      max_tokens: AI_CONFIG.chat.maxTokens,
    })

    const responseText = response.choices[0].message.content

    // Construir referencias/fuentes
    const sources = searchResults
      .filter(r => r.similarity > 0.5)
      .map(r => ({
        type: r.entityType,
        id: r.entityId,
        title: r.enrichedData?.title || `${r.entityType}/${r.entityId}`,
        url: r.enrichedData?.url || '#',
      }))

    // Generar preguntas de seguimiento contextuales
    const followUpQuestions = generateFollowUpQuestions(message, searchResults, detectedEntityTypes, !!metricsContext)

    return {
      message: responseText || 'No pude generar una respuesta. Por favor, intenta reformular tu pregunta.',
      sources: sources.length > 0 ? sources : undefined,
      followUpQuestions,
    }
  } catch (error) {
    console.error('[Assistant] Error generating response:', error)
    return {
      message: 'Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo en unos momentos.',
    }
  }
}

/**
 * Maneja una solicitud de acción
 */
async function handleAction(
  intent: AssistantIntent & { type: 'action' },
  context: AssistantContext
): Promise<AssistantResponse> {
  // Por ahora, devolver un preview de la acción
  // La ejecución real se hará en otro endpoint después de confirmación

  const actionDescriptions: Record<string, string> = {
    create_work_order: 'Crear una nueva Orden de Trabajo',
    create_failure: 'Reportar una nueva Falla',
    create_preventive: 'Crear una nueva Tarea Preventiva',
    assign_work_order: 'Asignar una Orden de Trabajo',
    update_status: 'Actualizar el estado',
    add_note: 'Agregar una nota',
    search: 'Buscar en el sistema',
    filter: 'Filtrar resultados',
  }

  const description = actionDescriptions[intent.action] || `Ejecutar: ${intent.action}`

  return {
    message: `Entendido. Voy a ${description.toLowerCase()}.\n\nParámetros detectados:\n${JSON.stringify(intent.params, null, 2)}\n\n¿Confirmas esta acción?`,
    action: {
      type: intent.action,
      preview: {
        description,
        data: intent.params,
        canExecute: true,
        warnings: [],
      },
    },
  }
}

/**
 * Maneja solicitudes de ayuda
 */
function handleHelp(): AssistantResponse {
  return {
    message: `¡Hola! Soy ORVIT, tu asistente de mantenimiento. Puedo ayudarte con:

**Métricas rápidas:**
- "¿Cuántas OTs tenemos pendientes?"
- "¿Cómo está la carga de trabajo de los técnicos?"
- "¿Cuántas fallas hubo este mes?"
- "¿Hay preventivos vencidos?"

**Consultas:**
- "¿Cómo se resolvió el problema de vibración en la bomba 5?"
- "¿Qué preventivos hay pendientes esta semana?"
- "Mostrame el historial de fallas de la cinta transportadora"

**Acciones:**
- "Creá una OT para revisar la bomba 5"
- "Asigná la OT 123 a Pérez"
- "Reportá una falla en el compresor"

**Análisis:**
- "¿Cuáles son las máquinas que más fallan?"
- "Estado general del día"

¿En qué puedo ayudarte hoy?`,
  }
}

/**
 * Maneja mensajes que no se entienden
 */
function handleUnclear(message: string): AssistantResponse {
  return {
    message: `No estoy seguro de entender tu solicitud. ¿Podrías reformularla?

Puedo ayudarte con:
- Buscar información sobre fallas, OTs o máquinas
- Crear órdenes de trabajo o reportar fallas
- Consultar preventivos pendientes
- Analizar historial de mantenimiento

¿Qué necesitas hacer?`,
    followUpQuestions: [
      '¿Querés buscar información sobre una falla?',
      '¿Necesitás crear una orden de trabajo?',
      '¿Querés ver los preventivos pendientes?',
    ],
  }
}

/**
 * Genera preguntas de seguimiento contextuales basadas en la consulta y resultados
 */
function generateFollowUpQuestions(
  query: string,
  searchResults: any[],
  detectedEntityTypes: string[],
  hasMetrics: boolean = false
): string[] {
  const questions: string[] = []
  const queryLower = query.toLowerCase()

  // Si mostró métricas, sugerir más detalles
  if (hasMetrics) {
    if (!queryLower.includes('prioridad') && !queryLower.includes('urgent')) {
      questions.push('¿Cuáles son las OTs urgentes?')
    }
    if (!queryLower.includes('tecnico') && !queryLower.includes('carga')) {
      questions.push('¿Cómo está la carga de trabajo por técnico?')
    }
    if (!queryLower.includes('comparar') && !queryLower.includes('mes pasado')) {
      questions.push('¿Cómo se compara con el mes pasado?')
    }
  }

  // Si se encontraron fallas, sugerir soluciones y patrones
  if (detectedEntityTypes.includes('failure_occurrence') || searchResults.some(r => r.entityType === 'failure_occurrence')) {
    if (!queryLower.includes('soluc') && !queryLower.includes('resolver')) {
      questions.push('¿Cómo se resolvió esta falla?')
    }
    if (!queryLower.includes('patron') && !queryLower.includes('frecuencia')) {
      questions.push('¿Con qué frecuencia ocurre esta falla?')
    }
  }

  // Si se encontraron máquinas, sugerir historial y preventivos
  if (detectedEntityTypes.includes('machine') || searchResults.some(r => r.entityType === 'machine')) {
    if (!queryLower.includes('historial') && !queryLower.includes('historia')) {
      questions.push('¿Cuál es el historial de fallas de esta máquina?')
    }
    if (!queryLower.includes('preventivo')) {
      questions.push('¿Qué preventivos tiene asignados?')
    }
  }

  // Si preguntó por soluciones, sugerir crear OT o más detalles
  if (detectedEntityTypes.includes('failure_solution') || queryLower.includes('soluc') || queryLower.includes('resolver')) {
    if (!queryLower.includes('crear') && !queryLower.includes('ot') && !queryLower.includes('orden')) {
      questions.push('¿Querés que cree una OT para esto?')
    }
    questions.push('¿Necesitás más detalles del procedimiento?')
  }

  // Si preguntó por preventivos
  if (detectedEntityTypes.includes('fixed_task') || queryLower.includes('preventivo')) {
    if (!queryLower.includes('pendiente')) {
      questions.push('¿Qué preventivos están pendientes esta semana?')
    }
    if (!queryLower.includes('venc') && !queryLower.includes('atras')) {
      questions.push('¿Hay preventivos vencidos?')
    }
  }

  // Si preguntó por OTs
  if (detectedEntityTypes.includes('work_order') || queryLower.includes('orden') || queryLower.includes('ot')) {
    if (!queryLower.includes('pendiente')) {
      questions.push('¿Cuáles son las OTs pendientes?')
    }
    if (!queryLower.includes('asigna')) {
      questions.push('¿A quién está asignada?')
    }
  }

  // Preguntas genéricas si no hay muchas específicas
  if (questions.length < 2) {
    if (!queryLower.includes('ayuda')) {
      questions.push('¿Qué más podés hacer?')
    }
    if (searchResults.length > 0 && !queryLower.includes('relacionad')) {
      questions.push('¿Hay casos similares?')
    }
  }

  // Limitar a máximo 3 preguntas
  return questions.slice(0, 3)
}

/**
 * Procesa un mensaje con streaming - devuelve un ReadableStream con chunks de la respuesta
 * @param imageBase64 - Imagen en base64 (data:image/...) para usar con GPT-4 Vision
 */
export async function processMessageStream(
  message: string,
  context: AssistantContext,
  conversationHistory: ConversationMessage[] = [],
  imageBase64?: string
): Promise<{ stream: ReadableStream<Uint8Array>, metadata: Promise<{ sources?: any[], followUpQuestions?: string[], interactiveSelection?: InteractiveSelection }> }> {
  const openai = await getOpenAIClient()
  const msgLower = message.toLowerCase().trim()
  const hasImage = !!imageBase64

  // ================================================================
  // FLUJO INTERACTIVO: Detectar intención de resolver falla
  // ================================================================
  const failureIntentPatterns = [
    /(?:quiero|necesito|tengo que|hay que|debo)\s+(?:solucionar|resolver|arreglar|reparar|ver|revisar)\s+(?:una\s+)?(?:falla|averia|problema|error)\s+(?:en|de|del|la|el)\s+(.+)/i,
    /(?:falla|problema|averia)\s+(?:en|de|del|la|el)\s+(.+?)[\s,.].*(?:solucionar|resolver|arreglar)/i,
    /(?:ayuda|ayudame)\s+(?:a\s+)?(?:resolver|solucionar|arreglar)\s+(?:una\s+)?(?:falla|problema)\s+(?:en|de)\s+(.+)/i,
    /(?:me\s+ayudas|podrias|podes)\s+(?:con|a)\s+(?:una\s+)?(?:falla|problema)\s+(?:en|de)\s+(.+)/i,
  ]

  // Verificar si es una solicitud de resolver falla en una máquina
  let machineFromPattern: string | null = null
  for (const pattern of failureIntentPatterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      machineFromPattern = match[1].trim()
      break
    }
  }

  // Si detectamos intención de resolver falla, buscar la máquina
  if (machineFromPattern) {
    console.log('[Assistant] Detected failure resolution intent for:', machineFromPattern)

    const machineDetection = await detectMachineMention(message, context.companyId)

    if (machineDetection.detected && machineDetection.machineId) {
      console.log('[Assistant] Found machine:', machineDetection.machineName, 'ID:', machineDetection.machineId)

      // Obtener fallas activas de la máquina
      const activeFailures = await getMachineActiveFailures(
        machineDetection.machineId,
        context.companyId
      )

      console.log('[Assistant] Found', activeFailures.length, 'active failures')

      // Si hay fallas activas, devolver respuesta con selección interactiva
      if (activeFailures.length > 0) {
        const responseText = `Encontré **${activeFailures.length} falla${activeFailures.length > 1 ? 's' : ''} activa${activeFailures.length > 1 ? 's' : ''}** en **${machineDetection.machineName}**.\n\nSeleccioná cuál querés resolver:`

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(responseText))
            controller.close()
          }
        })

        return {
          stream,
          metadata: Promise.resolve({
            interactiveSelection: {
              type: 'failure_selection',
              machineId: machineDetection.machineId,
              machineName: machineDetection.machineName!,
              failures: activeFailures,
            }
          })
        }
      } else {
        // No hay fallas activas, responder normalmente
        const responseText = `No encontré fallas activas registradas en **${machineDetection.machineName}**.\n\n¿Querés que te ayude con algo más? Puedo:\n- Mostrar el historial de fallas de esta máquina\n- Revisar las OTs relacionadas\n- Buscar problemas similares en otras máquinas`

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(responseText))
            controller.close()
          }
        })

        return {
          stream,
          metadata: Promise.resolve({
            followUpQuestions: [
              `¿Cuál es el historial de fallas de ${machineDetection.machineName}?`,
              '¿Hay OTs pendientes en esta máquina?',
              '¿Querés reportar una nueva falla?'
            ]
          })
        }
      }
    }
  }

  // ================================================================
  // DEEP SEARCH: Si viene de selección de falla con triggerDeepSearch
  // ================================================================
  const currentEntity = context.currentEntity
  if (currentEntity?.type === 'failure_occurrence' && currentEntity.data?.triggerDeepSearch) {
    console.log('[Assistant] Triggered deep search for failure:', currentEntity.id)

    const machineId = currentEntity.data.machineId as number
    const machineName = currentEntity.data.machineName as string
    const failureTitle = currentEntity.data.failureTitle as string

    // Obtener contexto profundo de la máquina
    const deepContext = await getDeepMachineContext(machineId, context.companyId)

    if (deepContext) {
      const formattedDeepContext = formatDeepMachineContextForLLM(deepContext)

      console.log('[Assistant] Deep context loaded for', machineName)

      // Construir prompt especial para análisis profundo
      const deepAnalysisPrompt = `El usuario seleccionó resolver la siguiente falla:

FALLA SELECCIONADA: ${failureTitle}
${currentEntity.data.failureDescription ? `Descripción: ${currentEntity.data.failureDescription}` : ''}
${currentEntity.data.componentName ? `Componente: ${currentEntity.data.componentName}` : ''}
${currentEntity.data.subcomponentName ? `Subcomponente: ${currentEntity.data.subcomponentName}` : ''}

CONTEXTO COMPLETO DE LA MÁQUINA Y SU HISTORIAL:
${formattedDeepContext}

INSTRUCCIONES:
1. Analiza toda la información disponible de la máquina
2. Revisa si hay soluciones previas para fallas similares
3. Considera los componentes y subcomponentes que podrían estar afectados
4. Genera un PLAN DE ACCIÓN DETALLADO que incluya:
   - Diagnóstico inicial (qué verificar primero)
   - Posibles causas basadas en el historial
   - Herramientas y materiales necesarios
   - Pasos de solución en orden
   - Precauciones de seguridad
   - Verificación final
5. Si hay soluciones previas relevantes, cita cuáles y adapta las recomendaciones
6. Menciona si hay otros componentes que deberían revisarse preventivamente`

      const pageContext = getPageContext(context.currentPage)
      const pageContextPrompt = pageContext ? `\n\nCONTEXTO DE PÁGINA:\n${pageContext}` : ''

      const systemPrompt = SYSTEM_PROMPTS.main + `\n\nAdapta tu respuesta para un rol de: ${context.userRole}` + pageContextPrompt

      const historyMessages = conversationHistory.slice(-AI_CONFIG.limits.maxConversationHistory)
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

      // Crear stream de OpenAI con análisis profundo
      const openaiStream = await openai.chat.completions.create({
        model: AI_CONFIG.chat.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: deepAnalysisPrompt },
        ],
        temperature: AI_CONFIG.chat.temperature,
        max_tokens: 3000, // Más tokens para respuesta detallada
        stream: true,
      })

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of openaiStream) {
              const content = chunk.choices[0]?.delta?.content
              if (content) {
                controller.enqueue(encoder.encode(content))
              }
            }
            controller.close()
          } catch (error) {
            console.error('[Assistant] Deep search stream error:', error)
            controller.error(error)
          }
        }
      })

      // Construir sources de todo el contexto profundo
      const sources = [
        ...(deepContext.activeFailures.map(f => ({
          type: 'failure_occurrence',
          id: f.id,
          title: f.title,
          url: `/mantenimiento/fallas/${f.id}`,
        }))),
        ...(deepContext.relatedWorkOrders.slice(0, 3).map(wo => ({
          type: 'work_order',
          id: wo.id,
          title: wo.title,
          url: `/mantenimiento/ordenes-trabajo/${wo.id}`,
        }))),
        ...(deepContext.relatedSolutions.slice(0, 2).map(s => ({
          type: 'failure_solution',
          id: s.id,
          title: s.title,
          url: '#',
        }))),
      ]

      return {
        stream,
        metadata: Promise.resolve({
          sources,
          followUpQuestions: [
            '¿Querés que cree una OT para esta reparación?',
            '¿Hay repuestos disponibles para esto?',
            '¿Qué más debería revisar preventivamente?',
          ],
        }),
      }
    }
  }

  // Detectar saludos para dar una respuesta rápida sin búsqueda (solo si no hay imagen)
  const greetings = ['hola', 'buenas', 'buen dia', 'buen día', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches', 'que tal', 'qué tal', 'hey', 'hi']
  const isGreeting = !hasImage && greetings.some(g => msgLower === g || msgLower.startsWith(g + ' ') || msgLower.startsWith(g + ','))

  if (isGreeting) {
    const greetingResponse = `¡Hola! Soy ORVIT, tu asistente de mantenimiento. ¿En qué puedo ayudarte hoy?

Puedo ayudarte a:
- Buscar soluciones a problemas de mantenimiento
- Consultar historial de fallas y OTs
- Crear órdenes de trabajo
- Analizar patrones de fallas

¿Qué necesitás?`

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(greetingResponse))
        controller.close()
      }
    })
    return { stream, metadata: Promise.resolve({}) }
  }

  // Detectar si es una pregunta de seguimiento
  const followUpPatterns = [
    'como lo resolverias', 'cómo lo resolverías', 'como resolverias', 'cómo resolverías',
    'como lo solucionarias', 'cómo lo solucionarías', 'como solucionarias', 'cómo solucionarías',
    'que harias', 'qué harías', 'que harias vos', 'qué harías vos',
    'como hubieras', 'cómo hubieras', 'como hubieses', 'cómo hubieses',
    'dame un plan', 'armame un plan', 'arma un plan',
    'como se resuelve eso', 'cómo se resuelve eso', 'como arreglo eso', 'cómo arreglo eso',
    'que me recomendas', 'qué me recomendás', 'que recomiendas', 'qué recomendás',
  ]

  const isFollowUp = followUpPatterns.some(p => msgLower.includes(p)) ||
    (msgLower.includes('eso') && (msgLower.includes('resolver') || msgLower.includes('solucionar') || msgLower.includes('arreglar')))

  let enrichedMessage = message
  let conversationContext = ''

  if (isFollowUp && conversationHistory.length > 0) {
    const recentMessages = conversationHistory.slice(-6)
    const contextParts: string[] = []

    for (const msg of recentMessages) {
      const content = msg.content.toLowerCase()
      if (content.includes('falla') || content.includes('problema') || content.includes('error') ||
          content.includes('avería') || content.includes('no funciona') || content.includes('roto') ||
          content.includes('panel') || content.includes('bomba') || content.includes('motor') ||
          content.includes('eléctric') || content.includes('mecánic') || content.includes('hidráulic')) {
        contextParts.push(msg.content)
      }
    }

    if (contextParts.length > 0) {
      conversationContext = contextParts.join('\n')
      enrichedMessage = `Contexto de la conversación anterior:\n${conversationContext}\n\nPregunta actual del usuario: ${message}`
    }
  }

  // Detectar tipos de entidad
  const entityTypeKeywords: Record<string, string[]> = {
    failure_occurrence: ['falla', 'fallas', 'incidente', 'incidentes', 'avería', 'averías', 'problema', 'problemas'],
    failure_solution: ['solución', 'soluciones', 'solucion', 'soluciones', 'arreglo', 'reparación'],
    work_order: ['orden', 'ordenes', 'órdenes', 'ot', 'ots', 'trabajo', 'trabajos'],
    machine: ['máquina', 'maquina', 'máquinas', 'maquinas', 'equipo', 'equipos'],
    component: ['componente', 'componentes', 'parte', 'partes', 'pieza', 'piezas'],
    fixed_task: ['preventivo', 'preventivos', 'tarea', 'tareas', 'rutina', 'rutinas'],
    maintenance_checklist: ['checklist', 'checklists', 'lista', 'listas', 'verificación'],
  }

  const textForEntityDetection = (enrichedMessage + ' ' + conversationContext).toLowerCase()
  const detectedEntityTypes: string[] = []

  for (const [entityType, keywords] of Object.entries(entityTypeKeywords)) {
    if (keywords.some(kw => textForEntityDetection.includes(kw))) {
      detectedEntityTypes.push(entityType)
    }
  }

  if (isFollowUp && !detectedEntityTypes.includes('failure_solution')) {
    detectedEntityTypes.push('failure_solution')
  }

  // Detectar métricas y comparaciones
  const detectedMetrics = detectMetricsQuery(message)
  const comparisonPeriod = detectComparisonRequest(message)
  let metricsContext = ''

  if (detectedMetrics && detectedMetrics.length > 0) {
    try {
      let metricsResults
      if (comparisonPeriod) {
        metricsResults = await getMetricsWithComparison(context, detectedMetrics, comparisonPeriod)
        const currentMetrics = await getMetrics(context, detectedMetrics)
        metricsResults = [...metricsResults, ...currentMetrics]
      } else {
        metricsResults = await getMetrics(context, detectedMetrics)
      }
      metricsContext = formatMetricsForLLM(metricsResults)
    } catch (metricsError) {
      console.error('[Assistant] Error getting metrics:', metricsError)
    }
  }

  // Buscar en conocimiento
  let searchResults: Awaited<ReturnType<typeof searchKnowledge>> = []
  let formattedContext = ''

  try {
    searchResults = await searchKnowledge(enrichedMessage, context, {
      limit: 10,
      entityTypes: detectedEntityTypes.length > 0 ? detectedEntityTypes as any[] : undefined,
    })
    formattedContext = formatSearchResultsForLLM(searchResults)

    if (metricsContext) {
      formattedContext = metricsContext + '\n\n' + formattedContext
    }

    if ((!formattedContext || formattedContext.trim() === '' || searchResults.length === 0) && !metricsContext) {
      formattedContext = 'NO SE ENCONTRARON DATOS HISTÓRICOS EN EL SISTEMA para esta consulta. Por favor, responde usando tu conocimiento técnico de mantenimiento industrial y aclara que es una recomendación basada en buenas prácticas generales.'
    }
  } catch (searchError) {
    console.error('[Assistant] Error in knowledge search:', searchError)
    if (metricsContext) {
      formattedContext = metricsContext
    } else {
      formattedContext = 'No se pudo realizar la búsqueda en la base de conocimiento. Responde usando tu conocimiento técnico de mantenimiento industrial y aclara que es una recomendación general.'
    }
  }

  const historyMessages = conversationHistory.slice(-AI_CONFIG.limits.maxConversationHistory)
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  // Obtener contexto de página
  const pageContext = getPageContext(context.currentPage)
  const pageContextPrompt = pageContext ? `\n\nCONTEXTO DE PÁGINA:\n${pageContext}` : ''

  const systemPrompt = SYSTEM_PROMPTS.main + `\n\nAdapta tu respuesta para un rol de: ${context.userRole}` + pageContextPrompt
  const userPrompt = SYSTEM_PROMPTS.responseGeneration
    .replace('{context}', formattedContext)
    .replace('{question}', enrichedMessage)
    .replace('{role}', context.userRole)

  // Construir mensaje del usuario (con o sin imagen)
  let userMessage: any
  if (hasImage && imageBase64) {
    // Mensaje con imagen para GPT-4 Vision
    const imagePrompt = `${userPrompt}

El usuario también adjuntó una imagen. Analízala en el contexto de mantenimiento industrial:
- Si es una foto de una máquina o equipo, identifica posibles problemas visibles
- Si es una foto de una falla o avería, describe lo que ves y sugiere posibles causas
- Si es una foto de un documento o etiqueta, extrae la información relevante
- Relaciona lo que ves con la consulta del usuario`

    userMessage = {
      role: 'user',
      content: [
        { type: 'text', text: imagePrompt },
        { type: 'image_url', image_url: { url: imageBase64, detail: 'high' } },
      ],
    }
  } else {
    userMessage = { role: 'user', content: userPrompt }
  }

  // Usar modelo con visión si hay imagen
  const model = hasImage ? 'gpt-4o' : AI_CONFIG.chat.model

  // Crear stream de OpenAI
  const openaiStream = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      userMessage,
    ],
    temperature: AI_CONFIG.chat.temperature,
    max_tokens: hasImage ? 2000 : AI_CONFIG.chat.maxTokens,
    stream: true,
  })

  const encoder = new TextEncoder()

  // Transformar el stream de OpenAI a ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of openaiStream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            controller.enqueue(encoder.encode(content))
          }
        }
        controller.close()
      } catch (error) {
        console.error('[Assistant] Stream error:', error)
        controller.error(error)
      }
    }
  })

  // Metadata (sources, follow-up questions) se resuelven después
  const metadata = Promise.resolve({
    sources: searchResults
      .filter(r => r.similarity > 0.5)
      .map(r => ({
        type: r.entityType,
        id: r.entityId,
        title: r.enrichedData?.title || `${r.entityType}/${r.entityId}`,
        url: r.enrichedData?.url || '#',
      })),
    followUpQuestions: generateFollowUpQuestions(message, searchResults, detectedEntityTypes, !!metricsContext),
  })

  return { stream, metadata }
}

/**
 * Transcribe audio a texto usando Whisper
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const openai = await getOpenAIClient()

  // Crear un archivo temporal para enviar a Whisper
  const file = new File([audioBuffer], 'audio.webm', { type: mimeType })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: AI_CONFIG.voice.model,
    language: AI_CONFIG.voice.language,
    response_format: 'text',
  })

  return transcription
}
