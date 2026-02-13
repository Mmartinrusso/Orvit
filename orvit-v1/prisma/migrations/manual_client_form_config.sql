-- Migración: Configuración del formulario de clientes
-- Fecha: 2026-01-14
-- Permite a cada empresa configurar qué campos mostrar en el formulario de clientes

-- ═══════════════════════════════════════════════════════════════════════════
-- AGREGAR CAMPOS DE CONFIGURACIÓN A SALES_CONFIG
-- ═══════════════════════════════════════════════════════════════════════════

-- Campo JSON para almacenar qué campos están habilitados
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "clientFormEnabledFields" JSONB DEFAULT '{}';

-- Límite máximo de funcionalidades (definido por superadmin, null = sin límite)
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "maxClientFormFeatures" INTEGER DEFAULT NULL;

-- Comentarios descriptivos
COMMENT ON COLUMN "sales_config"."clientFormEnabledFields" IS 'JSON con campos habilitados del formulario de clientes. Ej: {"whatsapp": true, "visitDays": true}';
COMMENT ON COLUMN "sales_config"."maxClientFormFeatures" IS 'Máximo de funcionalidades que puede habilitar la empresa (null = sin límite)';

-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIGURACIÓN POR DEFECTO PARA EMPRESAS EXISTENTES
-- ═══════════════════════════════════════════════════════════════════════════
-- Todas las empresas existentes tendrán todos los campos básicos habilitados por defecto
UPDATE "sales_config"
SET "clientFormEnabledFields" = '{
  "basicContact": true,
  "extendedContact": true,
  "address": true,
  "taxInfo": true,
  "classification": true,
  "financial": true,
  "commercial": true,
  "whatsapp": false,
  "visitDeliveryDays": false,
  "taxExemptions": false,
  "subclients": false,
  "quickNote": true
}'::jsonb
WHERE "clientFormEnabledFields" = '{}'::jsonb OR "clientFormEnabledFields" IS NULL;
