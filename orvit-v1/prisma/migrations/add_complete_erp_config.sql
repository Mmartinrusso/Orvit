-- ════════════════════════════════════════════════════════════════════════════════
-- CONFIGURACIÓN COMPLETA DE MÓDULOS Y FUNCIONALIDADES DEL ERP
-- ════════════════════════════════════════════════════════════════════════════════

-- ═══ MÓDULOS DE VENTAS AVANZADOS ═══
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_afip_habilitado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_comisiones_avanzado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_contratos_venta BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_rma_devoluciones BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_backorders BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_promociones BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_cross_selling BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_garantias BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS modulo_ecommerce_avanzado BOOLEAN NOT NULL DEFAULT false;

-- ═══ CONFIGURACIÓN AFIP ═══
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS afip_cuit VARCHAR(20);
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS afip_cert_path VARCHAR(500);
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS afip_key_path VARCHAR(500);
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS afip_ambiente VARCHAR(20) DEFAULT 'HOMOLOGACION';
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS afip_auto_authorize BOOLEAN DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS afip_retry_attempts INT DEFAULT 3;

-- ═══ CONFIGURACIÓN COMISIONES ═══
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS comision_trigger VARCHAR(50) DEFAULT 'COBRADA';
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS comision_permite_adelantos BOOLEAN DEFAULT false;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS comision_escalonada_habilitada BOOLEAN DEFAULT false;

-- ═══ CONFIGURACIÓN RMA ═══
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS rma_requiere_aprobacion BOOLEAN DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS rma_dias_limite INT DEFAULT 30;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS rma_auto_reingreso_stock BOOLEAN DEFAULT false;

-- ═══ CONFIGURACIÓN BACKORDERS ═══
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS backorders_prioridad VARCHAR(20) DEFAULT 'FIFO';
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS backorders_auto_entrega_parcial BOOLEAN DEFAULT true;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS backorders_notificar_cliente BOOLEAN DEFAULT true;

-- ═══ MÓDULOS DE COMPRAS AVANZADOS ═══
CREATE TABLE IF NOT EXISTS purchase_config (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Módulos habilitados
  modulo_contratos_compra BOOLEAN DEFAULT false,
  modulo_supplier_performance BOOLEAN DEFAULT false,
  modulo_rfq_licitaciones BOOLEAN DEFAULT false,
  modulo_importaciones BOOLEAN DEFAULT false,
  modulo_vmi BOOLEAN DEFAULT false,
  modulo_muestras BOOLEAN DEFAULT false,
  modulo_auto_po BOOLEAN DEFAULT false,
  modulo_drop_shipping BOOLEAN DEFAULT false,
  modulo_blanket_orders BOOLEAN DEFAULT false,

  -- Configuración RFQ
  rfq_dias_vigencia INT DEFAULT 15,
  rfq_minimo_proveedores INT DEFAULT 3,
  rfq_requiere_aprobacion_adjudicacion BOOLEAN DEFAULT true,

  -- Configuración Auto-PO
  auto_po_habilitado BOOLEAN DEFAULT false,
  auto_po_stock_minimo_trigger BOOLEAN DEFAULT true,
  auto_po_requiere_aprobacion BOOLEAN DEFAULT true,

  -- Configuración Supplier Performance
  spm_habilitado BOOLEAN DEFAULT false,
  spm_periodo_evaluacion_meses INT DEFAULT 3,
  spm_peso_calidad DECIMAL(5,2) DEFAULT 40,
  spm_peso_entrega DECIMAL(5,2) DEFAULT 40,
  spm_peso_precio DECIMAL(5,2) DEFAULT 20,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══ MÓDULOS DE TESORERÍA AVANZADOS ═══
CREATE TABLE IF NOT EXISTS treasury_config (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Módulos habilitados
  modulo_cash_flow_forecast BOOLEAN DEFAULT false,
  modulo_multi_moneda BOOLEAN DEFAULT false,
  modulo_inversiones BOOLEAN DEFAULT false,
  modulo_deuda BOOLEAN DEFAULT false,
  modulo_reconciliacion_auto BOOLEAN DEFAULT false,
  modulo_pagos_masivos BOOLEAN DEFAULT false,
  modulo_garantias_bancarias BOOLEAN DEFAULT false,
  modulo_factoring BOOLEAN DEFAULT false,

  -- Configuración Multi-moneda
  moneda_base VARCHAR(10) DEFAULT 'ARS',
  multi_moneda_habilitado BOOLEAN DEFAULT false,
  auto_update_exchange_rates BOOLEAN DEFAULT false,
  exchange_rate_api_provider VARCHAR(50),

  -- Configuración Cash Flow Forecast
  forecast_periodo_dias INT DEFAULT 90,
  forecast_incluir_ventas_proyectadas BOOLEAN DEFAULT true,
  forecast_incluir_compras_proyectadas BOOLEAN DEFAULT true,

  -- Configuración Reconciliación Automática
  reconciliacion_auto_habilitada BOOLEAN DEFAULT false,
  reconciliacion_matching_threshold DECIMAL(5,2) DEFAULT 0.99,
  reconciliacion_ml_enabled BOOLEAN DEFAULT false,

  -- Configuración Pagos Masivos
  pagos_masivos_formato VARCHAR(50) DEFAULT 'AFIP',
  pagos_masivos_requiere_aprobacion BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══ MÓDULOS GENERALES ═══
CREATE TABLE IF NOT EXISTS general_config (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Módulos habilitados
  modulo_crm BOOLEAN DEFAULT false,
  modulo_bi_avanzado BOOLEAN DEFAULT false,
  modulo_proyectos BOOLEAN DEFAULT false,
  modulo_rrhh_completo BOOLEAN DEFAULT false,
  modulo_dms BOOLEAN DEFAULT false,
  modulo_quality_management BOOLEAN DEFAULT false,
  modulo_compliance BOOLEAN DEFAULT false,
  modulo_activos_fijos BOOLEAN DEFAULT false,
  modulo_mobility BOOLEAN DEFAULT false,

  -- Configuración CRM
  crm_pipeline_etapas TEXT,
  crm_auto_seguimiento BOOLEAN DEFAULT false,
  crm_dias_seguimiento INT DEFAULT 7,

  -- Configuración BI
  bi_constructor_reportes BOOLEAN DEFAULT false,
  bi_alertas_automaticas BOOLEAN DEFAULT false,
  bi_reportes_programados BOOLEAN DEFAULT false,

  -- Configuración Proyectos
  proyectos_time_tracking BOOLEAN DEFAULT false,
  proyectos_facturacion BOOLEAN DEFAULT false,
  proyectos_requiere_aprobacion_presupuesto BOOLEAN DEFAULT true,

  -- Configuración Quality
  quality_iso9001 BOOLEAN DEFAULT false,
  quality_auto_ncr BOOLEAN DEFAULT false,
  quality_requiere_capa BOOLEAN DEFAULT true,

  -- Configuración RRHH
  rrhh_portal_empleado BOOLEAN DEFAULT false,
  rrhh_evaluaciones_desempeno BOOLEAN DEFAULT false,
  rrhh_gestion_vacaciones BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══ CONFIGURACIÓN DE INTEGRACIONES ═══
CREATE TABLE IF NOT EXISTS integration_config (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Integraciones habilitadas
  integracion_afip BOOLEAN DEFAULT false,
  integracion_bancos BOOLEAN DEFAULT false,
  integracion_ecommerce BOOLEAN DEFAULT false,
  integracion_marketplaces BOOLEAN DEFAULT false,
  integracion_transportistas BOOLEAN DEFAULT false,
  integracion_contabilidad BOOLEAN DEFAULT false,
  integracion_pagos BOOLEAN DEFAULT false,
  integracion_crm_externo BOOLEAN DEFAULT false,
  integracion_bi_externo BOOLEAN DEFAULT false,
  integracion_whatsapp BOOLEAN DEFAULT false,

  -- Configuración AFIP
  afip_cuit VARCHAR(20),
  afip_ws_url VARCHAR(500),
  afip_ambiente VARCHAR(20) DEFAULT 'HOMOLOGACION',

  -- Configuración Bancos
  banco_provider VARCHAR(50),
  banco_api_key VARCHAR(500),
  banco_auto_import BOOLEAN DEFAULT false,

  -- Configuración E-commerce
  ecommerce_platform VARCHAR(50),
  ecommerce_api_url VARCHAR(500),
  ecommerce_api_key VARCHAR(500),
  ecommerce_sync_stock BOOLEAN DEFAULT true,
  ecommerce_sync_precios BOOLEAN DEFAULT true,

  -- Configuración Marketplaces
  mercadolibre_enabled BOOLEAN DEFAULT false,
  mercadolibre_client_id VARCHAR(200),
  mercadolibre_client_secret VARCHAR(200),

  -- Configuración Transportistas
  transportista_provider VARCHAR(50),
  transportista_api_key VARCHAR(500),
  transportista_auto_label BOOLEAN DEFAULT false,

  -- Configuración WhatsApp
  whatsapp_api_url VARCHAR(500),
  whatsapp_api_token VARCHAR(500),
  whatsapp_template_ids TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══ CONFIGURACIÓN DE IA Y AUTOMATIZACIÓN ═══
CREATE TABLE IF NOT EXISTS ai_config (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Funcionalidades de IA habilitadas
  ai_demand_forecasting BOOLEAN DEFAULT false,
  ai_price_optimization BOOLEAN DEFAULT false,
  ai_smart_reorder BOOLEAN DEFAULT false,
  ai_invoice_ocr BOOLEAN DEFAULT false,
  ai_document_classification BOOLEAN DEFAULT false,
  ai_chatbot BOOLEAN DEFAULT false,
  ai_fraud_detection BOOLEAN DEFAULT false,
  ai_sentiment_analysis BOOLEAN DEFAULT false,
  ai_predictive_maintenance BOOLEAN DEFAULT false,
  ai_quality_prediction BOOLEAN DEFAULT false,

  -- Configuración general de IA
  ai_provider VARCHAR(50) DEFAULT 'OPENAI',
  ai_api_key VARCHAR(500),
  ai_model VARCHAR(100) DEFAULT 'gpt-4',

  -- Configuración específica
  forecast_periodo_dias INT DEFAULT 90,
  forecast_auto_ajuste_stock BOOLEAN DEFAULT false,

  price_optimization_objetivo VARCHAR(50) DEFAULT 'MARGEN',
  price_optimization_competencia_enabled BOOLEAN DEFAULT false,

  ocr_auto_procesamiento BOOLEAN DEFAULT false,
  ocr_requiere_validacion BOOLEAN DEFAULT true,

  chatbot_idiomas TEXT DEFAULT 'es,en',
  chatbot_horario_disponible VARCHAR(100),

  fraud_score_threshold DECIMAL(5,2) DEFAULT 0.75,
  fraud_auto_bloqueo BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══ ÍNDICES PARA PERFORMANCE ═══
CREATE INDEX IF NOT EXISTS idx_purchase_config_company ON purchase_config(company_id);
CREATE INDEX IF NOT EXISTS idx_treasury_config_company ON treasury_config(company_id);
CREATE INDEX IF NOT EXISTS idx_general_config_company ON general_config(company_id);
CREATE INDEX IF NOT EXISTS idx_integration_config_company ON integration_config(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_config_company ON ai_config(company_id);

-- ═══ COMENTARIOS ═══
COMMENT ON TABLE purchase_config IS 'Configuración avanzada del módulo de Compras';
COMMENT ON TABLE treasury_config IS 'Configuración avanzada del módulo de Tesorería';
COMMENT ON TABLE general_config IS 'Configuración de módulos generales (CRM, BI, Proyectos, etc.)';
COMMENT ON TABLE integration_config IS 'Configuración de integraciones externas';
COMMENT ON TABLE ai_config IS 'Configuración de funcionalidades de Inteligencia Artificial';

COMMENT ON COLUMN ai_config.ai_demand_forecasting IS 'Predicción de demanda usando ML';
COMMENT ON COLUMN ai_config.ai_price_optimization IS 'Optimización dinámica de precios';
COMMENT ON COLUMN ai_config.ai_smart_reorder IS 'Reorden inteligente de stock';
COMMENT ON COLUMN ai_config.ai_invoice_ocr IS 'OCR automático de facturas';
COMMENT ON COLUMN ai_config.ai_chatbot IS 'Chatbot para atención al cliente';
COMMENT ON COLUMN ai_config.ai_fraud_detection IS 'Detección de fraude en transacciones';
