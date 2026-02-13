-- Cleanup more legacy tables blocking enum changes

BEGIN;

-- Drop dependent tables first
DROP TABLE IF EXISTS "ClientPaymentCheque" CASCADE;
DROP TABLE IF EXISTS "ClientPaymentMethod" CASCADE;
DROP TABLE IF EXISTS "ClientPaymentItem" CASCADE;
DROP TABLE IF EXISTS "ClientMovement" CASCADE;
DROP TABLE IF EXISTS "client_payments" CASCADE;
DROP TABLE IF EXISTS "client_ledger_entries" CASCADE;
DROP TABLE IF EXISTS "invoice_payment_allocations" CASCADE;
DROP TABLE IF EXISTS "cheques" CASCADE;
DROP TABLE IF EXISTS "sales_deliveries" CASCADE;
DROP TABLE IF EXISTS "sale_delivery_items" CASCADE;
DROP TABLE IF EXISTS "sales_remitos" CASCADE;
DROP TABLE IF EXISTS "sale_remito_items" CASCADE;
DROP TABLE IF EXISTS "sales_invoices" CASCADE;
DROP TABLE IF EXISTS "sales_invoice_items" CASCADE;
DROP TABLE IF EXISTS "credit_debit_notes" CASCADE;
DROP TABLE IF EXISTS "credit_debit_note_items" CASCADE;
DROP TABLE IF EXISTS "stock_reservations" CASCADE;
DROP TABLE IF EXISTS "document_sequences" CASCADE;
DROP TABLE IF EXISTS "idempotency_keys" CASCADE;

COMMIT;
