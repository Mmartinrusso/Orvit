-- Migración: Agregar campo defaultPriceListId a Client
-- Fecha: 2026-01-13

-- Agregar campo defaultPriceListId (FK a SalesPriceList)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "defaultPriceListId" INTEGER;

-- Agregar constraint de FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Client_defaultPriceListId_fkey'
    ) THEN
        ALTER TABLE "Client"
        ADD CONSTRAINT "Client_defaultPriceListId_fkey"
        FOREIGN KEY ("defaultPriceListId")
        REFERENCES "SalesPriceList"("id")
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    END IF;
END $$;

-- Crear índice para la FK
CREATE INDEX IF NOT EXISTS "Client_defaultPriceListId_idx" ON "Client"("defaultPriceListId");

-- Comentario para documentación
COMMENT ON COLUMN "Client"."defaultPriceListId" IS 'Lista de precios por defecto asignada al cliente';
