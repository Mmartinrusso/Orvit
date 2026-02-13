-- Índices para SolutionApplied
-- Optimiza queries de getTopSolutions y filtros por outcome

-- Índice para filtrar por outcome (FUNCIONÓ, PARCIAL, etc.)
CREATE INDEX IF NOT EXISTS "solutions_applied_companyId_outcome_idx"
ON "solutions_applied"("companyId", "outcome");

-- Índice compuesto para getTopSolutions (outcome + effectiveness)
CREATE INDEX IF NOT EXISTS "solutions_applied_companyId_outcome_effectiveness_idx"
ON "solutions_applied"("companyId", "outcome", "effectiveness");
