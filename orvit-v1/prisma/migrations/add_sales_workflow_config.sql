-- Add workflow configuration fields to sales_config
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS requiere_aprobacion_pagos BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS requiere_aprobacion_pagos_monto_minimo DECIMAL(15,2);
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS aprobacion_pagos_tipos_requieren TEXT; -- JSON array of payment types that require approval

ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS requiere_aprobacion_facturas BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS requiere_aprobacion_facturas_monto_minimo DECIMAL(15,2);

ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS requiere_confirmacion_orden BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS permitir_orden_sin_stock BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS permitir_orden_sin_credito BOOLEAN NOT NULL DEFAULT false;

-- Notification settings
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS notificar_nueva_cotizacion BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS notificar_orden_confirmada BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS notificar_entrega_programada BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS notificar_factura_emitida BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS notificar_pago_recibido BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS emails_notificaciones TEXT; -- Comma-separated emails

-- Module enablement
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_cotizaciones_habilitado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_ordenes_habilitado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_entregas_habilitado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_facturas_habilitado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_cobranzas_habilitado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_remitos_habilitado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_notas_credito_habilitado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_turnos_habilitado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_disputas_habilitado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_valores_habilitado BOOLEAN NOT NULL DEFAULT true;

-- Delivery/logistics settings
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS requiere_conductor_en_despacho BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS requiere_vehiculo_en_despacho BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS requiere_evidencia_entrega BOOLEAN NOT NULL DEFAULT false;

-- Document mandatory fields
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS campos_obligatorios_cotizacion TEXT; -- JSON array
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS campos_obligatorios_orden TEXT; -- JSON array
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS campos_obligatorios_factura TEXT; -- JSON array

-- Credit and payment enforcement level
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS nivel_enforcement_credito VARCHAR(20) NOT NULL DEFAULT 'WARNING'; -- STRICT, WARNING, DISABLED
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS nivel_enforcement_stock VARCHAR(20) NOT NULL DEFAULT 'WARNING'; -- STRICT, WARNING, DISABLED

COMMENT ON COLUMN sales_config.requiere_aprobacion_pagos IS 'Si los pagos de clientes deben ser aprobados por admin antes de impactar cuenta corriente';
COMMENT ON COLUMN sales_config.aprobacion_pagos_tipos_requieren IS 'Array JSON de tipos de pago que requieren aprobación: ["CHEQUE", "ECHEQ"]';
COMMENT ON COLUMN sales_config.nivel_enforcement_credito IS 'STRICT: bloquea operaciones, WARNING: solo alerta, DISABLED: sin control';
