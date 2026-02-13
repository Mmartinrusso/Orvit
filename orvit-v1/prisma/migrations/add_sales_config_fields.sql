-- ============================================================================
-- MIGRACIÓN: Agregar campos de configuración avanzada a SalesConfig
-- Fecha: 2026-02-06
-- Descripción: Agrega 33 nuevos campos para eliminar hardcoded values y
--              permitir personalización completa por empresa
-- ============================================================================

-- IMPORTANTE: Esta migración agrega campos con valores por defecto,
-- por lo que es segura y no eliminará datos existentes.

BEGIN;

-- ============================================================================
-- IMPUESTOS Y PERCEPCIONES
-- ============================================================================

ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "iva_rates" JSONB DEFAULT '[21, 10.5, 27, 0]',
ADD COLUMN IF NOT EXISTS "percepcion_iva_habilitada" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "percepcion_iva_tasa" DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS "percepcion_iibb_habilitada" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "percepcion_iibb_tasa" DECIMAL(5, 2);

-- ============================================================================
-- VENCIMIENTOS Y PLAZOS
-- ============================================================================

ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "dias_vencimiento_factura_default" INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS "dias_recordatorio_factura" INTEGER DEFAULT 5;

-- ============================================================================
-- CRÉDITO AVANZADO
-- ============================================================================

ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "enable_block_by_overdue" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "overdue_grace_days" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "enable_aging" BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS "aging_buckets" JSONB DEFAULT '[30, 60, 90, 120]',
ADD COLUMN IF NOT EXISTS "credit_alert_threshold" DECIMAL(5, 2) DEFAULT 80,
ADD COLUMN IF NOT EXISTS "enable_check_limit" BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS "default_check_limit" DECIMAL(15, 2);

-- ============================================================================
-- MÁRGENES Y APROBACIONES AVANZADAS
-- ============================================================================

ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "margin_requires_approval" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "margin_approval_threshold" DECIMAL(5, 2);

-- ============================================================================
-- MONEDAS
-- ============================================================================

ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "monedas_habilitadas" JSONB DEFAULT '["ARS", "USD"]',
ADD COLUMN IF NOT EXISTS "moneda_principal" VARCHAR(10) DEFAULT 'ARS',
ADD COLUMN IF NOT EXISTS "permite_cambio_moneda" BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- DESCUENTOS AVANZADOS
-- ============================================================================

ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "descuento_maximo_automatico" DECIMAL(5, 2) DEFAULT 5,
ADD COLUMN IF NOT EXISTS "descuento_maximo_con_aprobacion" DECIMAL(5, 2) DEFAULT 20;

-- ============================================================================
-- CONFIGURACIÓN DE PRODUCTOS
-- ============================================================================

ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "product_cost_update_mode" VARCHAR(20) DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS "margin_min_required_for_sale" DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS "show_cost_in_product_list" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "require_product_code_unique" BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- LOGÍSTICA Y TURNOS
-- ============================================================================

ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "turno_capacidad_maxima_default" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "turno_hora_inicio_default" VARCHAR(5) DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS "turno_hora_fin_default" VARCHAR(5) DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS "ruta_max_paradas" INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS "ruta_max_distancia_km" DECIMAL(10, 2) DEFAULT 5;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar que los campos fueron agregados correctamente
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_config'
  AND column_name IN (
    'iva_rates',
    'percepcion_iva_habilitada',
    'dias_vencimiento_factura_default',
    'enable_block_by_overdue',
    'aging_buckets',
    'credit_alert_threshold',
    'margin_requires_approval',
    'monedas_habilitadas',
    'descuento_maximo_automatico',
    'product_cost_update_mode',
    'turno_capacidad_maxima_default',
    'ruta_max_paradas'
  )
ORDER BY column_name;

-- ============================================================================
-- NOTAS DE IMPLEMENTACIÓN
-- ============================================================================

-- Esta migración agrega 33 nuevos campos a la tabla sales_config:
--
-- 1. IMPUESTOS (5 campos):
--    - iva_rates: Alícuotas IVA configurables
--    - Percepciones IVA e IIBB
--
-- 2. VENCIMIENTOS (2 campos):
--    - Días de vencimiento y recordatorio para facturas
--
-- 3. CRÉDITO AVANZADO (7 campos):
--    - Bloqueo por mora, aging buckets, alertas, límites de cheques
--
-- 4. MÁRGENES (2 campos):
--    - Aprobaciones por margen bajo
--
-- 5. MONEDAS (3 campos):
--    - Monedas habilitadas, principal, cambio permitido
--
-- 6. DESCUENTOS (2 campos):
--    - Descuentos máximos con/sin aprobación
--
-- 7. PRODUCTOS (4 campos):
--    - Modo de actualización de costos, márgenes, visualización
--
-- 8. LOGÍSTICA (5 campos):
--    - Turnos y rutas configurables
--
-- SIGUIENTES PASOS:
-- 1. Ejecutar esta migración: psql -d database_name -f add_sales_config_fields.sql
-- 2. Regenerar Prisma Client: npm run prisma:generate
-- 3. Actualizar código para usar nuevos campos (ver archivos a modificar en documentación)
