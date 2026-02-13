// ============================================
// Asistente IA - Exports
// ============================================

// Tipos
export * from './types'

// Configuración
export * from './config'

// Embeddings
export {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  toPostgresVector,
  fromPostgresVector,
} from './embeddings'

// Indexador
export {
  indexEntity,
  indexEntityQuick,
  indexAllEntitiesOfType,
  reindexEntity,
  deleteEntityEmbedding,
} from './indexer'

// Base de conocimiento
export {
  searchKnowledge,
  searchByText,
  getEntityContext,
  searchRelated,
  formatSearchResultsForLLM,
} from './knowledge'

// Motor del asistente
export {
  processMessage,
  detectIntent,
  transcribeAudio,
} from './engine'

// Autenticación
export {
  getAssistantContext,
  hasAssistantAccess,
} from './auth'
