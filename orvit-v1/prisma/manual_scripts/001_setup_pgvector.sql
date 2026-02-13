-- ============================================
-- Script para configurar pgvector
-- Ejecutar DESPUÉS de la migración de Prisma
-- ============================================

-- 1. Habilitar la extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Agregar columna de embedding a la tabla assistant_embeddings
-- Usamos 1536 dimensiones (compatible con OpenAI text-embedding-3-small)
ALTER TABLE assistant_embeddings
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Crear índice para búsqueda eficiente por similitud de coseno
-- ivfflat es más rápido para datasets grandes
CREATE INDEX IF NOT EXISTS idx_assistant_embeddings_vector
ON assistant_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Crear función para buscar embeddings similares
CREATE OR REPLACE FUNCTION search_similar_embeddings(
  query_embedding vector(1536),
  company_id_filter INT,
  entity_type_filter TEXT DEFAULT NULL,
  limit_count INT DEFAULT 5
)
RETURNS TABLE (
  id INT,
  entity_type VARCHAR(50),
  entity_id INT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    ae."entityType",
    ae."entityId",
    ae.content,
    ae.metadata::JSONB,
    1 - (ae.embedding <=> query_embedding) AS similarity
  FROM assistant_embeddings ae
  WHERE ae."companyId" = company_id_filter
    AND (entity_type_filter IS NULL OR ae."entityType" = entity_type_filter)
    AND ae.embedding IS NOT NULL
  ORDER BY ae.embedding <=> query_embedding
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Comentarios para documentación
COMMENT ON COLUMN assistant_embeddings.embedding IS 'Vector embedding de 1536 dimensiones generado por OpenAI text-embedding-3-small';
COMMENT ON FUNCTION search_similar_embeddings IS 'Busca embeddings similares usando distancia de coseno';
