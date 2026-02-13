// ============================================
// Indexador de entidades para búsqueda semántica
// ============================================

import { prisma } from '@/lib/prisma'
import { generateEmbedding, toPostgresVector } from './embeddings'
import { INDEXABLE_ENTITIES, EntityIndexConfig } from './config'
import { IndexableEntityType, IndexableContent } from './types'

// Flag para saber si pgvector está disponible
let pgvectorAvailable: boolean | null = null

/**
 * Verifica si pgvector está instalado
 */
async function checkPgvector(): Promise<boolean> {
  if (pgvectorAvailable !== null) {
    return pgvectorAvailable
  }

  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`)
    await prisma.$queryRawUnsafe(`SELECT embedding FROM assistant_embeddings LIMIT 0`)
    pgvectorAvailable = true
    console.log('[Indexer] pgvector is available')
  } catch (error) {
    pgvectorAvailable = false
    console.log('[Indexer] pgvector not available, indexing without embeddings')
  }

  return pgvectorAvailable
}

/**
 * Indexa una entidad individual (versión rápida sin embeddings para uso automático)
 */
export async function indexEntityQuick(
  entityType: IndexableEntityType,
  entityId: number,
  companyId: number
): Promise<void> {
  const config = INDEXABLE_ENTITIES[entityType]
  if (!config) {
    console.warn(`[Indexer] Unknown entity type: ${entityType}`)
    return
  }

  try {
    // Obtener la entidad de la base de datos
    const entity = await fetchEntity(config.table, entityId, config.includes)
    if (!entity) {
      console.warn(`[Indexer] Entity not found: ${entityType}/${entityId}`)
      return
    }

    // Construir el texto a indexar
    const content = buildIndexableText(entityType, entity, config)

    // Construir metadata
    const metadata = buildMetadata(entity, config.metadataFields)

    // Guardar sin embedding (para búsqueda por texto)
    await upsertEmbeddingWithoutVector({
      entityType,
      entityId,
      companyId,
      content,
      metadata,
    })

    console.log(`[Indexer] Quick indexed: ${entityType}/${entityId}`)
  } catch (error) {
    console.error(`[Indexer] Error quick indexing ${entityType}/${entityId}:`, error)
  }
}

/**
 * Indexa una entidad individual (con embedding si pgvector disponible)
 */
export async function indexEntity(
  entityType: IndexableEntityType,
  entityId: number,
  companyId: number
): Promise<void> {
  const config = INDEXABLE_ENTITIES[entityType]
  if (!config) {
    throw new Error(`Unknown entity type: ${entityType}`)
  }

  // Obtener la entidad de la base de datos
  const entity = await fetchEntity(config.table, entityId, config.includes)
  if (!entity) {
    console.warn(`Entity not found: ${entityType}/${entityId}`)
    return
  }

  // Construir el texto a indexar
  const content = buildIndexableText(entityType, entity, config)

  // Construir metadata
  const metadata = buildMetadata(entity, config.metadataFields)

  // Verificar si pgvector está disponible
  const usePgvector = await checkPgvector()

  if (usePgvector) {
    try {
      // Generar embedding
      const embedding = await generateEmbedding(content)

      // Guardar con embedding
      await upsertEmbedding({
        entityType,
        entityId,
        companyId,
        content,
        metadata,
        embedding,
      })
      console.log(`[Indexer] Indexed with embedding: ${entityType}/${entityId}`)
      return
    } catch (error) {
      console.error(`[Indexer] Error generating embedding, saving without:`, error)
    }
  }

  // Fallback: guardar sin embedding
  await upsertEmbeddingWithoutVector({
    entityType,
    entityId,
    companyId,
    content,
    metadata,
  })
  console.log(`[Indexer] Indexed without embedding: ${entityType}/${entityId}`)
}

/**
 * Indexa todas las entidades de un tipo para una empresa
 */
export async function indexAllEntitiesOfType(
  entityType: IndexableEntityType,
  companyId: number,
  options?: {
    batchSize?: number
    onProgress?: (processed: number, total: number) => void
  }
): Promise<{ processed: number; errors: number }> {
  const config = INDEXABLE_ENTITIES[entityType]
  if (!config) {
    throw new Error(`Unknown entity type: ${entityType}`)
  }

  const batchSize = options?.batchSize ?? 50
  let processed = 0
  let errors = 0

  // Obtener total de entidades
  const total = await countEntities(config.table, companyId)

  // Procesar en batches
  let skip = 0
  while (skip < total) {
    const entities = await fetchEntitiesBatch(config.table, companyId, skip, batchSize, config.includes)

    for (const entity of entities) {
      try {
        const content = buildIndexableText(entityType, entity, config)
        const metadata = buildMetadata(entity, config.metadataFields)
        const embedding = await generateEmbedding(content)

        await upsertEmbedding({
          entityType,
          entityId: entity.id,
          companyId,
          content,
          metadata,
          embedding,
        })

        processed++
      } catch (error) {
        console.error(`Error indexing ${entityType}/${entity.id}:`, error)
        errors++
      }

      options?.onProgress?.(processed + errors, total)
    }

    skip += batchSize

    // Rate limiting para no sobrecargar OpenAI
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { processed, errors }
}

/**
 * Re-indexa una entidad después de una actualización
 */
export async function reindexEntity(
  entityType: IndexableEntityType,
  entityId: number,
  companyId: number
): Promise<void> {
  // Simplemente volver a indexar
  await indexEntity(entityType, entityId, companyId)
}

/**
 * Elimina el embedding de una entidad
 */
export async function deleteEntityEmbedding(
  entityType: IndexableEntityType,
  entityId: number
): Promise<void> {
  await prisma.assistantEmbedding.deleteMany({
    where: {
      entityType,
      entityId,
    },
  })
}

// ============================================
// Funciones auxiliares
// ============================================

/**
 * Construye el texto indexable para una entidad
 */
function buildIndexableText(
  entityType: IndexableEntityType,
  entity: Record<string, any>,
  config: EntityIndexConfig
): string {
  const parts: string[] = []

  // Agregar campos de texto principales
  for (const field of config.textFields) {
    const value = getNestedValue(entity, field)
    if (value && typeof value === 'string' && value.trim()) {
      parts.push(value.trim())
    }
  }

  // Agregar información de relaciones
  if (entity.machine?.name) {
    parts.push(`Máquina: ${entity.machine.name}`)
  }
  if (entity.machine?.sector?.name) {
    parts.push(`Sector: ${entity.machine.sector.name}`)
  }
  if (entity.component?.name) {
    parts.push(`Componente: ${entity.component.name}`)
  }
  if (entity.sector?.name && !entity.machine?.sector) {
    parts.push(`Sector: ${entity.sector.name}`)
  }
  if (entity.assignedTo?.name) {
    parts.push(`Asignado a: ${entity.assignedTo.name}`)
  }
  if (entity.executor?.name) {
    parts.push(`Ejecutado por: ${entity.executor.name}`)
  }

  // Agregar campos específicos por tipo de entidad
  switch (entityType) {
    case 'work_order':
      if (entity.type) parts.push(`Tipo: ${entity.type}`)
      if (entity.priority) parts.push(`Prioridad: ${entity.priority}`)
      if (entity.status) parts.push(`Estado: ${entity.status}`)
      break

    case 'failure_occurrence':
      if (entity.severity) parts.push(`Severidad: ${entity.severity}`)
      if (entity.status) parts.push(`Estado: ${entity.status}`)
      break

    case 'fixed_task':
      if (entity.frequency) parts.push(`Frecuencia: ${entity.frequency}`)
      if (entity.type) parts.push(`Tipo: ${entity.type}`)
      break

    case 'machine':
      if (entity.model) parts.push(`Modelo: ${entity.model}`)
      if (entity.serialNumber) parts.push(`Serie: ${entity.serialNumber}`)
      if (entity.criticality) parts.push(`Criticidad: ${entity.criticality}`)
      break
  }

  return parts.join('\n')
}

/**
 * Construye la metadata para filtros
 */
function buildMetadata(
  entity: Record<string, any>,
  metadataFields: string[]
): Record<string, any> {
  const metadata: Record<string, any> = {}

  for (const field of metadataFields) {
    const value = entity[field]
    if (value !== undefined && value !== null) {
      metadata[field] = value
    }
  }

  // Agregar fecha si existe
  if (entity.createdAt) {
    metadata.createdAt = entity.createdAt
  }
  if (entity.completedAt) {
    metadata.completedAt = entity.completedAt
  }

  return metadata
}

/**
 * Obtiene un valor anidado de un objeto
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Obtiene una entidad de la base de datos
 */
async function fetchEntity(
  table: string,
  id: number,
  includes?: Record<string, any>
): Promise<Record<string, any> | null> {
  const model = (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)]
  if (!model) {
    throw new Error(`Unknown table: ${table}`)
  }

  return model.findUnique({
    where: { id },
    include: includes,
  })
}

/**
 * Obtiene un batch de entidades
 */
async function fetchEntitiesBatch(
  table: string,
  companyId: number,
  skip: number,
  take: number,
  includes?: Record<string, any>
): Promise<Record<string, any>[]> {
  const model = (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)]
  if (!model) {
    throw new Error(`Unknown table: ${table}`)
  }

  return model.findMany({
    where: { companyId },
    skip,
    take,
    include: includes,
  })
}

/**
 * Cuenta entidades de una tabla
 */
async function countEntities(table: string, companyId: number): Promise<number> {
  const model = (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)]
  if (!model) {
    throw new Error(`Unknown table: ${table}`)
  }

  return model.count({
    where: { companyId },
  })
}

/**
 * Inserta o actualiza un embedding (con vector)
 */
async function upsertEmbedding(params: {
  entityType: IndexableEntityType
  entityId: number
  companyId: number
  content: string
  metadata: Record<string, any>
  embedding: number[]
}): Promise<void> {
  const { entityType, entityId, companyId, content, metadata, embedding } = params

  // Primero, upsert sin el embedding (Prisma no soporta vector directamente)
  const record = await prisma.assistantEmbedding.upsert({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
    create: {
      companyId,
      entityType,
      entityId,
      content,
      metadata,
    },
    update: {
      content,
      metadata,
      updatedAt: new Date(),
    },
  })

  // Luego, actualizar el embedding con raw SQL
  const vectorString = toPostgresVector(embedding)
  await prisma.$executeRawUnsafe(
    `UPDATE assistant_embeddings SET embedding = $1::vector WHERE id = $2`,
    vectorString,
    record.id
  )
}

/**
 * Inserta o actualiza sin vector (para fallback de texto)
 */
async function upsertEmbeddingWithoutVector(params: {
  entityType: IndexableEntityType
  entityId: number
  companyId: number
  content: string
  metadata: Record<string, any>
}): Promise<void> {
  const { entityType, entityId, companyId, content, metadata } = params

  await prisma.assistantEmbedding.upsert({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
    create: {
      companyId,
      entityType,
      entityId,
      content,
      metadata,
    },
    update: {
      content,
      metadata,
      updatedAt: new Date(),
    },
  })
}
