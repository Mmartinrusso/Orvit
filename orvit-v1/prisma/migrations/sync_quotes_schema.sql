-- =============================================
-- SINCRONIZAR TABLAS QUOTES CON PRISMA SCHEMA
-- Sin eliminar datos existentes
-- =============================================

-- ENUMs necesarios
DO $$ BEGIN CREATE TYPE "QuoteStatus" AS ENUM ('BORRADOR', 'ENVIADA', 'EN_NEGOCIACION', 'ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "SaleStatus" AS ENUM ('BORRADOR', 'CONFIRMADA', 'EN_PREPARACION', 'ENTREGADA', 'FACTURADA', 'COMPLETADA', 'CANCELADA'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DocType" AS ENUM ('T1', 'T2', 'T3'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- TABLA: quotes (Quote en Prisma)
-- =============================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS "quotes" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "sellerId" INTEGER,
    "estado" "QuoteStatus" DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fechaValidez" DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    "fechaEnvio" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "descuentoGlobal" DECIMAL(5,2) DEFAULT 0,
    "descuentoMonto" DECIMAL(15,2) DEFAULT 0,
    "tasaIva" DECIMAL(5,2) DEFAULT 21,
    "impuestos" DECIMAL(15,2) DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "moneda" VARCHAR(10) DEFAULT 'ARS',
    "tipoCambio" DECIMAL(15,4),
    "condicionesPago" VARCHAR(255),
    "diasPlazo" INTEGER,
    "condicionesEntrega" VARCHAR(255),
    "tiempoEntrega" VARCHAR(100),
    "lugarEntrega" TEXT,
    "titulo" VARCHAR(255),
    "descripcion" TEXT,
    "notas" TEXT,
    "notasInternas" TEXT,
    "requiereAprobacion" BOOLEAN DEFAULT false,
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "motivoPerdida" TEXT,
    "competidorGanador" TEXT,
    "precioCompetidor" DECIMAL(15,2),
    "convertidaAVentaId" INTEGER,
    "convertidaAt" TIMESTAMP(3),
    "costoTotal" DECIMAL(15,2),
    "margenBruto" DECIMAL(15,2),
    "margenPorcentaje" DECIMAL(5,2),
    "comisionPorcentaje" DECIMAL(5,2),
    "comisionMonto" DECIMAL(15,2),
    "docType" "DocType" DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Agregar columnas que pueden faltar (ALTER TABLE ADD COLUMN IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'fechaEmision') THEN
        ALTER TABLE "quotes" ADD COLUMN "fechaEmision" DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'fechaValidez') THEN
        ALTER TABLE "quotes" ADD COLUMN "fechaValidez" DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'estado') THEN
        ALTER TABLE "quotes" ADD COLUMN "estado" "QuoteStatus" DEFAULT 'BORRADOR';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'descripcion') THEN
        ALTER TABLE "quotes" ADD COLUMN "descripcion" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'descuentoGlobal') THEN
        ALTER TABLE "quotes" ADD COLUMN "descuentoGlobal" DECIMAL(5,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'descuentoMonto') THEN
        ALTER TABLE "quotes" ADD COLUMN "descuentoMonto" DECIMAL(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'diasPlazo') THEN
        ALTER TABLE "quotes" ADD COLUMN "diasPlazo" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'lugarEntrega') THEN
        ALTER TABLE "quotes" ADD COLUMN "lugarEntrega" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'titulo') THEN
        ALTER TABLE "quotes" ADD COLUMN "titulo" VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'requiereAprobacion') THEN
        ALTER TABLE "quotes" ADD COLUMN "requiereAprobacion" BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'aprobadoPor') THEN
        ALTER TABLE "quotes" ADD COLUMN "aprobadoPor" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'aprobadoAt') THEN
        ALTER TABLE "quotes" ADD COLUMN "aprobadoAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'costoTotal') THEN
        ALTER TABLE "quotes" ADD COLUMN "costoTotal" DECIMAL(15,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'margenBruto') THEN
        ALTER TABLE "quotes" ADD COLUMN "margenBruto" DECIMAL(15,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'margenPorcentaje') THEN
        ALTER TABLE "quotes" ADD COLUMN "margenPorcentaje" DECIMAL(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'docType') THEN
        ALTER TABLE "quotes" ADD COLUMN "docType" "DocType" DEFAULT 'T1';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'isExpired') THEN
        ALTER TABLE "quotes" ADD COLUMN "isExpired" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'version') THEN
        ALTER TABLE "quotes" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- =============================================
-- ENUM: QuoteType (Tipo de documento)
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuoteType') THEN
        CREATE TYPE "QuoteType" AS ENUM ('COTIZACION', 'NOTA_PEDIDO');
    END IF;
END $$;

-- Agregar columna quoteType si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quoteType') THEN
        ALTER TABLE "quotes" ADD COLUMN "quoteType" "QuoteType" NOT NULL DEFAULT 'COTIZACION';
    END IF;
END $$;

-- =============================================
-- TABLA: quote_items (QuoteItem en Prisma)
-- =============================================

CREATE TABLE IF NOT EXISTS "quote_items" (
    "id" SERIAL PRIMARY KEY,
    "quoteId" INTEGER NOT NULL,
    "productId" TEXT,
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL DEFAULT 'UN',
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(5,2) DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "costoUnitario" DECIMAL(15,2),
    "margenItem" DECIMAL(5,2),
    "notas" TEXT,
    "orden" INTEGER DEFAULT 0
);

-- Agregar columnas que pueden faltar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_items' AND column_name = 'codigo') THEN
        ALTER TABLE "quote_items" ADD COLUMN "codigo" VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_items' AND column_name = 'costoUnitario') THEN
        ALTER TABLE "quote_items" ADD COLUMN "costoUnitario" DECIMAL(15,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_items' AND column_name = 'margenItem') THEN
        ALTER TABLE "quote_items" ADD COLUMN "margenItem" DECIMAL(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_items' AND column_name = 'orden') THEN
        ALTER TABLE "quote_items" ADD COLUMN "orden" INTEGER DEFAULT 0;
    END IF;
END $$;

-- =============================================
-- TABLA: quote_versions (QuoteVersion en Prisma)
-- =============================================

CREATE TABLE IF NOT EXISTS "quote_versions" (
    "id" SERIAL PRIMARY KEY,
    "quoteId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "datos" JSONB NOT NULL,
    "motivo" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Agregar columnas que pueden faltar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_versions' AND column_name = 'datos') THEN
        ALTER TABLE "quote_versions" ADD COLUMN "datos" JSONB NOT NULL DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_versions' AND column_name = 'motivo') THEN
        ALTER TABLE "quote_versions" ADD COLUMN "motivo" TEXT;
    END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS "quotes_companyId_idx" ON "quotes"("companyId");
CREATE INDEX IF NOT EXISTS "quotes_clientId_idx" ON "quotes"("clientId");
CREATE INDEX IF NOT EXISTS "quotes_sellerId_idx" ON "quotes"("sellerId");
CREATE INDEX IF NOT EXISTS "quotes_estado_idx" ON "quotes"("estado");
CREATE INDEX IF NOT EXISTS "quotes_fechaEmision_idx" ON "quotes"("fechaEmision");
CREATE INDEX IF NOT EXISTS "quotes_fechaValidez_idx" ON "quotes"("fechaValidez");
CREATE INDEX IF NOT EXISTS "quotes_docType_idx" ON "quotes"("docType");
CREATE INDEX IF NOT EXISTS "quotes_companyId_isExpired_idx" ON "quotes"("companyId", "isExpired");
CREATE INDEX IF NOT EXISTS "quotes_quoteType_idx" ON "quotes"("quoteType");
CREATE INDEX IF NOT EXISTS "quotes_companyId_quoteType_idx" ON "quotes"("companyId", "quoteType");
CREATE INDEX IF NOT EXISTS "quote_items_quoteId_idx" ON "quote_items"("quoteId");
CREATE INDEX IF NOT EXISTS "quote_items_productId_idx" ON "quote_items"("productId");
CREATE INDEX IF NOT EXISTS "quote_versions_quoteId_idx" ON "quote_versions"("quoteId");

-- =============================================
-- UNIQUE CONSTRAINT
-- =============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_companyId_numero_key') THEN
        ALTER TABLE "quotes" ADD CONSTRAINT "quotes_companyId_numero_key" UNIQUE ("companyId", "numero");
    END IF;
END $$;

-- =============================================
-- FOREIGN KEYS (solo si no existen)
-- =============================================

DO $$
BEGIN
    -- quotes FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_clientId_fkey') THEN
        ALTER TABLE "quotes" ADD CONSTRAINT "quotes_clientId_fkey"
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_sellerId_fkey') THEN
        ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sellerId_fkey"
            FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_companyId_fkey') THEN
        ALTER TABLE "quotes" ADD CONSTRAINT "quotes_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_createdBy_fkey') THEN
        ALTER TABLE "quotes" ADD CONSTRAINT "quotes_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_aprobadoPor_fkey') THEN
        ALTER TABLE "quotes" ADD CONSTRAINT "quotes_aprobadoPor_fkey"
            FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL;
    END IF;

    -- quote_items FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_quoteId_fkey') THEN
        ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_fkey"
            FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_productId_fkey') THEN
        ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_productId_fkey"
            FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL;
    END IF;

    -- quote_versions FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_versions_quoteId_fkey') THEN
        ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quoteId_fkey"
            FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_versions_createdBy_fkey') THEN
        ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_createdBy_fkey"
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
    RAISE NOTICE 'Tablas de Cotizaciones sincronizadas correctamente';
    RAISE NOTICE '- quotes, quote_items, quote_versions, SalesConfig';
END $$;
