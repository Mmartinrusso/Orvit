-- ============================================================
-- Agregar columna aplicaComision a tabla Product
-- Alinear tabla con Prisma schema
-- ============================================================

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "aplicaComision" BOOLEAN NOT NULL DEFAULT true;
