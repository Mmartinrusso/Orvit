-- =============================================
-- REFACTORIZACION FLUJO DE COMPRAS - V2
-- Stock solo por Recepcion, 3-Way Match por Linea,
-- Solicitudes NCA, Pronto Pago, Compras Rapidas
-- =============================================

-- =============================================
-- PARTE 1: NUEVOS ENUMS
-- =============================================

-- Enum: QuickPurchaseReason (motivos de compra rapida)
DO $$ BEGIN
    CREATE TYPE "QuickPurchaseReason" AS ENUM (
        'EMERGENCIA_PRODUCCION',
        'REPOSICION_URGENTE',
        'PROVEEDOR_UNICO',
        'COMPRA_MENOR',
        'OPORTUNIDAD_PRECIO',
        'OTRO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: RegularizationStatus (estado de regularizacion de compra rapida)
DO $$ BEGIN
    CREATE TYPE "RegularizationStatus" AS ENUM (
        'REG_PENDING',
        'REG_OK',
        'REG_NOT_REQUIRED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: FacturaMatchStatus (estado de match de factura)
DO $$ BEGIN
    CREATE TYPE "FacturaMatchStatus" AS ENUM (
        'MATCH_PENDING',
        'MATCH_OK',
        'MATCH_WARNING',
        'MATCH_BLOCKED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: PayApprovalStatus (estado de aprobacion de pago)
DO $$ BEGIN
    CREATE TYPE "PayApprovalStatus" AS ENUM (
        'PAY_PENDING',
        'PAY_APPROVED',
        'PAY_REJECTED',
        'PAY_BLOCKED_BY_MATCH'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: LineMatchStatus (estado de match por linea)
DO $$ BEGIN
    CREATE TYPE "LineMatchStatus" AS ENUM (
        'LINE_OK',
        'LINE_WARNING',
        'LINE_BLOCKED',
        'LINE_MISSING_RECEIPT',
        'LINE_MISSING_INVOICE',
        'LINE_EXTRA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: CreditNoteRequestStatus (estado de solicitud de NCA)
DO $$ BEGIN
    CREATE TYPE "CreditNoteRequestStatus" AS ENUM (
        'SNCA_NUEVA',
        'SNCA_ENVIADA',
        'SNCA_EN_REVISION',
        'SNCA_APROBADA',
        'SNCA_PARCIAL',
        'SNCA_RECHAZADA',
        'SNCA_NCA_RECIBIDA',
        'SNCA_APLICADA',
        'SNCA_CERRADA',
        'SNCA_CANCELADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: CreditNoteRequestType (tipo de solicitud de NCA)
DO $$ BEGIN
    CREATE TYPE "CreditNoteRequestType" AS ENUM (
        'SNCA_FALTANTE',
        'SNCA_DEVOLUCION',
        'SNCA_PRECIO',
        'SNCA_DESCUENTO',
        'SNCA_CALIDAD',
        'SNCA_OTRO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: CreditNoteType (tipo de NCA recibida)
DO $$ BEGIN
    CREATE TYPE "CreditNoteType" AS ENUM (
        'NCA_FALTANTE',
        'NCA_DEVOLUCION',
        'NCA_PRECIO',
        'NCA_DESCUENTO',
        'NCA_CALIDAD',
        'NCA_OTRO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- PARTE 2: MODIFICAR goods_receipts (Compras Rapidas)
-- =============================================

ALTER TABLE "goods_receipts"
ADD COLUMN IF NOT EXISTS "isQuickPurchase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "quickPurchaseReason" "QuickPurchaseReason",
ADD COLUMN IF NOT EXISTS "quickPurchaseJustification" TEXT,
ADD COLUMN IF NOT EXISTS "regularizationStatus" "RegularizationStatus",
ADD COLUMN IF NOT EXISTS "regularizedBy" INTEGER,
ADD COLUMN IF NOT EXISTS "regularizationNotes" TEXT;

-- Indices para goods_receipts
CREATE INDEX IF NOT EXISTS "goods_receipts_isQuickPurchase_idx" ON "goods_receipts"("isQuickPurchase");
CREATE INDEX IF NOT EXISTS "goods_receipts_regularizationStatus_idx" ON "goods_receipts"("regularizationStatus");
CREATE INDEX IF NOT EXISTS "goods_receipts_companyId_isQuickPurchase_idx" ON "goods_receipts"("companyId", "isQuickPurchase");

-- FK para regularizedBy
ALTER TABLE "goods_receipts"
DROP CONSTRAINT IF EXISTS "goods_receipts_regularizedBy_fkey";
ALTER TABLE "goods_receipts"
ADD CONSTRAINT "goods_receipts_regularizedBy_fkey"
FOREIGN KEY ("regularizedBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- PARTE 3: MODIFICAR PurchaseReceipt (Match, Validation, Pronto Pago)
-- =============================================

-- 3-Way Match por linea
ALTER TABLE "PurchaseReceipt"
ADD COLUMN IF NOT EXISTS "matchStatus" "FacturaMatchStatus" NOT NULL DEFAULT 'MATCH_PENDING',
ADD COLUMN IF NOT EXISTS "matchCheckedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "matchBlockReason" TEXT;

-- Validacion de Factura (distinto de aprobacion de pago)
ALTER TABLE "PurchaseReceipt"
ADD COLUMN IF NOT EXISTS "facturaValidada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "validadaPor" INTEGER,
ADD COLUMN IF NOT EXISTS "validadaAt" TIMESTAMP(3);

-- Aprobacion de Pago
ALTER TABLE "PurchaseReceipt"
ADD COLUMN IF NOT EXISTS "payApprovalStatus" "PayApprovalStatus" NOT NULL DEFAULT 'PAY_PENDING',
ADD COLUMN IF NOT EXISTS "payApprovedBy" INTEGER,
ADD COLUMN IF NOT EXISTS "payApprovedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "payRejectedReason" TEXT;

-- Pronto Pago
ALTER TABLE "PurchaseReceipt"
ADD COLUMN IF NOT EXISTS "prontoPagoDisponible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "prontoPagoFechaLimite" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "prontoPagoPorcentaje" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "prontoPagoMonto" DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS "prontoPagoAplicado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "prontoPagoAplicadoAt" TIMESTAMP(3);

-- Control de duplicados
ALTER TABLE "PurchaseReceipt"
ADD COLUMN IF NOT EXISTS "requiereRevisionDuplicado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "motivoBloqueo" TEXT;

-- Indices para PurchaseReceipt
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_matchStatus_idx" ON "PurchaseReceipt"("matchStatus");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_payApprovalStatus_idx" ON "PurchaseReceipt"("payApprovalStatus");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_facturaValidada_idx" ON "PurchaseReceipt"("facturaValidada");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_prontoPagoDisponible_idx" ON "PurchaseReceipt"("prontoPagoDisponible");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_companyId_matchStatus_idx" ON "PurchaseReceipt"("companyId", "matchStatus");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_companyId_payApprovalStatus_idx" ON "PurchaseReceipt"("companyId", "payApprovalStatus");

-- FKs para PurchaseReceipt
ALTER TABLE "PurchaseReceipt"
DROP CONSTRAINT IF EXISTS "PurchaseReceipt_validadaPor_fkey";
ALTER TABLE "PurchaseReceipt"
ADD CONSTRAINT "PurchaseReceipt_validadaPor_fkey"
FOREIGN KEY ("validadaPor") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseReceipt"
DROP CONSTRAINT IF EXISTS "PurchaseReceipt_payApprovedBy_fkey";
ALTER TABLE "PurchaseReceipt"
ADD CONSTRAINT "PurchaseReceipt_payApprovedBy_fkey"
FOREIGN KEY ("payApprovedBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- PARTE 4: MODIFICAR suppliers (Pronto Pago)
-- =============================================

ALTER TABLE "suppliers"
ADD COLUMN IF NOT EXISTS "prontoPagoDias" INTEGER,
ADD COLUMN IF NOT EXISTS "prontoPagoPorcentaje" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "prontoPagoAplicaSobre" VARCHAR(20);

-- =============================================
-- PARTE 5: MODIFICAR purchase_configs (Tolerancias y Compras Rapidas)
-- =============================================

ALTER TABLE "purchase_configs"
ADD COLUMN IF NOT EXISTS "toleranciaTotal" DECIMAL(5,2) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "permitirExceso" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "bloquearPagoConWarning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "quickPurchaseEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "quickPurchaseMaxAmount" DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS "quickPurchaseRequiresApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "quickPurchaseAllowedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "quickPurchaseAlertThreshold" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS "quickPurchaseRequireJustification" BOOLEAN NOT NULL DEFAULT true;

-- =============================================
-- PARTE 6: MODIFICAR credit_debit_notes (Vincular NCA a solicitud y devolucion)
-- =============================================

ALTER TABLE "credit_debit_notes"
ADD COLUMN IF NOT EXISTS "tipoNca" "CreditNoteType" NOT NULL DEFAULT 'NCA_OTRO',
ADD COLUMN IF NOT EXISTS "requestId" INTEGER,
ADD COLUMN IF NOT EXISTS "purchaseReturnId" INTEGER;

CREATE INDEX IF NOT EXISTS "credit_debit_notes_tipoNca_idx" ON "credit_debit_notes"("tipoNca");
CREATE INDEX IF NOT EXISTS "credit_debit_notes_requestId_idx" ON "credit_debit_notes"("requestId");
CREATE INDEX IF NOT EXISTS "credit_debit_notes_purchaseReturnId_idx" ON "credit_debit_notes"("purchaseReturnId");

-- =============================================
-- PARTE 7: CREAR TABLA CreditNoteRequest (Solicitudes de NCA)
-- =============================================

CREATE TABLE IF NOT EXISTS "credit_note_requests" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "estado" "CreditNoteRequestStatus" NOT NULL DEFAULT 'SNCA_NUEVA',
    "tipo" "CreditNoteRequestType" NOT NULL,

    -- Vinculaciones
    "facturaId" INTEGER,
    "goodsReceiptId" INTEGER,

    -- Montos
    "montoSolicitado" DECIMAL(15,2) NOT NULL,
    "montoAprobado" DECIMAL(15,2),

    -- Descripcion
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,

    -- Evidencia
    "evidencias" TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Fechas
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEnvio" TIMESTAMP(3),
    "fechaRespuesta" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),

    -- Respuesta proveedor
    "respuestaProveedor" TEXT,

    -- Tipo de documento
    "docType" "DocType" NOT NULL DEFAULT 'T1',

    -- Tracking
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_note_requests_companyId_numero_key" UNIQUE ("companyId", "numero")
);

-- Indices para credit_note_requests
CREATE INDEX IF NOT EXISTS "credit_note_requests_companyId_idx" ON "credit_note_requests"("companyId");
CREATE INDEX IF NOT EXISTS "credit_note_requests_estado_idx" ON "credit_note_requests"("estado");
CREATE INDEX IF NOT EXISTS "credit_note_requests_proveedorId_idx" ON "credit_note_requests"("proveedorId");
CREATE INDEX IF NOT EXISTS "credit_note_requests_facturaId_idx" ON "credit_note_requests"("facturaId");
CREATE INDEX IF NOT EXISTS "credit_note_requests_goodsReceiptId_idx" ON "credit_note_requests"("goodsReceiptId");
CREATE INDEX IF NOT EXISTS "credit_note_requests_tipo_idx" ON "credit_note_requests"("tipo");
CREATE INDEX IF NOT EXISTS "credit_note_requests_companyId_estado_idx" ON "credit_note_requests"("companyId", "estado");

-- FKs para credit_note_requests
ALTER TABLE "credit_note_requests"
DROP CONSTRAINT IF EXISTS "credit_note_requests_proveedorId_fkey";
ALTER TABLE "credit_note_requests"
ADD CONSTRAINT "credit_note_requests_proveedorId_fkey"
FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_note_requests"
DROP CONSTRAINT IF EXISTS "credit_note_requests_facturaId_fkey";
ALTER TABLE "credit_note_requests"
ADD CONSTRAINT "credit_note_requests_facturaId_fkey"
FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "credit_note_requests"
DROP CONSTRAINT IF EXISTS "credit_note_requests_goodsReceiptId_fkey";
ALTER TABLE "credit_note_requests"
ADD CONSTRAINT "credit_note_requests_goodsReceiptId_fkey"
FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "credit_note_requests"
DROP CONSTRAINT IF EXISTS "credit_note_requests_companyId_fkey";
ALTER TABLE "credit_note_requests"
ADD CONSTRAINT "credit_note_requests_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_note_requests"
DROP CONSTRAINT IF EXISTS "credit_note_requests_createdBy_fkey";
ALTER TABLE "credit_note_requests"
ADD CONSTRAINT "credit_note_requests_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================
-- PARTE 8: CREAR TABLA CreditNoteRequestItem (Items de solicitud NCA)
-- =============================================

CREATE TABLE IF NOT EXISTS "credit_note_request_items" (
    "id" SERIAL PRIMARY KEY,
    "requestId" INTEGER NOT NULL,
    "supplierItemId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "cantidadFacturada" DECIMAL(15,4) NOT NULL,
    "cantidadSolicitada" DECIMAL(15,4) NOT NULL,
    "cantidadAprobada" DECIMAL(15,4),
    "unidad" VARCHAR(20) NOT NULL,
    "precioUnitario" DECIMAL(15,4) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "motivo" TEXT
);

-- Indices para credit_note_request_items
CREATE INDEX IF NOT EXISTS "credit_note_request_items_requestId_idx" ON "credit_note_request_items"("requestId");
CREATE INDEX IF NOT EXISTS "credit_note_request_items_supplierItemId_idx" ON "credit_note_request_items"("supplierItemId");

-- FKs para credit_note_request_items
ALTER TABLE "credit_note_request_items"
DROP CONSTRAINT IF EXISTS "credit_note_request_items_requestId_fkey";
ALTER TABLE "credit_note_request_items"
ADD CONSTRAINT "credit_note_request_items_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "credit_note_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_note_request_items"
DROP CONSTRAINT IF EXISTS "credit_note_request_items_supplierItemId_fkey";
ALTER TABLE "credit_note_request_items"
ADD CONSTRAINT "credit_note_request_items_supplierItemId_fkey"
FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- PARTE 9: CREAR TABLA MatchLineResult (Resultado de match por linea)
-- =============================================

CREATE TABLE IF NOT EXISTS "match_line_results" (
    "id" SERIAL PRIMARY KEY,
    "matchResultId" INTEGER NOT NULL,

    -- Identificacion del item
    "facturaItemId" INTEGER,
    "receiptItemId" INTEGER,
    "ocItemId" INTEGER,
    "supplierItemId" INTEGER,
    "descripcion" TEXT NOT NULL,

    -- Cantidades comparadas
    "qtyFacturada" DECIMAL(15,4) NOT NULL,
    "qtyRecibida" DECIMAL(15,4) NOT NULL,
    "qtyOC" DECIMAL(15,4),

    -- Precios comparados
    "precioFactura" DECIMAL(15,4),
    "precioRecibido" DECIMAL(15,4),
    "precioOC" DECIMAL(15,4),

    -- Resultado de esta linea
    "status" "LineMatchStatus" NOT NULL,
    "diffCantidad" DECIMAL(15,4),
    "diffPorcentaje" DECIMAL(5,2),
    "diffPrecio" DECIMAL(15,4),
    "razon" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices para match_line_results
CREATE INDEX IF NOT EXISTS "match_line_results_matchResultId_idx" ON "match_line_results"("matchResultId");
CREATE INDEX IF NOT EXISTS "match_line_results_status_idx" ON "match_line_results"("status");
CREATE INDEX IF NOT EXISTS "match_line_results_facturaItemId_idx" ON "match_line_results"("facturaItemId");
CREATE INDEX IF NOT EXISTS "match_line_results_receiptItemId_idx" ON "match_line_results"("receiptItemId");

-- FKs para match_line_results
ALTER TABLE "match_line_results"
DROP CONSTRAINT IF EXISTS "match_line_results_matchResultId_fkey";
ALTER TABLE "match_line_results"
ADD CONSTRAINT "match_line_results_matchResultId_fkey"
FOREIGN KEY ("matchResultId") REFERENCES "match_results"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_line_results"
DROP CONSTRAINT IF EXISTS "match_line_results_supplierItemId_fkey";
ALTER TABLE "match_line_results"
ADD CONSTRAINT "match_line_results_supplierItemId_fkey"
FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- PARTE 10: MODIFICAR purchase_returns (Vincular a solicitud NCA)
-- =============================================

ALTER TABLE "purchase_returns"
ADD COLUMN IF NOT EXISTS "creditNoteRequestId" INTEGER;

CREATE INDEX IF NOT EXISTS "purchase_returns_creditNoteRequestId_idx" ON "purchase_returns"("creditNoteRequestId");

-- FK para creditNoteRequestId en purchase_returns
-- Nota: Esta FK se crea despues de crear la tabla credit_note_requests
ALTER TABLE "purchase_returns"
DROP CONSTRAINT IF EXISTS "purchase_returns_creditNoteRequestId_fkey";
ALTER TABLE "purchase_returns"
ADD CONSTRAINT "purchase_returns_creditNoteRequestId_fkey"
FOREIGN KEY ("creditNoteRequestId") REFERENCES "credit_note_requests"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- FK para credit_debit_notes.requestId -> credit_note_requests
ALTER TABLE "credit_debit_notes"
DROP CONSTRAINT IF EXISTS "credit_debit_notes_requestId_fkey";
ALTER TABLE "credit_debit_notes"
ADD CONSTRAINT "credit_debit_notes_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "credit_note_requests"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- FK para credit_debit_notes.purchaseReturnId -> purchase_returns
ALTER TABLE "credit_debit_notes"
DROP CONSTRAINT IF EXISTS "credit_debit_notes_purchaseReturnId_fkey";
ALTER TABLE "credit_debit_notes"
ADD CONSTRAINT "credit_debit_notes_purchaseReturnId_fkey"
FOREIGN KEY ("purchaseReturnId") REFERENCES "purchase_returns"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- FIN - Migracion de Refactorizacion de Compras
-- =============================================
