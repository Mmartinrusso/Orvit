-- =============================================
-- FIX: Corregir tipos de columnas en Quote y QuoteItem
-- =============================================

-- PASO 1: Eliminar foreign keys existentes que usan tipos incorrectos
DO $$
BEGIN
    -- Quote FKs
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Quote_clientId_fkey') THEN
        ALTER TABLE "Quote" DROP CONSTRAINT "Quote_clientId_fkey";
    END IF;

    -- QuoteItem FKs
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteItem_productId_fkey') THEN
        ALTER TABLE "QuoteItem" DROP CONSTRAINT "QuoteItem_productId_fkey";
    END IF;
END $$;

-- PASO 2: Cambiar tipos de columnas (INTEGER -> TEXT)
-- Si la columna tiene datos, se convertirán a TEXT
DO $$
BEGIN
    -- Verificar si clientId en Quote es INTEGER
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Quote' AND column_name = 'clientId'
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE "Quote" ALTER COLUMN "clientId" TYPE TEXT USING "clientId"::TEXT;
        RAISE NOTICE 'Quote.clientId convertido a TEXT';
    END IF;

    -- Verificar si productId en QuoteItem es INTEGER
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'QuoteItem' AND column_name = 'productId'
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE "QuoteItem" ALTER COLUMN "productId" TYPE TEXT USING "productId"::TEXT;
        RAISE NOTICE 'QuoteItem.productId convertido a TEXT';
    END IF;
END $$;

-- PASO 3: Agregar foreign keys con tipos correctos
DO $$
BEGIN
    -- Quote -> Client
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Quote_clientId_fkey') THEN
        -- Solo agregar FK si hay un Client para cada clientId existente
        -- O si la tabla está vacía
        IF NOT EXISTS (SELECT 1 FROM "Quote" WHERE "clientId" IS NOT NULL LIMIT 1) OR
           NOT EXISTS (SELECT q."clientId" FROM "Quote" q LEFT JOIN "Client" c ON q."clientId" = c.id WHERE c.id IS NULL AND q."clientId" IS NOT NULL) THEN
            ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey"
                FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
            RAISE NOTICE 'FK Quote_clientId_fkey creada';
        ELSE
            RAISE NOTICE 'No se puede crear FK Quote_clientId - hay clientIds sin Client correspondiente';
        END IF;
    END IF;

    -- QuoteItem -> Product
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteItem_productId_fkey') THEN
        IF NOT EXISTS (SELECT 1 FROM "QuoteItem" WHERE "productId" IS NOT NULL LIMIT 1) OR
           NOT EXISTS (SELECT qi."productId" FROM "QuoteItem" qi LEFT JOIN "Product" p ON qi."productId" = p.id WHERE p.id IS NULL AND qi."productId" IS NOT NULL) THEN
            ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey"
                FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL;
            RAISE NOTICE 'FK QuoteItem_productId_fkey creada';
        ELSE
            RAISE NOTICE 'No se puede crear FK QuoteItem_productId - hay productIds sin Product correspondiente';
        END IF;
    END IF;
END $$;

-- PASO 4: Verificar otras FKs necesarias
DO $$
BEGIN
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
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteItem_quoteId_fkey') THEN
        ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey"
            FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteVersion_quoteId_fkey') THEN
        ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_quoteId_fkey"
            FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteVersion_createdBy_fkey') THEN
        ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesConfig_companyId_fkey') THEN
        ALTER TABLE "SalesConfig" ADD CONSTRAINT "SalesConfig_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    RAISE NOTICE 'Tipos de columnas corregidos exitosamente';
END $$;
