-- =====================================================
-- UNIVERSAL FEATURES MIGRATION
-- Features: Templates, Follow-ups, Approvals, Alerts, Backorders, Commissions
-- =====================================================

-- 1. QUOTE TEMPLATES (Plantillas de Cotizaciones)
-- =====================================================
CREATE TABLE "quote_templates" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "nombre" VARCHAR(255) NOT NULL,
  "descripcion" TEXT,
  "categoria" VARCHAR(100),
  "isActive" BOOLEAN NOT NULL DEFAULT true,

  -- Contenido pre-configurado
  "titulo" VARCHAR(500),
  "condicionesPago" TEXT,
  "condicionesEntrega" TEXT,
  "tiempoEntrega" VARCHAR(255),
  "validezDias" INTEGER NOT NULL DEFAULT 30,
  "notas" TEXT,
  "notasInternas" TEXT,

  -- Descuentos por defecto
  "descuentoDefault" DECIMAL(5, 2) DEFAULT 0,
  "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
  "tasaIva" DECIMAL(5, 2) NOT NULL DEFAULT 21,

  -- Uso y estadísticas
  "timesUsed" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP,

  -- Tracking
  "createdBy" INTEGER NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "quote_template_items" (
  "id" SERIAL PRIMARY KEY,
  "templateId" INTEGER NOT NULL REFERENCES "quote_templates"("id") ON DELETE CASCADE,
  "productId" TEXT REFERENCES "Product"("id"),
  "descripcion" VARCHAR(500) NOT NULL,
  "cantidad" DECIMAL(15, 4) NOT NULL DEFAULT 1,
  "unidad" VARCHAR(50) NOT NULL DEFAULT 'UN',
  "usarPrecioActual" BOOLEAN NOT NULL DEFAULT true,
  "precioFijo" DECIMAL(15, 2),
  "descuento" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "notas" TEXT
);

CREATE INDEX "idx_quote_templates_company" ON "quote_templates"("companyId");
CREATE INDEX "idx_quote_templates_active" ON "quote_templates"("companyId", "isActive");
CREATE INDEX "idx_quote_template_items_template" ON "quote_template_items"("templateId");

-- =====================================================
-- 2. FOLLOW-UPS (Seguimientos Automáticos)
-- =====================================================
CREATE TABLE "quote_follow_ups" (
  "id" SERIAL PRIMARY KEY,
  "quoteId" INTEGER NOT NULL REFERENCES "quotes"("id") ON DELETE CASCADE,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,

  -- Tipo y canal
  "tipo" VARCHAR(20) NOT NULL CHECK ("tipo" IN ('AUTO', 'MANUAL')),
  "canal" VARCHAR(20) NOT NULL CHECK ("canal" IN ('EMAIL', 'WHATSAPP', 'LLAMADA', 'INTERNO')),

  -- Contenido
  "asunto" VARCHAR(255),
  "mensaje" TEXT,

  -- Programación
  "programadoPara" TIMESTAMP NOT NULL,
  "enviado" BOOLEAN NOT NULL DEFAULT false,
  "enviadoAt" TIMESTAMP,
  "errorEnvio" TEXT,

  -- Respuesta
  "respondido" BOOLEAN NOT NULL DEFAULT false,
  "respuestaAt" TIMESTAMP,
  "resultado" VARCHAR(20) CHECK ("resultado" IN ('INTERESADO', 'SEGUIR', 'NO_INTERESA', 'CONVERTIDA', 'POSPONER')),
  "comentarios" TEXT,

  -- Tracking
  "createdBy" INTEGER NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_follow_ups_quote" ON "quote_follow_ups"("quoteId");
CREATE INDEX "idx_follow_ups_programado" ON "quote_follow_ups"("programadoPara", "enviado");
CREATE INDEX "idx_follow_ups_pending" ON "quote_follow_ups"("companyId", "enviado", "programadoPara");

-- =====================================================
-- 3. APPROVAL WORKFLOWS (Aprobaciones Multi-nivel)
-- =====================================================
CREATE TABLE "quote_approval_workflows" (
  "id" SERIAL PRIMARY KEY,
  "quoteId" INTEGER NOT NULL REFERENCES "quotes"("id") ON DELETE CASCADE,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,

  -- Motivo de aprobación requerida
  "motivo" VARCHAR(50) NOT NULL CHECK ("motivo" IN (
    'MARGEN_BAJO', 'MONTO_ALTO', 'DESCUENTO_ALTO', 'CLIENTE_NUEVO',
    'CONDICIONES_ESPECIALES', 'MANUAL'
  )),
  "detalleMotivo" TEXT,

  -- Valores que dispararon la aprobación
  "margenActual" DECIMAL(5, 2),
  "margenMinimo" DECIMAL(5, 2),
  "montoTotal" DECIMAL(15, 2),
  "descuentoTotal" DECIMAL(5, 2),

  -- Estado general
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK ("estado" IN (
    'PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'EXPIRADA'
  )),
  "nivelActual" INTEGER NOT NULL DEFAULT 1,
  "nivelesRequeridos" INTEGER NOT NULL,

  -- Resultado
  "resueltoAt" TIMESTAMP,
  "resueltoBy" INTEGER REFERENCES "User"("id"),
  "comentarioFinal" TEXT,

  -- Expiración
  "expiraAt" TIMESTAMP,

  -- Tracking
  "solicitadoBy" INTEGER NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "quote_approval_levels" (
  "id" SERIAL PRIMARY KEY,
  "workflowId" INTEGER NOT NULL REFERENCES "quote_approval_workflows"("id") ON DELETE CASCADE,
  "nivel" INTEGER NOT NULL,

  -- Quién debe aprobar
  "aprobarPorRol" VARCHAR(50),
  "aprobarPorUsuarios" INTEGER[], -- Array de user IDs

  -- Resultado
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK ("estado" IN (
    'PENDIENTE', 'APROBADO', 'RECHAZADO', 'OMITIDO'
  )),
  "aprobadoPor" INTEGER REFERENCES "User"("id"),
  "aprobadoAt" TIMESTAMP,
  "comentario" TEXT,

  UNIQUE ("workflowId", "nivel")
);

CREATE INDEX "idx_approval_workflows_quote" ON "quote_approval_workflows"("quoteId");
CREATE INDEX "idx_approval_workflows_pending" ON "quote_approval_workflows"("companyId", "estado");
CREATE INDEX "idx_approval_levels_workflow" ON "quote_approval_levels"("workflowId");

-- =====================================================
-- 4. RISK ALERTS (Alertas de Riesgo)
-- =====================================================
CREATE TABLE "sales_risk_alerts" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "documentType" VARCHAR(20) NOT NULL CHECK ("documentType" IN ('QUOTE', 'SALE', 'INVOICE', 'CLIENT')),
  "documentId" INTEGER NOT NULL,

  -- Tipo de alerta
  "tipo" VARCHAR(50) NOT NULL,
  "categoria" VARCHAR(30) NOT NULL CHECK ("categoria" IN (
    'CREDITO', 'STOCK', 'ENTREGA', 'MARGEN', 'VENCIMIENTO', 'OPERATIVA', 'OTRO'
  )),
  "severidad" VARCHAR(10) NOT NULL CHECK ("severidad" IN ('CRITICA', 'ALTA', 'MEDIA', 'BAJA')),

  -- Contenido
  "titulo" VARCHAR(255) NOT NULL,
  "mensaje" TEXT NOT NULL,
  "recomendacion" TEXT,
  "datosAdicionales" JSONB,

  -- Estado
  "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CHECK ("estado" IN (
    'ACTIVA', 'RESUELTA', 'IGNORADA', 'EXPIRADA'
  )),
  "resolvidaPor" INTEGER REFERENCES "User"("id"),
  "resolvidaAt" TIMESTAMP,
  "comentarioResolucion" TEXT,

  -- Auto-resolver
  "autoResolver" BOOLEAN NOT NULL DEFAULT false,
  "autoResueltaAt" TIMESTAMP,

  -- Tracking
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_risk_alerts_company" ON "sales_risk_alerts"("companyId", "estado", "severidad");
CREATE INDEX "idx_risk_alerts_document" ON "sales_risk_alerts"("documentType", "documentId");
CREATE INDEX "idx_risk_alerts_tipo" ON "sales_risk_alerts"("companyId", "tipo", "estado");

-- =====================================================
-- 5. BACKORDERS (Pedidos Pendientes)
-- =====================================================
CREATE TABLE "sale_backorders" (
  "id" SERIAL PRIMARY KEY,
  "saleId" INTEGER NOT NULL REFERENCES "sales"("id") ON DELETE CASCADE,
  "saleItemId" INTEGER NOT NULL REFERENCES "sale_items"("id") ON DELETE CASCADE,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,

  -- Producto
  "productId" TEXT NOT NULL REFERENCES "Product"("id"),
  "cantidadOriginal" DECIMAL(15, 4) NOT NULL,
  "cantidadRecibida" DECIMAL(15, 4) NOT NULL DEFAULT 0,
  "cantidadPendiente" DECIMAL(15, 4) NOT NULL,

  -- Estimación
  "fechaEstimadaDisponibilidad" DATE,
  "proveedorId" INTEGER,
  "ordenCompraId" INTEGER,
  "loteEsperado" VARCHAR(100),

  -- Notificaciones al cliente
  "notificarCliente" BOOLEAN NOT NULL DEFAULT true,
  "clienteNotificadoAt" TIMESTAMP,
  "ultimoSeguimiento" TIMESTAMP,

  -- Prioridad
  "prioridad" VARCHAR(10) NOT NULL DEFAULT 'NORMAL' CHECK ("prioridad" IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),

  -- Estado
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK ("estado" IN (
    'PENDIENTE', 'PARCIAL', 'COMPLETO', 'CANCELADO'
  )),
  "completadoAt" TIMESTAMP,
  "canceladoAt" TIMESTAMP,
  "motivoCancelacion" TEXT,

  -- Tracking
  "createdBy" INTEGER NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "sale_backorder_receipts" (
  "id" SERIAL PRIMARY KEY,
  "backorderId" INTEGER NOT NULL REFERENCES "sale_backorders"("id") ON DELETE CASCADE,
  "cantidad" DECIMAL(15, 4) NOT NULL,
  "lote" VARCHAR(100),
  "fechaRecepcion" TIMESTAMP NOT NULL DEFAULT NOW(),
  "recibidobBy" INTEGER NOT NULL REFERENCES "User"("id"),
  "notas" TEXT
);

CREATE INDEX "idx_backorders_sale" ON "sale_backorders"("saleId");
CREATE INDEX "idx_backorders_product" ON "sale_backorders"("productId", "estado");
CREATE INDEX "idx_backorders_pending" ON "sale_backorders"("companyId", "estado", "prioridad");
CREATE INDEX "idx_backorder_receipts_backorder" ON "sale_backorder_receipts"("backorderId");

-- =====================================================
-- 6. COMMISSION RULES & PAYMENTS (Comisiones)
-- =====================================================
CREATE TABLE "commission_rules" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "nombre" VARCHAR(255) NOT NULL,
  "descripcion" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,

  -- Aplicabilidad
  "aplicaA" VARCHAR(20) NOT NULL CHECK ("aplicaA" IN ('TODOS', 'VENDEDOR', 'EQUIPO', 'SUPERVISOR', 'ESPECIFICOS')),
  "usuariosEspecificos" INTEGER[],
  "rolesEspecificos" VARCHAR(50)[],

  -- Cálculo base
  "base" VARCHAR(20) NOT NULL CHECK ("base" IN ('SUBTOTAL', 'TOTAL', 'MARGEN_BRUTO', 'MARGEN_NETO')),
  "porcentaje" DECIMAL(5, 2),
  "montoFijo" DECIMAL(15, 2),

  -- Condiciones
  "minimoVentasMes" DECIMAL(15, 2),
  "soloVentasFacturadas" BOOLEAN NOT NULL DEFAULT true,
  "soloVentasCobradas" BOOLEAN NOT NULL DEFAULT false,
  "excluirDescuentos" BOOLEAN NOT NULL DEFAULT false,

  -- Timing
  "pagoEnMes" VARCHAR(20) NOT NULL DEFAULT 'FACTURACION' CHECK ("pagoEnMes" IN ('VENTA', 'FACTURACION', 'COBRANZA')),

  -- Prioridad (si aplican múltiples)
  "prioridad" INTEGER NOT NULL DEFAULT 0,

  -- Tracking
  "createdBy" INTEGER NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "commission_rule_tiers" (
  "id" SERIAL PRIMARY KEY,
  "ruleId" INTEGER NOT NULL REFERENCES "commission_rules"("id") ON DELETE CASCADE,
  "desdeVentas" DECIMAL(15, 2) NOT NULL,
  "hastaVentas" DECIMAL(15, 2),
  "porcentaje" DECIMAL(5, 2) NOT NULL,
  "descripcion" VARCHAR(255),
  "orden" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "commission_calculations" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES "User"("id"),
  "periodo" VARCHAR(7) NOT NULL, -- YYYY-MM

  -- Ventas incluidas
  "ventasIncluidas" INTEGER NOT NULL DEFAULT 0,
  "montoBaseTotal" DECIMAL(15, 2) NOT NULL DEFAULT 0,

  -- Cálculo
  "comisionBase" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "bonificaciones" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "deducciones" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "total" DECIMAL(15, 2) NOT NULL DEFAULT 0,

  -- Detalles
  "detalleVentas" JSONB,
  "detalleCalculos" JSONB,

  -- Estado
  "estado" VARCHAR(20) NOT NULL DEFAULT 'CALCULADO' CHECK ("estado" IN (
    'CALCULADO', 'APROBADO', 'RECHAZADO', 'PAGADO'
  )),
  "aprobadoPor" INTEGER REFERENCES "User"("id"),
  "aprobadoAt" TIMESTAMP,
  "pagadoAt" TIMESTAMP,
  "comentarios" TEXT,

  -- Tracking
  "calculadoAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE ("companyId", "userId", "periodo")
);

CREATE INDEX "idx_commission_rules_company" ON "commission_rules"("companyId", "activo");
CREATE INDEX "idx_commission_tiers_rule" ON "commission_rule_tiers"("ruleId");
CREATE INDEX "idx_commission_calcs_user_periodo" ON "commission_calculations"("userId", "periodo");
CREATE INDEX "idx_commission_calcs_pending" ON "commission_calculations"("companyId", "estado");

-- =====================================================
-- 7. APPROVAL CONFIG (Configuración de Aprobaciones)
-- =====================================================
CREATE TABLE "sales_approval_config" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL UNIQUE REFERENCES "Company"("id") ON DELETE CASCADE,

  -- Configuración de aprobaciones automáticas
  "requiereAprobacionSi" JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Ejemplo: {"margenMenorA": 15, "montoMayorA": 1000000, "descuentoMayorA": 20}

  -- Niveles de aprobación
  "niveles" JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Ejemplo: [{"nivel": 1, "rol": "SUPERVISOR"}, {"nivel": 2, "rol": "GERENTE"}]

  -- Timeouts
  "diasExpiracion" INTEGER NOT NULL DEFAULT 7,
  "recordatoriosDias" INTEGER[] DEFAULT ARRAY[1, 3, 5],

  -- Notificaciones
  "notificarPorEmail" BOOLEAN NOT NULL DEFAULT true,
  "notificarPorInterno" BOOLEAN NOT NULL DEFAULT true,

  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDICES ADICIONALES PARA PERFORMANCE
-- =====================================================

-- Optimizar queries de dashboard
CREATE INDEX "idx_quotes_company_estado_fecha" ON "quotes"("companyId", "estado", "fechaEmision" DESC);
CREATE INDEX "idx_sales_company_estado_fecha" ON "sales"("companyId", "estado", "fechaEmision" DESC);

-- Optimizar queries de ventas por vendedor
CREATE INDEX "idx_quotes_seller_fecha" ON "quotes"("sellerId", "fechaEmision" DESC) WHERE "sellerId" IS NOT NULL;
CREATE INDEX "idx_sales_seller_fecha" ON "sales"("sellerId", "fechaEmision" DESC) WHERE "sellerId" IS NOT NULL;

-- Optimizar queries de cliente
CREATE INDEX "idx_quotes_client_fecha" ON "quotes"("clientId", "fechaEmision" DESC);
CREATE INDEX "idx_sales_client_fecha" ON "sales"("clientId", "fechaEmision" DESC);

-- =====================================================
-- TRIGGERS PARA AUDITORÍA
-- =====================================================

-- Trigger para actualizar updatedAt automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quote_templates_updated_at BEFORE UPDATE ON "quote_templates"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON "quote_follow_ups"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON "quote_approval_workflows"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_alerts_updated_at BEFORE UPDATE ON "sales_risk_alerts"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backorders_updated_at BEFORE UPDATE ON "sale_backorders"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_rules_updated_at BEFORE UPDATE ON "commission_rules"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_calcs_updated_at BEFORE UPDATE ON "commission_calculations"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMENTARIOS EN TABLAS
-- =====================================================

COMMENT ON TABLE "quote_templates" IS 'Plantillas reutilizables de cotizaciones con items predefinidos';
COMMENT ON TABLE "quote_follow_ups" IS 'Sistema de seguimiento automático y recordatorios para cotizaciones';
COMMENT ON TABLE "quote_approval_workflows" IS 'Flujos de aprobación multi-nivel para cotizaciones';
COMMENT ON TABLE "sales_risk_alerts" IS 'Alertas proactivas de riesgos en ventas y cotizaciones';
COMMENT ON TABLE "sale_backorders" IS 'Gestión de pedidos pendientes por falta de stock';
COMMENT ON TABLE "commission_rules" IS 'Reglas configurables para cálculo de comisiones';
COMMENT ON TABLE "commission_calculations" IS 'Cálculos mensuales de comisiones por vendedor';
COMMENT ON TABLE "sales_approval_config" IS 'Configuración de reglas de aprobación por compañía';
