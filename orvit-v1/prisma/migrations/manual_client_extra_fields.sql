-- Migration: Agregar campos faltantes al Client (del sistema legacy)
-- Date: 2026-01-13

-- 1. Transporte (empresa de transporte preferida)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "transportCompany" TEXT;

-- 2. Rubro/Sector del cliente
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "businessSector" TEXT;

-- 3. Periodo de liquidación (SEMANAL, QUINCENAL, MENSUAL)
-- Primero crear el enum si no existe
DO $$ BEGIN
    CREATE TYPE "SettlementPeriod" AS ENUM ('SEMANAL', 'QUINCENAL', 'MENSUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "settlementPeriod" "SettlementPeriod";

-- 4. Exige orden de compra
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "requiresPurchaseOrder" BOOLEAN NOT NULL DEFAULT false;

-- 5. Bloqueado entregas (separado del bloqueo de crédito)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isDeliveryBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deliveryBlockedReason" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deliveryBlockedAt" TIMESTAMP;

-- 6. Nota rápida con vigencia
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "quickNote" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "quickNoteExpiry" TIMESTAMP;

-- 7. Tope de cheques
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "checkLimit" DECIMAL(15, 2);

-- 8. Descuento general del cliente (porcentaje)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "generalDiscount" DECIMAL(5, 2);

-- 9. Índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS "Client_businessSector_idx" ON "Client"("businessSector");
CREATE INDEX IF NOT EXISTS "Client_settlementPeriod_idx" ON "Client"("settlementPeriod");
CREATE INDEX IF NOT EXISTS "Client_isDeliveryBlocked_idx" ON "Client"("isDeliveryBlocked");
CREATE INDEX IF NOT EXISTS "Client_quickNoteExpiry_idx" ON "Client"("quickNoteExpiry");
