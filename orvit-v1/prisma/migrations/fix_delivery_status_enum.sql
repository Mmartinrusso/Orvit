-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Fix DeliveryStatus Enum - Remove PARCIAL State
-- Aligns database enum with state-machine.ts (8 states)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Step 1: Update any existing PARCIAL records to EN_PREPARACION
UPDATE "sale_deliveries"
SET "estado" = 'EN_PREPARACION'
WHERE "estado" = 'PARCIAL';

-- Step 2: Temporarily convert column to text
ALTER TABLE "sale_deliveries"
  ALTER COLUMN "estado" TYPE TEXT;

-- Step 3: Drop old enum
DROP TYPE IF EXISTS "DeliveryStatus";

-- Step 4: Create new enum without PARCIAL
CREATE TYPE "DeliveryStatus" AS ENUM (
  'PENDIENTE',
  'EN_PREPARACION',
  'LISTA_PARA_DESPACHO',
  'EN_TRANSITO',
  'RETIRADA',
  'ENTREGADA',
  'ENTREGA_FALLIDA',
  'CANCELADA'
);

-- Step 5: Convert column back to enum type
ALTER TABLE "sale_deliveries"
  ALTER COLUMN "estado" TYPE "DeliveryStatus" USING "estado"::"DeliveryStatus";

-- Step 6: Set default value
ALTER TABLE "sale_deliveries"
  ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE'::"DeliveryStatus";

-- Add comment
COMMENT ON TYPE "DeliveryStatus" IS 'Aligned with state-machine.ts - 8 states without PARCIAL';

COMMIT;
