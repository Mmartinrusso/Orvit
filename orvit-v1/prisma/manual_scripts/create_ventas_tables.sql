-- ============================================
-- CREAR TABLAS DE VENTAS FALTANTES
-- Solo crea tablas nuevas, no modifica nada existente
-- Fecha: 2026-01-12
-- PREREQUISITO: Ejecutar 001_add_enum_values.sql PRIMERO
-- ============================================

-- ============================================
-- 1. TABLAS DE ENTREGAS
-- ============================================

CREATE TABLE IF NOT EXISTS "sale_deliveries" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "saleId" INTEGER NOT NULL REFERENCES "sales"("id"),
    "clientId" TEXT NOT NULL REFERENCES "Client"("id"),
    "estado" "DeliveryStatus" NOT NULL DEFAULT 'PENDIENTE',
    "fechaProgramada" DATE,
    "horaProgramada" VARCHAR(20),
    "fechaEntrega" DATE,
    "horaEntrega" VARCHAR(20),
    "direccionEntrega" TEXT,
    "transportista" VARCHAR(255),
    "vehiculo" VARCHAR(100),
    "conductorNombre" VARCHAR(255),
    "conductorDNI" VARCHAR(20),
    "costoFlete" DECIMAL(15, 2),
    "costoSeguro" DECIMAL(15, 2),
    "otrosCostos" DECIMAL(15, 2),
    "recibeNombre" VARCHAR(255),
    "recibeDNI" VARCHAR(20),
    "firmaRecepcion" TEXT,
    "latitudEntrega" DECIMAL(10, 8),
    "longitudEntrega" DECIMAL(11, 8),
    "notas" TEXT,
    "observacionesEntrega" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "User"("id"),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("companyId", "numero")
);

CREATE INDEX IF NOT EXISTS "sale_deliveries_companyId_idx" ON "sale_deliveries"("companyId");
CREATE INDEX IF NOT EXISTS "sale_deliveries_saleId_idx" ON "sale_deliveries"("saleId");
CREATE INDEX IF NOT EXISTS "sale_deliveries_clientId_idx" ON "sale_deliveries"("clientId");
CREATE INDEX IF NOT EXISTS "sale_deliveries_estado_idx" ON "sale_deliveries"("estado");
CREATE INDEX IF NOT EXISTS "sale_deliveries_fechaEntrega_idx" ON "sale_deliveries"("fechaEntrega");
CREATE INDEX IF NOT EXISTS "sale_deliveries_docType_idx" ON "sale_deliveries"("docType");
CREATE INDEX IF NOT EXISTS "sale_deliveries_companyId_docType_idx" ON "sale_deliveries"("companyId", "docType");

CREATE TABLE IF NOT EXISTS "sale_delivery_items" (
    "id" SERIAL PRIMARY KEY,
    "deliveryId" INTEGER NOT NULL REFERENCES "sale_deliveries"("id") ON DELETE CASCADE,
    "saleItemId" INTEGER NOT NULL REFERENCES "sale_items"("id"),
    "productId" TEXT REFERENCES "Product"("id"),
    "cantidad" DECIMAL(15, 4) NOT NULL,
    "notas" TEXT
);

CREATE INDEX IF NOT EXISTS "sale_delivery_items_deliveryId_idx" ON "sale_delivery_items"("deliveryId");
CREATE INDEX IF NOT EXISTS "sale_delivery_items_saleItemId_idx" ON "sale_delivery_items"("saleItemId");

CREATE TABLE IF NOT EXISTS "sale_delivery_evidences" (
    "id" SERIAL PRIMARY KEY,
    "deliveryId" INTEGER NOT NULL REFERENCES "sale_deliveries"("id") ON DELETE CASCADE,
    "tipo" VARCHAR(50) NOT NULL,
    "url" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "sale_delivery_evidences_deliveryId_idx" ON "sale_delivery_evidences"("deliveryId");

-- ============================================
-- 3. TABLAS DE REMITOS
-- ============================================

CREATE TABLE IF NOT EXISTS "sale_remitos" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "saleId" INTEGER NOT NULL REFERENCES "sales"("id"),
    "deliveryId" INTEGER REFERENCES "sale_deliveries"("id"),
    "clientId" TEXT NOT NULL REFERENCES "Client"("id"),
    "estado" "RemitoStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "cai" VARCHAR(20),
    "fechaVtoCai" DATE,
    "notas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "User"("id"),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("companyId", "numero")
);

CREATE INDEX IF NOT EXISTS "sale_remitos_companyId_idx" ON "sale_remitos"("companyId");
CREATE INDEX IF NOT EXISTS "sale_remitos_saleId_idx" ON "sale_remitos"("saleId");
CREATE INDEX IF NOT EXISTS "sale_remitos_deliveryId_idx" ON "sale_remitos"("deliveryId");
CREATE INDEX IF NOT EXISTS "sale_remitos_clientId_idx" ON "sale_remitos"("clientId");
CREATE INDEX IF NOT EXISTS "sale_remitos_estado_idx" ON "sale_remitos"("estado");
CREATE INDEX IF NOT EXISTS "sale_remitos_docType_idx" ON "sale_remitos"("docType");

CREATE TABLE IF NOT EXISTS "sale_remito_items" (
    "id" SERIAL PRIMARY KEY,
    "remitoId" INTEGER NOT NULL REFERENCES "sale_remitos"("id") ON DELETE CASCADE,
    "saleItemId" INTEGER NOT NULL REFERENCES "sale_items"("id"),
    "productId" TEXT REFERENCES "Product"("id"),
    "cantidad" DECIMAL(15, 4) NOT NULL
);

CREATE INDEX IF NOT EXISTS "sale_remito_items_remitoId_idx" ON "sale_remito_items"("remitoId");
CREATE INDEX IF NOT EXISTS "sale_remito_items_saleItemId_idx" ON "sale_remito_items"("saleItemId");

-- ============================================
-- 4. TABLAS DE FACTURAS
-- ============================================

CREATE TABLE IF NOT EXISTS "sales_invoices" (
    "id" SERIAL PRIMARY KEY,
    "tipo" "SalesInvoiceType" NOT NULL,
    "letra" VARCHAR(1) NOT NULL,
    "puntoVenta" VARCHAR(5) NOT NULL,
    "numero" VARCHAR(8) NOT NULL,
    "numeroCompleto" VARCHAR(20) NOT NULL,
    "clientId" TEXT NOT NULL REFERENCES "Client"("id"),
    "saleId" INTEGER REFERENCES "sales"("id"),
    "estado" "SalesInvoiceStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "fechaServicioDesde" DATE,
    "fechaServicioHasta" DATE,
    "netoGravado" DECIMAL(15, 2) NOT NULL,
    "netoNoGravado" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "exento" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "iva21" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "percepcionIVA" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "percepcionIIBB" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "otrosImpuestos" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15, 2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "tipoCambio" DECIMAL(15, 4),
    "totalCobrado" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "saldoPendiente" DECIMAL(15, 2) NOT NULL,
    "cae" VARCHAR(20),
    "fechaVtoCae" DATE,
    "estadoAFIP" "AFIPStatus",
    "condicionesPago" VARCHAR(255),
    "notas" TEXT,
    "notasInternas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "User"("id"),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

CREATE TABLE IF NOT EXISTS "sales_invoice_items" (
    "id" SERIAL PRIMARY KEY,
    "invoiceId" INTEGER NOT NULL REFERENCES "sales_invoices"("id") ON DELETE CASCADE,
    "saleItemId" INTEGER REFERENCES "sale_items"("id"),
    "productId" TEXT REFERENCES "Product"("id"),
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15, 4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15, 2) NOT NULL,
    "descuento" DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "alicuotaIVA" DECIMAL(5, 2) NOT NULL DEFAULT 21,
    "subtotal" DECIMAL(15, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS "sales_invoice_items_invoiceId_idx" ON "sales_invoice_items"("invoiceId");
CREATE INDEX IF NOT EXISTS "sales_invoice_items_saleItemId_idx" ON "sales_invoice_items"("saleItemId");

-- ============================================
-- 5. TABLAS DE NOTAS CREDITO/DEBITO
-- ============================================

CREATE TABLE IF NOT EXISTS "sales_credit_debit_notes" (
    "id" SERIAL PRIMARY KEY,
    "tipo" "SalesCreditDebitType" NOT NULL,
    "letra" VARCHAR(1) NOT NULL,
    "puntoVenta" VARCHAR(5) NOT NULL,
    "numero" VARCHAR(8) NOT NULL,
    "numeroCompleto" VARCHAR(20) NOT NULL,
    "clientId" TEXT NOT NULL REFERENCES "Client"("id"),
    "facturaId" INTEGER REFERENCES "sales_invoices"("id"),
    "estado" "CreditDebitNoteStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "netoGravado" DECIMAL(15, 2) NOT NULL,
    "iva21" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15, 2) NOT NULL,
    "cae" VARCHAR(20),
    "fechaVtoCae" DATE,
    "aplicada" BOOLEAN NOT NULL DEFAULT false,
    "aplicadaAt" TIMESTAMPTZ,
    "notas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "User"("id"),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_companyId_idx" ON "sales_credit_debit_notes"("companyId");
CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_clientId_idx" ON "sales_credit_debit_notes"("clientId");
CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_facturaId_idx" ON "sales_credit_debit_notes"("facturaId");
CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_tipo_idx" ON "sales_credit_debit_notes"("tipo");
CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_estado_idx" ON "sales_credit_debit_notes"("estado");
CREATE INDEX IF NOT EXISTS "sales_credit_debit_notes_docType_idx" ON "sales_credit_debit_notes"("docType");

CREATE TABLE IF NOT EXISTS "sales_credit_debit_note_items" (
    "id" SERIAL PRIMARY KEY,
    "noteId" INTEGER NOT NULL REFERENCES "sales_credit_debit_notes"("id") ON DELETE CASCADE,
    "productId" TEXT REFERENCES "Product"("id"),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15, 4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15, 2) NOT NULL,
    "alicuotaIVA" DECIMAL(5, 2) NOT NULL DEFAULT 21,
    "subtotal" DECIMAL(15, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS "sales_credit_debit_note_items_noteId_idx" ON "sales_credit_debit_note_items"("noteId");

-- ============================================
-- 6. TABLAS DE PAGOS
-- ============================================

CREATE TABLE IF NOT EXISTS "client_payments" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL REFERENCES "Client"("id"),
    "fechaPago" DATE NOT NULL,
    "totalPago" DECIMAL(15, 2) NOT NULL,
    "efectivo" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "transferencia" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "chequesTerceros" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "chequesPropios" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "tarjetaCredito" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "tarjetaDebito" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "otrosMedios" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "retIVA" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "retGanancias" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "retIngBrutos" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "estado" "ClientPaymentStatus" NOT NULL DEFAULT 'CONFIRMADO',
    "bancoOrigen" VARCHAR(100),
    "numeroOperacion" VARCHAR(50),
    "notas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "createdBy" INTEGER NOT NULL REFERENCES "User"("id"),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("companyId", "numero")
);

CREATE INDEX IF NOT EXISTS "client_payments_companyId_idx" ON "client_payments"("companyId");
CREATE INDEX IF NOT EXISTS "client_payments_clientId_idx" ON "client_payments"("clientId");
CREATE INDEX IF NOT EXISTS "client_payments_fechaPago_idx" ON "client_payments"("fechaPago");
CREATE INDEX IF NOT EXISTS "client_payments_estado_idx" ON "client_payments"("estado");
CREATE INDEX IF NOT EXISTS "client_payments_docType_idx" ON "client_payments"("docType");
CREATE INDEX IF NOT EXISTS "client_payments_companyId_docType_idx" ON "client_payments"("companyId", "docType");
CREATE INDEX IF NOT EXISTS "client_payments_companyId_docType_fechaPago_idx" ON "client_payments"("companyId", "docType", "fechaPago");

CREATE TABLE IF NOT EXISTS "invoice_payment_allocations" (
    "id" SERIAL PRIMARY KEY,
    "paymentId" INTEGER NOT NULL REFERENCES "client_payments"("id") ON DELETE CASCADE,
    "invoiceId" INTEGER NOT NULL REFERENCES "sales_invoices"("id"),
    "montoAplicado" DECIMAL(15, 2) NOT NULL,
    "fechaAplicacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "invoice_payment_allocations_paymentId_idx" ON "invoice_payment_allocations"("paymentId");
CREATE INDEX IF NOT EXISTS "invoice_payment_allocations_invoiceId_idx" ON "invoice_payment_allocations"("invoiceId");

CREATE TABLE IF NOT EXISTS "client_payment_cheques" (
    "id" SERIAL PRIMARY KEY,
    "paymentId" INTEGER NOT NULL REFERENCES "client_payments"("id") ON DELETE CASCADE,
    "tipo" VARCHAR(20) NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "banco" VARCHAR(100),
    "titular" VARCHAR(255),
    "cuit" VARCHAR(20),
    "fechaEmision" DATE,
    "fechaVencimiento" DATE,
    "importe" DECIMAL(15, 2) NOT NULL,
    "estado" "ChequeStatus" NOT NULL DEFAULT 'CARTERA'
);

CREATE INDEX IF NOT EXISTS "client_payment_cheques_paymentId_idx" ON "client_payment_cheques"("paymentId");
CREATE INDEX IF NOT EXISTS "client_payment_cheques_estado_idx" ON "client_payment_cheques"("estado");

-- ============================================
-- 7. CUENTA CORRIENTE (LEDGER)
-- ============================================

CREATE TABLE IF NOT EXISTS "client_ledger_entries" (
    "id" SERIAL PRIMARY KEY,
    "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
    "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "tipo" "ClientMovementType" NOT NULL,
    "facturaId" INTEGER REFERENCES "sales_invoices"("id"),
    "notaCreditoDebitoId" INTEGER REFERENCES "sales_credit_debit_notes"("id"),
    "pagoId" INTEGER REFERENCES "client_payments"("id"),
    "fecha" DATE NOT NULL,
    "fechaVencimiento" DATE,
    "debe" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "comprobante" VARCHAR(100),
    "descripcion" TEXT,
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "anuladoPor" INTEGER REFERENCES "client_ledger_entries"("id"),
    "anuladoAt" TIMESTAMPTZ,
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "conciliadoAt" TIMESTAMPTZ,
    "conciliadoBy" INTEGER,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "client_ledger_entries_clientId_idx" ON "client_ledger_entries"("clientId");
CREATE INDEX IF NOT EXISTS "client_ledger_entries_companyId_idx" ON "client_ledger_entries"("companyId");
CREATE INDEX IF NOT EXISTS "client_ledger_entries_fecha_idx" ON "client_ledger_entries"("fecha");
CREATE INDEX IF NOT EXISTS "client_ledger_entries_tipo_idx" ON "client_ledger_entries"("tipo");
CREATE INDEX IF NOT EXISTS "client_ledger_entries_anulado_idx" ON "client_ledger_entries"("anulado");

-- ============================================
-- FIN DE MIGRACION
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Tablas de Ventas creadas exitosamente!';
    RAISE NOTICE '============================================';
END $$;
