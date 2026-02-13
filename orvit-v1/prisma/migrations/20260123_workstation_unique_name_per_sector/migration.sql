-- AlterTable: Agregar constraint único de nombre por sector en WorkStation
-- Esto permite que el mismo nombre exista en diferentes sectores, pero no dentro del mismo sector

-- Primero verificar si hay duplicados existentes
-- SELECT name, "sectorId", COUNT(*)
-- FROM "WorkStation"
-- GROUP BY name, "sectorId"
-- HAVING COUNT(*) > 1;

-- Si hay duplicados, deberás renombrarlos manualmente antes de ejecutar esta migración

-- Crear el índice único
CREATE UNIQUE INDEX IF NOT EXISTS "WorkStation_name_sectorId_key" ON "WorkStation"("name", "sectorId");
