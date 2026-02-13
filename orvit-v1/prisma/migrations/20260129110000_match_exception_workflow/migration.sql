-- =====================================================
-- MATCH EXCEPTION WORKFLOW ENHANCEMENT
-- =====================================================
-- Agrega campos para workflow de excepciones:
-- 1. Owner (responsable de resolver)
-- 2. SLA (fecha límite)
-- 3. Prioridad
-- 4. Monto afectado
-- 5. Historial de escalamiento
-- =====================================================

-- 1. Campos de ownership y SLA
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "ownerId" INT;
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "ownerRole" VARCHAR(100);
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "slaDeadline" TIMESTAMP;
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "slaBreached" BOOLEAN DEFAULT false;
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP;
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "escalatedTo" INT;

-- 2. Campos de prioridad y monto
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "prioridad" VARCHAR(20) DEFAULT 'NORMAL';
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "montoAfectado" DECIMAL(15,2);

-- 3. Campos de descuento (para varianza de precio)
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "descuentoAplicado" DECIMAL(15,2);
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "precioConDescuento" DECIMAL(15,2);
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "descuentoPorcentaje" DECIMAL(5,2);

-- 4. Razón del rechazo/aprobación
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "reasonCode" VARCHAR(100);
ALTER TABLE "match_exceptions" ADD COLUMN IF NOT EXISTS "reasonText" TEXT;

-- 5. Foreign key para owner
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'match_exceptions_owner_fk'
    ) THEN
        ALTER TABLE "match_exceptions"
        ADD CONSTRAINT "match_exceptions_owner_fk"
        FOREIGN KEY ("ownerId") REFERENCES "User"("id");
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- 6. Foreign key para escalatedTo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'match_exceptions_escalated_fk'
    ) THEN
        ALTER TABLE "match_exceptions"
        ADD CONSTRAINT "match_exceptions_escalated_fk"
        FOREIGN KEY ("escalatedTo") REFERENCES "User"("id");
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- 7. Index para excepciones pendientes por owner
CREATE INDEX IF NOT EXISTS "idx_match_exception_owner_pending"
ON "match_exceptions" ("ownerId", "resuelto", "slaDeadline")
WHERE "resuelto" = false;

-- 8. Index para SLA breach
CREATE INDEX IF NOT EXISTS "idx_match_exception_sla_breach"
ON "match_exceptions" ("slaBreached", "slaDeadline")
WHERE "slaBreached" = false AND "resuelto" = false;

-- 9. Tabla de historial de excepciones
CREATE TABLE IF NOT EXISTS "MatchExceptionHistory" (
    "id" SERIAL PRIMARY KEY,
    "exceptionId" INT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "fromOwnerId" INT,
    "toOwnerId" INT,
    "fromStatus" VARCHAR(50),
    "toStatus" VARCHAR(50),
    "reasonCode" VARCHAR(100),
    "reasonText" TEXT,
    "userId" INT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "match_exception_history_exception_fk"
        FOREIGN KEY ("exceptionId") REFERENCES "match_exceptions"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_match_exception_history_exception"
ON "MatchExceptionHistory" ("exceptionId", "createdAt");

-- 10. Agregar campos de descuento a PurchaseReceiptItem si no existen
ALTER TABLE "PurchaseReceiptItem" ADD COLUMN IF NOT EXISTS "descuento" DECIMAL(5,2) DEFAULT 0;
ALTER TABLE "PurchaseReceiptItem" ADD COLUMN IF NOT EXISTS "descuentoMonto" DECIMAL(15,2) DEFAULT 0;
ALTER TABLE "PurchaseReceiptItem" ADD COLUMN IF NOT EXISTS "precioConDescuento" DECIMAL(15,4);

-- 11. Configuración de SLA por tipo de excepción
CREATE TABLE IF NOT EXISTS "MatchExceptionSLAConfig" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INT NOT NULL,
    "exceptionType" VARCHAR(50) NOT NULL,
    "slaHours" INT NOT NULL DEFAULT 24,
    "ownerRole" VARCHAR(100),
    "escalateAfterHours" INT,
    "escalateToRole" VARCHAR(100),
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "match_exception_sla_unique" UNIQUE ("companyId", "exceptionType")
);

-- 12. Insertar configuración SLA por defecto
INSERT INTO "MatchExceptionSLAConfig" ("companyId", "exceptionType", "slaHours", "ownerRole", "escalateAfterHours", "escalateToRole")
SELECT c.id, 'PRECIO_DIFERENTE', 24, 'COMPRAS_ANALISTA', 48, 'COMPRAS_SUPERVISOR'
FROM "Company" c
WHERE NOT EXISTS (
    SELECT 1 FROM "MatchExceptionSLAConfig"
    WHERE "companyId" = c.id AND "exceptionType" = 'PRECIO_DIFERENTE'
);

INSERT INTO "MatchExceptionSLAConfig" ("companyId", "exceptionType", "slaHours", "ownerRole", "escalateAfterHours", "escalateToRole")
SELECT c.id, 'CANTIDAD_DIFERENTE', 24, 'ALMACEN_SUPERVISOR', 48, 'COMPRAS_SUPERVISOR'
FROM "Company" c
WHERE NOT EXISTS (
    SELECT 1 FROM "MatchExceptionSLAConfig"
    WHERE "companyId" = c.id AND "exceptionType" = 'CANTIDAD_DIFERENTE'
);

INSERT INTO "MatchExceptionSLAConfig" ("companyId", "exceptionType", "slaHours", "ownerRole", "escalateAfterHours", "escalateToRole")
SELECT c.id, 'SIN_RECEPCION', 48, 'ALMACEN_SUPERVISOR', 72, 'COMPRAS_GERENTE'
FROM "Company" c
WHERE NOT EXISTS (
    SELECT 1 FROM "MatchExceptionSLAConfig"
    WHERE "companyId" = c.id AND "exceptionType" = 'SIN_RECEPCION'
);

INSERT INTO "MatchExceptionSLAConfig" ("companyId", "exceptionType", "slaHours", "ownerRole", "escalateAfterHours", "escalateToRole")
SELECT c.id, 'ITEM_EXTRA', 24, 'COMPRAS_ANALISTA', 48, 'COMPRAS_SUPERVISOR'
FROM "Company" c
WHERE NOT EXISTS (
    SELECT 1 FROM "MatchExceptionSLAConfig"
    WHERE "companyId" = c.id AND "exceptionType" = 'ITEM_EXTRA'
);

-- =====================================================
-- DONE
-- =====================================================
