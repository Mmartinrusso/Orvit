-- ============================================
-- Índices de performance para UnidadMovil
-- ============================================

-- Índice para listado por empresa
CREATE INDEX IF NOT EXISTS "UnidadMovil_companyId_idx" ON "UnidadMovil"("companyId");

-- Índice para filtro por estado
CREATE INDEX IF NOT EXISTS "UnidadMovil_companyId_estado_idx" ON "UnidadMovil"("companyId", "estado");

-- Índice para filtro por sector
CREATE INDEX IF NOT EXISTS "UnidadMovil_companyId_sectorId_idx" ON "UnidadMovil"("companyId", "sectorId");

-- Índice para filtro por tipo
CREATE INDEX IF NOT EXISTS "UnidadMovil_companyId_tipo_idx" ON "UnidadMovil"("companyId", "tipo");

-- Índice para alertas de mantenimiento próximo
CREATE INDEX IF NOT EXISTS "UnidadMovil_proximoMantenimiento_idx" ON "UnidadMovil"("proximoMantenimiento");
