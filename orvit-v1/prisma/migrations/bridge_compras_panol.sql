-- Bridge Compras ↔ Pañol
-- Agrega toolId a SupplierItem para vincular items de compra con repuestos del pañol
-- Agrega toolId, componentId, machineId a PurchaseRequestItem para contexto de "para qué compro"

-- 1. SupplierItem: link al Tool del pañol
ALTER TABLE "SupplierItem" ADD COLUMN IF NOT EXISTS "toolId" INTEGER;
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_toolId_fkey"
  FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "SupplierItem_toolId_idx" ON "SupplierItem"("toolId");

-- 2. PurchaseRequestItem: contexto de compra
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "toolId" INTEGER;
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "componentId" INTEGER;
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "machineId" INTEGER;

ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_toolId_fkey"
  FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_componentId_fkey"
  FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "purchase_request_items_toolId_idx" ON "purchase_request_items"("toolId");
