-- =====================================================
-- GRNI AUDIT ENHANCEMENT
-- =====================================================
-- Mejora el sistema GRNI con:
-- 1. Owner/responsable de seguimiento
-- 2. Historial de cambios (audit log)
-- 3. Alertas de antigüedad
-- 4. Integración con NotificationOutbox
-- =====================================================

-- 1. Campos de owner y seguimiento
ALTER TABLE "grni_accruals" ADD COLUMN IF NOT EXISTS "ownerId" INT;
ALTER TABLE "grni_accruals" ADD COLUMN IF NOT EXISTS "ownerRole" VARCHAR(100);
ALTER TABLE "grni_accruals" ADD COLUMN IF NOT EXISTS "seguimientoAt" TIMESTAMP;
ALTER TABLE "grni_accruals" ADD COLUMN IF NOT EXISTS "notasSegumiento" TEXT;

-- 2. Campos de alerta
ALTER TABLE "grni_accruals" ADD COLUMN IF NOT EXISTS "alertaEnviada" BOOLEAN DEFAULT false;
ALTER TABLE "grni_accruals" ADD COLUMN IF NOT EXISTS "alertaEnviadaAt" TIMESTAMP;
ALTER TABLE "grni_accruals" ADD COLUMN IF NOT EXISTS "diasAlerta" INT DEFAULT 30;

-- 3. Campos de razón para cierre
ALTER TABLE "grni_accruals" ADD COLUMN IF NOT EXISTS "reasonCode" VARCHAR(100);
ALTER TABLE "grni_accruals" ADD COLUMN IF NOT EXISTS "reasonText" TEXT;

-- 4. Foreign key para owner
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'grni_accruals_owner_fk'
    ) THEN
        ALTER TABLE "grni_accruals"
        ADD CONSTRAINT "grni_accruals_owner_fk"
        FOREIGN KEY ("ownerId") REFERENCES "User"("id");
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- 5. Historial de GRNI
CREATE TABLE IF NOT EXISTS "GRNIAuditLog" (
    "id" SERIAL PRIMARY KEY,
    "grniAccrualId" INT NOT NULL,
    "companyId" INT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "fromState" VARCHAR(50),
    "toState" VARCHAR(50),
    "montoAnterior" DECIMAL(15,2),
    "montoNuevo" DECIMAL(15,2),
    "fromOwnerId" INT,
    "toOwnerId" INT,
    "reasonCode" VARCHAR(100),
    "reasonText" TEXT,
    "metadata" JSONB,
    "userId" INT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "grni_audit_log_accrual_fk"
        FOREIGN KEY ("grniAccrualId") REFERENCES "grni_accruals"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_grni_audit_log_accrual"
ON "GRNIAuditLog" ("grniAccrualId", "createdAt");

CREATE INDEX IF NOT EXISTS "idx_grni_audit_log_company"
ON "GRNIAuditLog" ("companyId", "createdAt");

-- 6. Índice para GRNI pendientes por owner
CREATE INDEX IF NOT EXISTS "idx_grni_accruals_owner_pending"
ON "grni_accruals" ("ownerId", "estado", "createdAt")
WHERE "estado" = 'PENDIENTE';

-- 7. Índice para alertas de antigüedad
CREATE INDEX IF NOT EXISTS "idx_grni_accruals_aging_alert"
ON "grni_accruals" ("companyId", "estado", "alertaEnviada", "createdAt")
WHERE "estado" = 'PENDIENTE' AND "alertaEnviada" = false;

-- 8. Configuración de alertas GRNI por empresa
CREATE TABLE IF NOT EXISTS "GRNIAlertConfig" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INT NOT NULL,
    "diasAlertaAmarilla" INT NOT NULL DEFAULT 30,
    "diasAlertaRoja" INT NOT NULL DEFAULT 60,
    "diasAlertaCritica" INT NOT NULL DEFAULT 90,
    "emailsNotificar" TEXT[],
    "ownerRoleDefault" VARCHAR(100) DEFAULT 'COMPRAS_ANALISTA',
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "grni_alert_config_unique" UNIQUE ("companyId")
);

-- Insertar configuración por defecto
INSERT INTO "GRNIAlertConfig" ("companyId", "diasAlertaAmarilla", "diasAlertaRoja", "diasAlertaCritica", "ownerRoleDefault")
SELECT c.id, 30, 60, 90, 'COMPRAS_ANALISTA'
FROM "Company" c
WHERE NOT EXISTS (
    SELECT 1 FROM "GRNIAlertConfig" WHERE "companyId" = c.id
);

-- =====================================================
-- DONE
-- =====================================================
