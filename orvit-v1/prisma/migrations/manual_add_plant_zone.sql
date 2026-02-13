-- ============================================
-- MIGRACIÓN: Agregar PlantZone para jerarquía de máquinas
-- ============================================

-- Crear tabla PlantZone
CREATE TABLE IF NOT EXISTS "PlantZone" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "logo" TEXT,
  "photo" TEXT,
  "color" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "parentId" INTEGER,
  "sectorId" INTEGER NOT NULL,
  "companyId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT "PlantZone_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PlantZone"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlantZone_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlantZone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Índices para PlantZone
CREATE INDEX IF NOT EXISTS "PlantZone_sectorId_idx" ON "PlantZone"("sectorId");
CREATE INDEX IF NOT EXISTS "PlantZone_companyId_idx" ON "PlantZone"("companyId");
CREATE INDEX IF NOT EXISTS "PlantZone_parentId_idx" ON "PlantZone"("parentId");

-- Agregar columna plantZoneId a Machine
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "plantZoneId" INTEGER;

-- Foreign key para Machine.plantZoneId
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_plantZoneId_fkey"
  FOREIGN KEY ("plantZoneId") REFERENCES "PlantZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice para Machine.plantZoneId
CREATE INDEX IF NOT EXISTS "Machine_plantZoneId_idx" ON "Machine"("plantZoneId");
