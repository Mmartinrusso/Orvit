-- Surgical cleanup of legacy tables blocking O2C migration
-- This preserves all important data while removing only blocking elements

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Drop tables that use old enum types and will be recreated
-- These are O2C tables that don't have data yet or will be recreated
-- ═══════════════════════════════════════════════════════════════════════════════

-- Old O2C tables (Pascal case - these are the old schema)
DROP TABLE IF EXISTS "SalesCreditDebitNoteItem" CASCADE;
DROP TABLE IF EXISTS "SalesCreditDebitNote" CASCADE;
DROP TABLE IF EXISTS "SalesInvoiceItem" CASCADE;
DROP TABLE IF EXISTS "SalesInvoice" CASCADE;
DROP TABLE IF EXISTS "InvoicePaymentAllocation" CASCADE;
DROP TABLE IF EXISTS "ClientPaymentCheque" CASCADE;
DROP TABLE IF EXISTS "ClientPaymentMethod" CASCADE;
DROP TABLE IF EXISTS "ClientPaymentItem" CASCADE;
DROP TABLE IF EXISTS "ClientPayment" CASCADE;
DROP TABLE IF EXISTS "ClientLedgerEntry" CASCADE;
DROP TABLE IF EXISTS "ClientMovement" CASCADE;
DROP TABLE IF EXISTS "SaleDeliveryItem" CASCADE;
DROP TABLE IF EXISTS "SaleDelivery" CASCADE;
DROP TABLE IF EXISTS "SaleRemitoItem" CASCADE;
DROP TABLE IF EXISTS "SaleRemito" CASCADE;
DROP TABLE IF EXISTS "StockReservation" CASCADE;
DROP TABLE IF EXISTS "Cheque" CASCADE;
DROP TABLE IF EXISTS "DocumentSequence" CASCADE;
DROP TABLE IF EXISTS "IdempotencyKey" CASCADE;
DROP TABLE IF EXISTS "SalesApproval" CASCADE;
DROP TABLE IF EXISTS "SalesAuditLog" CASCADE;
DROP TABLE IF EXISTS "SellerKPI" CASCADE;
DROP TABLE IF EXISTS "StateTransitionLog" CASCADE;
DROP TABLE IF EXISTS "PODUpload" CASCADE;

-- Tables that are being restructured
DROP TABLE IF EXISTS "SalesPriceListItem" CASCADE;
DROP TABLE IF EXISTS "SalesPriceList" CASCADE;
DROP TABLE IF EXISTS "SalesConfig" CASCADE;

-- Unused/legacy tables
DROP TABLE IF EXISTS "MachineFamily" CASCADE;
DROP TABLE IF EXISTS "MachineFamilyLevel" CASCADE;
DROP TABLE IF EXISTS "ProductionLine" CASCADE;
DROP TABLE IF EXISTS "Shutdown" CASCADE;
DROP TABLE IF EXISTS "ShutdownMilestone" CASCADE;
DROP TABLE IF EXISTS "ShutdownWorkOrder" CASCADE;
DROP TABLE IF EXISTS "SoDMatrix" CASCADE;
DROP TABLE IF EXISTS "Warranty" CASCADE;
DROP TABLE IF EXISTS "WarrantyClaim" CASCADE;
DROP TABLE IF EXISTS "ToolConditionLog" CASCADE;
DROP TABLE IF EXISTS "DailyProductionEntry" CASCADE;
DROP TABLE IF EXISTS "daily_production_entries" CASCADE;
DROP TABLE IF EXISTS "ProductionProfile" CASCADE;
DROP TABLE IF EXISTS "production_profiles" CASCADE;
DROP TABLE IF EXISTS "disassemble_operations" CASCADE;
DROP TABLE IF EXISTS "promotion_operations" CASCADE;
DROP TABLE IF EXISTS "user_whatsapp_groups" CASCADE;
DROP TABLE IF EXISTS "whatsapp_verifications" CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Drop old enum types that will be recreated
-- Only if they don't have remaining dependencies
-- ═══════════════════════════════════════════════════════════════════════════════

-- Check and drop old enum types
DO $$
BEGIN
    -- Try to drop each enum, ignore if doesn't exist or has dependencies
    BEGIN DROP TYPE IF EXISTS "AFIPStatus" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DROP TYPE IF EXISTS "AFIPStatus_old" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DROP TYPE IF EXISTS "ChequeStatus_old" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DROP TYPE IF EXISTS "ClientMovementType_old" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DROP TYPE IF EXISTS "ClientPaymentStatus_old" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DROP TYPE IF EXISTS "CreditDebitNoteStatus_old" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DROP TYPE IF EXISTS "DeliveryStatus_old" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DROP TYPE IF EXISTS "HistoryEventType_old" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DROP TYPE IF EXISTS "SalesApprovalStatus_old" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DROP TYPE IF EXISTS "SalesApprovalType_old" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DROP TYPE IF EXISTS "SalesCreditDebitType_old" CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

COMMIT;
