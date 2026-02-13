-- AlterTable: Add itemNumber field to Component
-- This field stores the position number from exploded diagrams/parts lists (1, 2, 3...)

ALTER TABLE "Component" ADD COLUMN "itemNumber" TEXT;

-- Add comment for documentation
COMMENT ON COLUMN "Component"."itemNumber" IS 'Número de posición en el plano de despiece (1, 2, 3...)';
