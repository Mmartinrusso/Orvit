-- Migración: Sistema de Tipos de Costo para Productos
-- Fecha: 2026-01-14
-- Descripción: Agrega campos para soportar diferentes tipos de costo (Producción, Compra, Manual)

-- ═══════════════════════════════════════════════════════════════════════════
-- CREAR ENUM PARA TIPO DE COSTO
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductCostType') THEN
        CREATE TYPE "ProductCostType" AS ENUM ('PRODUCTION', 'PURCHASE', 'MANUAL');
    END IF;
END$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- AGREGAR CAMPOS AL MODELO PRODUCT
-- ═══════════════════════════════════════════════════════════════════════════

-- Tipo de costo (default MANUAL para compatibilidad con datos existentes)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costType" "ProductCostType" DEFAULT 'MANUAL';

-- Relación opcional con Recipe (para productos tipo PRODUCTION)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "recipeId" TEXT;

-- Relación opcional con InputItem (para productos tipo PURCHASE)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "purchaseInputId" TEXT;

-- Costo promedio ponderado (para productos tipo PURCHASE)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "weightedAverageCost" DECIMAL(15, 4);

-- Fecha de última actualización de costo
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastCostUpdate" TIMESTAMP;

-- Cantidad en stock usada para el cálculo de costo promedio
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costCalculationStock" INTEGER DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- CREAR FOREIGN KEYS
-- ═══════════════════════════════════════════════════════════════════════════

-- FK a Recipe (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Product_recipeId_fkey'
    ) THEN
        ALTER TABLE "Product" ADD CONSTRAINT "Product_recipeId_fkey"
            FOREIGN KEY ("recipeId") REFERENCES "Recipe"(id) ON DELETE SET NULL;
    END IF;
END$$;

-- FK a InputItem (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Product_purchaseInputId_fkey'
    ) THEN
        ALTER TABLE "Product" ADD CONSTRAINT "Product_purchaseInputId_fkey"
            FOREIGN KEY ("purchaseInputId") REFERENCES "InputItem"(id) ON DELETE SET NULL;
    END IF;
END$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CREAR ÍNDICES
-- ═══════════════════════════════════════════════════════════════════════════

-- Índice para filtrar por tipo de costo
CREATE INDEX IF NOT EXISTS "Product_costType_idx" ON "Product"("costType");

-- Índice para búsqueda por receta
CREATE INDEX IF NOT EXISTS "Product_recipeId_idx" ON "Product"("recipeId");

-- Índice para búsqueda por insumo de compra
CREATE INDEX IF NOT EXISTS "Product_purchaseInputId_idx" ON "Product"("purchaseInputId");

-- ═══════════════════════════════════════════════════════════════════════════
-- CREAR TABLA DE HISTORIAL DE COSTOS (si no existe una similar)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "ProductCostLog" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "productId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,

    -- Valores del cambio
    "previousCost" DECIMAL(15, 4),
    "newCost" DECIMAL(15, 4) NOT NULL,
    "previousStock" INTEGER,
    "newStock" INTEGER,

    -- Origen del cambio
    "changeSource" TEXT NOT NULL, -- 'PURCHASE', 'RECIPE_UPDATE', 'MANUAL', 'BATCH_RUN'
    "sourceDocumentId" TEXT,      -- ID del documento origen (ej: ID de compra)
    "sourceDocumentType" TEXT,    -- Tipo de documento (ej: 'PurchaseVoucher')

    -- Cálculo detallado (para auditoría)
    "purchaseQuantity" DECIMAL(12, 4),
    "purchaseUnitPrice" DECIMAL(15, 4),
    "calculationMethod" TEXT,     -- 'WEIGHTED_AVERAGE', 'LAST_PURCHASE', 'RECIPE_SUM'

    -- Metadata
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "createdById" INTEGER,
    "notes" TEXT,

    CONSTRAINT "ProductCostLog_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE,
    CONSTRAINT "ProductCostLog_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE
);

-- Índices para ProductCostLog
CREATE INDEX IF NOT EXISTS "ProductCostLog_productId_idx" ON "ProductCostLog"("productId");
CREATE INDEX IF NOT EXISTS "ProductCostLog_companyId_createdAt_idx" ON "ProductCostLog"("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ProductCostLog_changeSource_idx" ON "ProductCostLog"("changeSource");

-- ═══════════════════════════════════════════════════════════════════════════
-- COMENTARIOS
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON COLUMN "Product"."costType" IS 'Tipo de costo: PRODUCTION (receta), PURCHASE (compra), MANUAL';
COMMENT ON COLUMN "Product"."recipeId" IS 'Receta vinculada para productos tipo PRODUCTION';
COMMENT ON COLUMN "Product"."purchaseInputId" IS 'InputItem vinculado para productos tipo PURCHASE';
COMMENT ON COLUMN "Product"."weightedAverageCost" IS 'Costo promedio ponderado calculado para productos PURCHASE';
COMMENT ON COLUMN "Product"."lastCostUpdate" IS 'Última vez que se actualizó el costo';
COMMENT ON COLUMN "Product"."costCalculationStock" IS 'Stock usado en el último cálculo de costo promedio';

COMMENT ON TABLE "ProductCostLog" IS 'Historial de cambios de costo de productos para auditoría';
