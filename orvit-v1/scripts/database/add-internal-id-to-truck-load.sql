-- Script para agregar campos internalId a Truck y Load
-- Ejecutar manualmente si es necesario

-- Agregar campo internalId a Truck
ALTER TABLE "Truck" 
ADD COLUMN IF NOT EXISTS "internalId" INTEGER;

-- Agregar campo internalId a Load
ALTER TABLE "Load" 
ADD COLUMN IF NOT EXISTS "internalId" INTEGER;

-- Crear índices únicos para internalId por empresa
CREATE UNIQUE INDEX IF NOT EXISTS "Truck_companyId_internalId_key" 
ON "Truck"("companyId", "internalId") 
WHERE "internalId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Load_companyId_internalId_key" 
ON "Load"("companyId", "internalId") 
WHERE "internalId" IS NOT NULL;

-- Crear índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS "Truck_internalId_idx" 
ON "Truck"("internalId");

CREATE INDEX IF NOT EXISTS "Load_internalId_idx" 
ON "Load"("internalId");

-- Actualizar internalId para registros existentes (opcional)
-- Esto asignará IDs secuenciales a los registros existentes
DO $$
DECLARE
    company_record RECORD;
    next_truck_id INTEGER;
    next_load_id INTEGER;
BEGIN
    FOR company_record IN SELECT DISTINCT "companyId" FROM "Truck" LOOP
        -- Asignar internalId a trucks existentes
        next_truck_id := 1;
        FOR truck_record IN 
            SELECT id FROM "Truck" 
            WHERE "companyId" = company_record."companyId" 
            AND "internalId" IS NULL 
            ORDER BY id ASC
        LOOP
            UPDATE "Truck" 
            SET "internalId" = next_truck_id 
            WHERE id = truck_record.id;
            next_truck_id := next_truck_id + 1;
        END LOOP;
        
        -- Asignar internalId a loads existentes
        next_load_id := 1;
        FOR load_record IN 
            SELECT id FROM "Load" 
            WHERE "companyId" = company_record."companyId" 
            AND "internalId" IS NULL 
            ORDER BY id ASC
        LOOP
            UPDATE "Load" 
            SET "internalId" = next_load_id 
            WHERE id = load_record.id;
            next_load_id := next_load_id + 1;
        END LOOP;
    END LOOP;
END $$;

