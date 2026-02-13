// ============================================
// Generación y manejo de embeddings
// ============================================

import { AI_CONFIG } from './config'

// Cliente de OpenAI (lazy initialization)
let openaiClient: any = null

async function getOpenAIClient() {
  if (!openaiClient) {
    const OpenAI = (await import('openai')).default
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

/**
 * Genera un embedding para un texto dado
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = await getOpenAIClient()

  // Limpiar y truncar el texto si es necesario
  const cleanedText = cleanText(text)

  // OpenAI tiene un límite de ~8000 tokens para embeddings
  const truncatedText = truncateText(cleanedText, 8000)

  const response = await openai.embeddings.create({
    model: AI_CONFIG.embeddings.model,
    input: truncatedText,
  })

  return response.data[0].embedding
}

/**
 * Genera embeddings para múltiples textos en batch
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const openai = await getOpenAIClient()

  // Limpiar y truncar los textos
  const cleanedTexts = texts.map(t => truncateText(cleanText(t), 8000))

  const response = await openai.embeddings.create({
    model: AI_CONFIG.embeddings.model,
    input: cleanedTexts,
  })

  return response.data.map((d: { embedding: number[] }) => d.embedding)
}

/**
 * Limpia el texto para mejor calidad de embeddings
 */
function cleanText(text: string): string {
  return text
    // Remover múltiples espacios y saltos de línea
    .replace(/\s+/g, ' ')
    // Remover caracteres especiales que no aportan
    .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ.,;:!?¿¡()\-]/g, '')
    // Trim
    .trim()
}

/**
 * Trunca el texto a un número aproximado de tokens
 * (1 token ≈ 4 caracteres en español)
 */
function truncateText(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) {
    return text
  }
  return text.substring(0, maxChars) + '...'
}

/**
 * Calcula la similitud de coseno entre dos embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Convierte un array de números a formato de vector PostgreSQL
 */
export function toPostgresVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Parsea un vector de PostgreSQL a array de números
 */
export function fromPostgresVector(vectorString: string): number[] {
  // El formato es [n1,n2,n3,...]
  const cleaned = vectorString.replace(/[\[\]]/g, '')
  return cleaned.split(',').map(Number)
}
