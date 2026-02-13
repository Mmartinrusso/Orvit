-- =============================================
-- SOLO TABLAS DE COTIZACIONES (Quote)
-- =============================================

-- ENUMs necesarios
DO $$ BEGIN CREATE TYPE "QuoteStatus" AS ENUM ('BORRADOR', 'ENVIADA', 'EN_NEGOCIACION', 'ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DocType" AS ENUM ('T1', 'T2', 'T3'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- TABLA: Quote (Cotizaciones)
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

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS "Quote_companyId_idx" ON "Quote"("companyId");
CREATE INDEX IF NOT EXISTS "Quote_clientId_idx" ON "Quote"("clientId");
CREATE INDEX IF NOT EXISTS "Quote_status_idx" ON "Quote"("status");
CREATE INDEX IF NOT EXISTS "Quote_numero_idx" ON "Quote"("numero");
CREATE INDEX IF NOT EXISTS "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");
CREATE INDEX IF NOT EXISTS "QuoteVersion_quoteId_idx" ON "QuoteVersion"("quoteId");

-- =============================================
-- FOREIGN KEYS (solo si no existen)
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

    -- SalesConfig FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesConfig_companyId_fkey') THEN
        ALTER TABLE "SalesConfig" ADD CONSTRAINT "SalesConfig_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FIN
-- =============================================

DO $$ BEGIN
    RAISE NOTICE 'Tablas de Cotizaciones creadas correctamente';
    RAISE NOTICE '- Quote, QuoteItem, QuoteVersion, SalesConfig';
END $$;
