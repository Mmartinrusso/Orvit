-- Migración: Agregar campos hasCheckLimit y checkLimitType a Client
-- Fecha: 2026-01-13

-- Agregar campo hasCheckLimit (Boolean con default false)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "hasCheckLimit" BOOLEAN NOT NULL DEFAULT false;

-- Agregar campo checkLimitType (String nullable: 'CANTIDAD' o 'SALDO')
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "checkLimitType" TEXT;

-- Comentarios para documentación
COMMENT ON COLUMN "Client"."hasCheckLimit" IS 'Indica si el cliente tiene tope de cheques activo';
COMMENT ON COLUMN "Client"."checkLimitType" IS 'Tipo de tope de cheques: CANTIDAD (cantidad de cheques) o SALDO (monto total)';

-- Migrar datos existentes: si checkLimit tiene valor > 0, activar hasCheckLimit y poner tipo SALDO por defecto
UPDATE "Client"
SET "hasCheckLimit" = true, "checkLimitType" = 'SALDO'
WHERE "checkLimit" IS NOT NULL AND "checkLimit" > 0;
