-- =============================================
-- SISTEMA DE VENTAS - Tablas con tipos correctos
-- Client.id = TEXT (cuid), Product.id = TEXT (cuid)
-- =============================================

-- ENUMs necesarios
DO $$ BEGIN CREATE TYPE "QuoteStatus" AS ENUM ('BORRADOR', 'ENVIADA', 'EN_NEGOCIACION', 'ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "SaleStatus" AS ENUM ('BORRADOR', 'CONFIRMADA', 'EN_PREPARACION', 'ENTREGADA', 'FACTURADA', 'COMPLETADA', 'CANCELADA'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DocType" AS ENUM ('T1', 'T2', 'T3'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- TABLA: SalesConfig
-- =============================================

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
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesConfig_companyId_fkey') THEN
        ALTER TABLE "SalesConfig" ADD CONSTRAINT "SalesConfig_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- TABLA: Quote (Cotizaciones)
-- clientId es TEXT porque Client.id es String cuid
-- =============================================

CREATE TABLE IF NOT EXISTS "Quote" (
    "id" SERIAL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
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

-- =============================================
-- TABLA: QuoteItem
-- productId es TEXT porque Product.id es String cuid
-- =============================================

CREATE TABLE IF NOT EXISTS "QuoteItem" (
    "id" SERIAL PRIMARY KEY,
    "quoteId" INTEGER NOT NULL,
    "productId" TEXT,
    "descripcion" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" TEXT DEFAULT 'UN',
    "precioUnitario" DECIMAL(15,4) NOT NULL,
    "descuento" DECIMAL(5,2) DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "costo" DECIMAL(15,4) DEFAULT 0,
    "margen" DECIMAL(5,2) DEFAULT 0,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA: QuoteVersion
-- =============================================

CREATE TABLE IF NOT EXISTS "QuoteVersion" (
    "id" SERIAL PRIMARY KEY,
    "quoteId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA: Sale (Órdenes de Venta)
-- =============================================

CREATE TABLE IF NOT EXISTS "Sale" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "quoteId" INTEGER UNIQUE,
    "clientId" TEXT NOT NULL,
    "sellerId" INTEGER,
    "estado" "SaleStatus" DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fechaEntregaEstimada" DATE,
    "fechaEntregaReal" DATE,
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

-- =============================================
-- TABLA: SaleItem
-- =============================================

CREATE TABLE IF NOT EXISTS "SaleItem" (
    "id" SERIAL PRIMARY KEY,
    "saleId" INTEGER NOT NULL,
    "productId" TEXT,
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadEntregada" DECIMAL(15,4) DEFAULT 0,
    "cantidadPendiente" DECIMAL(15,4) NOT NULL,
    "cantidadFacturada" DECIMAL(15,4) DEFAULT 0,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(5,2) DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "costo" DECIMAL(15,4) DEFAULT 0,
    "margen" DECIMAL(5,2) DEFAULT 0,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA: SalesAuditLog
-- =============================================

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

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS "Quote_companyId_idx" ON "Quote"("companyId");
CREATE INDEX IF NOT EXISTS "Quote_clientId_idx" ON "Quote"("clientId");
CREATE INDEX IF NOT EXISTS "Quote_status_idx" ON "Quote"("status");
CREATE INDEX IF NOT EXISTS "Quote_numero_idx" ON "Quote"("numero");
CREATE INDEX IF NOT EXISTS "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");
CREATE INDEX IF NOT EXISTS "QuoteVersion_quoteId_idx" ON "QuoteVersion"("quoteId");
CREATE INDEX IF NOT EXISTS "Sale_companyId_idx" ON "Sale"("companyId");
CREATE INDEX IF NOT EXISTS "Sale_clientId_idx" ON "Sale"("clientId");
CREATE INDEX IF NOT EXISTS "Sale_estado_idx" ON "Sale"("estado");
CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX IF NOT EXISTS "SalesAuditLog_companyId_idx" ON "SalesAuditLog"("companyId");
CREATE INDEX IF NOT EXISTS "SalesAuditLog_entidad_idx" ON "SalesAuditLog"("entidad", "entidadId");

-- =============================================
-- FOREIGN KEYS
-- =============================================

DO $$
BEGIN
    -- Quote FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Quote_clientId_fkey') THEN
        ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey"
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Quote_sellerId_fkey') THEN
        ALTER TABLE "Quote" ADD CONSTRAINT "Quote_sellerId_fkey"
            FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Quote_companyId_fkey') THEN
        ALTER TABLE "Quote" ADD CONSTRAINT "Quote_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Quote_createdBy_fkey') THEN
        ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Quote_approvedBy_fkey') THEN
        ALTER TABLE "Quote" ADD CONSTRAINT "Quote_approvedBy_fkey"
            FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL;
    END IF;

    -- QuoteItem FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteItem_quoteId_fkey') THEN
        ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey"
            FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteItem_productId_fkey') THEN
        ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey"
            FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL;
    END IF;

    -- QuoteVersion FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteVersion_quoteId_fkey') THEN
        ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_quoteId_fkey"
            FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteVersion_createdBy_fkey') THEN
        ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;

    -- Sale FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_clientId_fkey') THEN
        ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey"
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_sellerId_fkey') THEN
        ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey"
            FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_quoteId_fkey') THEN
        ALTER TABLE "Sale" ADD CONSTRAINT "Sale_quoteId_fkey"
            FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_companyId_fkey') THEN
        ALTER TABLE "Sale" ADD CONSTRAINT "Sale_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_createdBy_fkey') THEN
        ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;

    -- SaleItem FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaleItem_saleId_fkey') THEN
        ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey"
            FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaleItem_productId_fkey') THEN
        ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey"
            FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL;
    END IF;

    -- SalesAuditLog FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesAuditLog_companyId_fkey') THEN
        ALTER TABLE "SalesAuditLog" ADD CONSTRAINT "SalesAuditLog_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesAuditLog_userId_fkey') THEN
        ALTER TABLE "SalesAuditLog" ADD CONSTRAINT "SalesAuditLog_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- =============================================
-- FIN
-- =============================================

DO $$ BEGIN
    RAISE NOTICE 'Tablas de Ventas creadas correctamente';
    RAISE NOTICE '- Quote, QuoteItem, QuoteVersion';
    RAISE NOTICE '- Sale, SaleItem';
    RAISE NOTICE '- SalesConfig, SalesAuditLog';
END $$;
