-- =============================================
-- FIX: Corregir tipos de columnas en Sale y SaleItem
-- =============================================

-- Crear enum SaleStatus si no existe
DO $$ BEGIN CREATE TYPE "SaleStatus" AS ENUM ('BORRADOR', 'CONFIRMADA', 'EN_PREPARACION', 'ENTREGADA', 'FACTURADA', 'COMPLETADA', 'CANCELADA'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PASO 1: Verificar si la tabla Sale existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Sale') THEN
        -- Crear la tabla Sale si no existe
        CREATE TABLE "Sale" (
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
        RAISE NOTICE 'Tabla Sale creada';
    ELSE
        RAISE NOTICE 'Tabla Sale ya existe';
    END IF;
END $$;

-- PASO 2: Verificar si la tabla SaleItem existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SaleItem') THEN
        CREATE TABLE "SaleItem" (
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
        RAISE NOTICE 'Tabla SaleItem creada';
    ELSE
        RAISE NOTICE 'Tabla SaleItem ya existe';
    END IF;
END $$;

-- PASO 3: Verificar si la tabla SalesAuditLog existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SalesAuditLog') THEN
        CREATE TABLE "SalesAuditLog" (
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
        RAISE NOTICE 'Tabla SalesAuditLog creada';
    ELSE
        RAISE NOTICE 'Tabla SalesAuditLog ya existe';
    END IF;
END $$;

-- PASO 4: Eliminar foreign keys con tipos incorrectos si existen
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_clientId_fkey') THEN
        ALTER TABLE "Sale" DROP CONSTRAINT "Sale_clientId_fkey";
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaleItem_productId_fkey') THEN
        ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_productId_fkey";
    END IF;
END $$;

-- PASO 5: Corregir tipos de columnas en Sale
DO $$
BEGIN
    -- Verificar si clientId en Sale es INTEGER
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Sale' AND column_name = 'clientId'
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE "Sale" ALTER COLUMN "clientId" TYPE TEXT USING "clientId"::TEXT;
        RAISE NOTICE 'Sale.clientId convertido a TEXT';
    END IF;

    -- Verificar si productId en SaleItem es INTEGER
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'SaleItem' AND column_name = 'productId'
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE "SaleItem" ALTER COLUMN "productId" TYPE TEXT USING "productId"::TEXT;
        RAISE NOTICE 'SaleItem.productId convertido a TEXT';
    END IF;
END $$;

-- PASO 6: Agregar columna estado si no existe (por si la tabla fue creada con nombre diferente)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Sale' AND column_name = 'estado') THEN
        ALTER TABLE "Sale" ADD COLUMN "estado" "SaleStatus" DEFAULT 'BORRADOR';
        RAISE NOTICE 'Columna estado agregada a Sale';
    END IF;
END $$;

-- PASO 7: Índices
CREATE INDEX IF NOT EXISTS "Sale_companyId_idx" ON "Sale"("companyId");
CREATE INDEX IF NOT EXISTS "Sale_clientId_idx" ON "Sale"("clientId");
CREATE INDEX IF NOT EXISTS "Sale_estado_idx" ON "Sale"("estado");
CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX IF NOT EXISTS "SalesAuditLog_companyId_idx" ON "SalesAuditLog"("companyId");
CREATE INDEX IF NOT EXISTS "SalesAuditLog_entidad_idx" ON "SalesAuditLog"("entidad", "entidadId");

-- PASO 8: Agregar foreign keys
DO $$
BEGIN
    -- Sale FKs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_clientId_fkey') THEN
        -- Solo si no hay datos huérfanos
        IF NOT EXISTS (SELECT 1 FROM "Sale" s LEFT JOIN "Client" c ON s."clientId" = c.id WHERE c.id IS NULL AND s."clientId" IS NOT NULL) THEN
            ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey"
                FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
        END IF;
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
        IF NOT EXISTS (SELECT 1 FROM "SaleItem" si LEFT JOIN "Product" p ON si."productId" = p.id WHERE p.id IS NULL AND si."productId" IS NOT NULL) THEN
            ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey"
                FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL;
        END IF;
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

DO $$ BEGIN
    RAISE NOTICE 'Tablas Sale, SaleItem, SalesAuditLog configuradas correctamente';
END $$;
