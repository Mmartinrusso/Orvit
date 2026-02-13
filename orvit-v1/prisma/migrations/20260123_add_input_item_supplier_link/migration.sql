-- Add supplier item link to InputItem for production stock consumption
-- This allows linking recipe ingredients to actual inventory items

-- Add supplierItemId column to InputItem
ALTER TABLE "InputItem" ADD COLUMN "supplierItemId" INTEGER;

-- Add conversionFactor column with default value of 1
ALTER TABLE "InputItem" ADD COLUMN "conversionFactor" DECIMAL(10, 4) DEFAULT 1 NOT NULL;

-- Create index for faster lookups
CREATE INDEX "InputItem_supplierItemId_idx" ON "InputItem"("supplierItemId");

-- Add foreign key constraint
ALTER TABLE "InputItem"
ADD CONSTRAINT "InputItem_supplierItemId_fkey"
FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
