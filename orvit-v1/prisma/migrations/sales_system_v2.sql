-- Sistema de Ventas Premium v2 - SQL Migration
-- Ejecutar en orden

-- =====================================================
-- ENUMS (si no existen, agregar valores)
-- =====================================================

-- Agregar T3 al DocType existente si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'T3' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'DocType')) THEN
        ALTER TYPE "DocType" ADD VALUE 'T3';
    END IF;
END $$;

-- Crear enums de ventas
DO $$ BEGIN
    CREATE TYPE "QuoteStatus" AS ENUM ('BORRADOR', 'ENVIADA', 'EN_NEGOCIACION', 'ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SaleStatus" AS ENUM ('BORRADOR', 'CONFIRMADA', 'EN_PREPARACION', 'ENTREGADA', 'FACTURADA', 'COMPLETADA', 'CANCELADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DeliveryStatus" AS ENUM ('PENDIENTE', 'PROGRAMADA', 'EN_PREPARACION', 'EN_TRANSITO', 'ENTREGADA', 'CANCELADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RemitoStatus" AS ENUM ('BORRADOR', 'EMITIDO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SalesInvoiceType" AS ENUM ('A', 'B', 'C', 'M');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SalesInvoiceStatus" AS ENUM ('BORRADOR', 'EMITIDA', 'PARCIALMENTE_COBRADA', 'COBRADA', 'VENCIDA', 'ANULADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AFIPStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'ERROR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SalesCreditDebitType" AS ENUM ('CREDITO', 'DEBITO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreditDebitNoteStatus ya existe en el schema de compras, no crear duplicado
-- Si necesitas agregar valores faltantes:
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'BORRADOR' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditDebitNoteStatus')) THEN
        ALTER TYPE "CreditDebitNoteStatus" ADD VALUE 'BORRADOR';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EMITIDA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditDebitNoteStatus')) THEN
        ALTER TYPE "CreditDebitNoteStatus" ADD VALUE 'EMITIDA';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'APLICADA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditDebitNoteStatus')) THEN
        ALTER TYPE "CreditDebitNoteStatus" ADD VALUE 'APLICADA';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ANULADA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditDebitNoteStatus')) THEN
        ALTER TYPE "CreditDebitNoteStatus" ADD VALUE 'ANULADA';
    END IF;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClientPaymentStatus" AS ENUM ('PENDIENTE', 'PARCIAL', 'APLICADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ChequeStatus" AS ENUM ('PENDIENTE', 'DEPOSITADO', 'ACREDITADO', 'RECHAZADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClientMovementType" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'PAGO', 'ANTICIPO', 'AJUSTE_DEBITO', 'AJUSTE_CREDITO', 'ANULACION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SalesApprovalType" AS ENUM ('DESCUENTO', 'CREDITO', 'MARGEN', 'LIMITE_MONTO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SalesApprovalStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "StockReservationStatus" AS ENUM ('RESERVADO', 'LIBERADO', 'ENTREGADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLAS
-- =====================================================

-- SalesConfig
CREATE TABLE IF NOT EXISTS "SalesConfig" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL UNIQUE,
    "defaultTaxRate" DECIMAL(5,2) DEFAULT 21.00,
    "defaultPaymentTerms" TEXT,
    "defaultDeliveryTerms" TEXT,
    "quoteValidityDays" INTEGER DEFAULT 30,
    "autoNumberQuotes" BOOLEAN DEFAULT true,
    "autoNumberSales" BOOLEAN DEFAULT true,
    "autoNumberInvoices" BOOLEAN DEFAULT true,
    "requireApprovalForDiscount" DECIMAL(5,2),
    "minMarginPercent" DECIMAL(5,2),
    "autoReserveStock" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- Quote (Cotizaciones)
CREATE TABLE IF NOT EXISTS "Quote" (
    "id" SERIAL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "sellerId" INTEGER,
    "titulo" TEXT,
    "fecha" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "fechaValidez" TIMESTAMP(3),
    "fechaEnvio" TIMESTAMP(3),
    "fechaConversion" TIMESTAMP(3),
    "status" "QuoteStatus" DEFAULT 'BORRADOR',
    "moneda" TEXT DEFAULT 'ARS',
    "subtotal" DECIMAL(15,2) DEFAULT 0,
    "tasaIva" DECIMAL(5,2) DEFAULT 21,
    "impuestos" DECIMAL(15,2) DEFAULT 0,
    "descuentoTotal" DECIMAL(15,2) DEFAULT 0,
    "total" DECIMAL(15,2) DEFAULT 0,
    "condicionesPago" TEXT,
    "condicionesEntrega" TEXT,
    "tiempoEntrega" TEXT,
    "notas" TEXT,
    "notasInternas" TEXT,
    "motivoPerdida" TEXT,
    "docType" "DocType" DEFAULT 'T1',
    "version" INTEGER DEFAULT 1,
    "saleId" INTEGER,
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- QuoteItem
CREATE TABLE IF NOT EXISTS "QuoteItem" (
    "id" SERIAL PRIMARY KEY,
    "quoteId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "descripcion" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" TEXT DEFAULT 'UN',
    "precioUnitario" DECIMAL(15,4) NOT NULL,
    "descuento" DECIMAL(5,2) DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "costo" DECIMAL(15,4) DEFAULT 0,
    "margen" DECIMAL(5,2) DEFAULT 0,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE
);

-- QuoteAttachment
CREATE TABLE IF NOT EXISTS "QuoteAttachment" (
    "id" SERIAL PRIMARY KEY,
    "quoteId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT,
    "tamaño" INTEGER,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteAttachment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE
);

-- QuoteVersion
CREATE TABLE IF NOT EXISTS "QuoteVersion" (
    "id" SERIAL PRIMARY KEY,
    "quoteId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteVersion_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE
);

-- ClientPortalAccess
CREATE TABLE IF NOT EXISTS "ClientPortalAccess" (
    "id" SERIAL PRIMARY KEY,
    "clientId" INTEGER NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "quoteId" INTEGER,
    "usedAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- QuoteAcceptance
CREATE TABLE IF NOT EXISTS "QuoteAcceptance" (
    "id" SERIAL PRIMARY KEY,
    "quoteId" INTEGER NOT NULL UNIQUE,
    "acceptedBy" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "firma" TEXT,
    "comentarios" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteAcceptance_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE
);

-- Sale (Órdenes de Venta)
CREATE TABLE IF NOT EXISTS "Sale" (
    "id" SERIAL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "quoteId" INTEGER,
    "clientId" INTEGER NOT NULL,
    "sellerId" INTEGER,
    "status" "SaleStatus" DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "fechaConfirmacion" TIMESTAMP(3),
    "fechaEntrega" TIMESTAMP(3),
    "moneda" TEXT DEFAULT 'ARS',
    "subtotal" DECIMAL(15,2) DEFAULT 0,
    "tasaIva" DECIMAL(5,2) DEFAULT 21,
    "impuestos" DECIMAL(15,2) DEFAULT 0,
    "descuentoTotal" DECIMAL(15,2) DEFAULT 0,
    "total" DECIMAL(15,2) DEFAULT 0,
    "condicionesPago" TEXT,
    "condicionesEntrega" TEXT,
    "tiempoEntrega" TEXT,
    "notas" TEXT,
    "notasInternas" TEXT,
    "motivoCancelacion" TEXT,
    "docType" "DocType" DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- SaleItem
CREATE TABLE IF NOT EXISTS "SaleItem" (
    "id" SERIAL PRIMARY KEY,
    "saleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "descripcion" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadEntregada" DECIMAL(15,4) DEFAULT 0,
    "cantidadPendiente" DECIMAL(15,4) NOT NULL,
    "cantidadFacturada" DECIMAL(15,4) DEFAULT 0,
    "unidad" TEXT DEFAULT 'UN',
    "precioUnitario" DECIMAL(15,4) NOT NULL,
    "descuento" DECIMAL(5,2) DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "costo" DECIMAL(15,4) DEFAULT 0,
    "margen" DECIMAL(5,2) DEFAULT 0,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE
);

-- SaleDelivery (Entregas físicas)
CREATE TABLE IF NOT EXISTS "SaleDelivery" (
    "id" SERIAL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "saleId" INTEGER NOT NULL,
    "status" "DeliveryStatus" DEFAULT 'PENDIENTE',
    "fechaProgramada" TIMESTAMP(3),
    "fechaDespacho" TIMESTAMP(3),
    "fechaEntrega" TIMESTAMP(3),
    "direccionEntrega" TEXT,
    "transportista" TEXT,
    "costoFlete" DECIMAL(15,2),
    "costoSeguro" DECIMAL(15,2),
    "gpsEntrega" TEXT,
    "firmaCliente" TEXT,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleDelivery_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE
);

-- SaleDeliveryItem
CREATE TABLE IF NOT EXISTS "SaleDeliveryItem" (
    "id" SERIAL PRIMARY KEY,
    "deliveryId" INTEGER NOT NULL,
    "saleItemId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleDeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SaleDelivery"("id") ON DELETE CASCADE,
    CONSTRAINT "SaleDeliveryItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE
);

-- SaleDeliveryEvidence
CREATE TABLE IF NOT EXISTS "SaleDeliveryEvidence" (
    "id" SERIAL PRIMARY KEY,
    "deliveryId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleDeliveryEvidence_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SaleDelivery"("id") ON DELETE CASCADE
);

-- SaleRemito (Documento fiscal)
CREATE TABLE IF NOT EXISTS "SaleRemito" (
    "id" SERIAL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "deliveryId" INTEGER UNIQUE,
    "saleId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "status" "RemitoStatus" DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "cai" TEXT,
    "fechaVtoCai" TIMESTAMP(3),
    "direccionEntrega" TEXT,
    "observaciones" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleRemito_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SaleDelivery"("id") ON DELETE SET NULL,
    CONSTRAINT "SaleRemito_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE
);

-- SaleRemitoItem
CREATE TABLE IF NOT EXISTS "SaleRemitoItem" (
    "id" SERIAL PRIMARY KEY,
    "remitoId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "descripcion" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" TEXT DEFAULT 'UN',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleRemitoItem_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "SaleRemito"("id") ON DELETE CASCADE
);

-- SalesInvoice (Facturas)
CREATE TABLE IF NOT EXISTS "SalesInvoice" (
    "id" SERIAL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "saleId" INTEGER,
    "tipo" "SalesInvoiceType" NOT NULL,
    "status" "SalesInvoiceStatus" DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "fechaEmision" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3),
    "moneda" TEXT DEFAULT 'ARS',
    "subtotal" DECIMAL(15,2) DEFAULT 0,
    "tasaIva" DECIMAL(5,2) DEFAULT 21,
    "impuestos" DECIMAL(15,2) DEFAULT 0,
    "total" DECIMAL(15,2) DEFAULT 0,
    "saldoPendiente" DECIMAL(15,2) DEFAULT 0,
    "condicionesPago" TEXT,
    "notas" TEXT,
    "cae" TEXT,
    "fechaVtoCae" TIMESTAMP(3),
    "afipStatus" "AFIPStatus",
    "afipResponse" JSONB,
    "motivoAnulacion" TEXT,
    "fechaAnulacion" TIMESTAMP(3),
    "docType" "DocType" DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesInvoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL
);

-- SalesInvoiceItem
CREATE TABLE IF NOT EXISTS "SalesInvoiceItem" (
    "id" SERIAL PRIMARY KEY,
    "invoiceId" INTEGER NOT NULL,
    "saleItemId" INTEGER,
    "productId" INTEGER,
    "descripcion" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" TEXT DEFAULT 'UN',
    "precioUnitario" DECIMAL(15,4) NOT NULL,
    "descuento" DECIMAL(5,2) DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE
);

-- SalesCreditDebitNote
CREATE TABLE IF NOT EXISTS "SalesCreditDebitNote" (
    "id" SERIAL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "invoiceId" INTEGER,
    "tipo" "SalesCreditDebitType" NOT NULL,
    "status" "CreditDebitNoteStatus" DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "fechaEmision" TIMESTAMP(3),
    "moneda" TEXT DEFAULT 'ARS',
    "subtotal" DECIMAL(15,2) DEFAULT 0,
    "tasaIva" DECIMAL(5,2) DEFAULT 21,
    "impuestos" DECIMAL(15,2) DEFAULT 0,
    "total" DECIMAL(15,2) DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "notas" TEXT,
    "cae" TEXT,
    "fechaVtoCae" TIMESTAMP(3),
    "afipStatus" "AFIPStatus",
    "docType" "DocType" DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesCreditDebitNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL
);

-- SalesCreditDebitNoteItem
CREATE TABLE IF NOT EXISTS "SalesCreditDebitNoteItem" (
    "id" SERIAL PRIMARY KEY,
    "noteId" INTEGER NOT NULL,
    "productId" INTEGER,
    "descripcion" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" TEXT DEFAULT 'UN',
    "precioUnitario" DECIMAL(15,4) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesCreditDebitNoteItem_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "SalesCreditDebitNote"("id") ON DELETE CASCADE
);

-- ClientPayment (Pagos)
CREATE TABLE IF NOT EXISTS "ClientPayment" (
    "id" SERIAL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(15,2) NOT NULL,
    "montoAplicado" DECIMAL(15,2) DEFAULT 0,
    "montoDisponible" DECIMAL(15,2) DEFAULT 0,
    "metodoPago" TEXT NOT NULL,
    "referencia" TEXT,
    "status" "ClientPaymentStatus" DEFAULT 'PENDIENTE',
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- InvoicePaymentAllocation (Aplicación de pagos parciales)
CREATE TABLE IF NOT EXISTS "InvoicePaymentAllocation" (
    "id" SERIAL PRIMARY KEY,
    "paymentId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoicePaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ClientPayment"("id") ON DELETE CASCADE,
    CONSTRAINT "InvoicePaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE
);

-- ClientPaymentCheque
CREATE TABLE IF NOT EXISTS "ClientPaymentCheque" (
    "id" SERIAL PRIMARY KEY,
    "paymentId" INTEGER NOT NULL,
    "banco" TEXT NOT NULL,
    "numeroCheque" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "estado" "ChequeStatus" DEFAULT 'PENDIENTE',
    "fechaDeposito" TIMESTAMP(3),
    "fechaAcreditacion" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientPaymentCheque_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ClientPayment"("id") ON DELETE CASCADE
);

-- ClientLedgerEntry (Cuenta corriente inmutable)
CREATE TABLE IF NOT EXISTS "ClientLedgerEntry" (
    "id" SERIAL PRIMARY KEY,
    "clientId" INTEGER NOT NULL,
    "tipo" "ClientMovementType" NOT NULL,
    "documentoTipo" TEXT,
    "documentoId" INTEGER,
    "documentoNumero" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "debe" DECIMAL(15,2) DEFAULT 0,
    "haber" DECIMAL(15,2) DEFAULT 0,
    "saldo" DECIMAL(15,2) DEFAULT 0,
    "descripcion" TEXT,
    "anulado" BOOLEAN DEFAULT false,
    "anuladoPor" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- SalesPriceList
CREATE TABLE IF NOT EXISTS "SalesPriceList" (
    "id" SERIAL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "moneda" TEXT DEFAULT 'ARS',
    "activa" BOOLEAN DEFAULT true,
    "fechaDesde" TIMESTAMP(3),
    "fechaHasta" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- SalesPriceListItem
CREATE TABLE IF NOT EXISTS "SalesPriceListItem" (
    "id" SERIAL PRIMARY KEY,
    "priceListId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "precio" DECIMAL(15,4) NOT NULL,
    "descuentoMaximo" DECIMAL(5,2) DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesPriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "SalesPriceList"("id") ON DELETE CASCADE
);

-- StockReservation
CREATE TABLE IF NOT EXISTS "StockReservation" (
    "id" SERIAL PRIMARY KEY,
    "productId" INTEGER NOT NULL,
    "saleId" INTEGER NOT NULL,
    "saleItemId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "estado" "StockReservationStatus" DEFAULT 'RESERVADO',
    "fechaLiberacion" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockReservation_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE
);

-- SalesApproval
CREATE TABLE IF NOT EXISTS "SalesApproval" (
    "id" SERIAL PRIMARY KEY,
    "tipo" "SalesApprovalType" NOT NULL,
    "documentoTipo" TEXT NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "solicitadoPor" INTEGER NOT NULL,
    "aprobadoPor" INTEGER,
    "status" "SalesApprovalStatus" DEFAULT 'PENDIENTE',
    "valorSolicitado" DECIMAL(15,2),
    "valorAprobado" DECIMAL(15,2),
    "motivo" TEXT,
    "comentarios" TEXT,
    "fechaSolicitud" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "fechaResolucion" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- SalesAuditLog
CREATE TABLE IF NOT EXISTS "SalesAuditLog" (
    "id" SERIAL PRIMARY KEY,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "datosAnteriores" JSONB,
    "datosNuevos" JSONB,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- SellerKPI
CREATE TABLE IF NOT EXISTS "SellerKPI" (
    "id" SERIAL PRIMARY KEY,
    "sellerId" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "año" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "cotizacionesCreadas" INTEGER DEFAULT 0,
    "cotizacionesConvertidas" INTEGER DEFAULT 0,
    "ventasTotales" DECIMAL(15,2) DEFAULT 0,
    "ventasCantidad" INTEGER DEFAULT 0,
    "comisionGenerada" DECIMAL(15,2) DEFAULT 0,
    "comisionPagada" DECIMAL(15,2) DEFAULT 0,
    "tasaConversion" DECIMAL(5,2) DEFAULT 0,
    "ticketPromedio" DECIMAL(15,2) DEFAULT 0,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS "Quote_companyId_idx" ON "Quote"("companyId");
CREATE INDEX IF NOT EXISTS "Quote_clientId_idx" ON "Quote"("clientId");
CREATE INDEX IF NOT EXISTS "Quote_status_idx" ON "Quote"("status");
CREATE INDEX IF NOT EXISTS "Quote_numero_idx" ON "Quote"("numero");

CREATE INDEX IF NOT EXISTS "Sale_companyId_idx" ON "Sale"("companyId");
CREATE INDEX IF NOT EXISTS "Sale_clientId_idx" ON "Sale"("clientId");
CREATE INDEX IF NOT EXISTS "Sale_status_idx" ON "Sale"("status");
CREATE INDEX IF NOT EXISTS "Sale_numero_idx" ON "Sale"("numero");

CREATE INDEX IF NOT EXISTS "SalesInvoice_companyId_idx" ON "SalesInvoice"("companyId");
CREATE INDEX IF NOT EXISTS "SalesInvoice_clientId_idx" ON "SalesInvoice"("clientId");
CREATE INDEX IF NOT EXISTS "SalesInvoice_status_idx" ON "SalesInvoice"("status");
CREATE INDEX IF NOT EXISTS "SalesInvoice_numero_idx" ON "SalesInvoice"("numero");

CREATE INDEX IF NOT EXISTS "ClientPayment_companyId_idx" ON "ClientPayment"("companyId");
CREATE INDEX IF NOT EXISTS "ClientPayment_clientId_idx" ON "ClientPayment"("clientId");

CREATE INDEX IF NOT EXISTS "ClientLedgerEntry_clientId_idx" ON "ClientLedgerEntry"("clientId");
CREATE INDEX IF NOT EXISTS "ClientLedgerEntry_companyId_idx" ON "ClientLedgerEntry"("companyId");
CREATE INDEX IF NOT EXISTS "ClientLedgerEntry_fecha_idx" ON "ClientLedgerEntry"("fecha");

CREATE INDEX IF NOT EXISTS "SaleDelivery_companyId_idx" ON "SaleDelivery"("companyId");
CREATE INDEX IF NOT EXISTS "SaleDelivery_saleId_idx" ON "SaleDelivery"("saleId");
CREATE INDEX IF NOT EXISTS "SaleDelivery_status_idx" ON "SaleDelivery"("status");

CREATE INDEX IF NOT EXISTS "SalesAuditLog_companyId_idx" ON "SalesAuditLog"("companyId");
CREATE INDEX IF NOT EXISTS "SalesAuditLog_entidad_entidadId_idx" ON "SalesAuditLog"("entidad", "entidadId");

-- =====================================================
-- FOREIGN KEYS adicionales
-- =====================================================

-- Quote FKs
ALTER TABLE "Quote" ADD CONSTRAINT IF NOT EXISTS "Quote_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
ALTER TABLE "Quote" ADD CONSTRAINT IF NOT EXISTS "Quote_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "Quote" ADD CONSTRAINT IF NOT EXISTS "Quote_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT IF NOT EXISTS "Quote_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "Quote" ADD CONSTRAINT IF NOT EXISTS "Quote_approvedBy_fkey"
    FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL;

-- QuoteItem FKs
ALTER TABLE "QuoteItem" ADD CONSTRAINT IF NOT EXISTS "QuoteItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;

-- Sale FKs
ALTER TABLE "Sale" ADD CONSTRAINT IF NOT EXISTS "Sale_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
ALTER TABLE "Sale" ADD CONSTRAINT IF NOT EXISTS "Sale_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "Sale" ADD CONSTRAINT IF NOT EXISTS "Sale_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT IF NOT EXISTS "Sale_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "Sale" ADD CONSTRAINT IF NOT EXISTS "Sale_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL;

-- SaleItem FKs
ALTER TABLE "SaleItem" ADD CONSTRAINT IF NOT EXISTS "SaleItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;

-- SalesInvoice FKs
ALTER TABLE "SalesInvoice" ADD CONSTRAINT IF NOT EXISTS "SalesInvoice_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT IF NOT EXISTS "SalesInvoice_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT IF NOT EXISTS "SalesInvoice_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;

-- ClientPayment FKs
ALTER TABLE "ClientPayment" ADD CONSTRAINT IF NOT EXISTS "ClientPayment_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
ALTER TABLE "ClientPayment" ADD CONSTRAINT IF NOT EXISTS "ClientPayment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "ClientPayment" ADD CONSTRAINT IF NOT EXISTS "ClientPayment_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;

-- ClientLedgerEntry FKs
ALTER TABLE "ClientLedgerEntry" ADD CONSTRAINT IF NOT EXISTS "ClientLedgerEntry_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
ALTER TABLE "ClientLedgerEntry" ADD CONSTRAINT IF NOT EXISTS "ClientLedgerEntry_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;

-- SalesAuditLog FKs
ALTER TABLE "SalesAuditLog" ADD CONSTRAINT IF NOT EXISTS "SalesAuditLog_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "SalesAuditLog" ADD CONSTRAINT IF NOT EXISTS "SalesAuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;

-- SaleDelivery FK
ALTER TABLE "SaleDelivery" ADD CONSTRAINT IF NOT EXISTS "SaleDelivery_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "SaleDelivery" ADD CONSTRAINT IF NOT EXISTS "SaleDelivery_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;

-- SaleRemito FKs
ALTER TABLE "SaleRemito" ADD CONSTRAINT IF NOT EXISTS "SaleRemito_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
ALTER TABLE "SaleRemito" ADD CONSTRAINT IF NOT EXISTS "SaleRemito_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "SaleRemito" ADD CONSTRAINT IF NOT EXISTS "SaleRemito_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;

-- SalesCreditDebitNote FKs
ALTER TABLE "SalesCreditDebitNote" ADD CONSTRAINT IF NOT EXISTS "SalesCreditDebitNote_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
ALTER TABLE "SalesCreditDebitNote" ADD CONSTRAINT IF NOT EXISTS "SalesCreditDebitNote_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "SalesCreditDebitNote" ADD CONSTRAINT IF NOT EXISTS "SalesCreditDebitNote_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;

-- SalesPriceList FKs
ALTER TABLE "SalesPriceList" ADD CONSTRAINT IF NOT EXISTS "SalesPriceList_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "SalesPriceList" ADD CONSTRAINT IF NOT EXISTS "SalesPriceList_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;

-- SalesPriceListItem FK
ALTER TABLE "SalesPriceListItem" ADD CONSTRAINT IF NOT EXISTS "SalesPriceListItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;

-- StockReservation FK
ALTER TABLE "StockReservation" ADD CONSTRAINT IF NOT EXISTS "StockReservation_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
ALTER TABLE "StockReservation" ADD CONSTRAINT IF NOT EXISTS "StockReservation_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;

-- SalesApproval FKs
ALTER TABLE "SalesApproval" ADD CONSTRAINT IF NOT EXISTS "SalesApproval_solicitadoPor_fkey"
    FOREIGN KEY ("solicitadoPor") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "SalesApproval" ADD CONSTRAINT IF NOT EXISTS "SalesApproval_aprobadoPor_fkey"
    FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "SalesApproval" ADD CONSTRAINT IF NOT EXISTS "SalesApproval_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;

-- SellerKPI FKs
ALTER TABLE "SellerKPI" ADD CONSTRAINT IF NOT EXISTS "SellerKPI_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "SellerKPI" ADD CONSTRAINT IF NOT EXISTS "SellerKPI_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;

-- SaleDeliveryItem FK adicionales
ALTER TABLE "SaleDeliveryItem" ADD CONSTRAINT IF NOT EXISTS "SaleDeliveryItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;

-- SaleRemitoItem FK
ALTER TABLE "SaleRemitoItem" ADD CONSTRAINT IF NOT EXISTS "SaleRemitoItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;

-- SalesInvoiceItem FKs
ALTER TABLE "SalesInvoiceItem" ADD CONSTRAINT IF NOT EXISTS "SalesInvoiceItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL;
ALTER TABLE "SalesInvoiceItem" ADD CONSTRAINT IF NOT EXISTS "SalesInvoiceItem_saleItemId_fkey"
    FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL;

-- SalesCreditDebitNoteItem FK
ALTER TABLE "SalesCreditDebitNoteItem" ADD CONSTRAINT IF NOT EXISTS "SalesCreditDebitNoteItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL;

-- QuoteVersion FK
ALTER TABLE "QuoteVersion" ADD CONSTRAINT IF NOT EXISTS "QuoteVersion_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;

-- ClientPortalAccess FKs
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT IF NOT EXISTS "ClientPortalAccess_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE;
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT IF NOT EXISTS "ClientPortalAccess_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL;
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT IF NOT EXISTS "ClientPortalAccess_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;

-- ClientPaymentCheque FK
ALTER TABLE "ClientPaymentCheque" ADD CONSTRAINT IF NOT EXISTS "ClientPaymentCheque_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;

-- =====================================================
-- AÑADIR CAMPOS A TABLAS EXISTENTES (si no existen)
-- =====================================================

-- Agregar currentDebt y creditLimit a Client si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'currentDebt') THEN
        ALTER TABLE "Client" ADD COLUMN "currentDebt" DECIMAL(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'creditLimit') THEN
        ALTER TABLE "Client" ADD COLUMN "creditLimit" DECIMAL(15,2);
    END IF;
END $$;

-- Mensaje de éxito
DO $$ BEGIN
    RAISE NOTICE 'Sistema de Ventas Premium v2 - Migración completada exitosamente';
END $$;
