-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Mejoras Órdenes de Venta y Órdenes de Carga - 100% Maturity
-- Adds tables and fields for enhanced sales and logistics features
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. DETAILED AUDIT LOGS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "detailed_audit_logs" (
    "id" SERIAL PRIMARY KEY,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "userId" INTEGER NOT NULL REFERENCES "users"("id"),
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "changes" JSONB, -- Array of {field, oldValue, newValue, dataType}
    "reason" TEXT,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "detailed_audit_logs_entity_idx" ON "detailed_audit_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "detailed_audit_logs_company_idx" ON "detailed_audit_logs"("companyId");
CREATE INDEX IF NOT EXISTS "detailed_audit_logs_user_idx" ON "detailed_audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "detailed_audit_logs_timestamp_idx" ON "detailed_audit_logs"("timestamp" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. DELIVERY EVIDENCE (Photos, Signatures)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvidenceType') THEN
        CREATE TYPE "EvidenceType" AS ENUM ('FOTO', 'FIRMA_CHOFER', 'FIRMA_CLIENTE', 'DOCUMENTO', 'VIDEO');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS "delivery_evidence" (
    "id" SERIAL PRIMARY KEY,
    "loadOrderId" INTEGER REFERENCES "load_orders"("id") ON DELETE CASCADE,
    "deliveryId" INTEGER REFERENCES "sale_deliveries"("id") ON DELETE CASCADE,
    "tipo" "EvidenceType" NOT NULL,
    "url" TEXT NOT NULL, -- S3 URL or base64
    "descripcion" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "delivery_evidence_loadorder_idx" ON "delivery_evidence"("loadOrderId");
CREATE INDEX IF NOT EXISTS "delivery_evidence_delivery_idx" ON "delivery_evidence"("deliveryId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. GPS TRACKING LOGS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "delivery_gps_logs" (
    "id" SERIAL PRIMARY KEY,
    "loadOrderId" INTEGER REFERENCES "load_orders"("id") ON DELETE CASCADE,
    "deliveryId" INTEGER REFERENCES "sale_deliveries"("id") ON DELETE CASCADE,
    "latitud" DECIMAL(10, 8) NOT NULL,
    "longitud" DECIMAL(11, 8) NOT NULL,
    "velocidad" DECIMAL(5, 2), -- km/h
    "precision" DECIMAL(5, 2), -- meters
    "evento" VARCHAR(50), -- EN_RUTA, PARADA, ENTREGA_CONFIRMADA, etc.
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "delivery_gps_logs_loadorder_idx" ON "delivery_gps_logs"("loadOrderId", "timestamp");
CREATE INDEX IF NOT EXISTS "delivery_gps_logs_delivery_idx" ON "delivery_gps_logs"("deliveryId", "timestamp");
CREATE INDEX IF NOT EXISTS "delivery_gps_logs_timestamp_idx" ON "delivery_gps_logs"("timestamp" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. ADD NEW COLUMNS TO EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Load Orders: Add delivery confirmation fields
ALTER TABLE "load_orders"
    ADD COLUMN IF NOT EXISTS "receptorNombre" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "receptorDNI" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "receptorRelacion" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "latitudActual" DECIMAL(10, 8),
    ADD COLUMN IF NOT EXISTS "longitudActual" DECIMAL(11, 8);

-- Sales: Add duplicate tracking
ALTER TABLE "sales"
    ADD COLUMN IF NOT EXISTS "duplicadaDe" INTEGER REFERENCES "sales"("id"),
    ADD COLUMN IF NOT EXISTS "diasSinActividad" INTEGER GENERATED ALWAYS AS (
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - "updatedAt"))
    ) STORED;

-- Products: Add logistics info (if not exists)
ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "pesoUnitario" DECIMAL(15, 4),
    ADD COLUMN IF NOT EXISTS "volumenUnitario" DECIMAL(15, 4),
    ADD COLUMN IF NOT EXISTS "unidadPeso" VARCHAR(20) DEFAULT 'kg',
    ADD COLUMN IF NOT EXISTS "unidadVolumen" VARCHAR(20) DEFAULT 'm3';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. NOTIFICATION QUEUE (Optional - for scheduled notifications)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus') THEN
        CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel') THEN
        CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS "notification_queue" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "recipientName" VARCHAR(255),
    "recipientEmail" VARCHAR(255),
    "recipientPhone" VARCHAR(50),
    "channel" "NotificationChannel" NOT NULL,
    "subject" VARCHAR(500),
    "body" TEXT NOT NULL,
    "html" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "notification_queue_status_idx" ON "notification_queue"("status");
CREATE INDEX IF NOT EXISTS "notification_queue_scheduled_idx" ON "notification_queue"("scheduledFor") WHERE "status" = 'PENDING';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Sales indexes for advanced search
CREATE INDEX IF NOT EXISTS "sales_company_estado_idx" ON "sales"("companyId", "estado");
CREATE INDEX IF NOT EXISTS "sales_company_fecha_idx" ON "sales"("companyId", "fechaEmision" DESC);
CREATE INDEX IF NOT EXISTS "sales_company_total_idx" ON "sales"("companyId", "total" DESC);
CREATE INDEX IF NOT EXISTS "sales_client_fecha_idx" ON "sales"("clientId", "fechaEmision" DESC);
CREATE INDEX IF NOT EXISTS "sales_seller_fecha_idx" ON "sales"("sellerId", "fechaEmision" DESC);
CREATE INDEX IF NOT EXISTS "sales_updated_idx" ON "sales"("updatedAt");

-- Load Orders indexes
CREATE INDEX IF NOT EXISTS "load_orders_company_estado_idx" ON "load_orders"("companyId", "estado");
CREATE INDEX IF NOT EXISTS "load_orders_chofer_idx" ON "load_orders"("chofer") WHERE "chofer" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "load_orders_vehiculo_idx" ON "load_orders"("vehiculo") WHERE "vehiculo" IS NOT NULL;

-- Sale Items indexes for product search
CREATE INDEX IF NOT EXISTS "sale_items_product_idx" ON "sale_items"("productId");

-- Invoices indexes
CREATE INDEX IF NOT EXISTS "sales_invoices_vencimiento_idx" ON "sales_invoices"("fechaVencimiento")
    WHERE "saldoPendiente" > 0 AND "estado" IN ('EMITIDA', 'PARCIALMENTE_COBRADA');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. UPDATE COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE "detailed_audit_logs" IS 'Field-level audit trail with change tracking';
COMMENT ON TABLE "delivery_evidence" IS 'Photos, signatures, and documents for proof of delivery';
COMMENT ON TABLE "delivery_gps_logs" IS 'GPS tracking history for deliveries';
COMMENT ON TABLE "notification_queue" IS 'Queue for scheduled SMS/Email/WhatsApp notifications';

COMMIT;
