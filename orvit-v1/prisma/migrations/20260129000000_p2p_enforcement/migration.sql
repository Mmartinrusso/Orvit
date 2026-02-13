-- P2P Enforcement Migration
-- Creates: GRNIAccrual, SupplierChangeRequest, PaymentOrder approval fields

-- =====================================================
-- 1. GRNIStatus Enum
-- =====================================================
DO $$ BEGIN
    CREATE TYPE "GRNIStatus" AS ENUM ('PENDIENTE', 'FACTURADO', 'REVERSADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. GRNI Accruals Table
-- =====================================================
CREATE TABLE IF NOT EXISTS "grni_accruals" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "goodsReceiptId" INTEGER NOT NULL,
    "goodsReceiptItemId" INTEGER,
    "supplierId" INTEGER NOT NULL,
    "descripcion" TEXT,
    "montoEstimado" DECIMAL(15,2) NOT NULL,
    "montoFacturado" DECIMAL(15,2),
    "varianza" DECIMAL(15,2),
    "estado" "GRNIStatus" NOT NULL DEFAULT 'PENDIENTE',
    "facturaId" INTEGER,
    "periodoCreacion" TEXT NOT NULL,
    "periodoFacturacion" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "docType" TEXT NOT NULL DEFAULT 'T1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "reversadoAt" TIMESTAMP(3),
    "reversadoBy" INTEGER,
    "motivoReversion" TEXT,

    CONSTRAINT "grni_accruals_pkey" PRIMARY KEY ("id")
);

-- Indexes for grni_accruals
CREATE INDEX IF NOT EXISTS "grni_accruals_companyId_estado_idx" ON "grni_accruals"("companyId", "estado");
CREATE INDEX IF NOT EXISTS "grni_accruals_supplierId_idx" ON "grni_accruals"("supplierId");
CREATE INDEX IF NOT EXISTS "grni_accruals_periodoCreacion_idx" ON "grni_accruals"("periodoCreacion");
CREATE INDEX IF NOT EXISTS "grni_accruals_goodsReceiptId_idx" ON "grni_accruals"("goodsReceiptId");

-- Foreign keys for grni_accruals
DO $$ BEGIN
    ALTER TABLE "grni_accruals" ADD CONSTRAINT "grni_accruals_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "grni_accruals" ADD CONSTRAINT "grni_accruals_goodsReceiptId_fkey"
    FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "grni_accruals" ADD CONSTRAINT "grni_accruals_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "grni_accruals" ADD CONSTRAINT "grni_accruals_facturaId_fkey"
    FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 3. Supplier Change Requests Table
-- =====================================================
CREATE TABLE IF NOT EXISTS "supplier_change_requests" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "datosAnteriores" JSONB NOT NULL,
    "datosNuevos" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_APROBACION',
    "solicitadoPor" INTEGER NOT NULL,
    "solicitadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "rechazadoPor" INTEGER,
    "rechazadoAt" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "segundoAprobadorId" INTEGER,
    "segundaAprobacionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_change_requests_pkey" PRIMARY KEY ("id")
);

-- Indexes for supplier_change_requests
CREATE INDEX IF NOT EXISTS "supplier_change_requests_supplierId_idx" ON "supplier_change_requests"("supplierId");
CREATE INDEX IF NOT EXISTS "supplier_change_requests_companyId_estado_idx" ON "supplier_change_requests"("companyId", "estado");

-- Foreign keys for supplier_change_requests
DO $$ BEGIN
    ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_solicitadoPor_fkey"
    FOREIGN KEY ("solicitadoPor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_aprobadoPor_fkey"
    FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_rechazadoPor_fkey"
    FOREIGN KEY ("rechazadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_segundoAprobadorId_fkey"
    FOREIGN KEY ("segundoAprobadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 4. PaymentOrder - Add approval columns
-- =====================================================
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "estado" TEXT DEFAULT 'EJECUTADO';
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "requiereDobleAprobacion" BOOLEAN DEFAULT false;
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "primeraAprobacionBy" INTEGER;
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "primeraAprobacionAt" TIMESTAMP(3);
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "segundaAprobacionBy" INTEGER;
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "segundaAprobacionAt" TIMESTAMP(3);
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "motivoRechazo" TEXT;

-- =====================================================
-- 5. PurchaseConfig - Add approval thresholds (if table exists)
-- =====================================================
DO $$ BEGIN
    ALTER TABLE "purchase_configs" ADD COLUMN IF NOT EXISTS "umbralDobleAprobacion" DECIMAL(15,2) DEFAULT 500000;
EXCEPTION
    WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_configs" ADD COLUMN IF NOT EXISTS "umbralAprobacionPedido" DECIMAL(15,2) DEFAULT 50000;
EXCEPTION
    WHEN undefined_table THEN null;
END $$;
