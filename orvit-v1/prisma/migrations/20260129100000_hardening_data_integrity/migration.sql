-- =====================================================
-- HARDENING: Data Integrity Constraints
-- =====================================================
-- Este migration agrega constraints críticos para:
-- 1. Unicidad de facturas (evita duplicados)
-- 2. Unicidad de CUIT por empresa (evita proveedores duplicados)
-- 3. Idempotency keys para operaciones críticas
-- 4. Indexes para Control Tower performance
-- =====================================================

-- =====================================================
-- 1. UNIQUE CONSTRAINT: Facturas por proveedor
-- Una factura es única por: empresa + proveedor + tipo + serie + número
-- =====================================================
DO $$
BEGIN
    -- Solo si la tabla existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PurchaseReceipt') THEN
        RAISE NOTICE 'Tabla PurchaseReceipt no existe, saltando constraint de unicidad';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'PurchaseReceipt_unique_factura'
    ) THEN
        -- Primero detectar duplicados existentes y marcarlos
        UPDATE "PurchaseReceipt" pr1
        SET "observaciones" = COALESCE("observaciones", '') || ' [DUPLICADO DETECTADO: ' || NOW()::text || ']'
        WHERE EXISTS (
            SELECT 1 FROM "PurchaseReceipt" pr2
            WHERE pr2."companyId" = pr1."companyId"
            AND pr2."proveedorId" = pr1."proveedorId"
            AND pr2."tipo" = pr1."tipo"
            AND pr2."numeroSerie" = pr1."numeroSerie"
            AND pr2."numeroFactura" = pr1."numeroFactura"
            AND pr2.id < pr1.id
        );

        -- Crear constraint único (fallará si hay duplicados no resueltos)
        ALTER TABLE "PurchaseReceipt"
        ADD CONSTRAINT "PurchaseReceipt_unique_factura"
        UNIQUE ("companyId", "proveedorId", "tipo", "numeroSerie", "numeroFactura");

        RAISE NOTICE 'Constraint PurchaseReceipt_unique_factura creado';
    END IF;
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Hay facturas duplicadas. Revisar registros con observaciones DUPLICADO DETECTADO';
END $$;

-- =====================================================
-- 2. UNIQUE CONSTRAINT: CUIT por empresa
-- Un CUIT debe ser único dentro de cada empresa
-- =====================================================
DO $$
BEGIN
    -- Solo si la tabla existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
        RAISE NOTICE 'Tabla suppliers no existe, saltando constraint de CUIT';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'suppliers_unique_cuit_company'
    ) THEN
        -- Marcar proveedores duplicados
        UPDATE "suppliers" s1
        SET "notes" = COALESCE("notes", '') || ' [CUIT DUPLICADO: ' || NOW()::text || ']'
        WHERE s1."cuit" IS NOT NULL
        AND s1."cuit" != ''
        AND EXISTS (
            SELECT 1 FROM "suppliers" s2
            WHERE s2."company_id" = s1."company_id"
            AND s2."cuit" = s1."cuit"
            AND s2.id < s1.id
        );

        -- Crear constraint (solo para CUITs no vacíos)
        CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_unique_cuit_company"
        ON "suppliers" ("company_id", "cuit")
        WHERE "cuit" IS NOT NULL AND "cuit" != '';

        RAISE NOTICE 'Index único suppliers_unique_cuit_company creado';
    END IF;
END $$;

-- =====================================================
-- 3. IDEMPOTENCY KEYS TABLE
-- Para prevenir operaciones duplicadas por retry
-- =====================================================
CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
    "id" SERIAL PRIMARY KEY,
    "key" VARCHAR(255) NOT NULL,
    "companyId" INT NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" INT,
    "requestHash" VARCHAR(64),
    "response" JSONB,
    "status" VARCHAR(20) DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "expiresAt" TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
    CONSTRAINT "IdempotencyKey_unique" UNIQUE ("companyId", "key")
);

CREATE INDEX IF NOT EXISTS "idx_idempotency_key_lookup"
ON "IdempotencyKey" ("companyId", "key", "operation");

CREATE INDEX IF NOT EXISTS "idx_idempotency_key_expires"
ON "IdempotencyKey" ("expiresAt");

-- =====================================================
-- 4. STATE TRANSITION LOG
-- Registro inmutable de transiciones de estado
-- =====================================================
CREATE TABLE IF NOT EXISTS "StateTransitionLog" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INT NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" INT NOT NULL,
    "fromState" VARCHAR(50),
    "toState" VARCHAR(50) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "userId" INT NOT NULL,
    "reasonCode" VARCHAR(100),
    "reasonText" TEXT,
    "metadata" JSONB,
    "sodCheckResult" JSONB,
    "eligibilityCheckResult" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
    -- Hash para integridad (prevState + transition + timestamp)
    "integrityHash" VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS "idx_state_transition_entity"
ON "StateTransitionLog" ("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "idx_state_transition_company"
ON "StateTransitionLog" ("companyId", "createdAt");

CREATE INDEX IF NOT EXISTS "idx_state_transition_user"
ON "StateTransitionLog" ("userId", "createdAt");

-- =====================================================
-- 5. APPROVAL MATRIX TABLE
-- Matriz de aprobaciones para doble aprobación configurable
-- =====================================================
CREATE TABLE IF NOT EXISTS "ApprovalMatrix" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INT NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "condition" VARCHAR(255),
    "minApprovers" INT DEFAULT 1,
    "requiredRoles" TEXT[],
    "excludedRoles" TEXT[],
    "amountThreshold" DECIMAL(15,2),
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "ApprovalMatrix_unique" UNIQUE ("companyId", "entityType", "action", "condition")
);

-- Insert default approval rules
INSERT INTO "ApprovalMatrix" ("companyId", "entityType", "action", "condition", "minApprovers", "amountThreshold")
SELECT c.id, 'PaymentOrder', 'APPROVE', 'AMOUNT_THRESHOLD', 2, 500000
FROM "Company" c
WHERE NOT EXISTS (
    SELECT 1 FROM "ApprovalMatrix" am
    WHERE am."companyId" = c.id
    AND am."entityType" = 'PaymentOrder'
    AND am."action" = 'APPROVE'
);

INSERT INTO "ApprovalMatrix" ("companyId", "entityType", "action", "condition", "minApprovers")
SELECT c.id, 'SupplierChangeRequest', 'APPROVE_CBU', 'ALWAYS', 2
FROM "Company" c
WHERE NOT EXISTS (
    SELECT 1 FROM "ApprovalMatrix" am
    WHERE am."companyId" = c.id
    AND am."entityType" = 'SupplierChangeRequest'
);

-- =====================================================
-- 6. SOD MATRIX TABLE
-- Matriz de segregación de funciones configurable
-- =====================================================
CREATE TABLE IF NOT EXISTS "SoDMatrix" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INT NOT NULL,
    "ruleCode" VARCHAR(100) NOT NULL,
    "action1" VARCHAR(100) NOT NULL,
    "action2" VARCHAR(100) NOT NULL,
    "scope" VARCHAR(50) DEFAULT 'SAME_DOCUMENT',
    "severity" VARCHAR(20) DEFAULT 'BLOCKING',
    "isEnabled" BOOLEAN DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "SoDMatrix_unique" UNIQUE ("companyId", "ruleCode")
);

-- Insert default SoD rules for all companies
INSERT INTO "SoDMatrix" ("companyId", "ruleCode", "action1", "action2", "scope", "severity", "description")
SELECT c.id, 'SOD_PEDIDO_APROBAR', 'CREAR_PEDIDO', 'APROBAR_PEDIDO', 'SAME_DOCUMENT', 'BLOCKING', 'Creador del pedido no puede aprobarlo'
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "SoDMatrix" WHERE "companyId" = c.id AND "ruleCode" = 'SOD_PEDIDO_APROBAR');

INSERT INTO "SoDMatrix" ("companyId", "ruleCode", "action1", "action2", "scope", "severity", "description")
SELECT c.id, 'SOD_OC_RECEPCION', 'APROBAR_OC', 'CONFIRMAR_RECEPCION', 'SAME_DOCUMENT', 'BLOCKING', 'Aprobador de OC no puede confirmar recepción'
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "SoDMatrix" WHERE "companyId" = c.id AND "ruleCode" = 'SOD_OC_RECEPCION');

INSERT INTO "SoDMatrix" ("companyId", "ruleCode", "action1", "action2", "scope", "severity", "description")
SELECT c.id, 'SOD_OC_PAGO', 'APROBAR_OC', 'CREAR_OP', 'SAME_SUPPLIER', 'BLOCKING', 'Aprobador de OC no puede crear orden de pago'
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "SoDMatrix" WHERE "companyId" = c.id AND "ruleCode" = 'SOD_OC_PAGO');

INSERT INTO "SoDMatrix" ("companyId", "ruleCode", "action1", "action2", "scope", "severity", "description")
SELECT c.id, 'SOD_PAGO_APROBAR', 'CREAR_OP', 'APROBAR_OP', 'SAME_DOCUMENT', 'BLOCKING', 'Creador de pago no puede aprobarlo'
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "SoDMatrix" WHERE "companyId" = c.id AND "ruleCode" = 'SOD_PAGO_APROBAR');

INSERT INTO "SoDMatrix" ("companyId", "ruleCode", "action1", "action2", "scope", "severity", "description")
SELECT c.id, 'SOD_PROVEEDOR_CBU', 'CREAR_PROVEEDOR', 'APROBAR_CAMBIO_CBU', 'SAME_SUPPLIER', 'BLOCKING', 'Creador de proveedor no puede aprobar cambio de CBU'
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "SoDMatrix" WHERE "companyId" = c.id AND "ruleCode" = 'SOD_PROVEEDOR_CBU');

INSERT INTO "SoDMatrix" ("companyId", "ruleCode", "action1", "action2", "scope", "severity", "description")
SELECT c.id, 'SOD_FACTURA_PAGO', 'REGISTRAR_FACTURA', 'APROBAR_OP', 'SAME_DOCUMENT', 'BLOCKING', 'Quien registra factura no puede aprobar su pago'
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "SoDMatrix" WHERE "companyId" = c.id AND "ruleCode" = 'SOD_FACTURA_PAGO');

-- =====================================================
-- 7. NOTIFICATION OUTBOX
-- Cola de notificaciones para procesamiento asíncrono
-- =====================================================
CREATE TABLE IF NOT EXISTS "NotificationOutbox" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INT NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "priority" VARCHAR(20) DEFAULT 'NORMAL',
    "entityType" VARCHAR(100),
    "entityId" INT,
    "recipientUserId" INT,
    "recipientEmail" VARCHAR(255),
    "recipientRole" VARCHAR(100),
    "subject" VARCHAR(500),
    "body" TEXT,
    "metadata" JSONB,
    "status" VARCHAR(20) DEFAULT 'PENDING',
    "attempts" INT DEFAULT 0,
    "lastAttemptAt" TIMESTAMP,
    "sentAt" TIMESTAMP,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "expiresAt" TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS "idx_notification_outbox_pending"
ON "NotificationOutbox" ("status", "priority", "createdAt")
WHERE "status" = 'PENDING';

CREATE INDEX IF NOT EXISTS "idx_notification_outbox_company"
ON "NotificationOutbox" ("companyId", "createdAt");

-- =====================================================
-- 8. INDEXES PARA CONTROL TOWER PERFORMANCE
-- Solo crear si las tablas existen
-- =====================================================

-- GRNI Accruals indexes (si existe la tabla)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'grni_accruals') THEN
        CREATE INDEX IF NOT EXISTS "idx_grni_accruals_pending_aging"
        ON "grni_accruals" ("companyId", "estado", "createdAt")
        WHERE "estado" = 'PENDIENTE';

        CREATE INDEX IF NOT EXISTS "idx_grni_accruals_supplier"
        ON "grni_accruals" ("supplierId", "estado", "montoEstimado");
    ELSE
        RAISE NOTICE 'Tabla grni_accruals no existe, saltando índices';
    END IF;
END $$;

-- Match Exception indexes (si existe la tabla)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MatchException') THEN
        CREATE INDEX IF NOT EXISTS "idx_match_exception_open"
        ON "MatchException" ("resuelta", "tipo", "createdAt")
        WHERE "resuelta" = false;
    ELSE
        RAISE NOTICE 'Tabla MatchException no existe, saltando índices';
    END IF;
END $$;

-- PaymentOrder indexes (si existe la tabla)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PaymentOrder') THEN
        CREATE INDEX IF NOT EXISTS "idx_payment_order_pending"
        ON "PaymentOrder" ("companyId", "estado", "fechaPago")
        WHERE "estado" IN ('PENDIENTE', 'PENDIENTE_APROBACION');
    ELSE
        RAISE NOTICE 'Tabla PaymentOrder no existe, saltando índices';
    END IF;
END $$;

-- PurchaseOrder indexes (si existe la tabla)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PurchaseOrder') THEN
        CREATE INDEX IF NOT EXISTS "idx_purchase_order_pending_delivery"
        ON "PurchaseOrder" ("companyId", "estado", "fechaEntregaEstimada")
        WHERE "estado" IN ('ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA');
    ELSE
        RAISE NOTICE 'Tabla PurchaseOrder no existe, saltando índices';
    END IF;
END $$;

-- =====================================================
-- 9. CONSTRAINT: PaymentOrder approvers must be different
-- =====================================================
DO $$
BEGIN
    -- Solo si la tabla existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PaymentOrder') THEN
        RAISE NOTICE 'Tabla PaymentOrder no existe, saltando constraint de aprobadores';
        RETURN;
    END IF;

    -- Verificar que las columnas existen
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'PaymentOrder' AND column_name = 'aprobadoPor'
    ) THEN
        RAISE NOTICE 'Columna aprobadoPor no existe, saltando constraint';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'PaymentOrder' AND column_name = 'aprobadoPor2'
    ) THEN
        RAISE NOTICE 'Columna aprobadoPor2 no existe, saltando constraint';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'PaymentOrder_different_approvers'
    ) THEN
        ALTER TABLE "PaymentOrder"
        ADD CONSTRAINT "PaymentOrder_different_approvers"
        CHECK (
            "aprobadoPor" IS NULL
            OR "aprobadoPor2" IS NULL
            OR "aprobadoPor" != "aprobadoPor2"
        );
        RAISE NOTICE 'Constraint PaymentOrder_different_approvers creado';
    END IF;
END $$;

-- =====================================================
-- 10. AUDIT LOG IMPROVEMENTS (solo si la tabla existe)
-- =====================================================
DO $$
BEGIN
    -- Verificar si la tabla existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PurchaseAuditLog') THEN
        -- Add reasonCode column if not exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'PurchaseAuditLog' AND column_name = 'reasonCode'
        ) THEN
            ALTER TABLE "PurchaseAuditLog" ADD COLUMN "reasonCode" VARCHAR(100);
        END IF;

        -- Add integrityHash column for audit chain
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'PurchaseAuditLog' AND column_name = 'integrityHash'
        ) THEN
            ALTER TABLE "PurchaseAuditLog" ADD COLUMN "integrityHash" VARCHAR(64);
        END IF;

        -- Add sodCheckResult column
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'PurchaseAuditLog' AND column_name = 'sodCheckResult'
        ) THEN
            ALTER TABLE "PurchaseAuditLog" ADD COLUMN "sodCheckResult" JSONB;
        END IF;

        RAISE NOTICE 'PurchaseAuditLog actualizado con columnas de hardening';
    ELSE
        RAISE NOTICE 'Tabla PurchaseAuditLog no existe, saltando mejoras';
    END IF;
END $$;

-- =====================================================
-- DONE
-- =====================================================
