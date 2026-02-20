-- Migración: Agrega tabla supply_categories y columna categoryId en supplies
-- Necesario porque el schema de Prisma tiene este modelo pero la DB no lo tiene aún.

-- 1. Crear tabla supply_categories (si no existe)
CREATE TABLE IF NOT EXISTS "supply_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "code" VARCHAR(20),
    "color" VARCHAR(7),
    "icon" VARCHAR(50),
    "parentId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supply_categories_pkey" PRIMARY KEY ("id")
);

-- 2. Índices y constraints de supply_categories
CREATE UNIQUE INDEX IF NOT EXISTS "supply_categories_companyId_name_key" ON "supply_categories"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "supply_categories_companyId_code_key" ON "supply_categories"("companyId", "code");
CREATE INDEX IF NOT EXISTS "supply_categories_parentId_idx" ON "supply_categories"("parentId");

-- FK de supply_categories a Company
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supply_categories_companyId_fkey'
  ) THEN
    ALTER TABLE "supply_categories"
      ADD CONSTRAINT "supply_categories_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- FK self-referential para jerarquía de categorías
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supply_categories_parentId_fkey'
  ) THEN
    ALTER TABLE "supply_categories"
      ADD CONSTRAINT "supply_categories_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "supply_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Agregar columna categoryId a supplies (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplies' AND column_name = 'categoryId'
  ) THEN
    ALTER TABLE "supplies" ADD COLUMN "categoryId" INTEGER;
  END IF;
END $$;

-- 4. Índice en supplies.categoryId
CREATE INDEX IF NOT EXISTS "supplies_categoryId_idx" ON "supplies"("categoryId");

-- 5. FK de supplies.categoryId a supply_categories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplies_categoryId_fkey'
  ) THEN
    ALTER TABLE "supplies"
      ADD CONSTRAINT "supplies_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "supply_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
