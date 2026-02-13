-- Migración: Sistema de Listas de Descuentos
-- Fecha: 2026-01-13

-- =====================================================
-- TABLA: DiscountList (Listas/Plantillas de descuentos)
-- =====================================================
CREATE TABLE IF NOT EXISTS "DiscountList" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "companyId" INTEGER NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS "DiscountList_companyId_idx" ON "DiscountList"("companyId");
CREATE INDEX IF NOT EXISTS "DiscountList_isActive_idx" ON "DiscountList"("isActive");

-- Unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DiscountList_companyId_name_key'
  ) THEN
    ALTER TABLE "DiscountList" ADD CONSTRAINT "DiscountList_companyId_name_key" UNIQUE ("companyId", name);
  END IF;
END $$;

-- =====================================================
-- TABLA: DiscountListRubro (Descuentos por Rubro/Categoría)
-- =====================================================
CREATE TABLE IF NOT EXISTS "DiscountListRubro" (
  id TEXT PRIMARY KEY,
  "discountListId" TEXT NOT NULL REFERENCES "DiscountList"(id) ON DELETE CASCADE,
  "categoryId" INTEGER NOT NULL REFERENCES "Category"(id) ON DELETE CASCADE,
  "categoryName" TEXT NOT NULL,
  "serieDesde" INTEGER DEFAULT 0,
  "serieHasta" INTEGER DEFAULT 0,
  descuento1 DECIMAL(5,2),
  descuento2 DECIMAL(5,2),
  "descuentoPago" DECIMAL(5,2),
  comision DECIMAL(5,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS "DiscountListRubro_discountListId_idx" ON "DiscountListRubro"("discountListId");
CREATE INDEX IF NOT EXISTS "DiscountListRubro_categoryId_idx" ON "DiscountListRubro"("categoryId");

-- =====================================================
-- TABLA: DiscountListProduct (Descuentos por Producto específico)
-- =====================================================
CREATE TABLE IF NOT EXISTS "DiscountListProduct" (
  id TEXT PRIMARY KEY,
  "discountListId" TEXT NOT NULL REFERENCES "DiscountList"(id) ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
  "productCode" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  descuento DECIMAL(5,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS "DiscountListProduct_discountListId_idx" ON "DiscountListProduct"("discountListId");
CREATE INDEX IF NOT EXISTS "DiscountListProduct_productId_idx" ON "DiscountListProduct"("productId");

-- =====================================================
-- AGREGAR CAMPO discountListId A CLIENTE
-- =====================================================
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "discountListId" TEXT REFERENCES "DiscountList"(id) ON UPDATE NO ACTION;

-- Índice para discountListId en Client
CREATE INDEX IF NOT EXISTS "Client_discountListId_idx" ON "Client"("discountListId");

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================
COMMENT ON TABLE "DiscountList" IS 'Listas/Plantillas de descuentos que se asignan a clientes';
COMMENT ON TABLE "DiscountListRubro" IS 'Descuentos por rubro/categoría dentro de una lista';
COMMENT ON TABLE "DiscountListProduct" IS 'Descuentos por producto específico dentro de una lista';
COMMENT ON COLUMN "DiscountListRubro".descuento1 IS 'Descuento principal (%)';
COMMENT ON COLUMN "DiscountListRubro".descuento2 IS 'Descuento secundario (%)';
COMMENT ON COLUMN "DiscountListRubro"."descuentoPago" IS 'Descuento por pronto pago (%)';
COMMENT ON COLUMN "DiscountListRubro".comision IS 'Comisión (%)';
COMMENT ON COLUMN "Client"."discountListId" IS 'Lista de descuentos asignada al cliente';
