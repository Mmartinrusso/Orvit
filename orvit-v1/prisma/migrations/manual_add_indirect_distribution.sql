-- Migración: Configuración de distribución de costos indirectos
-- Crea la tabla que persiste cómo se distribuye cada categoría de costo
-- indirecto (UTILITIES, VEHICLES, etc.) entre las categorías de producto.

-- Primero, drop de la tabla si existe (permite re-ejecutar en dev)
DROP TABLE IF EXISTS "indirect_distribution_configs";

CREATE TABLE "indirect_distribution_configs" (
  "id"                  SERIAL PRIMARY KEY,
  "companyId"           INTEGER NOT NULL,
  "indirectCategory"    TEXT NOT NULL,
  "productCategoryId"   INTEGER NOT NULL,
  "productCategoryName" TEXT NOT NULL DEFAULT '',
  "percentage"          FLOAT NOT NULL DEFAULT 0,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "indirect_distribution_configs_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,

  CONSTRAINT "indirect_distribution_configs_productCategoryId_fkey"
    FOREIGN KEY ("productCategoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE,

  CONSTRAINT "indirect_distribution_configs_companyId_indirectCategory_productCategoryId_key"
    UNIQUE ("companyId", "indirectCategory", "productCategoryId")
);

CREATE INDEX IF NOT EXISTS "indirect_distribution_configs_companyId_indirectCategory_idx"
  ON "indirect_distribution_configs"("companyId", "indirectCategory");
