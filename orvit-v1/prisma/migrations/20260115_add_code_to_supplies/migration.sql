-- Migration: Add code field to supplies table
-- Date: 2026-01-15
-- Description: Adds the internal product code (código propio) field to supplies

-- Add the code column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'supplies' AND column_name = 'code'
    ) THEN
        ALTER TABLE supplies ADD COLUMN code VARCHAR(50);
    END IF;
END $$;

-- Create unique index for company_id + code (only where code is not null)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'supplies_company_id_code_key'
    ) THEN
        CREATE UNIQUE INDEX supplies_company_id_code_key ON supplies(company_id, code) WHERE code IS NOT NULL;
    END IF;
END $$;

-- Comment
COMMENT ON COLUMN supplies.code IS 'Código interno propio del insumo';
