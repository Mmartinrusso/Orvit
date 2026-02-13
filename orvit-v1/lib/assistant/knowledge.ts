// ============================================
// Base de conocimiento - Búsqueda semántica
// ============================================

import { prisma } from '@/lib/prisma'
import { generateEmbedding, toPostgresVector } from './embeddings'
import { INDEXABLE_ENTITIES } from './config'
import { IndexableEntityType, KnowledgeSearchResult, AssistantContext } from './types'

// Flag para saber si pgvector está disponible
let pgvectorAvailable: boolean | null = null

interface SearchOptions {
  limit?: number
  entityTypes?: IndexableEntityType[]
  machineId?: number
  sectorId?: number
  dateFrom?: Date
  dateTo?: Date
  minSimilarity?: number
}

/**
 * Verifica si pgvector está instalado
 */
async function checkPgvector(): Promise<boolean> {
  if (pgvectorAvailable !== null) {
    return pgvectorAvailable
  }

  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`)
    // También verificar que la columna embedding existe
    await prisma.$queryRawUnsafe(`SELECT embedding FROM assistant_embeddings LIMIT 0`)
    pgvectorAvailable = true
    console.log('[Knowledge] pgvector is available')
  } catch (error) {
    pgvectorAvailable = false
    console.log('[Knowledge] pgvector not available, using text search fallback')
  }

  return pgvectorAvailable
}

/**
 * Busca en la base de conocimiento usando similitud semántica o texto
 */
export async function searchKnowledge(
  query: string,
  context: AssistantContext,
  options: SearchOptions = {}
): Promise<KnowledgeSearchResult[]> {
  const {
    limit = 5,
    entityTypes,
    machineId,
    sectorId,
  } = options

  // Verificar si pgvector está disponible
  const usePgvector = await checkPgvector()

  if (usePgvector) {
    try {
      const pgResults = await searchWithPgvector(query, context, options)
      // Si pgvector encontró resultados, devolverlos
      if (pgResults.length > 0) {
        return pgResults
      }
      // Si no encontró nada (puede ser porque los datos no tienen embeddings),
      // hacer fallback a búsqueda por texto
      console.log('[Knowledge] pgvector returned no results, falling back to text search')
    } catch (error) {
      console.error('[Knowledge] pgvector search failed, falling back to text:', error)
    }
  }

  // Fallback: búsqueda por texto
  return await searchWithText(query, context, options)
}

/**
 * Búsqueda semántica con pgvector
 */
async function searchWithPgvector(
  query: string,
  context: AssistantContext,
  options: SearchOptions
): Promise<KnowledgeSearchResult[]> {
  const {
    limit = 5,
    entityTypes,
    machineId,
    sectorId,
    minSimilarity = 0.5,
  } = options

  // Generar embedding de la consulta
  const queryEmbedding = await generateEmbedding(query)
  const vectorString = toPostgresVector(queryEmbedding)

  // Construir filtro de tipo de entidad
  let entityTypeFilter = ''
  if (entityTypes && entityTypes.length > 0) {
    const types = entityTypes.map(t => `'${t}'`).join(',')
    entityTypeFilter = `AND ae."entityType" IN (${types})`
  }

  // Ejecutar búsqueda con pgvector
  const results = await prisma.$queryRawUnsafe<
    {
      id: number
      entityType: string
      entityId: number
      content: string
      metadata: any
      similarity: number
    }[]
  >(`
    SELECT
      ae.id,
      ae."entityType",
      ae."entityId",
      ae.content,
      ae.metadata,
      1 - (ae.embedding <=> $1::vector) AS similarity
    FROM assistant_embeddings ae
    WHERE ae."companyId" = $2
      AND ae.embedding IS NOT NULL
      ${entityTypeFilter}
    ORDER BY ae.embedding <=> $1::vector
    LIMIT $3
  `, vectorString, context.companyId, limit * 2)

  // Filtrar por similitud mínima y aplicar otros filtros
  let filteredResults = results.filter(r => r.similarity >= minSimilarity)

  // Aplicar filtros de metadata si existen
  if (machineId) {
    filteredResults = filteredResults.filter(r =>
      r.metadata?.machineId === machineId
    )
  }
  if (sectorId) {
    filteredResults = filteredResults.filter(r =>
      r.metadata?.sectorId === sectorId
    )
  }

  // Limitar resultados
  filteredResults = filteredResults.slice(0, limit)

  // Enriquecer resultados con datos actuales
  const enrichedResults = await Promise.all(
    filteredResults.map(r => enrichSearchResult(r))
  )

  return enrichedResults
}

/**
 * Normaliza texto para búsqueda (quita tildes, lowercase)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[¿?¡!.,;:()]/g, '') // Quitar puntuación
}

// Stop words comunes en español
const STOP_WORDS = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por', 'para', 'que', 'como', 'se', 'su', 'es', 'al', 'lo', 'le', 'me', 'te', 'nos', 'y', 'o', 'a', 'hay', 'cuantas', 'cuantos', 'todas', 'todos', 'mostrar', 'mostrame', 'ver', 'listar', 'tenemos', 'tiene', 'tienen', 'dame', 'dime', 'cual', 'cuales', 'esta', 'esto', 'ese', 'esa', 'esos', 'esas']

// Palabras de entidades que se filtran de los keywords
const ENTITY_WORDS = ['falla', 'fallas', 'orden', 'ordenes', 'ordenes', 'maquina', 'maquinas', 'componente', 'componentes', 'preventivo', 'preventivos', 'checklist', 'checklists', 'ot', 'ots', 'equipo', 'equipos', 'sistema', 'todo']

/**
 * Sinónimos comunes en mantenimiento industrial
 * Incluye variaciones comunes, errores de tipeo y términos relacionados
 */
const SYNONYMS: Record<string, string[]> = {
  // Problemas / Fallas
  'falla': ['fallo', 'faya', 'faia', 'averia', 'problema', 'defecto', 'desperfecto', 'error', 'incidente'],
  'rotura': ['roto', 'quebrado', 'partido', 'fractura', 'rompimiento', 'ruptura'],
  'desgaste': ['gastado', 'desgastado', 'erosion', 'erosionado', 'usado'],
  'vibracion': ['vibra', 'vibrando', 'temblor', 'oscilacion', 'trepidacion'],
  'ruido': ['sonido', 'ruidoso', 'chirrido', 'golpeteo', 'zumbido', 'crujido'],
  'fuga': ['perdida', 'goteo', 'derrame', 'filtracion', 'escape', 'gotera'],
  'caliente': ['calentamiento', 'sobrecalentamiento', 'recalentado', 'temperatura', 'calor'],
  'atascado': ['trabado', 'trancado', 'bloqueado', 'atorado'],
  'lento': ['despacio', 'lentitud', 'demora'],
  'parado': ['detenido', 'parada', 'stop', 'no arranca', 'no enciende'],

  // Componentes - con errores de tipeo comunes
  'motor': ['motores', 'moto', 'motr'],
  'bomba': ['bombas', 'bomva', 'vonba', 'pompa'],
  'valvula': ['valvulas', 'valv', 'valbula', 'balvula'],
  'rodamiento': ['rodamientos', 'ruleman', 'ruliman', 'cojinete', 'balero', 'bearing'],
  'correa': ['correas', 'banda', 'faja', 'cinta'],
  'filtro': ['filtros', 'filtrante'],
  'aceite': ['lubricante', 'lubricacion', 'lubrificante', 'oil'],
  'electrico': ['electrica', 'electricidad', 'electrical', 'elec', 'elect'],
  'hidraulico': ['hidraulica', 'hidraulicos', 'hidr', 'hydraulico'],
  'neumatico': ['neumatica', 'neumaticos', 'aire', 'neum', 'pneumatico'],
  'mecanico': ['mecanica', 'mecanicos', 'mec'],
  'sensor': ['sensores', 'detector', 'medidor'],
  'plc': ['controlador', 'automata', 'programable'],
  'panel': ['tablero', 'cuadro', 'gabinete'],
  'compresor': ['compresora', 'compressor'],
  'transformador': ['trafo', 'transf'],
  'engranaje': ['engrane', 'piñon', 'gear'],
  'eje': ['flecha', 'shaft'],
  'sello': ['sellos', 'reten', 'empaque', 'junta', 'seal'],
  'bobina': ['bobinado', 'coil'],

  // Acciones
  'cambiar': ['cambio', 'reemplazar', 'reemplazo', 'sustituir', 'camviar'],
  'reparar': ['reparacion', 'arreglar', 'arreglo', 'fix', 'componer'],
  'revisar': ['revision', 'inspeccionar', 'inspeccion', 'verificar', 'chequear', 'checar'],
  'limpiar': ['limpieza', 'limpeza', 'asear'],
  'ajustar': ['ajuste', 'calibrar', 'calibracion', 'regular', 'alinear'],
  'lubricar': ['engrasar', 'aceitear', 'lubrificacion'],
  'apretar': ['torquear', 'ajustar', 'tensar'],

  // Estados
  'pendiente': ['pendientes', 'por hacer', 'sin hacer'],
  'completado': ['terminado', 'finalizado', 'hecho', 'completada'],
  'urgente': ['urgencia', 'critico', 'importante', 'prioritario'],
}

/**
 * Calcula distancia de Levenshtein simplificada (solo para palabras cortas)
 */
function isSimilarWord(word1: string, word2: string, maxDistance = 2): boolean {
  if (Math.abs(word1.length - word2.length) > maxDistance) return false
  if (word1 === word2) return true

  // Si son muy cortas, requieren match exacto
  if (word1.length < 4 || word2.length < 4) return word1 === word2

  // Comprobar si comparten el prefijo (para errores de tipeo al final)
  const prefixLen = Math.min(3, Math.floor(word1.length * 0.6))
  if (word1.substring(0, prefixLen) === word2.substring(0, prefixLen)) return true

  return false
}

/**
 * Expande keywords con sinónimos y búsqueda fuzzy
 */
function expandWithSynonyms(keywords: string[]): string[] {
  const expanded = new Set<string>(keywords)

  for (const keyword of keywords) {
    // Buscar si el keyword es un sinónimo de algo (exacto)
    for (const [main, synonyms] of Object.entries(SYNONYMS)) {
      if (keyword === main || synonyms.includes(keyword)) {
        expanded.add(main)
        synonyms.forEach(s => expanded.add(s))
      }
    }

    // Búsqueda fuzzy - si el keyword es similar a algún término conocido
    for (const [main, synonyms] of Object.entries(SYNONYMS)) {
      if (isSimilarWord(keyword, main)) {
        expanded.add(main)
        synonyms.forEach(s => expanded.add(s))
      }
      for (const syn of synonyms) {
        if (isSimilarWord(keyword, syn)) {
          expanded.add(main)
          synonyms.forEach(s => expanded.add(s))
          break
        }
      }
    }

    // Agregar versión corta para búsqueda parcial (mínimo 4 chars)
    if (keyword.length >= 5) {
      expanded.add(keyword.substring(0, 4))
    }
  }

  console.log('[Knowledge] Expanded keywords:', Array.from(expanded))
  return Array.from(expanded)
}

/**
 * Búsqueda por texto (fallback sin pgvector)
 */
async function searchWithText(
  query: string,
  context: AssistantContext,
  options: SearchOptions
): Promise<KnowledgeSearchResult[]> {
  const {
    limit = 5,
    entityTypes,
    machineId,
    sectorId,
  } = options

  console.log('[Knowledge] Searching with text:', query, 'entityTypes:', entityTypes)

  // Normalizar y extraer keywords (usando constantes del módulo)
  const normalizedQuery = normalizeText(query)
  let keywords = normalizedQuery
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.includes(word) && !ENTITY_WORDS.includes(word))

  // Expandir con sinónimos para mejor cobertura
  keywords = expandWithSynonyms(keywords)

  console.log('[Knowledge] Extracted keywords:', keywords)

  // Construir condiciones de búsqueda base
  const whereConditions: any = {
    companyId: context.companyId,
  }

  if (entityTypes && entityTypes.length > 0) {
    whereConditions.entityType = { in: entityTypes }
  }

  let results: any[] = []

  // Si hay tipos de entidad específicos pero pocas palabras clave útiles,
  // buscar todas las entidades de ese tipo
  if (entityTypes && entityTypes.length > 0 && keywords.length === 0) {
    console.log('[Knowledge] Searching all entities of types:', entityTypes)
    results = await prisma.assistantEmbedding.findMany({
      where: whereConditions,
      take: limit * 2,
      orderBy: {
        updatedAt: 'desc',
      },
    })
  } else if (keywords.length > 0) {
    // Buscar por palabras clave en el contenido
    results = await prisma.assistantEmbedding.findMany({
      where: {
        ...whereConditions,
        OR: keywords.map(keyword => ({
          content: {
            contains: keyword,
            mode: 'insensitive' as const,
          },
        })),
      },
      take: limit * 2,
      orderBy: {
        updatedAt: 'desc',
      },
    })

    // Si no encontramos nada con keywords pero tenemos tipos de entidad, buscar por tipo
    if (results.length === 0 && entityTypes && entityTypes.length > 0) {
      console.log('[Knowledge] No keyword matches, falling back to entity type search')
      results = await prisma.assistantEmbedding.findMany({
        where: whereConditions,
        take: limit * 2,
        orderBy: {
          updatedAt: 'desc',
        },
      })
    }
  } else {
    // Sin keywords ni tipos de entidad, devolver vacío
    return []
  }

  console.log('[Knowledge] Found', results.length, 'results')

  // Calcular relevancia basada en cantidad de keywords encontrados
  // Usamos keywords originales (sin expandir) para calcular, pero la búsqueda usa expandidos
  const originalKeywordsCount = normalizedQuery
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.includes(word) && !ENTITY_WORDS.includes(word))
    .length

  const scoredResults = results.map(r => {
    // Normalizar contenido para comparación (quitar tildes)
    const contentNormalized = normalizeText(r.content)

    // Si no hay keywords, dar relevancia basada en recencia
    // Contar cuántos keywords (incluyendo sinónimos) matchean
    const matchCount = keywords.length > 0
      ? keywords.filter(k => contentNormalized.includes(k)).length
      : 1

    // Calcular similarity basado en keywords originales para no inflar por sinónimos
    const similarity = originalKeywordsCount > 0
      ? Math.min(matchCount / originalKeywordsCount, 1) // Cap at 1
      : 0.8 // Alta relevancia si buscamos por tipo de entidad sin keywords

    return {
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      content: r.content,
      metadata: r.metadata,
      similarity,
    }
  })

  // Ordenar por relevancia y filtrar (umbral más bajo porque ahora es más flexible)
  const minSimilarity = originalKeywordsCount > 0 ? 0.2 : 0.5
  let filteredResults = scoredResults
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)

  // Aplicar filtros de metadata
  if (machineId) {
    filteredResults = filteredResults.filter(r =>
      (r.metadata as any)?.machineId === machineId
    )
  }
  if (sectorId) {
    filteredResults = filteredResults.filter(r =>
      (r.metadata as any)?.sectorId === sectorId
    )
  }

  // Limitar resultados
  filteredResults = filteredResults.slice(0, limit)

  console.log('[Knowledge] After filtering:', filteredResults.length, 'results')
  console.log('[Knowledge] First result:', filteredResults[0]?.entityType, filteredResults[0]?.entityId)

  // Enriquecer resultados
  try {
    const enrichedResults = await Promise.all(
      filteredResults.map(r => enrichSearchResult({
        ...r,
        entityType: r.entityType as IndexableEntityType,
      }))
    )
    console.log('[Knowledge] After enrichment:', enrichedResults.length, 'results')
    return enrichedResults
  } catch (enrichError) {
    console.error('[Knowledge] Error enriching results:', enrichError)
    // Devolver resultados sin enriquecer si falla
    return filteredResults.map(r => ({
      ...r,
      entityType: r.entityType as IndexableEntityType,
    }))
  }
}

/**
 * Busca entidades por texto exacto (para acciones)
 */
export async function searchByText(
  text: string,
  entityType: IndexableEntityType,
  companyId: number,
  limit = 5
): Promise<KnowledgeSearchResult[]> {
  const config = INDEXABLE_ENTITIES[entityType]
  if (!config) {
    throw new Error(`Unknown entity type: ${entityType}`)
  }

  // Buscar en la tabla de embeddings por contenido
  const results = await prisma.assistantEmbedding.findMany({
    where: {
      companyId,
      entityType,
      content: {
        contains: text,
        mode: 'insensitive',
      },
    },
    take: limit,
  })

  // Enriquecer resultados
  const enrichedResults = await Promise.all(
    results.map(r => enrichSearchResult({
      id: r.id,
      entityType: r.entityType as IndexableEntityType,
      entityId: r.entityId,
      content: r.content,
      metadata: r.metadata,
      similarity: 1, // Exact match
    }))
  )

  return enrichedResults
}

/**
 * Obtiene el contexto de una entidad específica
 */
export async function getEntityContext(
  entityType: IndexableEntityType,
  entityId: number,
  companyId: number
): Promise<KnowledgeSearchResult | null> {
  const embedding = await prisma.assistantEmbedding.findUnique({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
  })

  if (!embedding || embedding.companyId !== companyId) {
    return null
  }

  return enrichSearchResult({
    id: embedding.id,
    entityType: embedding.entityType as IndexableEntityType,
    entityId: embedding.entityId,
    content: embedding.content,
    metadata: embedding.metadata,
    similarity: 1,
  })
}

/**
 * Busca entidades relacionadas (mismo componente, misma máquina, etc.)
 */
export async function searchRelated(
  entityType: IndexableEntityType,
  entityId: number,
  companyId: number,
  limit = 5
): Promise<KnowledgeSearchResult[]> {
  // Primero obtener la entidad original
  const originalEmbedding = await prisma.assistantEmbedding.findUnique({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
  })

  if (!originalEmbedding) {
    return []
  }

  // Buscar por misma máquina o componente
  const machineId = (originalEmbedding.metadata as any)?.machineId
  const componentId = (originalEmbedding.metadata as any)?.componentId

  if (!machineId && !componentId) {
    return []
  }

  const results = await prisma.assistantEmbedding.findMany({
    where: {
      companyId,
      NOT: {
        entityType_entityId: {
          entityType,
          entityId,
        },
      },
      OR: [
        machineId ? { metadata: { path: ['machineId'], equals: machineId } } : {},
        componentId ? { metadata: { path: ['componentId'], equals: componentId } } : {},
      ].filter(f => Object.keys(f).length > 0),
    },
    take: limit,
    orderBy: {
      updatedAt: 'desc',
    },
  })

  const enrichedResults = await Promise.all(
    results.map(r => enrichSearchResult({
      id: r.id,
      entityType: r.entityType as IndexableEntityType,
      entityId: r.entityId,
      content: r.content,
      metadata: r.metadata,
      similarity: 0.8, // Related but not semantic match
    }))
  )

  return enrichedResults
}

// ============================================
// Funciones auxiliares
// ============================================

/**
 * Enriquece un resultado de búsqueda con datos actualizados
 */
async function enrichSearchResult(result: {
  id: number
  entityType: string
  entityId: number
  content: string
  metadata: any
  similarity: number
}): Promise<KnowledgeSearchResult> {
  const config = INDEXABLE_ENTITIES[result.entityType as IndexableEntityType]
  if (!config) {
    return {
      ...result,
      entityType: result.entityType as IndexableEntityType,
    }
  }

  // Obtener datos actualizados de la entidad
  const entity = await fetchEntityData(config.table, result.entityId, result.entityType as IndexableEntityType)

  // Construir URL
  let url = config.urlPattern.replace('{id}', String(result.entityId))
  if (result.metadata?.workOrderId) {
    url = url.replace('{workOrderId}', String(result.metadata.workOrderId))
  }
  if (result.metadata?.machineId) {
    url = url.replace('{machineId}', String(result.metadata.machineId))
  }

  // Construir ubicación jerárquica: Máquina → Componente → Subcomponente
  let locationParts: string[] = []
  if (entity?.machine?.name) {
    locationParts.push(entity.machine.name)
  }
  if (entity?.component?.name) {
    locationParts.push(entity.component.name)
  }
  if (entity?.subcomponent?.name) {
    locationParts.push(entity.subcomponent.name)
  }
  const location = locationParts.length > 0 ? locationParts.join(' → ') : undefined

  return {
    id: result.id,
    entityType: result.entityType as IndexableEntityType,
    entityId: result.entityId,
    content: result.content,
    metadata: result.metadata,
    similarity: result.similarity,
    enrichedData: {
      title: entity?.title || entity?.name || entity?.description?.substring(0, 50) || `${result.entityType}/${result.entityId}`,
      url,
      status: entity?.status,
      date: entity?.createdAt || entity?.completedAt,
      machine: entity?.machine?.name,
      component: entity?.component?.name,
      subcomponent: entity?.subcomponent?.name,
      location, // Jerarquía completa
      sector: entity?.sector?.name || entity?.machine?.sector?.name,
    },
  }
}

/**
 * Obtiene datos básicos de una entidad
 */
async function fetchEntityData(
  table: string,
  id: number,
  entityType?: IndexableEntityType
): Promise<Record<string, any> | null> {
  const modelName = table.charAt(0).toLowerCase() + table.slice(1)
  const model = (prisma as any)[modelName]

  if (!model) {
    return null
  }

  try {
    // Incluir relaciones según el tipo de entidad
    let include: any = {
      machine: {
        select: {
          name: true,
          sector: { select: { name: true } },
        },
      },
      sector: { select: { name: true } },
    }

    // Para fallas, incluir componente (vía subcomponentId que apunta a Component)
    if (entityType === 'failure_occurrence') {
      const failureData = await model.findUnique({
        where: { id },
        include: {
          machine: {
            select: {
              name: true,
              sector: { select: { name: true } },
            },
          },
        },
      })

      // Si hay subcomponentId, buscar el componente
      if (failureData?.subcomponentId) {
        const subcomponent = await (prisma as any).component.findUnique({
          where: { id: failureData.subcomponentId },
          include: {
            parent: { select: { name: true } }, // Componente padre
            machine: { select: { name: true } },
          },
        })
        return {
          ...failureData,
          subcomponent: subcomponent,
          component: subcomponent?.parent, // El padre es el componente
        }
      }

      return failureData
    }

    // Para OTs, incluir componente
    if (entityType === 'work_order') {
      return await model.findUnique({
        where: { id },
        include: {
          machine: {
            select: {
              name: true,
              sector: { select: { name: true } },
            },
          },
          component: {
            select: {
              name: true,
              parent: { select: { name: true } },
            },
          },
        },
      })
    }

    return await model.findUnique({
      where: { id },
      include,
    })
  } catch {
    // Si falla el include, intentar sin él
    return model.findUnique({ where: { id } })
  }
}

/**
 * Formatea resultados de búsqueda para mostrar al LLM
 */
export function formatSearchResultsForLLM(
  results: KnowledgeSearchResult[]
): string {
  if (results.length === 0) {
    return 'No se encontraron resultados relevantes en el sistema.'
  }

  const formatted = results.map((r, i) => {
    const parts = [
      `[${i + 1}] ${r.enrichedData?.title || r.entityType}`,
      `   Tipo: ${formatEntityType(r.entityType)}`,
    ]

    // Mostrar ubicación jerárquica si existe (Máquina → Componente → Subcomponente)
    if (r.enrichedData?.location) {
      parts.push(`   Ubicación: ${r.enrichedData.location}`)
    } else if (r.enrichedData?.machine) {
      // Fallback a solo máquina si no hay ubicación completa
      parts.push(`   Máquina: ${r.enrichedData.machine}`)
    }

    if (r.enrichedData?.sector) {
      parts.push(`   Sector: ${r.enrichedData.sector}`)
    }
    if (r.enrichedData?.status) {
      parts.push(`   Estado: ${r.enrichedData.status}`)
    }
    if (r.enrichedData?.date) {
      parts.push(`   Fecha: ${new Date(r.enrichedData.date).toLocaleDateString('es-AR')}`)
    }

    parts.push(`   Contenido: ${r.content.substring(0, 200)}${r.content.length > 200 ? '...' : ''}`)
    parts.push(`   Relevancia: ${Math.round(r.similarity * 100)}%`)
    parts.push(`   [Ver: ${r.enrichedData?.url || '#'}]`)

    return parts.join('\n')
  })

  return formatted.join('\n\n')
}

/**
 * Formatea el tipo de entidad para mostrar
 */
function formatEntityType(type: IndexableEntityType): string {
  const labels: Record<IndexableEntityType, string> = {
    work_order: 'Orden de Trabajo',
    failure_occurrence: 'Falla',
    failure_solution: 'Solución',
    fixed_task: 'Tarea Preventiva',
    fixed_task_execution: 'Ejecución de Preventivo',
    maintenance_checklist: 'Checklist',
    machine: 'Máquina',
    component: 'Componente',
  }
  return labels[type] || type
}

// ============================================
// Detección de Máquina y Contexto Profundo
// ============================================

/**
 * Resultado de detección de máquina en el texto
 */
export interface MachineDetectionResult {
  detected: boolean
  machineId?: number
  machineName?: string
  matchedText?: string
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Falla activa de una máquina
 */
export interface ActiveFailure {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  failureCategory: string | null
  createdAt: Date
  machine: { name: string } | null
  componentName?: string
  subcomponentName?: string
}

/**
 * Contexto profundo de una máquina
 */
export interface DeepMachineContext {
  machine: {
    id: number
    name: string
    nickname: string | null
    description: string | null
    brand: string | null
    model: string | null
    serialNumber: string | null
    type: string | null
    status: string
    sector: { name: string } | null
    area: { name: string } | null
  }
  components: Array<{
    id: number
    name: string
    description: string | null
    type: string | null
    system: string | null
    subcomponents: Array<{
      id: number
      name: string
      description: string | null
    }>
  }>
  activeFailures: ActiveFailure[]
  recentFailures: Array<{
    id: number
    title: string
    status: string
    createdAt: Date
    solution?: {
      title: string
      description: string
      rootCause: string | null
    }
  }>
  relatedWorkOrders: Array<{
    id: number
    title: string
    status: string
    priority: string
    createdAt: Date
    solution: string | null
  }>
  relatedSolutions: Array<{
    id: number
    title: string
    description: string
    rootCause: string | null
    preventiveActions: string | null
    effectiveness: number | null
  }>
  preventiveTasks: Array<{
    id: number
    title: string
    frequency: string
    lastExecution?: Date
    nextDue?: Date
  }>
}

/**
 * Detecta si un mensaje menciona una máquina específica
 * Busca nombres de máquinas, nicknames y patrones comunes
 */
export async function detectMachineMention(
  message: string,
  companyId: number
): Promise<MachineDetectionResult> {
  const msgLower = normalizeText(message)

  // Patrones que indican intención de referirse a una máquina
  const machinePatterns = [
    /(?:falla|problema|averia|error|revisar|solucionar|arreglar|ver)\s+(?:en|de|del|la|el)\s+(.+?)(?:\s+(?:que|porque|ya|esta|tiene|hay)|$)/i,
    /(?:maquina|equipo|bomba|compresor|motor|panel|cinta|transportador|prensa|torno|fresa|soldadora)\s*(?:n[°º]?\s*)?(\d+|\w+)/i,
    /(?:la|el)\s+(.+?)\s+(?:esta|tiene|falla|no funciona|hace ruido|vibra)/i,
  ]

  let potentialMachineNames: string[] = []

  // Extraer posibles nombres de máquina de los patrones
  for (const pattern of machinePatterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      potentialMachineNames.push(match[1].trim())
    }
  }

  // Si no encontramos con patrones, buscar palabras después de "en", "de", "la", "el"
  if (potentialMachineNames.length === 0) {
    const simplePattern = /(?:en|de|la|el)\s+([a-záéíóúñ0-9\s]+?)(?:\s+(?:que|hay|tiene|esta)|[,.]|$)/gi
    let match
    while ((match = simplePattern.exec(msgLower)) !== null) {
      if (match[1] && match[1].length > 2) {
        potentialMachineNames.push(match[1].trim())
      }
    }
  }

  console.log('[Knowledge] Potential machine names detected:', potentialMachineNames)

  if (potentialMachineNames.length === 0) {
    return { detected: false, confidence: 'low' }
  }

  // Buscar máquinas en la base de datos
  const machines = await prisma.machine.findMany({
    where: {
      companyId,
      OR: [
        // Búsqueda por nombre exacto o parcial
        ...potentialMachineNames.flatMap(name => [
          { name: { contains: name, mode: 'insensitive' as const } },
          { nickname: { contains: name, mode: 'insensitive' as const } },
        ]),
      ],
    },
    select: {
      id: true,
      name: true,
      nickname: true,
    },
    take: 5,
  })

  if (machines.length === 0) {
    // Intentar búsqueda más flexible - palabra por palabra
    const words = msgLower.split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.includes(w) && !ENTITY_WORDS.includes(w))

    for (const word of words) {
      const fuzzyMachines = await prisma.machine.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: word, mode: 'insensitive' } },
            { nickname: { contains: word, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          nickname: true,
        },
        take: 3,
      })

      if (fuzzyMachines.length > 0) {
        return {
          detected: true,
          machineId: fuzzyMachines[0].id,
          machineName: fuzzyMachines[0].name,
          matchedText: word,
          confidence: 'medium',
        }
      }
    }

    return { detected: false, confidence: 'low' }
  }

  // Si encontramos exactamente una máquina, alta confianza
  if (machines.length === 1) {
    return {
      detected: true,
      machineId: machines[0].id,
      machineName: machines[0].name,
      matchedText: potentialMachineNames[0],
      confidence: 'high',
    }
  }

  // Si hay múltiples, devolver la primera (podríamos mejorar esto)
  return {
    detected: true,
    machineId: machines[0].id,
    machineName: machines[0].name,
    matchedText: potentialMachineNames[0],
    confidence: 'medium',
  }
}

/**
 * Obtiene las fallas activas de una máquina
 */
export async function getMachineActiveFailures(
  machineId: number,
  companyId: number
): Promise<ActiveFailure[]> {
  const failures = await prisma.failureOccurrence.findMany({
    where: {
      machineId,
      companyId,
      status: {
        in: ['OPEN', 'IN_PROGRESS', 'PENDING'],
      },
    },
    include: {
      machine: {
        select: { name: true },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  // Enriquecer con información de componentes
  const enrichedFailures: ActiveFailure[] = await Promise.all(
    failures.map(async (f) => {
      let componentName: string | undefined
      let subcomponentName: string | undefined

      if (f.subcomponentId) {
        const subcomp = await prisma.component.findUnique({
          where: { id: f.subcomponentId },
          include: {
            parent: { select: { name: true } },
          },
        })
        if (subcomp) {
          subcomponentName = subcomp.name
          componentName = subcomp.parent?.name
        }
      }

      return {
        id: f.id,
        title: f.title,
        description: f.description,
        status: f.status,
        priority: f.priority,
        failureCategory: f.failureCategory,
        createdAt: f.createdAt,
        machine: f.machine,
        componentName,
        subcomponentName,
      }
    })
  )

  return enrichedFailures
}

/**
 * Obtiene el contexto profundo de una máquina - TODO su historial y datos relacionados
 */
export async function getDeepMachineContext(
  machineId: number,
  companyId: number
): Promise<DeepMachineContext | null> {
  // 1. Obtener datos de la máquina
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: {
      sector: { select: { name: true } },
      area: { select: { name: true } },
    },
  })

  if (!machine || machine.companyId !== companyId) {
    return null
  }

  // 2. Obtener componentes y subcomponentes
  const components = await prisma.component.findMany({
    where: {
      machineId,
      parentId: null, // Solo componentes principales
    },
    include: {
      children: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  })

  // 3. Obtener fallas activas
  const activeFailures = await getMachineActiveFailures(machineId, companyId)

  // 4. Obtener fallas recientes (últimos 6 meses) con soluciones
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const recentFailures = await prisma.failureOccurrence.findMany({
    where: {
      machineId,
      companyId,
      createdAt: { gte: sixMonthsAgo },
    },
    include: {
      solutions: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          title: true,
          description: true,
          rootCause: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // 5. Obtener OTs relacionadas
  const workOrders = await prisma.workOrder.findMany({
    where: {
      machineId,
      companyId,
      createdAt: { gte: sixMonthsAgo },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      solution: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // 6. Obtener soluciones relevantes (de fallas de esta máquina)
  const failureIds = recentFailures.map(f => f.id)
  const solutions = failureIds.length > 0
    ? await prisma.failureSolution.findMany({
        where: {
          occurrenceId: { in: failureIds },
        },
        select: {
          id: true,
          title: true,
          description: true,
          rootCause: true,
          preventiveActions: true,
          effectiveness: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
    : []

  // 7. Obtener tareas preventivas de la máquina
  // NOTA: FixedTask no tiene machineId, pero MaintenanceChecklist sí
  const checklists = await prisma.maintenanceChecklist.findMany({
    where: {
      machineId,
      companyId,
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      frequency: true,
    },
  })

  return {
    machine: {
      id: machine.id,
      name: machine.name,
      nickname: machine.nickname,
      description: machine.description,
      brand: machine.brand,
      model: machine.model,
      serialNumber: machine.serialNumber,
      type: machine.type,
      status: machine.status,
      sector: machine.sector,
      area: machine.area,
    },
    components: components.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      type: c.type,
      system: c.system,
      subcomponents: c.children,
    })),
    activeFailures,
    recentFailures: recentFailures.map(f => ({
      id: f.id,
      title: f.title,
      status: f.status,
      createdAt: f.createdAt,
      solution: f.solutions[0],
    })),
    relatedWorkOrders: workOrders,
    relatedSolutions: solutions,
    preventiveTasks: checklists.map(c => ({
      id: c.id,
      title: c.title,
      frequency: c.frequency,
    })),
  }
}

/**
 * Formatea el contexto profundo de máquina para el LLM
 */
export function formatDeepMachineContextForLLM(context: DeepMachineContext): string {
  const parts: string[] = []

  // Información de la máquina
  parts.push(`=== MÁQUINA: ${context.machine.name} ===`)
  if (context.machine.nickname) parts.push(`Alias: ${context.machine.nickname}`)
  if (context.machine.brand || context.machine.model) {
    parts.push(`Marca/Modelo: ${context.machine.brand || ''} ${context.machine.model || ''}`.trim())
  }
  if (context.machine.type) parts.push(`Tipo: ${context.machine.type}`)
  parts.push(`Estado: ${context.machine.status}`)
  if (context.machine.sector) parts.push(`Sector: ${context.machine.sector.name}`)
  if (context.machine.description) parts.push(`Descripción: ${context.machine.description}`)

  // Componentes
  if (context.components.length > 0) {
    parts.push(`\n=== COMPONENTES (${context.components.length}) ===`)
    for (const comp of context.components) {
      parts.push(`• ${comp.name}${comp.type ? ` (${comp.type})` : ''}${comp.system ? ` - Sistema: ${comp.system}` : ''}`)
      if (comp.subcomponents.length > 0) {
        parts.push(`  Subcomponentes: ${comp.subcomponents.map(s => s.name).join(', ')}`)
      }
    }
  }

  // Fallas activas
  if (context.activeFailures.length > 0) {
    parts.push(`\n=== FALLAS ACTIVAS (${context.activeFailures.length}) ===`)
    for (const failure of context.activeFailures) {
      parts.push(`• [#${failure.id}] ${failure.title}`)
      parts.push(`  Estado: ${failure.status} | Prioridad: ${failure.priority}`)
      if (failure.componentName) {
        parts.push(`  Ubicación: ${failure.componentName}${failure.subcomponentName ? ` → ${failure.subcomponentName}` : ''}`)
      }
      if (failure.description) {
        parts.push(`  Descripción: ${failure.description.substring(0, 150)}${failure.description.length > 150 ? '...' : ''}`)
      }
    }
  }

  // Historial de fallas con soluciones
  if (context.recentFailures.length > 0) {
    const solvedFailures = context.recentFailures.filter(f => f.solution)
    if (solvedFailures.length > 0) {
      parts.push(`\n=== HISTORIAL DE SOLUCIONES (últimos 6 meses) ===`)
      for (const failure of solvedFailures.slice(0, 5)) {
        parts.push(`• [#${failure.id}] ${failure.title}`)
        if (failure.solution) {
          parts.push(`  SOLUCIÓN: ${failure.solution.title}`)
          if (failure.solution.rootCause) {
            parts.push(`  Causa raíz: ${failure.solution.rootCause}`)
          }
          if (failure.solution.description) {
            parts.push(`  Procedimiento: ${failure.solution.description.substring(0, 200)}${failure.solution.description.length > 200 ? '...' : ''}`)
          }
        }
      }
    }
  }

  // OTs con soluciones
  const solvedWOs = context.relatedWorkOrders.filter(wo => wo.solution)
  if (solvedWOs.length > 0) {
    parts.push(`\n=== OTs COMPLETADAS CON SOLUCIÓN ===`)
    for (const wo of solvedWOs.slice(0, 5)) {
      parts.push(`• [OT-${wo.id}] ${wo.title}`)
      if (wo.solution) {
        parts.push(`  Solución: ${wo.solution.substring(0, 200)}${wo.solution.length > 200 ? '...' : ''}`)
      }
    }
  }

  // Tareas preventivas
  if (context.preventiveTasks.length > 0) {
    parts.push(`\n=== MANTENIMIENTO PREVENTIVO ===`)
    for (const task of context.preventiveTasks) {
      parts.push(`• ${task.title} (${task.frequency})`)
    }
  }

  return parts.join('\n')
}

/**
 * Formatea las fallas activas para mostrar al usuario como opciones seleccionables
 */
export function formatActiveFailuresForSelection(failures: ActiveFailure[]): string {
  if (failures.length === 0) {
    return 'No hay fallas activas registradas para esta máquina.'
  }

  const lines = ['Encontré las siguientes fallas activas:']

  for (const failure of failures) {
    const location = failure.componentName
      ? `${failure.componentName}${failure.subcomponentName ? ` → ${failure.subcomponentName}` : ''}`
      : ''

    const priorityEmoji = {
      'CRITICAL': '🔴',
      'HIGH': '🟠',
      'MEDIUM': '🟡',
      'LOW': '🟢',
    }[failure.priority] || '⚪'

    lines.push(`${priorityEmoji} **[Falla #${failure.id}]** ${failure.title}`)
    if (location) lines.push(`   📍 ${location}`)
    if (failure.status) lines.push(`   Estado: ${failure.status}`)
  }

  lines.push('\n¿Cuál falla querés resolver?')

  return lines.join('\n')
}
