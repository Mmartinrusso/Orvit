-- Optimización de índices para PurchaseRequest
-- Ejecutar manualmente: psql -d <database> -f manual_purchase_request_indexes.sql

-- Índice para ordenamiento por fecha de creación (muy usado en listados)
CREATE INDEX IF NOT EXISTS "purchase_requests_createdAt_idx"
ON "purchase_requests" ("createdAt" DESC);

-- Índice para filtro "vence esta semana"
CREATE INDEX IF NOT EXISTS "purchase_requests_fechaNecesidad_idx"
ON "purchase_requests" ("fechaNecesidad");

-- Índice compuesto para queries comunes: listar por empresa + estado + orden por fecha
CREATE INDEX IF NOT EXISTS "purchase_requests_companyId_estado_createdAt_idx"
ON "purchase_requests" ("companyId", "estado", "createdAt" DESC);

-- Índice compuesto para filtro de urgentes
CREATE INDEX IF NOT EXISTS "purchase_requests_companyId_prioridad_estado_idx"
ON "purchase_requests" ("companyId", "prioridad", "estado");

-- Verificar índices creados
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'purchase_requests';
