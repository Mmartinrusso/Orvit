-- Migración: Agregar campos extendidos al modelo Client
-- Fecha: 2026-01-14
-- Campos: WhatsApp, Retención Municipal, Subclientes, Días Visita/Entrega, Exenciones Impositivas

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. WHATSAPP
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT;

COMMENT ON COLUMN "Client"."whatsapp" IS 'Número de WhatsApp del cliente (formato: +54XXXXXXXXXX)';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. TIPO DE RETENCIÓN MUNICIPAL
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "municipalRetentionType" TEXT;

COMMENT ON COLUMN "Client"."municipalRetentionType" IS 'Tipo de retención municipal (Ej: CONVENIO_MULTILATERAL, LOCAL, EXENTO, NO_APLICA)';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. SUBCLIENTES (Relación padre-hijo)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "parentClientId" TEXT;

-- Agregar FK a sí mismo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Client_parentClientId_fkey'
    ) THEN
        ALTER TABLE "Client"
        ADD CONSTRAINT "Client_parentClientId_fkey"
        FOREIGN KEY ("parentClientId")
        REFERENCES "Client"("id")
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Client_parentClientId_idx" ON "Client"("parentClientId");

COMMENT ON COLUMN "Client"."parentClientId" IS 'ID del cliente padre (para subclientes)';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. DÍAS DE VISITA Y ENTREGA
-- ═══════════════════════════════════════════════════════════════════════════
-- Usamos JSONB para arrays de días: ["LUNES", "MARTES", etc.]
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "visitDays" JSONB DEFAULT '[]';
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deliveryDays" JSONB DEFAULT '[]';

COMMENT ON COLUMN "Client"."visitDays" IS 'Días de visita del vendedor (array: LUNES, MARTES, etc.)';
COMMENT ON COLUMN "Client"."deliveryDays" IS 'Días de entrega permitidos (array: LUNES, MARTES, etc.)';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. EXENCIONES IMPOSITIVAS
-- ═══════════════════════════════════════════════════════════════════════════
-- Exención de Percepción de IVA
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isVatPerceptionExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "vatPerceptionExemptUntil" TIMESTAMP;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "vatPerceptionExemptCertificate" TEXT;

-- Exención de Retención de IVA
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isVatRetentionExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "vatRetentionExemptUntil" TIMESTAMP;

-- Exención de Ingresos Brutos
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isGrossIncomeExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "grossIncomeExemptUntil" TIMESTAMP;

-- Exención Municipal
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isMunicipalExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "municipalExemptUntil" TIMESTAMP;

COMMENT ON COLUMN "Client"."isVatPerceptionExempt" IS 'Exento de Percepción de IVA';
COMMENT ON COLUMN "Client"."vatPerceptionExemptUntil" IS 'Fecha hasta la que está exento de percepción IVA';
COMMENT ON COLUMN "Client"."vatPerceptionExemptCertificate" IS 'Número de certificado de exención IVA';
COMMENT ON COLUMN "Client"."isVatRetentionExempt" IS 'Exento de Retención de IVA';
COMMENT ON COLUMN "Client"."vatRetentionExemptUntil" IS 'Fecha hasta la que está exento de retención IVA';
COMMENT ON COLUMN "Client"."isGrossIncomeExempt" IS 'Exento de Ingresos Brutos';
COMMENT ON COLUMN "Client"."grossIncomeExemptUntil" IS 'Fecha hasta la que está exento de IIBB';
COMMENT ON COLUMN "Client"."isMunicipalExempt" IS 'Exento de impuestos municipales';
COMMENT ON COLUMN "Client"."municipalExemptUntil" IS 'Fecha hasta la que está exento municipal';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ÍNDICES ADICIONALES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "Client_isVatPerceptionExempt_idx" ON "Client"("isVatPerceptionExempt") WHERE "isVatPerceptionExempt" = true;
CREATE INDEX IF NOT EXISTS "Client_vatPerceptionExemptUntil_idx" ON "Client"("vatPerceptionExemptUntil") WHERE "vatPerceptionExemptUntil" IS NOT NULL;
