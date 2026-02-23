-- ============================================================
-- Crear tabla credit_debit_notes y credit_debit_note_items
-- Faltaban en la BD causando 500 en DELETE /api/compras/comprobantes
-- ============================================================

-- 1. Tabla principal de notas de crédito/débito de proveedores
CREATE TABLE IF NOT EXISTS "credit_debit_notes" (
  "id"               SERIAL PRIMARY KEY,
  "tipo"             "CreditDebitNoteType" NOT NULL,
  "numero"           VARCHAR(50) NOT NULL,
  "numeroSerie"      VARCHAR(20) NOT NULL,
  "proveedorId"      INTEGER NOT NULL,
  "facturaId"        INTEGER,
  "goodsReceiptId"   INTEGER,
  "fechaEmision"     DATE NOT NULL,
  "motivo"           TEXT NOT NULL,
  "neto"             DECIMAL(15, 2) NOT NULL,
  "iva21"            DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "iva105"           DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "iva27"            DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "total"            DECIMAL(15, 2) NOT NULL,
  "estado"           "CreditDebitNoteStatus" NOT NULL DEFAULT 'BORRADOR',
  "aplicada"         BOOLEAN NOT NULL DEFAULT false,
  "aplicadaAt"       TIMESTAMP(3),
  "cae"              VARCHAR(20),
  "fechaVtoCae"      DATE,
  "notas"            TEXT,
  "tipoNca"          "CreditNoteType" NOT NULL DEFAULT 'NCA_OTRO',
  "requestId"        INTEGER,
  "purchaseReturnId" INTEGER,
  "docType"          "DocType" NOT NULL DEFAULT 'T1',
  "companyId"        INTEGER NOT NULL,
  "createdBy"        INTEGER NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_debit_notes_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id"),
  CONSTRAINT "credit_debit_notes_facturaId_fkey"
    FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL,
  CONSTRAINT "credit_debit_notes_goodsReceiptId_fkey"
    FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL,
  CONSTRAINT "credit_debit_notes_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "credit_debit_notes_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id"),
  CONSTRAINT "credit_debit_notes_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "credit_note_requests"("id") ON DELETE SET NULL,
  CONSTRAINT "credit_debit_notes_purchaseReturnId_fkey"
    FOREIGN KEY ("purchaseReturnId") REFERENCES "purchase_returns"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "credit_debit_notes_companyId_idx"
  ON "credit_debit_notes"("companyId");

CREATE INDEX IF NOT EXISTS "credit_debit_notes_proveedorId_idx"
  ON "credit_debit_notes"("proveedorId");

CREATE INDEX IF NOT EXISTS "credit_debit_notes_facturaId_idx"
  ON "credit_debit_notes"("facturaId");

CREATE INDEX IF NOT EXISTS "credit_debit_notes_tipo_idx"
  ON "credit_debit_notes"("tipo");

CREATE INDEX IF NOT EXISTS "credit_debit_notes_estado_idx"
  ON "credit_debit_notes"("estado");

CREATE INDEX IF NOT EXISTS "credit_debit_notes_docType_idx"
  ON "credit_debit_notes"("docType");

CREATE INDEX IF NOT EXISTS "credit_debit_notes_companyId_docType_idx"
  ON "credit_debit_notes"("companyId", "docType");

-- 2. Items de notas de crédito/débito
CREATE TABLE IF NOT EXISTS "credit_debit_note_items" (
  "id"             SERIAL PRIMARY KEY,
  "noteId"         INTEGER NOT NULL,
  "supplierItemId" INTEGER,
  "descripcion"    VARCHAR(255) NOT NULL,
  "cantidad"       DECIMAL(15, 4) NOT NULL,
  "unidad"         VARCHAR(50) NOT NULL,
  "precioUnitario" DECIMAL(15, 2) NOT NULL,
  "subtotal"       DECIMAL(15, 2) NOT NULL,

  CONSTRAINT "credit_debit_note_items_noteId_fkey"
    FOREIGN KEY ("noteId") REFERENCES "credit_debit_notes"("id") ON DELETE CASCADE,
  CONSTRAINT "credit_debit_note_items_supplierItemId_fkey"
    FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "credit_debit_note_items_noteId_idx"
  ON "credit_debit_note_items"("noteId");
