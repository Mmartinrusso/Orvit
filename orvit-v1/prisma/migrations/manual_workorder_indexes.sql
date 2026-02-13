-- Índices standalone para queries frecuentes en WorkOrder
-- Complementan los índices compuestos existentes (companyId+status, companyId+priority+status, etc.)

CREATE INDEX IF NOT EXISTS "work_orders_priority_idx" ON "work_orders" ("priority");
CREATE INDEX IF NOT EXISTS "work_orders_assignedToId_idx" ON "work_orders" ("assignedToId");
CREATE INDEX IF NOT EXISTS "work_orders_machineId_idx" ON "work_orders" ("machineId");
CREATE INDEX IF NOT EXISTS "work_orders_createdAt_idx" ON "work_orders" ("createdAt");
