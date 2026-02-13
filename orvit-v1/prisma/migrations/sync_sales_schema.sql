-- =============================================
-- SINCRONIZAR TABLAS SALES CON PRISMA SCHEMA
-- Sin eliminar datos existentes
-- =============================================

-- ENUMs (ya deberían existir pero por si acaso)
DO $$ BEGIN CREATE TYPE "SaleStatus" AS ENUM ('BORRADOR', 'CONFIRMADA', 'EN_PREPARACION', 'ENTREGADA', 'FACTURADA', 'COMPLETADA', 'CANCELADA'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DocType" AS ENUM ('T1', 'T2', 'T3'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- TABLA: sales (Sale en Prisma)
-- =============================================

CREATE TABLE IF NOT EXISTS "sales" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "sellerId" INTEGER,
    "quoteId" INTEGER UNIQUE,
    "estado" "SaleStatus" DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fechaEntregaEstimada" DATE,
    "fechaEntregaReal" DATE,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "descuentoGlobal" DECIMAL(5,2) DEFAULT 0,
    "descuentoMonto" DECIMAL(15,2) DEFAULT 0,
    "tasaIva" DECIMAL(5,2) DEFAULT 21,
    "impuestos" DECIMAL(15,2) DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "moneda" VARCHAR(10) DEFAULT 'ARS',
    "condicionesPago" VARCHAR(255),
    "diasPlazo" INTEGER,
    "lugarEntrega" TEXT,
    "notas" TEXT,
    "notasInternas" TEXT,
    "requiereAprobacion" BOOLEAN DEFAULT false,
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "comisionPorcentaje" DECIMAL(5,2),
    "comisionMonto" DECIMAL(15,2),
    "comisionPagada" BOOLEAN DEFAULT false,
    "comisionPagadaAt" TIMESTAMP(3),
    "costoTotal" DECIMAL(15,2),
    "margenBruto" DECIMAL(15,2),
    "margenPorcentaje" DECIMAL(5,2),
    "docType" "DocType" DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Agregar columnas que pueden faltar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'fechaEmision') THEN
        ALTER TABLE "sales" ADD COLUMN "fechaEmision" DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'estado') THEN
        ALTER TABLE "sales" ADD COLUMN "estado" "SaleStatus" DEFAULT 'BORRADOR';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'quoteId') THEN
        ALTER TABLE "sales" ADD COLUMN "quoteId" INTEGER UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'descuentoGlobal') THEN
        ALTER TABLE "sales" ADD COLUMN "descuentoGlobal" DECIMAL(5,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'descuentoMonto') THEN
        ALTER TABLE "sales" ADD COLUMN "descuentoMonto" DECIMAL(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'diasPlazo') THEN
        ALTER TABLE "sales" ADD COLUMN "diasPlazo" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'lugarEntrega') THEN
        ALTER TABLE "sales" ADD COLUMN "lugarEntrega" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'requiereAprobacion') THEN
        ALTER TABLE "sales" ADD COLUMN "requiereAprobacion" BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'aprobadoPor') THEN
        ALTER TABLE "sales" ADD COLUMN "aprobadoPor" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'aprobadoAt') THEN
        ALTER TABLE "sales" ADD COLUMN "aprobadoAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'comisionPorcentaje') THEN
        ALTER TABLE "sales" ADD COLUMN "comisionPorcentaje" DECIMAL(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'comisionMonto') THEN
        ALTER TABLE "sales" ADD COLUMN "comisionMonto" DECIMAL(15,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'comisionPagada') THEN
        ALTER TABLE "sales" ADD COLUMN "comisionPagada" BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'comisionPagadaAt') THEN
        ALTER TABLE "sales" ADD COLUMN "comisionPagadaAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'costoTotal') THEN
        ALTER TABLE "sales" ADD COLUMN "costoTotal" DECIMAL(15,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'margenBruto') THEN
        ALTER TABLE "sales" ADD COLUMN "margenBruto" DECIMAL(15,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'margenPorcentaje') THEN
        ALTER TABLE "sales" ADD COLUMN "margenPorcentaje" DECIMAL(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'docType') THEN
        ALTER TABLE "sales" ADD COLUMN "docType" "DocType" DEFAULT 'T1';
    END IF;
END $$;

-- =============================================
-- TABLA: sale_items (SaleItem en Prisma)
-- =============================================

CREATE TABLE IF NOT EXISTS "sale_items" (
    "id" SERIAL PRIMARY KEY,
    "saleId" INTEGER NOT NULL,
    "productId" TEXT,
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadEntregada" DECIMAL(15,4) DEFAULT 0,
    "cantidadPendiente" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL DEFAULT 'UN',
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(5,2) DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "costoUnitario" DECIMAL(15,2),
    "notas" TEXT,
    "orden" INTEGER DEFAULT 0
);

-- Agregar columnas que pueden faltar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'codigo') THEN
        ALTER TABLE "sale_items" ADD COLUMN "codigo" VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'cantidadEntregada') THEN
        ALTER TABLE "sale_items" ADD COLUMN "cantidadEntregada" DECIMAL(15,4) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'cantidadPendiente') THEN
        ALTER TABLE "sale_items" ADD COLUMN "cantidadPendiente" DECIMAL(15,4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'costoUnitario') THEN
        ALTER TABLE "sale_items" ADD COLUMN "costoUnitario" DECIMAL(15,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'orden') THEN
        ALTER TABLE "sale_items" ADD COLUMN "orden" INTEGER DEFAULT 0;
    END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS "sales_companyId_idx" ON "sales"("companyId");
CREATE INDEX IF NOT EXISTS "sales_clientId_idx" ON "sales"("clientId");
CREATE INDEX IF NOT EXISTS "sales_sellerId_idx" ON "sales"("sellerId");
CREATE INDEX IF NOT EXISTS "sales_estado_idx" ON "sales"("estado");
CREATE INDEX IF NOT EXISTS "sales_fechaEmision_idx" ON "sales"("fechaEmision");
CREATE INDEX IF NOT EXISTS "sales_docType_idx" ON "sales"("docType");
CREATE INDEX IF NOT EXISTS "sale_items_saleId_idx" ON "sale_items"("saleId");
CREATE INDEX IF NOT EXISTS "sale_items_productId_idx" ON "sale_items"("productId");
CREATE INDEX IF NOT EXISTS "SalesAuditLog_companyId_idx" ON "SalesAuditLog"("companyId");
CREATE INDEX IF NOT EXISTS "SalesAuditLog_entidad_idx" ON "SalesAuditLog"("entidad", "entidadId");

-- =============================================
-- UNIQUE CONSTRAINT
-- =============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_companyId_numero_key') THEN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_companyId_numero_key" UNIQUE ("companyId", "numero");
    END IF;
END $$;

-- =============================================
-- FOREIGN KEYS (solo si no existen)
-- =============================================

DO $$
BEGIN
    -- sales FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_clientId_fkey') THEN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_clientId_fkey"
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_sellerId_fkey') THEN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_sellerId_fkey"
            FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_quoteId_fkey') THEN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_quoteId_fkey"
            FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_companyId_fkey') THEN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_createdBy_fkey') THEN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_aprobadoPor_fkey') THEN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_aprobadoPor_fkey"
            FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL;
    END IF;

    -- sale_items FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_saleId_fkey') THEN
        ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey"
            FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_productId_fkey') THEN
        ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey"
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
    RAISE NOTICE 'Tablas de Ventas sincronizadas correctamente';
    RAISE NOTICE '- sales, sale_items, SalesAuditLog';
END $$;
