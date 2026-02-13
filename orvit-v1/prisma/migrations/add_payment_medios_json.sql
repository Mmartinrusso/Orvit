-- Migration: Add mediosData JSON field to ClientPayment
-- Purpose: Store payment medium details (accounts, check data) for PENDIENTE payments

-- Add JSON column to store payment medios array
ALTER TABLE client_payments ADD COLUMN medios_data JSONB;

-- Add index for querying medios data
CREATE INDEX idx_client_payments_medios_data ON client_payments USING GIN (medios_data);

-- Comment explaining the field
COMMENT ON COLUMN client_payments.medios_data IS 'JSON array storing payment medium details: [{tipo, monto, accountId, accountType, chequeData, ...}]. Required for creating treasury movements when approving PENDIENTE payments.';
