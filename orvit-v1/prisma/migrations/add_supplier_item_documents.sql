-- Add supplierDocuments column to SupplierItem for per-supplier documents (SDS, certificates, etc.)
ALTER TABLE "SupplierItem"
  ADD COLUMN IF NOT EXISTS "supplierDocuments" JSONB NOT NULL DEFAULT '[]';
