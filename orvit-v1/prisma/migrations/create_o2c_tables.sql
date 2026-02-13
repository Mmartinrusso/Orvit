-- ═══════════════════════════════════════════════════════════════════════════════
-- O2C TABLES CREATION SCRIPT
-- Creates all missing O2C tables to sync database with Prisma schema
-- Run this BEFORE prisma migrate deploy
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: CREATE ENUMS (IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    -- SalesInvoiceType
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SalesInvoiceType') THEN
        CREATE TYPE "SalesInvoiceType" AS ENUM ('FACTURA', 'FACTURA_EXPORTACION', 'NOTA_DEBITO', 'NOTA_CREDITO');
    END IF;

    -- SalesInvoiceStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SalesInvoiceStatus') THEN
        CREATE TYPE "SalesInvoiceStatus" AS ENUM ('BORRADOR', 'EMITIDA', 'PARCIALMENTE_COBRADA', 'COBRADA', 'ANULADA');
    END IF;

    -- AFIPStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AFIPStatus') THEN
        CREATE TYPE "AFIPStatus" AS ENUM ('PENDIENTE', 'AUTORIZADO', 'RECHAZADO', 'CONTINGENCIA');
    END IF;

    -- ClientMovementType
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientMovementType') THEN
        CREATE TYPE "ClientMovementType" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'PAGO', 'ANTICIPO', 'AJUSTE', 'SALDO_INICIAL');
    END IF;

    -- SalesCreditDebitType
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SalesCreditDebitType') THEN
        CREATE TYPE "SalesCreditDebitType" AS ENUM ('NOTA_CREDITO', 'NOTA_DEBITO');
    END IF;

    -- CreditDebitNoteStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CreditDebitNoteStatus') THEN
        CREATE TYPE "CreditDebitNoteStatus" AS ENUM ('BORRADOR', 'EMITIDA', 'APLICADA', 'ANULADA');
    END IF;

    -- TreasuryMovementType
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TreasuryMovementType') THEN
        CREATE TYPE "TreasuryMovementType" AS ENUM ('INGRESO', 'EGRESO', 'TRANSFERENCIA_INTERNA', 'AJUSTE');
    END IF;

    -- PaymentMedium
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMedium') THEN
        CREATE TYPE "PaymentMedium" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE_TERCERO', 'CHEQUE_PROPIO', 'ECHEQ', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'DEPOSITO', 'COMISION', 'INTERES', 'AJUSTE');
    END IF;

    -- TreasuryAccountType
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TreasuryAccountType') THEN
        CREATE TYPE "TreasuryAccountType" AS ENUM ('CASH', 'BANK', 'CHECK_PORTFOLIO');
    END IF;

    -- TreasuryMovementStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TreasuryMovementStatus') THEN
        CREATE TYPE "TreasuryMovementStatus" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'REVERSADO');
    END IF;

    -- LoadOrderStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoadOrderStatus') THEN
        CREATE TYPE "LoadOrderStatus" AS ENUM ('PENDIENTE', 'CARGANDO', 'CARGADA', 'DESPACHADA', 'CANCELADA');
    END IF;

    -- DepositStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DepositStatus') THEN
        CREATE TYPE "DepositStatus" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');
    END IF;

    -- CashClosingStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashClosingStatus') THEN
        CREATE TYPE "CashClosingStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'CON_DIFERENCIA_APROBADA', 'RECHAZADO');
    END IF;

    -- IdempotencyStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IdempotencyStatus') THEN
        CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
    END IF;

    -- ChequeOrigen
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChequeOrigen') THEN
        CREATE TYPE "ChequeOrigen" AS ENUM ('RECIBIDO', 'EMITIDO');
    END IF;

    -- ChequeTipo
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChequeTipo') THEN
        CREATE TYPE "ChequeTipo" AS ENUM ('FISICO', 'ECHEQ');
    END IF;

    -- ChequeEstado
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChequeEstado') THEN
        CREATE TYPE "ChequeEstado" AS ENUM ('CARTERA', 'DEPOSITADO', 'COBRADO', 'RECHAZADO', 'ENDOSADO', 'ANULADO');
    END IF;

    -- ReconciliationStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReconciliationStatus') THEN
        CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CON_DIFERENCIAS', 'CERRADA');
    END IF;

    -- MatchType
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MatchType') THEN
        CREATE TYPE "MatchType" AS ENUM ('EXACT', 'FUZZY', 'REFERENCE', 'MANUAL');
    END IF;

    -- PickupStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PickupStatus') THEN
        CREATE TYPE "PickupStatus" AS ENUM ('RESERVADO', 'EN_ESPERA', 'EN_CARGA', 'COMPLETADO', 'CANCELADO', 'NO_SHOW', 'CANCELADO_TARDE');
    END IF;

    -- CollectionActionType
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CollectionActionType') THEN
        CREATE TYPE "CollectionActionType" AS ENUM ('LLAMADA', 'EMAIL', 'CARTA', 'VISITA', 'WHATSAPP', 'PROMESA_PAGO', 'ACUERDO_PAGO', 'DERIVACION_LEGAL');
    END IF;

    -- CollectionActionStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CollectionActionStatus') THEN
        CREATE TYPE "CollectionActionStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'ESCALADA');
    END IF;

    -- DisputeType
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeType') THEN
        CREATE TYPE "DisputeType" AS ENUM ('FACTURACION_INCORRECTA', 'MERCADERIA_DANADA', 'MERCADERIA_FALTANTE', 'PRECIO_INCORRECTO', 'FLETE_INCORRECTO', 'DUPLICADO', 'NO_RECIBIDO', 'OTRO');
    END IF;

    -- DisputeStatus
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeStatus') THEN
        CREATE TYPE "DisputeStatus" AS ENUM ('ABIERTA', 'EN_INVESTIGACION', 'PENDIENTE_CLIENTE', 'PENDIENTE_INTERNO', 'RESUELTA', 'CERRADA');
    END IF;

END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: CREATE CORE O2C TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Document Sequences (for invoice/remito numbering)
CREATE TABLE IF NOT EXISTS "document_sequences" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "docType" VARCHAR(50) NOT NULL,
    "puntoVenta" VARCHAR(5),
    "prefix" VARCHAR(10) NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    UNIQUE("companyId", "docType", "puntoVenta")
);
CREATE INDEX IF NOT EXISTS "document_sequences_companyId_idx" ON "document_sequences"("companyId");

-- Client Block History
CREATE TABLE IF NOT EXISTS "client_block_history" (
    "id" SERIAL PRIMARY KEY,
    "clientId" TEXT NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "tipoBloqueo" VARCHAR(50) NOT NULL,
    "motivo" TEXT,
    "montoExcedido" DECIMAL(15,2),
    "facturaRef" VARCHAR(100),
    "diasMora" INTEGER,
    "bloqueadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloqueadoPor" INTEGER NOT NULL REFERENCES "users"("id"),
    "desbloqueadoAt" TIMESTAMP(3),
    "desbloqueadoPor" INTEGER REFERENCES "users"("id"),
    "motivoDesbloqueo" TEXT
);
CREATE INDEX IF NOT EXISTS "client_block_history_clientId_idx" ON "client_block_history"("clientId");
CREATE INDEX IF NOT EXISTS "client_block_history_companyId_idx" ON "client_block_history"("companyId");
CREATE INDEX IF NOT EXISTS "client_block_history_companyId_tipoBloqueo_idx" ON "client_block_history"("companyId", "tipoBloqueo");
CREATE INDEX IF NOT EXISTS "client_block_history_bloqueadoAt_idx" ON "client_block_history"("bloqueadoAt");

-- Idempotency Keys
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
    "id" SERIAL PRIMARY KEY,
    "key" VARCHAR(255) NOT NULL,
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "operation" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100),
    "entityId" INTEGER,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "response" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("companyId", "key")
);
CREATE INDEX IF NOT EXISTS "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");
CREATE INDEX IF NOT EXISTS "idempotency_keys_status_idx" ON "idempotency_keys"("status");

-- Cheques (Unified Check Portfolio)
CREATE TABLE IF NOT EXISTS "cheques" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "origen" "ChequeOrigen" NOT NULL,
    "tipo" "ChequeTipo" NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "banco" VARCHAR(100) NOT NULL,
    "sucursal" VARCHAR(50),
    "titular" VARCHAR(255) NOT NULL,
    "cuitTitular" VARCHAR(20),
    "importe" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "fechaEmision" DATE NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "fechaDeposito" DATE,
    "fechaCobro" DATE,
    "estado" "ChequeEstado" NOT NULL DEFAULT 'CARTERA',
    "clientPaymentId" INTEGER,
    "paymentOrderId" INTEGER,
    "bankAccountId" INTEGER,
    "depositoBankAccountId" INTEGER,
    "endosadoA" VARCHAR(255),
    "endosadoPaymentOrderId" INTEGER,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "motivoRechazo" TEXT,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "cheques_companyId_idx" ON "cheques"("companyId");
CREATE INDEX IF NOT EXISTS "cheques_estado_idx" ON "cheques"("estado");
CREATE INDEX IF NOT EXISTS "cheques_fechaVencimiento_idx" ON "cheques"("fechaVencimiento");
CREATE INDEX IF NOT EXISTS "cheques_origen_idx" ON "cheques"("origen");
CREATE INDEX IF NOT EXISTS "cheques_docType_idx" ON "cheques"("docType");

-- Sales Invoices
CREATE TABLE IF NOT EXISTS "sales_invoices" (
    "id" SERIAL PRIMARY KEY,
    "tipo" "SalesInvoiceType" NOT NULL,
    "letra" VARCHAR(1) NOT NULL,
    "puntoVenta" VARCHAR(5) NOT NULL,
    "numero" VARCHAR(8) NOT NULL,
    "numeroCompleto" VARCHAR(20) NOT NULL,
    "clientId" TEXT NOT NULL REFERENCES "clients"("id"),
    "saleId" INTEGER REFERENCES "sales"("id"),
    "estado" "SalesInvoiceStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "fechaServicioDesde" DATE,
    "fechaServicioHasta" DATE,
    "netoGravado" DECIMAL(15,2) NOT NULL,
    "netoNoGravado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "exento" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva21" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "percepcionIVA" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "percepcionIIBB" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otrosImpuestos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "tipoCambio" DECIMAL(15,4),
    "totalCobrado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldoPendiente" DECIMAL(15,2) NOT NULL,
    "cae" VARCHAR(20),
    "fechaVtoCae" DATE,
    "estadoAFIP" "AFIPStatus",
    "condicionesPago" VARCHAR(255),
    "notas" TEXT,
    "notasInternas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("companyId", "tipo", "puntoVenta", "numero")
);
CREATE INDEX IF NOT EXISTS "sales_invoices_companyId_idx" ON "sales_invoices"("companyId");
CREATE INDEX IF NOT EXISTS "sales_invoices_clientId_idx" ON "sales_invoices"("clientId");
CREATE INDEX IF NOT EXISTS "sales_invoices_saleId_idx" ON "sales_invoices"("saleId");
CREATE INDEX IF NOT EXISTS "sales_invoices_estado_idx" ON "sales_invoices"("estado");
CREATE INDEX IF NOT EXISTS "sales_invoices_fechaEmision_idx" ON "sales_invoices"("fechaEmision");
CREATE INDEX IF NOT EXISTS "sales_invoices_fechaVencimiento_idx" ON "sales_invoices"("fechaVencimiento");
CREATE INDEX IF NOT EXISTS "sales_invoices_cae_idx" ON "sales_invoices"("cae");
CREATE INDEX IF NOT EXISTS "sales_invoices_docType_idx" ON "sales_invoices"("docType");
CREATE INDEX IF NOT EXISTS "sales_invoices_companyId_docType_idx" ON "sales_invoices"("companyId", "docType");
CREATE INDEX IF NOT EXISTS "sales_invoices_companyId_docType_fechaEmision_idx" ON "sales_invoices"("companyId", "docType", "fechaEmision");

-- Sales Invoice Items
CREATE TABLE IF NOT EXISTS "sales_invoice_items" (
    "id" SERIAL PRIMARY KEY,
    "invoiceId" INTEGER NOT NULL REFERENCES "sales_invoices"("id") ON DELETE CASCADE,
    "saleItemId" INTEGER,
    "productId" TEXT,
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "alicuotaIVA" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "subtotal" DECIMAL(15,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS "sales_invoice_items_invoiceId_idx" ON "sales_invoice_items"("invoiceId");
CREATE INDEX IF NOT EXISTS "sales_invoice_items_saleItemId_idx" ON "sales_invoice_items"("saleItemId");

-- Sales Credit/Debit Notes
CREATE TABLE IF NOT EXISTS "sales_credit_debit_notes" (
    "id" SERIAL PRIMARY KEY,
    "tipo" "SalesCreditDebitType" NOT NULL,
    "letra" VARCHAR(1) NOT NULL,
    "puntoVenta" VARCHAR(5) NOT NULL,
    "numero" VARCHAR(8) NOT NULL,
    "numeroCompleto" VARCHAR(20) NOT NULL,
    "clientId" TEXT NOT NULL REFERENCES "clients"("id"),
    "facturaId" INTEGER REFERENCES "sales_invoices"("id"),
    "estado" "CreditDebitNoteStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "netoGravado" DECIMAL(15,2) NOT NULL,
    "iva21" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "cae" VARCHAR(20),
    "fechaVtoCae" DATE,
    "aplicada" BOOLEAN NOT NULL DEFAULT FALSE,
    "aplicadaAt" TIMESTAMP(3),
    "notas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("companyId", "tipo", "puntoVenta", "numero")
);
CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_companyId_idx" ON "sales_credit_debit_notes"("companyId");
CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_clientId_idx" ON "sales_credit_debit_notes"("clientId");
CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_facturaId_idx" ON "sales_credit_debit_notes"("facturaId");
CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_estado_idx" ON "sales_credit_debit_notes"("estado");
CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_docType_idx" ON "sales_credit_debit_notes"("docType");

-- Sales Credit/Debit Note Items
CREATE TABLE IF NOT EXISTS "sales_credit_debit_note_items" (
    "id" SERIAL PRIMARY KEY,
    "noteId" INTEGER NOT NULL REFERENCES "sales_credit_debit_notes"("id") ON DELETE CASCADE,
    "invoiceItemId" INTEGER,
    "productId" TEXT,
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "alicuotaIVA" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "subtotal" DECIMAL(15,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS "sales_credit_debit_note_items_noteId_idx" ON "sales_credit_debit_note_items"("noteId");

-- Client Ledger Entries (AR Ledger - Source of Truth)
CREATE TABLE IF NOT EXISTS "client_ledger_entries" (
    "id" SERIAL PRIMARY KEY,
    "clientId" TEXT NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "tipo" "ClientMovementType" NOT NULL,
    "facturaId" INTEGER REFERENCES "sales_invoices"("id"),
    "notaCreditoDebitoId" INTEGER REFERENCES "sales_credit_debit_notes"("id"),
    "pagoId" INTEGER,
    "fecha" DATE NOT NULL,
    "fechaVencimiento" DATE,
    "debe" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "comprobante" VARCHAR(100),
    "descripcion" TEXT,
    "anulado" BOOLEAN NOT NULL DEFAULT FALSE,
    "anuladoPor" INTEGER,
    "anuladoAt" TIMESTAMP(3),
    "conciliado" BOOLEAN NOT NULL DEFAULT FALSE,
    "conciliadoAt" TIMESTAMP(3),
    "conciliadoBy" INTEGER,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "client_ledger_entries_clientId_idx" ON "client_ledger_entries"("clientId");
CREATE INDEX IF NOT EXISTS "client_ledger_entries_companyId_idx" ON "client_ledger_entries"("companyId");
CREATE INDEX IF NOT EXISTS "client_ledger_entries_fecha_idx" ON "client_ledger_entries"("fecha");
CREATE INDEX IF NOT EXISTS "client_ledger_entries_tipo_idx" ON "client_ledger_entries"("tipo");
CREATE INDEX IF NOT EXISTS "client_ledger_entries_anulado_idx" ON "client_ledger_entries"("anulado");

-- Treasury Movements (Unified Treasury Ledger)
CREATE TABLE IF NOT EXISTS "treasury_movements" (
    "id" SERIAL PRIMARY KEY,
    "fecha" DATE NOT NULL,
    "fechaValor" DATE,
    "tipo" "TreasuryMovementType" NOT NULL,
    "medio" "PaymentMedium" NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "accountType" "TreasuryAccountType" NOT NULL,
    "cashAccountId" INTEGER REFERENCES "cash_accounts"("id"),
    "bankAccountId" INTEGER REFERENCES "bank_accounts"("id"),
    "referenceType" VARCHAR(50),
    "referenceId" INTEGER,
    "chequeId" INTEGER REFERENCES "cheques"("id"),
    "descripcion" TEXT,
    "numeroComprobante" VARCHAR(100),
    "conciliado" BOOLEAN NOT NULL DEFAULT FALSE,
    "conciliadoAt" TIMESTAMP(3),
    "conciliadoBy" INTEGER,
    "estado" "TreasuryMovementStatus" NOT NULL DEFAULT 'CONFIRMADO',
    "reversaDeId" INTEGER UNIQUE,
    "reversadoPorId" INTEGER,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprobanteUrl" TEXT
);
CREATE INDEX IF NOT EXISTS "treasury_movements_companyId_idx" ON "treasury_movements"("companyId");
CREATE INDEX IF NOT EXISTS "treasury_movements_companyId_docType_idx" ON "treasury_movements"("companyId", "docType");
CREATE INDEX IF NOT EXISTS "treasury_movements_fecha_idx" ON "treasury_movements"("fecha");
CREATE INDEX IF NOT EXISTS "treasury_movements_companyId_fecha_idx" ON "treasury_movements"("companyId", "fecha");
CREATE INDEX IF NOT EXISTS "treasury_movements_accountType_cashAccountId_idx" ON "treasury_movements"("accountType", "cashAccountId");
CREATE INDEX IF NOT EXISTS "treasury_movements_accountType_bankAccountId_idx" ON "treasury_movements"("accountType", "bankAccountId");
CREATE INDEX IF NOT EXISTS "treasury_movements_conciliado_idx" ON "treasury_movements"("conciliado");
CREATE INDEX IF NOT EXISTS "treasury_movements_referenceType_referenceId_idx" ON "treasury_movements"("referenceType", "referenceId");

-- Add self-reference for reversa
ALTER TABLE "treasury_movements" ADD CONSTRAINT "treasury_movements_reversaDeId_fkey"
    FOREIGN KEY ("reversaDeId") REFERENCES "treasury_movements"("id");

-- Load Orders
CREATE TABLE IF NOT EXISTS "load_orders" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "LoadOrderStatus" NOT NULL DEFAULT 'PENDIENTE',
    "saleId" INTEGER NOT NULL REFERENCES "sales"("id"),
    "deliveryId" INTEGER UNIQUE,
    "vehiculo" VARCHAR(100),
    "vehiculoPatente" VARCHAR(20),
    "chofer" VARCHAR(255),
    "choferDNI" VARCHAR(20),
    "pesoTotal" DECIMAL(15,4),
    "volumenTotal" DECIMAL(15,4),
    "observaciones" TEXT,
    "confirmadoAt" TIMESTAMP(3),
    "confirmadoPor" INTEGER,
    "firmaOperario" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("companyId", "numero")
);
CREATE INDEX IF NOT EXISTS "load_orders_companyId_idx" ON "load_orders"("companyId");
CREATE INDEX IF NOT EXISTS "load_orders_companyId_docType_idx" ON "load_orders"("companyId", "docType");
CREATE INDEX IF NOT EXISTS "load_orders_saleId_idx" ON "load_orders"("saleId");
CREATE INDEX IF NOT EXISTS "load_orders_estado_idx" ON "load_orders"("estado");
CREATE INDEX IF NOT EXISTS "load_orders_fecha_idx" ON "load_orders"("fecha");

-- Load Order Items
CREATE TABLE IF NOT EXISTS "load_order_items" (
    "id" SERIAL PRIMARY KEY,
    "loadOrderId" INTEGER NOT NULL REFERENCES "load_orders"("id") ON DELETE CASCADE,
    "saleItemId" INTEGER NOT NULL,
    "productId" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadCargada" DECIMAL(15,4),
    "secuencia" INTEGER NOT NULL DEFAULT 0,
    "posicion" VARCHAR(50),
    "pesoUnitario" DECIMAL(15,4),
    "volumenUnitario" DECIMAL(15,4),
    "motivoDiferencia" TEXT
);
CREATE INDEX IF NOT EXISTS "load_order_items_loadOrderId_idx" ON "load_order_items"("loadOrderId");
CREATE INDEX IF NOT EXISTS "load_order_items_saleItemId_idx" ON "load_order_items"("saleItemId");

-- Cash Deposits
CREATE TABLE IF NOT EXISTS "cash_deposits" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "DepositStatus" NOT NULL DEFAULT 'PENDIENTE',
    "cashAccountId" INTEGER NOT NULL REFERENCES "cash_accounts"("id"),
    "bankAccountId" INTEGER NOT NULL REFERENCES "bank_accounts"("id"),
    "efectivo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cheques" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "numeroComprobante" VARCHAR(100),
    "comprobanteUrl" TEXT,
    "chequeIds" TEXT,
    "egresoMovementId" INTEGER,
    "ingresoMovementId" INTEGER,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "confirmedBy" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("companyId", "numero")
);
CREATE INDEX IF NOT EXISTS "cash_deposits_companyId_idx" ON "cash_deposits"("companyId");
CREATE INDEX IF NOT EXISTS "cash_deposits_estado_idx" ON "cash_deposits"("estado");
CREATE INDEX IF NOT EXISTS "cash_deposits_docType_idx" ON "cash_deposits"("docType");

-- Cash Closings
CREATE TABLE IF NOT EXISTS "cash_closings" (
    "id" SERIAL PRIMARY KEY,
    "cashAccountId" INTEGER NOT NULL REFERENCES "cash_accounts"("id"),
    "fecha" DATE NOT NULL,
    "saldoSistemaEfectivo" DECIMAL(15,2) NOT NULL,
    "saldoSistemaCheques" DECIMAL(15,2) NOT NULL,
    "saldoSistemaTotal" DECIMAL(15,2) NOT NULL,
    "arqueoEfectivo" DECIMAL(15,2) NOT NULL,
    "arqueoCheques" DECIMAL(15,2) NOT NULL,
    "arqueoTotal" DECIMAL(15,2) NOT NULL,
    "desglose" JSONB,
    "diferencia" DECIMAL(15,2) NOT NULL,
    "diferenciaNotas" TEXT,
    "ajusteMovementId" INTEGER,
    "estado" "CashClosingStatus" NOT NULL DEFAULT 'PENDIENTE',
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("cashAccountId", "fecha")
);
CREATE INDEX IF NOT EXISTS "cash_closings_companyId_idx" ON "cash_closings"("companyId");
CREATE INDEX IF NOT EXISTS "cash_closings_fecha_idx" ON "cash_closings"("fecha");
CREATE INDEX IF NOT EXISTS "cash_closings_estado_idx" ON "cash_closings"("estado");

-- Bank Statements
CREATE TABLE IF NOT EXISTS "bank_statements" (
    "id" SERIAL PRIMARY KEY,
    "bankAccountId" INTEGER NOT NULL REFERENCES "bank_accounts"("id"),
    "periodo" VARCHAR(7) NOT NULL,
    "fechaImportacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivoOriginal" TEXT,
    "saldoInicial" DECIMAL(15,2) NOT NULL,
    "totalDebitos" DECIMAL(15,2) NOT NULL,
    "totalCreditos" DECIMAL(15,2) NOT NULL,
    "saldoFinal" DECIMAL(15,2) NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "itemsConciliados" INTEGER NOT NULL DEFAULT 0,
    "itemsPendientes" INTEGER NOT NULL DEFAULT 0,
    "itemsSuspense" INTEGER NOT NULL DEFAULT 0,
    "estado" "ReconciliationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "cerradoAt" TIMESTAMP(3),
    "cerradoPor" INTEGER,
    "toleranciaMonto" DECIMAL(15,2) NOT NULL DEFAULT 0.01,
    "toleranciaDias" INTEGER NOT NULL DEFAULT 3,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("bankAccountId", "periodo")
);
CREATE INDEX IF NOT EXISTS "bank_statements_companyId_idx" ON "bank_statements"("companyId");
CREATE INDEX IF NOT EXISTS "bank_statements_estado_idx" ON "bank_statements"("estado");

-- Bank Statement Items
CREATE TABLE IF NOT EXISTS "bank_statement_items" (
    "id" SERIAL PRIMARY KEY,
    "statementId" INTEGER NOT NULL REFERENCES "bank_statements"("id") ON DELETE CASCADE,
    "lineNumber" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "fechaValor" DATE,
    "descripcion" TEXT NOT NULL,
    "referencia" VARCHAR(100),
    "debito" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credito" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(15,2) NOT NULL,
    "conciliado" BOOLEAN NOT NULL DEFAULT FALSE,
    "treasuryMovementId" INTEGER REFERENCES "treasury_movements"("id"),
    "conciliadoAt" TIMESTAMP(3),
    "conciliadoBy" INTEGER,
    "matchType" "MatchType",
    "matchConfidence" DOUBLE PRECISION,
    "esSuspense" BOOLEAN NOT NULL DEFAULT FALSE,
    "suspenseNotas" TEXT,
    "suspenseResuelto" BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS "bank_statement_items_statementId_idx" ON "bank_statement_items"("statementId");
CREATE INDEX IF NOT EXISTS "bank_statement_items_conciliado_idx" ON "bank_statement_items"("conciliado");
CREATE INDEX IF NOT EXISTS "bank_statement_items_esSuspense_idx" ON "bank_statement_items"("esSuspense");

-- Pickup Slots
CREATE TABLE IF NOT EXISTS "pickup_slots" (
    "id" SERIAL PRIMARY KEY,
    "fecha" DATE NOT NULL,
    "horaInicio" VARCHAR(5) NOT NULL,
    "horaFin" VARCHAR(5) NOT NULL,
    "capacidadMaxima" INTEGER NOT NULL DEFAULT 1,
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("companyId", "fecha", "horaInicio")
);
CREATE INDEX IF NOT EXISTS "pickup_slots_companyId_idx" ON "pickup_slots"("companyId");
CREATE INDEX IF NOT EXISTS "pickup_slots_fecha_idx" ON "pickup_slots"("fecha");

-- Pickup Reservations
CREATE TABLE IF NOT EXISTS "pickup_reservations" (
    "id" SERIAL PRIMARY KEY,
    "slotId" INTEGER NOT NULL REFERENCES "pickup_slots"("id"),
    "saleId" INTEGER NOT NULL UNIQUE REFERENCES "sales"("id"),
    "clientId" TEXT NOT NULL REFERENCES "clients"("id"),
    "estado" "PickupStatus" NOT NULL DEFAULT 'RESERVADO',
    "observaciones" TEXT,
    "retiroNombre" VARCHAR(255),
    "retiroDNI" VARCHAR(20),
    "retiroVehiculo" VARCHAR(100),
    "retiroFecha" TIMESTAMP(3),
    "llegadaAt" TIMESTAMP(3),
    "inicioAt" TIMESTAMP(3),
    "finAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "pickup_reservations_slotId_idx" ON "pickup_reservations"("slotId");
CREATE INDEX IF NOT EXISTS "pickup_reservations_companyId_idx" ON "pickup_reservations"("companyId");
CREATE INDEX IF NOT EXISTS "pickup_reservations_estado_idx" ON "pickup_reservations"("estado");

-- Collection Actions
CREATE TABLE IF NOT EXISTS "collection_actions" (
    "id" SERIAL PRIMARY KEY,
    "clientId" TEXT NOT NULL REFERENCES "clients"("id"),
    "invoiceId" INTEGER REFERENCES "sales_invoices"("id"),
    "tipo" "CollectionActionType" NOT NULL,
    "estado" "CollectionActionStatus" NOT NULL DEFAULT 'PENDIENTE',
    "fecha" DATE NOT NULL,
    "descripcion" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "contactoEmail" TEXT,
    "resultado" TEXT,
    "proximaAccion" DATE,
    "promesaPago" DATE,
    "promesaMonto" DECIMAL(15,2),
    "asignadoA" INTEGER,
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "collection_actions_companyId_idx" ON "collection_actions"("companyId");
CREATE INDEX IF NOT EXISTS "collection_actions_clientId_idx" ON "collection_actions"("clientId");
CREATE INDEX IF NOT EXISTS "collection_actions_estado_idx" ON "collection_actions"("estado");

-- Payment Disputes
CREATE TABLE IF NOT EXISTS "payment_disputes" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL REFERENCES "clients"("id"),
    "invoiceId" INTEGER REFERENCES "sales_invoices"("id"),
    "tipo" "DisputeType" NOT NULL,
    "estado" "DisputeStatus" NOT NULL DEFAULT 'ABIERTA',
    "descripcion" TEXT NOT NULL,
    "montoDisputa" DECIMAL(15,2),
    "resolucion" TEXT,
    "resolucionNotas" TEXT,
    "resolucionPor" INTEGER,
    "resolucionAt" TIMESTAMP(3),
    "creditNoteId" INTEGER REFERENCES "sales_credit_debit_notes"("id"),
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("companyId", "numero")
);
CREATE INDEX IF NOT EXISTS "payment_disputes_companyId_idx" ON "payment_disputes"("companyId");
CREATE INDEX IF NOT EXISTS "payment_disputes_clientId_idx" ON "payment_disputes"("clientId");
CREATE INDEX IF NOT EXISTS "payment_disputes_estado_idx" ON "payment_disputes"("estado");

-- Sales Price Lists
CREATE TABLE IF NOT EXISTS "sales_price_lists" (
    "id" SERIAL PRIMARY KEY,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "porcentajeBase" DECIMAL(5,2),
    "esDefault" BOOLEAN NOT NULL DEFAULT FALSE,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "validFrom" DATE,
    "validUntil" DATE,
    "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "sales_price_lists_companyId_idx" ON "sales_price_lists"("companyId");
CREATE INDEX IF NOT EXISTS "sales_price_lists_isActive_idx" ON "sales_price_lists"("isActive");

-- Sales Price List Items
CREATE TABLE IF NOT EXISTS "sales_price_list_items" (
    "id" SERIAL PRIMARY KEY,
    "priceListId" INTEGER NOT NULL REFERENCES "sales_price_lists"("id") ON DELETE CASCADE,
    "productId" TEXT NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "porcentaje" DECIMAL(5,2),
    UNIQUE("priceListId", "productId")
);
CREATE INDEX IF NOT EXISTS "sales_price_list_items_priceListId_idx" ON "sales_price_list_items"("priceListId");

-- Invoice Payment Allocations
CREATE TABLE IF NOT EXISTS "invoice_payment_allocations" (
    "id" SERIAL PRIMARY KEY,
    "paymentId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL REFERENCES "sales_invoices"("id"),
    "montoAplicado" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "invoice_payment_allocations_paymentId_idx" ON "invoice_payment_allocations"("paymentId");
CREATE INDEX IF NOT EXISTS "invoice_payment_allocations_invoiceId_idx" ON "invoice_payment_allocations"("invoiceId");

COMMIT;
