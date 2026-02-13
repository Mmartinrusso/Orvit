-- ============================================
-- Campos de obsolescencia para SolutionApplied
-- Permite marcar soluciones que ya no son válidas
-- ============================================

-- Agregar campos de obsolescencia
ALTER TABLE "solutions_applied"
ADD COLUMN IF NOT EXISTS "isObsolete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "obsoleteReason" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "obsoleteAt" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "obsoleteById" INTEGER;

-- Índice para filtrar soluciones no obsoletas que funcionaron
CREATE INDEX IF NOT EXISTS "solutions_applied_companyId_isObsolete_outcome_idx"
ON "solutions_applied"("companyId", "isObsolete", "outcome");

-- Comentarios para documentación
COMMENT ON COLUMN "solutions_applied"."isObsolete" IS 'True si la solución ya no es válida (cambió el equipo, procedimiento obsoleto, etc.)';
COMMENT ON COLUMN "solutions_applied"."obsoleteReason" IS 'Razón por la que la solución fue marcada como obsoleta';
COMMENT ON COLUMN "solutions_applied"."obsoleteAt" IS 'Fecha en que fue marcada como obsoleta';
COMMENT ON COLUMN "solutions_applied"."obsoleteById" IS 'Usuario que marcó la solución como obsoleta';
