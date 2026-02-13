-- Migration: Add codigoProveedor column to purchase_quotation_items
-- Date: 2026-01-26

-- Add codigoProveedor column to purchase_quotation_items table
ALTER TABLE purchase_quotation_items
ADD COLUMN IF NOT EXISTS "codigoProveedor" VARCHAR(100);

-- Add comment
COMMENT ON COLUMN purchase_quotation_items."codigoProveedor" IS 'Código del producto según el proveedor';
