-- Migration: Add Product sale price, margin fields, and ProductStockMovement model
-- Date: 2026-01-15

-- 1. Add new columns to Product table
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "salePrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleCurrency" TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "marginMin" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "marginMax" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tags" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trackBatches" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trackExpiration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "alertStockEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "alertStockDays" INTEGER;

-- 2. Create index for barcode
CREATE INDEX IF NOT EXISTS "Product_barcode_idx" ON "Product"("barcode");

-- 3. Create index for companyId + isActive
CREATE INDEX IF NOT EXISTS "Product_companyId_isActive_idx" ON "Product"("companyId", "isActive");

-- 4. Create enum for ProductStockMovementType if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductStockMovementType') THEN
        CREATE TYPE "ProductStockMovementType" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');
    END IF;
END$$;

-- 5. Create ProductStockMovement table
CREATE TABLE IF NOT EXISTS "product_stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tipo" "ProductStockMovementType" NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "stockAnterior" DOUBLE PRECISION NOT NULL,
    "stockPosterior" DOUBLE PRECISION NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceNumber" TEXT,
    "motivo" TEXT,
    "notas" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_stock_movements_pkey" PRIMARY KEY ("id")
);

-- 6. Create indexes for ProductStockMovement
CREATE INDEX IF NOT EXISTS "product_stock_movements_productId_idx" ON "product_stock_movements"("productId");
CREATE INDEX IF NOT EXISTS "product_stock_movements_companyId_createdAt_idx" ON "product_stock_movements"("companyId", "createdAt" DESC);

-- 7. Add foreign keys for ProductStockMovement
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'product_stock_movements_productId_fkey'
    ) THEN
        ALTER TABLE "product_stock_movements" ADD CONSTRAINT "product_stock_movements_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'product_stock_movements_companyId_fkey'
    ) THEN
        ALTER TABLE "product_stock_movements" ADD CONSTRAINT "product_stock_movements_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'product_stock_movements_createdBy_fkey'
    ) THEN
        ALTER TABLE "product_stock_movements" ADD CONSTRAINT "product_stock_movements_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;
