-- ============================================================
-- Migración manual: tablas creadas dinámicamente en API routes
-- Ejecutar una sola vez en cada entorno (dev, staging, prod)
-- Todas las operaciones usan IF NOT EXISTS para ser idempotentes
-- ============================================================

-- 1. machine_order_temp
--    Almacena el orden visual de máquinas por empresa
CREATE TABLE IF NOT EXISTS machine_order_temp (
  id             SERIAL PRIMARY KEY,
  company_id     INTEGER NOT NULL,
  machine_id     INTEGER NOT NULL,
  order_position INTEGER NOT NULL,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, machine_id)
);

-- 2. LoadAudit
--    Historial de cambios sobre registros de carga
CREATE TABLE IF NOT EXISTS "LoadAudit" (
  id          SERIAL PRIMARY KEY,
  "loadId"    INTEGER NOT NULL REFERENCES "Load"(id) ON DELETE CASCADE,
  "userId"    INTEGER NOT NULL REFERENCES "User"(id),
  action      VARCHAR(50) NOT NULL,
  changes     JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LoadAudit_loadId_idx" ON "LoadAudit"("loadId");

-- 3. LoadTemplate
--    Plantillas de carga predefinidas por empresa
CREATE TABLE IF NOT EXISTS "LoadTemplate" (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  "companyId" INTEGER NOT NULL REFERENCES "Company"(id),
  "truckId"   INTEGER REFERENCES "Truck"(id),
  items       JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LoadTemplate_companyId_idx" ON "LoadTemplate"("companyId");

-- 4. ChecklistInstructive
--    Instructivos asociados a checklists de mantenimiento
CREATE TABLE IF NOT EXISTS "ChecklistInstructive" (
  "id"          SERIAL PRIMARY KEY,
  "checklistId" INTEGER NOT NULL,
  "title"       TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ChecklistInstructive_checklistId_idx"
  ON "ChecklistInstructive"("checklistId");

-- 5. ChecklistExecution
--    Registro de ejecuciones de checklists
CREATE TABLE IF NOT EXISTS "ChecklistExecution" (
  id            SERIAL PRIMARY KEY,
  "checklistId" INTEGER,
  "companyId"   INTEGER,
  "sectorId"    INTEGER,
  "executedAt"  TIMESTAMP DEFAULT NOW(),
  data          JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS "ChecklistExecution_checklistId_idx" ON "ChecklistExecution"("checklistId");
CREATE INDEX IF NOT EXISTS "ChecklistExecution_companyId_idx"   ON "ChecklistExecution"("companyId");
CREATE INDEX IF NOT EXISTS "ChecklistExecution_sectorId_idx"    ON "ChecklistExecution"("sectorId");
CREATE INDEX IF NOT EXISTS "ChecklistExecution_executedAt_idx"  ON "ChecklistExecution"("executedAt");

-- 6. failures
--    Registro de fallas de máquinas
CREATE TABLE IF NOT EXISTS failures (
  id            SERIAL PRIMARY KEY,
  machine_id    INTEGER,
  description   TEXT,
  status        VARCHAR(50),
  reported_date TIMESTAMP DEFAULT NOW(),
  data          JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_failures_machine_id    ON failures(machine_id);
CREATE INDEX IF NOT EXISTS idx_failures_status        ON failures(status);
CREATE INDEX IF NOT EXISTS idx_failures_reported_date ON failures(reported_date);

-- 7. Columnas en Truck (peso chasis / acoplado)
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "chasisWeight"   DOUBLE PRECISION;
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "acopladoWeight" DOUBLE PRECISION;

-- 8. Índice en purchase_receipt para facturas sin pagar
CREATE INDEX IF NOT EXISTS "idx_purchase_receipt_unpaid"
  ON "PurchaseReceipt"("companyId", "paymentStatus")
  WHERE "paymentStatus" = 'PENDING';

DO $$
BEGIN
  RAISE NOTICE '✅ Migración manual_dynamic_tables completada exitosamente';
END $$;
