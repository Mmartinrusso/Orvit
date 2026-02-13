// ============================================
// Tipos para el Asistente IA
// ============================================

// Tipos de entidades que se pueden indexar
// NOTA: Solo incluye entidades que existen en el schema
export type IndexableEntityType =
  | 'work_order'
  | 'failure_occurrence'
  | 'failure_solution'
  | 'fixed_task'
  | 'fixed_task_execution'
  | 'maintenance_checklist'
  | 'machine'
  | 'component'

// Tipos de acciones que puede ejecutar el asistente
export type AssistantActionType =
  | 'create_work_order'
  | 'create_failure'
  | 'create_preventive'
  | 'create_checklist'
  | 'assign_work_order'
  | 'assign_preventive'
  | 'update_status'
  | 'complete_preventive'
  | 'add_note'
  | 'search'
  | 'filter'
  | 'generate_report'

// Intención detectada del mensaje del usuario
export type AssistantIntent =
  | { type: 'query'; subject: string }
  | { type: 'action'; action: AssistantActionType; params: Record<string, unknown> }
  | { type: 'report'; reportType: string }
  | { type: 'help' }
  | { type: 'unclear' }

// Contexto del usuario en el momento de la consulta
export interface AssistantContext {
  userId: number
  companyId: number
  userRole: string
  currentPage?: string
  currentEntity?: {
    type: IndexableEntityType
    id: number
    data?: Record<string, unknown>
  }
}

// Mensaje en la conversación
export interface ConversationMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  action?: {
    type: AssistantActionType
    preview?: Record<string, unknown>
    status: 'pending' | 'confirmed' | 'executed' | 'cancelled'
  }
  sources?: EntityReference[]
  isVoiceInput?: boolean
}

// Referencia a una entidad del sistema
export interface EntityReference {
  type: IndexableEntityType
  id: number
  title: string
  url: string
}

// Resultado de búsqueda en la base de conocimiento
export interface KnowledgeSearchResult {
  id: number
  entityType: IndexableEntityType
  entityId: number
  content: string
  metadata: Record<string, unknown>
  similarity: number
  // Datos enriquecidos después de buscar en la DB
  enrichedData?: {
    title: string
    url: string
    status?: string
    date?: Date
    machine?: string
    component?: string
    subcomponent?: string
    location?: string // Jerarquía completa: Máquina → Componente → Subcomponente
    sector?: string
  }
}

// Contenido a indexar
export interface IndexableContent {
  entityType: IndexableEntityType
  entityId: number
  companyId: number
  content: string
  metadata: {
    machineId?: number
    componentId?: number
    sectorId?: number
    status?: string
    priority?: string
    type?: string
    date?: Date
    tags?: string[]
  }
}

// Preview de una acción antes de ejecutar
export interface ActionPreview {
  description: string
  data: Record<string, unknown>
  warnings?: string[]
  canExecute: boolean
  missingFields?: string[]
}

// Resultado de ejecutar una acción
export interface ActionResult {
  success: boolean
  entityId?: number
  entityUrl?: string
  message: string
  error?: string
}

// Respuesta del asistente
export interface AssistantResponse {
  message: string
  sources?: EntityReference[]
  action?: {
    type: AssistantActionType
    preview: ActionPreview
  }
  followUpQuestions?: string[]
}

// Configuración de roles para adaptar respuestas
export interface RoleConfig {
  includeDetails: string[]
  excludeDetails: string[]
  language: 'technical' | 'balanced' | 'business'
  metrics: string[]
}

export const ROLE_CONFIGS: Record<string, RoleConfig> = {
  technician: {
    includeDetails: ['technical_specs', 'procedures', 'parts', 'tools'],
    excludeDetails: ['costs', 'financial_impact'],
    language: 'technical',
    metrics: ['time_to_fix', 'steps', 'parts_used']
  },
  supervisor: {
    includeDetails: ['summary', 'status', 'assignees', 'timeline'],
    excludeDetails: [],
    language: 'balanced',
    metrics: ['completion_rate', 'pending_count', 'overdue']
  },
  manager: {
    includeDetails: ['costs', 'financial_impact', 'kpis', 'trends'],
    excludeDetails: ['detailed_procedures'],
    language: 'business',
    metrics: ['cost', 'downtime_hours', 'production_lost', 'mttr', 'mtbf']
  },
  engineer: {
    includeDetails: ['technical_specs', 'kpis', 'trends', 'root_cause'],
    excludeDetails: [],
    language: 'balanced',
    metrics: ['mttr', 'mtbf', 'reliability', 'failure_patterns']
  }
}
