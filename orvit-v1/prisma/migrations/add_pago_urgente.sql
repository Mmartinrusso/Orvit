-- Agregar columna pagoUrgente a PurchaseReceipt
ALTER TABLE "PurchaseReceipt" 
ADD COLUMN IF NOT EXISTS "pagoUrgente" BOOLEAN NOT NULL DEFAULT false;

