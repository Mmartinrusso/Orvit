-- Agregar configuración avanzada de entregas a SalesConfig
-- Fecha: 2026-02-06
-- Sin GPS, sin predicción ETA, sin auto-asignación

-- ============================================================================
-- DELIVERY WORKFLOW SLA (Service Level Agreements)
-- ============================================================================
-- Tiempo máximo permitido en cada estado (en horas)
ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "delivery_sla_preparacion_max_horas" INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS "delivery_sla_transito_max_horas" INTEGER DEFAULT 48,
ADD COLUMN IF NOT EXISTS "delivery_sla_alerta_retraso_horas" INTEGER DEFAULT 2;

-- ============================================================================
-- DELIVERY NOTIFICATION TEMPLATES
-- ============================================================================
-- Templates personalizables para notificaciones
-- JSON structure: {"dispatched": "Tu pedido...", "delivered": "..."}
ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "delivery_notification_templates" JSONB DEFAULT '{
  "dispatched": "¡Tu pedido #{deliveryNumber} está en camino! 🚚\nConductor: {driverName}\nTracking: {trackingLink}",
  "delivered": "✅ Tu pedido #{deliveryNumber} ha sido entregado.\n¡Gracias por tu compra!",
  "failed": "⚠️ No pudimos entregar tu pedido #{deliveryNumber}.\nMotivo: {reason}\nNos contactaremos pronto.",
  "retry": "🔄 Reintentaremos la entrega de tu pedido #{deliveryNumber}.\nNueva fecha: {newDate}"
}'::jsonb;

-- ============================================================================
-- DELIVERY WORKFLOW CUSTOMIZATION
-- ============================================================================
-- Estados opcionales que se pueden saltar
-- JSON array: ["EN_PREPARACION", "LISTA_PARA_DESPACHO"]
ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "delivery_optional_states" JSONB DEFAULT '[]'::jsonb;

-- Permitir entregas sin orden de venta (entregas directas)
ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "permitir_entrega_sin_orden" BOOLEAN DEFAULT false;

-- Tipo de entrega por defecto
ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "delivery_tipo_default" VARCHAR(10) DEFAULT 'ENVIO'; -- ENVIO o RETIRO

-- ============================================================================
-- DELIVERY EVIDENCE REQUIREMENTS
-- ============================================================================
-- Qué evidencias son obligatorias
ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "requiere_firma_cliente" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "requiere_foto_entrega" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "requiere_dni_receptor" BOOLEAN DEFAULT false;

-- ============================================================================
-- DELIVERY COST CONFIGURATION
-- ============================================================================
-- Costo de flete por defecto
ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "costo_flete_default" DECIMAL(15,2) DEFAULT 0;

-- Calcular costo de flete automáticamente (basado en distancia/zona)
ALTER TABLE "sales_config"
ADD COLUMN IF NOT EXISTS "calcular_flete_automatico" BOOLEAN DEFAULT false;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN "sales_config"."delivery_sla_preparacion_max_horas" IS 'Horas máximas en estado EN_PREPARACION antes de alertar';
COMMENT ON COLUMN "sales_config"."delivery_sla_transito_max_horas" IS 'Horas máximas en estado EN_TRANSITO antes de alertar';
COMMENT ON COLUMN "sales_config"."delivery_sla_alerta_retraso_horas" IS 'Horas antes del SLA para enviar alerta preventiva';
COMMENT ON COLUMN "sales_config"."delivery_notification_templates" IS 'Templates personalizables de notificaciones (JSON)';
COMMENT ON COLUMN "sales_config"."delivery_optional_states" IS 'Estados que pueden saltarse en el workflow (JSON array)';
COMMENT ON COLUMN "sales_config"."requiere_firma_cliente" IS 'Firma del cliente es obligatoria para completar entrega';
COMMENT ON COLUMN "sales_config"."requiere_foto_entrega" IS 'Foto de evidencia es obligatoria';
COMMENT ON COLUMN "sales_config"."requiere_dni_receptor" IS 'DNI de quien recibe es obligatorio';

-- Verificación
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'sales_config' 
  AND column_name LIKE '%delivery%'
ORDER BY ordinal_position;
