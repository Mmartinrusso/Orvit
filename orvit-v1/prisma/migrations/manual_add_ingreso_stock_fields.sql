-- Agregar campos de control de ingreso de stock a PurchaseReceipt
-- Ejecutar manualmente en la base de datos

ALTER TABLE "PurchaseReceipt"
ADD COLUMN IF NOT EXISTS "ingresoConfirmado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "ingresoConfirmadoPor" INTEGER,
ADD COLUMN IF NOT EXISTS "ingresoConfirmadoAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "firmaIngreso" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "remitoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "fotoIngresoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "pagoForzado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "pagoForzadoPor" INTEGER,
ADD COLUMN IF NOT EXISTS "pagoForzadoAt" TIMESTAMP(3);

-- Crear índices
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_ingresoConfirmado_idx" ON "PurchaseReceipt"("ingresoConfirmado");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_companyId_ingresoConfirmado_idx" ON "PurchaseReceipt"("companyId", "ingresoConfirmado");

-- Foreign keys (opcional, para relaciones con User)
ALTER TABLE "PurchaseReceipt"
ADD CONSTRAINT "PurchaseReceipt_ingresoConfirmadoPor_fkey"
FOREIGN KEY ("ingresoConfirmadoPor") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseReceipt"
ADD CONSTRAINT "PurchaseReceipt_pagoForzadoPor_fkey"
FOREIGN KEY ("pagoForzadoPor") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
