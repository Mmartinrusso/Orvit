-- Migration: Change firmaIngreso from VARCHAR(100) to TEXT
-- Date: 2026-01-14
-- Description: firmaIngreso now stores S3 URLs which can be longer than 100 chars

-- Alter firmaIngreso column to TEXT
ALTER TABLE "PurchaseReceipt"
ALTER COLUMN "firmaIngreso" TYPE TEXT;
