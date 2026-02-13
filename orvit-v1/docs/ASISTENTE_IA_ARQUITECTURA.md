# Asistente IA - Arquitectura Técnica V1

## 1. Visión General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Chat Widget │  │ Voice Input │  │ Quick Actions│  │Context Panel│    │
│  │             │  │ (Whisper)   │  │             │  │             │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Next.js)                              │
│                                                                          │
│  /api/assistant/chat      → Procesa mensajes de texto                   │
│  /api/assistant/voice     → Procesa audio (Whisper)                     │
│  /api/assistant/actions   → Ejecuta acciones en el sistema              │
│  /api/assistant/context   → Obtiene contexto actual                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐
│   ASSISTANT ENGINE   │ │  KNOWLEDGE BASE  │ │    ACTION EXECUTOR       │
│                      │ │                  │ │                          │
│ • Intent Detection   │ │ • Embeddings     │ │ • Crear OT               │
│ • Context Building   │ │ • Soluciones     │ │ • Crear Falla            │
│ • Response Gen       │ │ • Historial      │ │ • Asignar                │
│ • Role Adaptation    │ │ • Documentos     │ │ • Actualizar estados     │
│                      │ │                  │ │ • Filtrar/Buscar         │
└──────────┬───────────┘ └────────┬─────────┘ └────────────┬─────────────┘
           │                      │                        │
           └──────────────────────┼────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         POSTGRESQL + pgvector                            │
│                                                                          │
│  Tablas existentes (OTs, Fallas, Máquinas, etc.)                        │
│  +                                                                       │
│  Nuevas tablas para IA:                                                  │
│  • assistant_embeddings     (vectores de búsqueda semántica)            │
│  • assistant_conversations  (historial de chats)                         │
│  • assistant_actions_log    (auditoría de acciones)                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Componentes Principales

### 2.1 Frontend - Chat Widget

```typescript
// components/assistant/AssistantChat.tsx

interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date

  // Si es una acción
  action?: {
    type: 'create_ot' | 'create_failure' | 'assign' | 'update' | 'search'
    preview: any        // Vista previa de lo que va a hacer
    status: 'pending' | 'confirmed' | 'executed' | 'cancelled'
  }

  // Si tiene fuentes/referencias
  sources?: {
    type: 'work_order' | 'failure' | 'solution' | 'machine'
    id: string
    title: string
    url: string
  }[]
}

interface AssistantContext {
  // Contexto actual del usuario
  currentPage: string           // ej: '/mantenimiento/ots/123'
  currentEntity?: {
    type: 'work_order' | 'failure' | 'machine' | 'checklist'
    id: string
    data: any
  }
  userRole: string              // Para adaptar respuestas
  companyId: string
  userId: string
}
```

### 2.2 Voice Input (Whisper)

```typescript
// lib/assistant/voice.ts

interface VoiceProcessingResult {
  transcript: string           // Texto transcrito
  language: string             // Idioma detectado
  confidence: number           // Confianza de la transcripción
  duration: number             // Duración del audio
}

// Flujo:
// 1. Usuario graba audio en el frontend
// 2. Se envía a /api/assistant/voice
// 3. Se procesa con Whisper (OpenAI o local)
// 4. Se devuelve el texto
// 5. El texto se procesa como mensaje normal
```

### 2.3 Assistant Engine

```typescript
// lib/assistant/engine.ts

interface AssistantEngine {
  // Procesar mensaje del usuario
  processMessage(
    message: string,
    context: AssistantContext,
    conversationHistory: AssistantMessage[]
  ): Promise<AssistantResponse>

  // Detectar intención
  detectIntent(message: string): Promise<Intent>

  // Buscar en base de conocimiento
  searchKnowledge(query: string, context: AssistantContext): Promise<KnowledgeResult[]>

  // Generar respuesta
  generateResponse(
    intent: Intent,
    knowledge: KnowledgeResult[],
    context: AssistantContext
  ): Promise<string>

  // Adaptar respuesta al rol
  adaptToRole(response: string, userRole: string): string
}

type Intent =
  | { type: 'query', subject: string }           // Pregunta sobre algo
  | { type: 'action', action: ActionType, params: any }  // Ejecutar acción
  | { type: 'report', reportType: string }       // Generar reporte
  | { type: 'help' }                             // Ayuda general
  | { type: 'unclear' }                          // No se entendió

type ActionType =
  | 'create_work_order'
  | 'create_failure'
  | 'create_preventive'           // Crear tarea preventiva
  | 'create_checklist'            // Crear checklist
  | 'assign_work_order'
  | 'assign_preventive'           // Asignar preventivo
  | 'update_status'
  | 'complete_preventive'         // Marcar preventivo como completado
  | 'add_note'
  | 'search'
  | 'filter'
  | 'generate_report'
```

### 2.4 Knowledge Base

```typescript
// lib/assistant/knowledge.ts

interface KnowledgeBase {
  // Indexar contenido para búsqueda semántica
  indexContent(content: IndexableContent): Promise<void>

  // Buscar por similitud semántica
  searchSemantic(query: string, options: SearchOptions): Promise<SearchResult[]>

  // Buscar por filtros específicos
  searchStructured(filters: StructuredFilters): Promise<SearchResult[]>

  // Obtener contexto de una entidad
  getEntityContext(type: string, id: string): Promise<EntityContext>
}

interface IndexableContent {
  id: string
  type: 'work_order' | 'failure' | 'solution' | 'machine' | 'document'
  companyId: string

  // Texto para indexar
  text: string

  // Metadata para filtros
  metadata: {
    machineId?: string
    componentId?: string
    sectorId?: string
    date?: Date
    status?: string
    tags?: string[]
  }
}
```

### 2.5 Action Executor

```typescript
// lib/assistant/actions.ts

interface ActionExecutor {
  // Validar si la acción es posible
  validateAction(action: Action, context: AssistantContext): Promise<ValidationResult>

  // Generar preview de la acción
  generatePreview(action: Action): Promise<ActionPreview>

  // Ejecutar la acción
  executeAction(action: Action, context: AssistantContext): Promise<ActionResult>
}

interface Action {
  type: ActionType
  params: any
  requiresConfirmation: boolean
}

interface ActionPreview {
  description: string          // "Voy a crear una OT con estos datos:"
  data: any                    // Los datos que se van a crear/modificar
  warnings?: string[]          // Advertencias si hay algo raro
  canExecute: boolean          // Si se puede ejecutar o falta algo
  missingFields?: string[]     // Campos que faltan
}

interface ActionResult {
  success: boolean
  entityId?: string            // ID de la entidad creada/modificada
  entityUrl?: string           // URL para ver la entidad
  message: string              // Mensaje para el usuario
  error?: string               // Error si falló
}
```

---

## 3. Base de Datos - Nuevas Tablas

```prisma
// Agregar a schema.prisma

// Embeddings para búsqueda semántica
model AssistantEmbedding {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])

  // Referencia a la entidad original
  entityType  String   // 'work_order', 'failure', 'solution', etc.
  entityId    String

  // Texto indexado
  content     String

  // Vector de embedding (usando pgvector)
  embedding   Unsupported("vector(1536)")  // 1536 para OpenAI embeddings

  // Metadata para filtros
  metadata    Json?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([companyId])
  @@index([entityType])
  @@index([entityId])
}

// Historial de conversaciones
model AssistantConversation {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  userId      String
  user        User     @relation(fields: [userId], references: [id])

  // Contexto de la conversación
  context     Json?    // Página, entidad actual, etc.

  // Mensajes
  messages    AssistantMessage[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([companyId])
  @@index([userId])
}

model AssistantMessage {
  id              String   @id @default(cuid())
  conversationId  String
  conversation    AssistantConversation @relation(fields: [conversationId], references: [id])

  role            String   // 'user' | 'assistant'
  content         String

  // Si fue una acción
  actionType      String?
  actionData      Json?
  actionStatus    String?  // 'pending', 'confirmed', 'executed', 'cancelled'

  // Fuentes/referencias usadas
  sources         Json?

  // Métricas
  tokensUsed      Int?
  responseTimeMs  Int?

  createdAt       DateTime @default(now())

  @@index([conversationId])
}

// Log de acciones ejecutadas
model AssistantActionLog {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  userId      String
  user        User     @relation(fields: [userId], references: [id])

  // Qué acción se ejecutó
  actionType  String
  actionData  Json

  // Resultado
  success     Boolean
  resultData  Json?
  errorMessage String?

  // Entidad afectada
  entityType  String?
  entityId    String?

  createdAt   DateTime @default(now())

  @@index([companyId])
  @@index([userId])
  @@index([actionType])
}
```

### Configurar pgvector

```sql
-- Ejecutar en PostgreSQL

-- Habilitar extensión
CREATE EXTENSION IF NOT EXISTS vector;

-- Crear índice para búsqueda eficiente
CREATE INDEX ON "AssistantEmbedding"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

## 4. APIs

### 4.1 Chat Endpoint

```typescript
// app/api/assistant/chat/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { AssistantEngine } from '@/lib/assistant/engine'
import { KnowledgeBase } from '@/lib/assistant/knowledge'
import { ActionExecutor } from '@/lib/assistant/actions'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { message, conversationId, context } = await req.json()

  const engine = new AssistantEngine()
  const knowledge = new KnowledgeBase()
  const actions = new ActionExecutor()

  // 1. Detectar intención
  const intent = await engine.detectIntent(message)

  // 2. Si es una acción, generar preview
  if (intent.type === 'action') {
    const validation = await actions.validateAction(intent.action, context)
    if (!validation.valid) {
      return NextResponse.json({
        response: validation.message,
        needsMoreInfo: true,
        missingFields: validation.missingFields
      })
    }

    const preview = await actions.generatePreview(intent.action)
    return NextResponse.json({
      response: preview.description,
      action: {
        type: intent.action.type,
        preview: preview.data,
        status: 'pending'
      }
    })
  }

  // 3. Si es una consulta, buscar en knowledge base
  if (intent.type === 'query') {
    const results = await knowledge.searchSemantic(message, {
      companyId: context.companyId,
      limit: 5
    })

    const response = await engine.generateResponse(intent, results, context)
    const adaptedResponse = engine.adaptToRole(response, context.userRole)

    return NextResponse.json({
      response: adaptedResponse,
      sources: results.map(r => ({
        type: r.entityType,
        id: r.entityId,
        title: r.title,
        url: r.url
      }))
    })
  }

  // 4. Respuesta genérica
  const response = await engine.generateResponse(intent, [], context)
  return NextResponse.json({ response })
}
```

### 4.2 Voice Endpoint

```typescript
// app/api/assistant/voice/route.ts

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI()

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const audioFile = formData.get('audio') as File

  if (!audioFile) {
    return NextResponse.json({ error: 'No audio file' }, { status: 400 })
  }

  // Transcribir con Whisper
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'es',
    response_format: 'json'
  })

  return NextResponse.json({
    transcript: transcription.text,
    language: 'es'
  })
}
```

### 4.3 Actions Endpoint

```typescript
// app/api/assistant/actions/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { ActionExecutor } from '@/lib/assistant/actions'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { actionType, actionData, confirmed } = await req.json()

  const executor = new ActionExecutor()

  // Si no está confirmado, solo validar
  if (!confirmed) {
    const preview = await executor.generatePreview({ type: actionType, params: actionData })
    return NextResponse.json({ preview })
  }

  // Ejecutar la acción
  const result = await executor.executeAction(
    { type: actionType, params: actionData, requiresConfirmation: false },
    { userId: session.user.id, companyId: session.user.companyId }
  )

  // Loggear la acción
  await prisma.assistantActionLog.create({
    data: {
      companyId: session.user.companyId,
      userId: session.user.id,
      actionType,
      actionData,
      success: result.success,
      resultData: result,
      entityType: result.entityType,
      entityId: result.entityId
    }
  })

  return NextResponse.json(result)
}
```

---

## 5. Qué Datos Alimentan la IA

### 5.1 Entidades a Indexar

```typescript
// lib/assistant/indexer.ts

// Estas entidades se indexan para búsqueda semántica
const INDEXABLE_ENTITIES = {
  // MANTENIMIENTO
  work_order: {
    table: 'WorkOrder',
    textFields: ['title', 'description', 'solution', 'notes'],
    metadataFields: ['machineId', 'sectorId', 'status', 'priority', 'type']
  },

  failure_occurrence: {
    table: 'FailureOccurrence',
    textFields: ['description', 'symptoms', 'rootCause'],
    metadataFields: ['machineId', 'componentId', 'sectorId', 'severity']
  },

  failure_solution: {
    table: 'FailureSolution',
    textFields: ['description', 'steps', 'notes'],
    metadataFields: ['failureId', 'effectiveness', 'timeToFix']
  },

  solution_application: {
    table: 'SolutionApplication',
    textFields: ['notes', 'result'],
    metadataFields: ['solutionId', 'workOrderId', 'success']
  },

  // MÁQUINAS
  machine: {
    table: 'Machine',
    textFields: ['name', 'description', 'specifications'],
    metadataFields: ['sectorId', 'type', 'criticality']
  },

  component: {
    table: 'Component',
    textFields: ['name', 'description'],
    metadataFields: ['machineId', 'type']
  },

  // MANTENIMIENTO PREVENTIVO
  fixed_task: {
    table: 'FixedTask',
    textFields: ['title', 'description', 'instructions'],
    metadataFields: ['machineId', 'sectorId', 'frequency', 'assignedToId', 'type']
  },

  fixed_task_execution: {
    table: 'FixedTaskExecution',
    textFields: ['observations', 'issues', 'actionsPerformed'],
    metadataFields: ['fixedTaskId', 'executorId', 'status', 'completedAt']
  },

  maintenance_checklist: {
    table: 'MaintenanceChecklist',
    textFields: ['name', 'description', 'items'],
    metadataFields: ['machineId', 'frequency', 'type']
  },

  checklist_execution: {
    table: 'ChecklistExecution',
    textFields: ['observations', 'issues', 'findings'],
    metadataFields: ['checklistId', 'executorId', 'status', 'machineId']
  },

  // WORKLOGS
  work_log: {
    table: 'WorkLog',
    textFields: ['description', 'notes'],
    metadataFields: ['workOrderId', 'userId', 'type']
  }
}
```

### 5.2 Texto Combinado para Indexar

```typescript
// Ejemplo: cómo se arma el texto para indexar una OT

function buildWorkOrderText(workOrder: WorkOrder): string {
  const parts = []

  // Título y descripción
  parts.push(`Orden de trabajo: ${workOrder.title}`)
  parts.push(`Descripción: ${workOrder.description}`)

  // Máquina y ubicación
  if (workOrder.machine) {
    parts.push(`Máquina: ${workOrder.machine.name}`)
    if (workOrder.machine.sector) {
      parts.push(`Sector: ${workOrder.machine.sector.name}`)
    }
  }

  // Componente
  if (workOrder.component) {
    parts.push(`Componente: ${workOrder.component.name}`)
  }

  // Tipo y prioridad
  parts.push(`Tipo: ${workOrder.type}`)
  parts.push(`Prioridad: ${workOrder.priority}`)

  // Solución (si existe)
  if (workOrder.solution) {
    parts.push(`Solución aplicada: ${workOrder.solution}`)
  }

  // Notas
  if (workOrder.notes) {
    parts.push(`Notas: ${workOrder.notes}`)
  }

  // Síntomas de la falla relacionada
  if (workOrder.failureOccurrence?.symptoms) {
    parts.push(`Síntomas: ${workOrder.failureOccurrence.symptoms}`)
  }

  return parts.join('\n')
}
```

### 5.3 Sincronización de Embeddings

```typescript
// lib/assistant/sync.ts

// Sincronizar embeddings cuando se crea/actualiza una entidad
async function syncEmbedding(entityType: string, entityId: string, companyId: string) {
  const config = INDEXABLE_ENTITIES[entityType]
  if (!config) return

  // Obtener la entidad
  const entity = await prisma[config.table].findUnique({
    where: { id: entityId },
    include: getIncludes(entityType)
  })

  if (!entity) return

  // Construir texto
  const text = buildText(entityType, entity)

  // Generar embedding
  const embedding = await generateEmbedding(text)

  // Guardar o actualizar
  await prisma.assistantEmbedding.upsert({
    where: {
      entityType_entityId: { entityType, entityId }
    },
    create: {
      companyId,
      entityType,
      entityId,
      content: text,
      embedding,
      metadata: buildMetadata(entityType, entity)
    },
    update: {
      content: text,
      embedding,
      metadata: buildMetadata(entityType, entity)
    }
  })
}

// Llamar esto desde los hooks de Prisma o después de crear/actualizar
```

---

## 6. Flujos Principales

### 6.1 Flujo: Buscar Soluciones

```
Usuario: "¿Cómo se resolvió el problema de vibración en la bomba 5?"

1. DETECTAR INTENCIÓN
   → type: 'query'
   → subject: 'solución vibración bomba 5'

2. BUSCAR EN KNOWLEDGE BASE
   → Embedding de la pregunta
   → Búsqueda semántica en AssistantEmbedding
   → Filtrar por companyId
   → Top 5 resultados más similares

3. CONSTRUIR CONTEXTO
   → Resultados encontrados:
     - OT-234: "Vibración en bomba 5, se cambió rodamiento"
     - OT-189: "Bomba 5 vibraba, se ajustó alineación"
     - Falla-45: "Vibración excesiva en bomba hidráulica"

4. GENERAR RESPUESTA
   → LLM recibe: pregunta + contexto + resultados
   → Genera respuesta natural con citas

5. ADAPTAR AL ROL
   → Si es técnico: detalles técnicos
   → Si es gerente: impacto en $$ y tiempo

6. RESPUESTA FINAL
   "Encontré 3 casos similares de vibración en la bomba 5:

   1. OT-234 (hace 2 meses): Se cambió el rodamiento del eje.
      Resultado: Exitoso, no reincidió.

   2. OT-189 (hace 5 meses): Se ajustó la alineación.
      Resultado: Reincidió a los 20 días.

   La solución más efectiva fue el cambio de rodamiento.

   [Ver OT-234] [Ver OT-189]"
```

### 6.2 Flujo: Crear OT por Chat

```
Usuario: "Creá una OT para revisar la bomba 5, prioridad alta"

1. DETECTAR INTENCIÓN
   → type: 'action'
   → action: 'create_work_order'
   → params: { machine: 'bomba 5', priority: 'high' }

2. RESOLVER ENTIDADES
   → Buscar "bomba 5" en máquinas de la empresa
   → Encontrada: Machine { id: 'xxx', name: 'Bomba hidráulica #5' }

3. VALIDAR
   → ¿Usuario tiene permiso? ✓
   → ¿Máquina existe? ✓
   → ¿Faltan campos requeridos? → Falta 'tipo' y 'descripción'

4. PEDIR INFO FALTANTE
   "Para crear la OT necesito:
   - ¿Qué tipo? (Preventivo, Correctivo, Inspección)
   - ¿Descripción del trabajo?"

Usuario: "Preventivo, revisar estado general"

5. GENERAR PREVIEW
   "Voy a crear esta OT:

   Título: Revisión estado general - Bomba hidráulica #5
   Tipo: Preventivo
   Prioridad: Alta
   Máquina: Bomba hidráulica #5
   Descripción: Revisar estado general

   [Confirmar] [Editar] [Cancelar]"

6. EJECUTAR (después de confirmar)
   → Crear WorkOrder en la base de datos
   → Loggear acción

7. RESPUESTA FINAL
   "Listo, creé la OT-456.
   [Ver OT-456]"
```

### 6.3 Flujo: Consultar Preventivos

```
Usuario: "¿Qué preventivos hay pendientes para esta semana?"

1. DETECTAR INTENCIÓN
   → type: 'query'
   → subject: 'preventivos pendientes semana'

2. BUSCAR EN BASE DE DATOS
   → FixedTask WHERE status = 'pending' AND nextDueDate BETWEEN today AND endOfWeek
   → Filtrar por companyId y permisos del usuario

3. GENERAR RESPUESTA
   "Tenés 8 preventivos pendientes esta semana:

   URGENTES (vencidos):
   - Lubricación compresor #2 (venció hace 2 días) → [Ver]

   ESTA SEMANA:
   - Inspección cinta transportadora #1 (mañana) → [Ver]
   - Cambio filtros bomba 5 (miércoles) → [Ver]
   - Revisión tablero eléctrico sector 3 (jueves) → [Ver]
   - Limpieza general línea 2 (viernes) → [Ver]
   ... y 3 más

   [Ver todos] [Filtrar por sector] [Filtrar por máquina]"
```

### 6.4 Flujo: Crear Preventivo por Chat

```
Usuario: "Creá un preventivo mensual para revisar los rodamientos de todas las bombas"

1. DETECTAR INTENCIÓN
   → type: 'action'
   → action: 'create_preventive'
   → params: { frequency: 'monthly', task: 'revisar rodamientos', machines: 'bombas' }

2. RESOLVER ENTIDADES
   → Buscar máquinas tipo "bomba" en la empresa
   → Encontradas: 5 bombas (Bomba 1, 2, 3, 4, 5)

3. VALIDAR
   → ¿Usuario tiene permiso? ✓
   → ¿Máquinas existen? ✓

4. GENERAR PREVIEW
   "Voy a crear 5 tareas preventivas:

   Frecuencia: Mensual
   Tarea: Revisión de rodamientos

   Máquinas:
   - Bomba hidráulica #1
   - Bomba hidráulica #2
   - Bomba hidráulica #3
   - Bomba hidráulica #4
   - Bomba hidráulica #5

   ¿Querés asignarlas a alguien?

   [Crear todas] [Asignar primero] [Editar] [Cancelar]"

Usuario: "Asignalas a Pérez"

5. ACTUALIZAR PREVIEW
   "Voy a crear 5 preventivos mensuales asignados a Juan Pérez:

   [Confirmar] [Editar] [Cancelar]"

6. EJECUTAR
   → Crear 5 FixedTask en la base de datos
   → Loggear acción

7. RESPUESTA FINAL
   "Listo, creé 5 preventivos mensuales para revisión de rodamientos.
   Próxima ejecución: 15/02/2026
   [Ver preventivos creados]"
```

### 6.5 Flujo: Buscar Historial de Preventivos

```
Usuario: "¿Cuándo fue la última vez que se revisó el compresor?"

1. DETECTAR INTENCIÓN
   → type: 'query'
   → subject: 'historial preventivo compresor'

2. RESOLVER ENTIDAD
   → Buscar "compresor" en máquinas
   → Encontrado: Compresor principal #1

3. BUSCAR HISTORIAL
   → FixedTaskExecution WHERE machineId = 'compresor-1' ORDER BY completedAt DESC
   → ChecklistExecution WHERE machineId = 'compresor-1' ORDER BY completedAt DESC

4. GENERAR RESPUESTA
   "El compresor principal fue revisado por última vez hace 12 días:

   Última revisión: 25/01/2026
   - Tipo: Inspección mensual
   - Ejecutó: García
   - Estado: OK, sin observaciones
   - [Ver ejecución]

   Anteriores:
   - 28/12/2025: Cambio de filtros (Pérez) → [Ver]
   - 15/12/2025: Inspección mensual (García) → [Ver]

   Próximo preventivo programado: 25/02/2026 (en 18 días)"
```

### 6.6 Flujo: Detectar Conflictos

```
TRIGGER: Se agenda una parada de mantenimiento

1. DETECTAR EVENTO
   → Nueva OT de tipo 'parada programada' para máquina X

2. BUSCAR CONFLICTOS
   → ¿Hay producción programada que requiere esa máquina?
   → ¿Hay otras OTs que dependen de esa máquina?
   → ¿Hay entregas comprometidas que se afectan?

3. SI HAY CONFLICTO
   → Notificar a los usuarios relevantes
   → Mostrar en el dashboard

   "⚠️ Conflicto detectado:

   Mantenimiento: Parada de Bomba 5 programada para martes 10:00

   Conflictos:
   - Producción tiene pedido urgente de Cliente X que requiere esa bomba
   - OT-432 (limpieza de tanque) depende de que la bomba funcione

   Opciones:
   1. Mover mantenimiento a miércoles
   2. Adelantar producción a lunes
   3. Coordinar con producción

   [Notificar a Producción] [Reprogramar] [Ignorar]"
```

---

## 7. Adaptación por Rol

```typescript
// lib/assistant/role-adapter.ts

const ROLE_ADAPTATIONS = {
  // Técnico: detalles técnicos, procedimientos, repuestos
  technician: {
    includeDetails: ['technical_specs', 'procedures', 'parts', 'tools'],
    excludeDetails: ['costs', 'financial_impact'],
    language: 'technical',
    metrics: ['time_to_fix', 'steps', 'parts_used']
  },

  // Supervisor: balance entre técnico y gestión
  supervisor: {
    includeDetails: ['summary', 'status', 'assignees', 'timeline'],
    excludeDetails: [],
    language: 'balanced',
    metrics: ['completion_rate', 'pending_count', 'overdue']
  },

  // Gerente/Ingeniero: impacto en negocio, costos, KPIs
  manager: {
    includeDetails: ['costs', 'financial_impact', 'kpis', 'trends'],
    excludeDetails: ['detailed_procedures'],
    language: 'business',
    metrics: ['cost', 'downtime_hours', 'production_lost', 'mttr', 'mtbf']
  }
}

function adaptResponse(response: string, userRole: string, data: any): string {
  const adaptation = ROLE_ADAPTATIONS[userRole] || ROLE_ADAPTATIONS.supervisor

  // Agregar métricas relevantes
  if (adaptation.language === 'business' && data.costs) {
    response += `\n\nImpacto: $${data.costs.total} (${data.downtime} horas de parada)`
  }

  if (adaptation.language === 'technical' && data.procedure) {
    response += `\n\nProcedimiento:\n${data.procedure}`
  }

  return response
}
```

---

## 8. Configuración y Costos

### 8.1 Modelos a Usar

```typescript
// lib/assistant/config.ts

const ASSISTANT_CONFIG = {
  // Modelo para transcripción de voz
  voice: {
    model: 'whisper-1',
    provider: 'openai',
    costPer1kTokens: 0.006  // por minuto
  },

  // Modelo para embeddings
  embeddings: {
    model: 'text-embedding-3-small',
    provider: 'openai',
    dimensions: 1536,
    costPer1kTokens: 0.00002
  },

  // Modelo para chat/respuestas
  chat: {
    model: 'gpt-4o-mini',  // Bueno y barato para la mayoría
    provider: 'openai',
    costPer1kTokensInput: 0.00015,
    costPer1kTokensOutput: 0.0006,

    // Para consultas complejas o simulaciones
    complexModel: 'gpt-4o',
    complexCostPer1kTokensInput: 0.005,
    complexCostPer1kTokensOutput: 0.015
  },

  // Límites
  limits: {
    maxTokensPerRequest: 4000,
    maxConversationHistory: 10,  // mensajes
    maxSearchResults: 5,
    requestsPerUserPerDay: 100
  }
}
```

### 8.2 Estimación de Costos

```
Escenario: 50 usuarios activos (supervisores/ingenieros)

Uso estimado por día:
- 100 consultas de chat
- 20 audios transcritos (promedio 1 min cada uno)
- 50 acciones ejecutadas

Costo diario estimado:
- Embeddings (búsqueda): ~$0.50
- Chat (gpt-4o-mini): ~$2.00
- Voz (whisper): ~$0.20
- Total: ~$3/día = ~$90/mes

Con uso intensivo (200 consultas/día):
- ~$180/mes
```

---

## 9. Implementación Gradual

### Fase 1: Base (2-3 semanas)
- [ ] Configurar pgvector
- [ ] Crear tablas nuevas
- [ ] Indexador de embeddings básico
- [ ] API de chat simple
- [ ] UI de chat widget

### Fase 2: Conocimiento (2 semanas)
- [ ] Indexar OTs, Fallas, Soluciones
- [ ] Búsqueda semántica funcionando
- [ ] Respuestas con citas/fuentes

### Fase 3: Acciones (2 semanas)
- [ ] Crear OT por chat
- [ ] Crear Falla por chat
- [ ] Asignar por chat
- [ ] Preview + confirmación

### Fase 4: Voz (1 semana)
- [ ] Integración Whisper
- [ ] Grabación en frontend
- [ ] Flujo completo audio → acción

### Fase 5: Inteligencia (2+ semanas)
- [ ] Detección de conflictos
- [ ] Adaptación por rol
- [ ] Simulador what-if

---

## 10. Próximos Pasos

1. **Revisar y validar** esta arquitectura
2. **Configurar pgvector** en la base de datos
3. **Crear las tablas** nuevas en Prisma
4. **Implementar el indexador** de embeddings
5. **Crear la API básica** de chat
6. **Construir el widget** de chat en el frontend

¿Arrancamos?
