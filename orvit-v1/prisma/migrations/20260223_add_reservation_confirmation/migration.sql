-- Crear tabla spare_part_reservations si no existe (con campos de confirmación incluidos)
-- usedQuantity: cuántos repuestos se instalaron realmente (null = no confirmado, fallback a quantity)
-- returnedDamaged: si una herramienta volvió rota/dañada

CREATE TABLE IF NOT EXISTS "spare_part_reservations" (
  "id" SERIAL NOT NULL,
  "toolId" INTEGER NOT NULL,
  "workOrderId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pickedAt" TIMESTAMP(3),
  "pickedById" INTEGER,
  "returnedAt" TIMESTAMP(3),
  "returnedById" INTEGER,
  "notes" TEXT,
  "companyId" INTEGER NOT NULL,
  "usedQuantity" INTEGER DEFAULT NULL,
  "returnedDamaged" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "spare_part_reservations_pkey" PRIMARY KEY ("id")
);

-- Si la tabla ya existía, agregar las columnas nuevas
ALTER TABLE "spare_part_reservations"
  ADD COLUMN IF NOT EXISTS "usedQuantity" INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "returnedDamaged" BOOLEAN NOT NULL DEFAULT FALSE;

-- Indexes
CREATE INDEX IF NOT EXISTS "spare_part_reservations_workOrderId_idx" ON "spare_part_reservations"("workOrderId");
CREATE INDEX IF NOT EXISTS "spare_part_reservations_toolId_idx" ON "spare_part_reservations"("toolId");
CREATE INDEX IF NOT EXISTS "spare_part_reservations_companyId_status_idx" ON "spare_part_reservations"("companyId", "status");

-- Foreign keys (idempotent)
DO $$ BEGIN
  ALTER TABLE "spare_part_reservations" ADD CONSTRAINT "spare_part_reservations_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "spare_part_reservations" ADD CONSTRAINT "spare_part_reservations_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "spare_part_reservations" ADD CONSTRAINT "spare_part_reservations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "spare_part_reservations" ADD CONSTRAINT "spare_part_reservations_pickedById_fkey" FOREIGN KEY ("pickedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "spare_part_reservations" ADD CONSTRAINT "spare_part_reservations_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
