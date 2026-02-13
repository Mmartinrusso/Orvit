-- Migración: Campos adicionales de cliente con override temporal
-- Fecha: 2026-01-13

-- =====================================================
-- CAMPOS DE OVERRIDE TEMPORAL PARA LÍMITES
-- =====================================================

-- Límite de crédito - override temporal
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "creditLimitOverride" DECIMAL(15,2);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "creditLimitOverrideExpiry" TIMESTAMP;

-- Límite de días mercadería pendiente - override temporal
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "merchandisePendingDaysOverride" INTEGER;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "merchandisePendingDaysOverrideExpiry" TIMESTAMP;

-- Límite de crédito temporal (campo nuevo + su override)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tempCreditLimit" DECIMAL(15,2);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tempCreditLimitOverride" DECIMAL(15,2);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tempCreditLimitOverrideExpiry" TIMESTAMP;

-- =====================================================
-- OTROS CAMPOS ADICIONALES
-- =====================================================

-- Vencimiento de facturas por defecto (días)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "invoiceDueDays" INTEGER DEFAULT 15;

-- Días de inactividad para bloquear cuenta corriente
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "accountBlockDays" INTEGER;

-- Bonificación extra (descripción de condiciones)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "extraBonusDescription" TEXT;

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================
COMMENT ON COLUMN "Client"."creditLimitOverride" IS 'Override temporal del límite de crédito';
COMMENT ON COLUMN "Client"."creditLimitOverrideExpiry" IS 'Fecha de expiración del override de límite de crédito';
COMMENT ON COLUMN "Client"."merchandisePendingDaysOverride" IS 'Override temporal de días de mercadería pendiente';
COMMENT ON COLUMN "Client"."merchandisePendingDaysOverrideExpiry" IS 'Fecha de expiración del override de días mercadería';
COMMENT ON COLUMN "Client"."tempCreditLimit" IS 'Límite de crédito temporal (valor base)';
COMMENT ON COLUMN "Client"."tempCreditLimitOverride" IS 'Override temporal del límite de crédito temporal';
COMMENT ON COLUMN "Client"."tempCreditLimitOverrideExpiry" IS 'Fecha de expiración del override de crédito temporal';
COMMENT ON COLUMN "Client"."invoiceDueDays" IS 'Días de vencimiento por defecto para facturas';
COMMENT ON COLUMN "Client"."accountBlockDays" IS 'Días de inactividad para bloquear cuenta corriente';
COMMENT ON COLUMN "Client"."extraBonusDescription" IS 'Descripción de bonificación extra (ej: 10% por pago en 30 días)';
