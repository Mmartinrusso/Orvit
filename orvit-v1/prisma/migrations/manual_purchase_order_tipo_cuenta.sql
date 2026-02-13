-- Migration: Add tipoCuentaId to purchase_orders
-- Date: 2026-01-14
-- Description: Adds optional tipoCuentaId field to PurchaseOrder for pre-selecting account type

-- Add tipoCuentaId column to purchase_orders if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'tipoCuentaId'
    ) THEN
        ALTER TABLE purchase_orders ADD COLUMN "tipoCuentaId" INTEGER;
    END IF;
END $$;
