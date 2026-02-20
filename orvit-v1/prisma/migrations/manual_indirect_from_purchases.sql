-- ============================================================
-- Migración manual: Indirectos V2 desde Compras
-- Agrega esIndirecto + indirectCategory a PurchaseReceipt
-- Ejecutar una sola vez en cada entorno (dev, staging, prod)
-- ============================================================

-- Nota: IndirectCategory ya existe como enum en la BD
-- Valores: IMP_SERV, SOCIAL, VEHICLES, MKT, OTHER, UTILITIES

ALTER TABLE "PurchaseReceipt"
  ADD COLUMN IF NOT EXISTS "esIndirecto"      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "indirectCategory" TEXT;

-- Índice para queries de Costos V2 (filtra companyId + esIndirecto=true)
CREATE INDEX IF NOT EXISTS "idx_purchase_receipt_indirect"
  ON "PurchaseReceipt"("companyId", "esIndirecto")
  WHERE "esIndirecto" = true;

DO $$
BEGIN
  RAISE NOTICE '✅ Migración manual_indirect_from_purchases completada exitosamente';
END $$;
