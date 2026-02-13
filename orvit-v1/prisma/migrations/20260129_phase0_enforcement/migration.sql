-- Phase 0: P2P Enforcement - Complete Migration
-- This migration adds all necessary fields and tables for proper P2P enforcement

-- =====================================================
-- 1. SUPPLIERS: Add blocking fields
-- =====================================================
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "blockedReason" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "blockedByUserId" INTEGER;

CREATE INDEX IF NOT EXISTS "suppliers_isBlocked_idx" ON "suppliers"("isBlocked");

-- =====================================================
-- 2. MATCH_EXCEPTIONS: Add owner, SLA, priority fields
-- =====================================================
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "ownerId" INTEGER;
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "ownerRole" VARCHAR(50);
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "slaDeadline" TIMESTAMP;
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "slaBreached" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "prioridad" VARCHAR(20);
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "montoAfectado" DECIMAL(15, 2);
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP;
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "escalatedTo" INTEGER;
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "reasonCode" VARCHAR(50);
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "reasonText" TEXT;

CREATE INDEX IF NOT EXISTS "match_exceptions_ownerId_idx" ON "match_exceptions"("ownerId");
CREATE INDEX IF NOT EXISTS "match_exceptions_slaDeadline_idx" ON "match_exceptions"("slaDeadline");
CREATE INDEX IF NOT EXISTS "match_exceptions_slaBreached_idx" ON "match_exceptions"("slaBreached");

-- Add foreign key constraints for match_exceptions
ALTER TABLE "match_exceptions"
  ADD CONSTRAINT "match_exceptions_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "match_exceptions"
  ADD CONSTRAINT "match_exceptions_escalatedTo_fkey"
  FOREIGN KEY ("escalatedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- 3. MATCH EXCEPTION SLA CONFIG
-- =====================================================
CREATE TABLE IF NOT EXISTS "match_exception_sla_configs" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "exceptionType" VARCHAR(50) NOT NULL,
  "slaHours" INTEGER NOT NULL DEFAULT 24,
  "ownerRole" VARCHAR(50),
  "escalateAfterHours" INTEGER,
  "escalateToRole" VARCHAR(50),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_exception_sla_configs_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "match_exception_sla_configs_companyId_exceptionType_key"
    UNIQUE ("companyId", "exceptionType")
);

-- =====================================================
-- 4. MATCH EXCEPTION HISTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS "match_exception_history" (
  "id" SERIAL PRIMARY KEY,
  "exceptionId" INTEGER NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "fromOwnerId" INTEGER,
  "toOwnerId" INTEGER,
  "fromStatus" VARCHAR(50),
  "toStatus" VARCHAR(50),
  "reasonCode" VARCHAR(50),
  "reasonText" TEXT,
  "userId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_exception_history_exceptionId_fkey"
    FOREIGN KEY ("exceptionId") REFERENCES "match_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "match_exception_history_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "match_exception_history_exceptionId_idx" ON "match_exception_history"("exceptionId");

-- =====================================================
-- 5. NOTIFICATION OUTBOX
-- =====================================================
CREATE TABLE IF NOT EXISTS "notification_outbox" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "tipo" VARCHAR(50) NOT NULL,
  "destinatarios" JSONB NOT NULL,
  "titulo" VARCHAR(255) NOT NULL,
  "mensaje" TEXT NOT NULL,
  "datos" JSONB,
  "prioridad" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "ultimoError" TEXT,
  "scheduledAt" TIMESTAMP,
  "sentAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_outbox_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "notification_outbox_companyId_idx" ON "notification_outbox"("companyId");
CREATE INDEX IF NOT EXISTS "notification_outbox_estado_idx" ON "notification_outbox"("estado");
CREATE INDEX IF NOT EXISTS "notification_outbox_scheduledAt_idx" ON "notification_outbox"("scheduledAt");

-- =====================================================
-- 6. SOD RULES
-- =====================================================
CREATE TABLE IF NOT EXISTS "sod_rules" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "codigo" VARCHAR(20) NOT NULL,
  "nombre" VARCHAR(100) NOT NULL,
  "descripcion" TEXT,
  "accion1" VARCHAR(50) NOT NULL,
  "accion2" VARCHAR(50) NOT NULL,
  "scope" VARCHAR(30) NOT NULL DEFAULT 'SAME_DOCUMENT',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sod_rules_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sod_rules_companyId_codigo_key"
    UNIQUE ("companyId", "codigo")
);

-- =====================================================
-- 7. SOD VIOLATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS "sod_violations" (
  "id" SERIAL PRIMARY KEY,
  "ruleId" INTEGER NOT NULL,
  "companyId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "documentType" VARCHAR(50) NOT NULL,
  "documentId" INTEGER NOT NULL,
  "accion" VARCHAR(50) NOT NULL,
  "bloqueado" BOOLEAN NOT NULL DEFAULT true,
  "aprobadoPor" INTEGER,
  "motivo" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sod_violations_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "sod_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sod_violations_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sod_violations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "sod_violations_companyId_idx" ON "sod_violations"("companyId");
CREATE INDEX IF NOT EXISTS "sod_violations_userId_idx" ON "sod_violations"("userId");

-- =====================================================
-- 8. SEED DEFAULT SLA CONFIGS
-- =====================================================
-- Insert default SLA configurations for existing companies
INSERT INTO "match_exception_sla_configs" ("companyId", "exceptionType", "slaHours", "ownerRole", "escalateAfterHours", "escalateToRole")
SELECT c.id, t.tipo, t.sla, t.owner_role, t.escalate_hours, t.escalate_role
FROM "Company" c
CROSS JOIN (
  VALUES
    ('PRECIO_DIFERENTE', 24, 'COMPRAS_ANALISTA', 48, 'COMPRAS_SUPERVISOR'),
    ('CANTIDAD_DIFERENTE', 24, 'COMPRAS_ANALISTA', 48, 'COMPRAS_SUPERVISOR'),
    ('SIN_RECEPCION', 8, 'ALMACEN', 24, 'COMPRAS_SUPERVISOR'),
    ('ITEM_EXTRA', 24, 'COMPRAS_ANALISTA', 48, 'COMPRAS_SUPERVISOR'),
    ('ITEM_FALTANTE', 24, 'COMPRAS_ANALISTA', 48, 'COMPRAS_SUPERVISOR'),
    ('IMPUESTO_DIFERENTE', 12, 'CONTABILIDAD', 24, 'CONTADOR'),
    ('TOTAL_DIFERENTE', 8, 'COMPRAS_SUPERVISOR', 24, 'GERENTE_COMPRAS'),
    ('DUPLICADO', 4, 'COMPRAS_ANALISTA', 12, 'COMPRAS_SUPERVISOR'),
    ('SIN_OC', 12, 'COMPRAS_ANALISTA', 24, 'COMPRAS_SUPERVISOR')
) AS t(tipo, sla, owner_role, escalate_hours, escalate_role)
WHERE NOT EXISTS (
  SELECT 1 FROM "match_exception_sla_configs"
  WHERE "companyId" = c.id AND "exceptionType" = t.tipo
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 9. SEED DEFAULT SOD RULES
-- =====================================================
INSERT INTO "sod_rules" ("companyId", "codigo", "nombre", "descripcion", "accion1", "accion2", "scope", "enabled")
SELECT c.id, r.codigo, r.nombre, r.descripcion, r.accion1, r.accion2, r.scope, true
FROM "Company" c
CROSS JOIN (
  VALUES
    ('SOD_001', 'Creador pedido no aprueba', 'Quien crea el pedido no puede aprobarlo', 'CREAR_PEDIDO', 'APROBAR_PEDIDO', 'SAME_DOCUMENT'),
    ('SOD_002', 'Aprobador pedido no crea OC', 'Quien aprueba el pedido no puede crear la OC', 'APROBAR_PEDIDO', 'CREAR_OC', 'SAME_DOCUMENT'),
    ('SOD_003', 'Creador OC no recibe', 'Quien crea la OC no puede confirmar la recepción', 'CREAR_OC', 'CONFIRMAR_RECEPCION', 'SAME_DOCUMENT'),
    ('SOD_004', 'Aprobador OC no crea OP', 'Quien aprueba la OC no puede crear la orden de pago', 'APROBAR_OC', 'CREAR_OP', 'SAME_DOCUMENT'),
    ('SOD_005', 'Receptor no aprueba pago', 'Quien recibe mercadería no puede aprobar el pago', 'CONFIRMAR_RECEPCION', 'APROBAR_PAGO', 'SAME_DOCUMENT'),
    ('SOD_006', 'Creador OP no aprueba', 'Quien crea la orden de pago no puede aprobarla', 'CREAR_OP', 'APROBAR_PAGO', 'SAME_DOCUMENT')
) AS r(codigo, nombre, descripcion, accion1, accion2, scope)
WHERE NOT EXISTS (
  SELECT 1 FROM "sod_rules"
  WHERE "companyId" = c.id AND "codigo" = r.codigo
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
