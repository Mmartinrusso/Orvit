-- AlterTable: Add quantity field to Component
-- This field stores the quantity of this component in the assembly (default 1)

ALTER TABLE "Component" ADD COLUMN "quantity" INTEGER DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN "Component"."quantity" IS 'Cantidad de este componente en el ensamble (default 1)';
