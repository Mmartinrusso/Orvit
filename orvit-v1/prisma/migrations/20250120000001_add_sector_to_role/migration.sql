-- AlterTable
-- Agregar columna sectorId a la tabla Role de forma segura
-- Esta migración NO afecta los datos existentes ya que la columna es nullable

ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "sectorId" INTEGER;

-- AddForeignKey
-- Agregar la relación con Sector
ALTER TABLE "Role" ADD CONSTRAINT "Role_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

