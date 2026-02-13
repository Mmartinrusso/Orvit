-- =============================================
-- SISTEMA DE MÓDULOS POR EMPRESA + ACOPIOS
-- =============================================

-- Enum para categorías de módulos
DO $$ BEGIN
    CREATE TYPE "ModuleCategory" AS ENUM ('VENTAS', 'COMPRAS', 'MANTENIMIENTO', 'COSTOS', 'ADMINISTRACION', 'GENERAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para condiciones de venta
DO $$ BEGIN
    CREATE TYPE "SaleConditionType" AS ENUM ('FORMAL', 'INFORMAL', 'MIXTO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para estado de acopio
DO $$ BEGIN
    CREATE TYPE "AcopioStatus" AS ENUM ('ACTIVO', 'PARCIAL', 'RETIRADO', 'VENCIDO', 'CANCELADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- TABLA: modules (Catálogo de Módulos)
-- =============================================
CREATE TABLE IF NOT EXISTS "modules" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ModuleCategory" NOT NULL,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "modules_key_key" ON "modules"("key");

-- =============================================
-- TABLA: company_modules (Módulos por Empresa)
-- =============================================
CREATE TABLE IF NOT EXISTS "company_modules" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "moduleId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledBy" INTEGER,
    "config" JSONB,

    CONSTRAINT "company_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_modules_companyId_moduleId_key" ON "company_modules"("companyId", "moduleId");
CREATE INDEX IF NOT EXISTS "company_modules_companyId_idx" ON "company_modules"("companyId");
CREATE INDEX IF NOT EXISTS "company_modules_moduleId_idx" ON "company_modules"("moduleId");
CREATE INDEX IF NOT EXISTS "company_modules_isEnabled_idx" ON "company_modules"("isEnabled");

ALTER TABLE "company_modules" DROP CONSTRAINT IF EXISTS "company_modules_companyId_fkey";
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_modules" DROP CONSTRAINT IF EXISTS "company_modules_moduleId_fkey";
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_modules" DROP CONSTRAINT IF EXISTS "company_modules_enabledBy_fkey";
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_enabledBy_fkey"
    FOREIGN KEY ("enabledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- MODIFICAR TABLA: Client (Agregar campos de acopio)
-- =============================================
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tipoCondicionVenta" "SaleConditionType" NOT NULL DEFAULT 'FORMAL';
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "porcentajeFormal" DECIMAL(5,2);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "limiteAcopio" DECIMAL(15,2);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "acopioActual" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "diasAlertaAcopio" INTEGER;

CREATE INDEX IF NOT EXISTS "Client_tipoCondicionVenta_idx" ON "Client"("tipoCondicionVenta");

-- =============================================
-- MODIFICAR TABLA: sales_config (Agregar config de acopios)
-- =============================================
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "habilitarAcopios" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "acopioPrefix" VARCHAR(10) NOT NULL DEFAULT 'ACO';
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "acopioNextNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "retiroPrefix" VARCHAR(10) NOT NULL DEFAULT 'RET';
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "retiroNextNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "diasAlertaAcopioDefault" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "diasVencimientoAcopioDefault" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "bloquearVentaAcopioExcedido" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "alertarAcopioExcedido" BOOLEAN NOT NULL DEFAULT true;

-- =============================================
-- TABLA: sale_acopios (Acopios de Venta)
-- =============================================
CREATE TABLE IF NOT EXISTS "sale_acopios" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "saleId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "estado" "AcopioStatus" NOT NULL DEFAULT 'ACTIVO',
    "fechaIngreso" DATE NOT NULL,
    "fechaVencimiento" DATE,
    "montoTotal" DECIMAL(15,2) NOT NULL,
    "montoRetirado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "montoPendiente" DECIMAL(15,2) NOT NULL,
    "notas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_acopios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sale_acopios_companyId_numero_key" ON "sale_acopios"("companyId", "numero");
CREATE INDEX IF NOT EXISTS "sale_acopios_companyId_idx" ON "sale_acopios"("companyId");
CREATE INDEX IF NOT EXISTS "sale_acopios_clientId_idx" ON "sale_acopios"("clientId");
CREATE INDEX IF NOT EXISTS "sale_acopios_saleId_idx" ON "sale_acopios"("saleId");
CREATE INDEX IF NOT EXISTS "sale_acopios_estado_idx" ON "sale_acopios"("estado");
CREATE INDEX IF NOT EXISTS "sale_acopios_fechaVencimiento_idx" ON "sale_acopios"("fechaVencimiento");

ALTER TABLE "sale_acopios" DROP CONSTRAINT IF EXISTS "sale_acopios_clientId_fkey";
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_acopios" DROP CONSTRAINT IF EXISTS "sale_acopios_saleId_fkey";
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_acopios" DROP CONSTRAINT IF EXISTS "sale_acopios_paymentId_fkey";
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "client_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sale_acopios" DROP CONSTRAINT IF EXISTS "sale_acopios_companyId_fkey";
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_acopios" DROP CONSTRAINT IF EXISTS "sale_acopios_createdBy_fkey";
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================
-- TABLA: sale_acopio_items (Items del Acopio)
-- =============================================
CREATE TABLE IF NOT EXISTS "sale_acopio_items" (
    "id" SERIAL NOT NULL,
    "acopioId" INTEGER NOT NULL,
    "saleItemId" INTEGER,
    "productId" TEXT,
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadRetirada" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cantidadPendiente" DECIMAL(15,4) NOT NULL,

    CONSTRAINT "sale_acopio_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sale_acopio_items_acopioId_idx" ON "sale_acopio_items"("acopioId");
CREATE INDEX IF NOT EXISTS "sale_acopio_items_productId_idx" ON "sale_acopio_items"("productId");

ALTER TABLE "sale_acopio_items" DROP CONSTRAINT IF EXISTS "sale_acopio_items_acopioId_fkey";
ALTER TABLE "sale_acopio_items" ADD CONSTRAINT "sale_acopio_items_acopioId_fkey"
    FOREIGN KEY ("acopioId") REFERENCES "sale_acopios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_acopio_items" DROP CONSTRAINT IF EXISTS "sale_acopio_items_productId_fkey";
ALTER TABLE "sale_acopio_items" ADD CONSTRAINT "sale_acopio_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- TABLA: acopio_retiros (Retiros de Acopio)
-- =============================================
CREATE TABLE IF NOT EXISTS "acopio_retiros" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "acopioId" INTEGER NOT NULL,
    "fechaRetiro" DATE NOT NULL,
    "retiraNombre" VARCHAR(255),
    "retiraDNI" VARCHAR(20),
    "retiraRelacion" VARCHAR(100),
    "montoRetirado" DECIMAL(15,2) NOT NULL,
    "transportista" VARCHAR(255),
    "vehiculo" VARCHAR(100),
    "patente" VARCHAR(20),
    "firmaRetiro" TEXT,
    "fotoEntrega" TEXT,
    "gpsEntrega" VARCHAR(100),
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "observaciones" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acopio_retiros_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "acopio_retiros_companyId_numero_key" ON "acopio_retiros"("companyId", "numero");
CREATE INDEX IF NOT EXISTS "acopio_retiros_acopioId_idx" ON "acopio_retiros"("acopioId");
CREATE INDEX IF NOT EXISTS "acopio_retiros_companyId_idx" ON "acopio_retiros"("companyId");
CREATE INDEX IF NOT EXISTS "acopio_retiros_fechaRetiro_idx" ON "acopio_retiros"("fechaRetiro");

ALTER TABLE "acopio_retiros" DROP CONSTRAINT IF EXISTS "acopio_retiros_acopioId_fkey";
ALTER TABLE "acopio_retiros" ADD CONSTRAINT "acopio_retiros_acopioId_fkey"
    FOREIGN KEY ("acopioId") REFERENCES "sale_acopios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acopio_retiros" DROP CONSTRAINT IF EXISTS "acopio_retiros_companyId_fkey";
ALTER TABLE "acopio_retiros" ADD CONSTRAINT "acopio_retiros_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acopio_retiros" DROP CONSTRAINT IF EXISTS "acopio_retiros_createdBy_fkey";
ALTER TABLE "acopio_retiros" ADD CONSTRAINT "acopio_retiros_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================
-- TABLA: acopio_retiro_items (Items del Retiro)
-- =============================================
CREATE TABLE IF NOT EXISTS "acopio_retiro_items" (
    "id" SERIAL NOT NULL,
    "retiroId" INTEGER NOT NULL,
    "acopioItemId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,

    CONSTRAINT "acopio_retiro_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "acopio_retiro_items_retiroId_idx" ON "acopio_retiro_items"("retiroId");
CREATE INDEX IF NOT EXISTS "acopio_retiro_items_acopioItemId_idx" ON "acopio_retiro_items"("acopioItemId");

ALTER TABLE "acopio_retiro_items" DROP CONSTRAINT IF EXISTS "acopio_retiro_items_retiroId_fkey";
ALTER TABLE "acopio_retiro_items" ADD CONSTRAINT "acopio_retiro_items_retiroId_fkey"
    FOREIGN KEY ("retiroId") REFERENCES "acopio_retiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================
-- SEED: Módulos Iniciales
-- =============================================
INSERT INTO "modules" ("id", "key", "name", "description", "category", "icon", "isActive", "sortOrder", "dependencies", "createdAt", "updatedAt")
VALUES
    -- VENTAS
    (gen_random_uuid()::text, 'sales_core', 'Ventas Core', 'Funcionalidades base de ventas: cotizaciones, órdenes, entregas, facturas', 'VENTAS', 'ShoppingCart', true, 1, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'acopios', 'Sistema de Acopios', 'Gestión de mercadería pagada pendiente de retiro con control de límites', 'VENTAS', 'Package', true, 2, ARRAY['sales_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'mixed_sales_conditions', 'Condiciones Mixtas de Venta', 'Permite configurar condiciones de venta mixtas (formal/informal) por cliente', 'VENTAS', 'SplitSquareHorizontal', true, 3, ARRAY['sales_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'multi_price_lists', 'Listas de Precio Múltiples', 'Soporte para múltiples listas de precio por cliente', 'VENTAS', 'ListOrdered', true, 4, ARRAY['sales_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'seller_commissions', 'Comisiones de Vendedores', 'Sistema completo de comisiones con tracking y reportes', 'VENTAS', 'Percent', true, 5, ARRAY['sales_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'client_portal', 'Portal de Clientes', 'Acceso de clientes para ver cotizaciones, documentos y cuenta corriente', 'VENTAS', 'Globe', true, 6, ARRAY['sales_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'fiscal_invoicing', 'Facturación Fiscal (AFIP)', 'Integración con AFIP para facturación electrónica', 'VENTAS', 'FileCheck', true, 7, ARRAY['sales_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'client_ledger', 'Cuenta Corriente Clientes', 'Sistema de cuenta corriente tipo ledger inmutable para clientes', 'VENTAS', 'BookOpen', true, 8, ARRAY['sales_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'client_credit_limits', 'Límites de Crédito', 'Control de límites de crédito con bloqueo automático', 'VENTAS', 'AlertTriangle', true, 9, ARRAY['sales_core']::TEXT[], NOW(), NOW()),

    -- COMPRAS
    (gen_random_uuid()::text, 'purchases_core', 'Compras Core', 'Funcionalidades base de compras: solicitudes, órdenes, recepciones', 'COMPRAS', 'ShoppingBag', true, 10, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'purchase_orders', 'Órdenes de Compra', 'Gestión completa de órdenes de compra con workflow de aprobación', 'COMPRAS', 'FileText', true, 11, ARRAY['purchases_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'supplier_ledger', 'Cuentas Corrientes Proveedores', 'Sistema de cuenta corriente para proveedores', 'COMPRAS', 'BookOpen', true, 12, ARRAY['purchases_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'stock_management', 'Gestión de Stock', 'Control de inventario, ubicaciones y transferencias', 'COMPRAS', 'Warehouse', true, 13, ARRAY['purchases_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'stock_replenishment', 'Reposición de Stock', 'Sistema automático de sugerencias de reposición', 'COMPRAS', 'RefreshCw', true, 14, ARRAY['stock_management']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'cost_centers', 'Centros de Costo', 'Asignación de compras a centros de costo', 'COMPRAS', 'PieChart', true, 15, ARRAY['purchases_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'projects', 'Proyectos', 'Vinculación de compras a proyectos específicos', 'COMPRAS', 'FolderKanban', true, 16, ARRAY['purchases_core']::TEXT[], NOW(), NOW()),

    -- MANTENIMIENTO
    (gen_random_uuid()::text, 'maintenance_core', 'Mantenimiento Core', 'Funcionalidades base de mantenimiento: órdenes de trabajo, equipos', 'MANTENIMIENTO', 'Wrench', true, 20, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'preventive_maintenance', 'Mantenimiento Preventivo', 'Programación y gestión de mantenimiento preventivo con checklists', 'MANTENIMIENTO', 'Calendar', true, 21, ARRAY['maintenance_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'corrective_maintenance', 'Mantenimiento Correctivo', 'Gestión de fallas, RCA y soluciones', 'MANTENIMIENTO', 'AlertCircle', true, 22, ARRAY['maintenance_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'panol', 'Pañol / Herramientas', 'Gestión de herramientas y préstamos', 'MANTENIMIENTO', 'Hammer', true, 23, ARRAY['maintenance_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'mobile_units', 'Unidades Móviles', 'Gestión de vehículos y unidades móviles', 'MANTENIMIENTO', 'Truck', true, 24, ARRAY['maintenance_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'downtime_tracking', 'Tracking de Paradas', 'Registro y análisis de tiempos de parada de equipos', 'MANTENIMIENTO', 'Clock', true, 25, ARRAY['maintenance_core']::TEXT[], NOW(), NOW()),

    -- COSTOS
    (gen_random_uuid()::text, 'costs_core', 'Costos Core', 'Cálculo de costos de productos y recetas', 'COSTOS', 'Calculator', true, 30, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'costs_dashboard', 'Dashboard de Costos', 'Visualización y análisis de costos', 'COSTOS', 'BarChart3', true, 31, ARRAY['costs_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'labor_costs', 'Costos Laborales', 'Gestión de costos laborales y categorías', 'COSTOS', 'Users', true, 32, ARRAY['costs_core']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'indirect_costs', 'Costos Indirectos', 'Asignación y distribución de costos indirectos', 'COSTOS', 'Layers', true, 33, ARRAY['costs_core']::TEXT[], NOW(), NOW()),

    -- ADMINISTRACION
    (gen_random_uuid()::text, 'cargas', 'Sistema de Cargas', 'Gestión de cargas y entregas', 'ADMINISTRACION', 'Truck', true, 40, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'controls', 'Controles Fiscales', 'Gestión de impuestos y obligaciones fiscales', 'ADMINISTRACION', 'FileCheck2', true, 41, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'agenda', 'Agenda', 'Calendario y agenda de eventos', 'ADMINISTRACION', 'CalendarDays', true, 42, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'notifications', 'Notificaciones', 'Sistema de notificaciones y alertas', 'ADMINISTRACION', 'Bell', true, 43, ARRAY[]::TEXT[], NOW(), NOW()),

    -- GENERAL
    (gen_random_uuid()::text, 'tasks', 'Tareas', 'Sistema de tareas y asignaciones', 'GENERAL', 'CheckSquare', true, 50, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'fixed_tasks', 'Tareas Fijas', 'Tareas recurrentes con programación automática', 'GENERAL', 'RefreshCcw', true, 51, ARRAY['tasks']::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'documents', 'Documentos', 'Gestión de documentos y archivos', 'GENERAL', 'Files', true, 52, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'advanced_reports', 'Reportes Avanzados', 'Reportes personalizados y exportación', 'GENERAL', 'FileSpreadsheet', true, 53, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'ai_assistant', 'Asistente IA', 'Asistente virtual con inteligencia artificial', 'GENERAL', 'Bot', true, 54, ARRAY[]::TEXT[], NOW(), NOW()),
    (gen_random_uuid()::text, 'whatsapp_integration', 'Integración WhatsApp', 'Notificaciones y comunicación por WhatsApp', 'GENERAL', 'MessageCircle', true, 55, ARRAY['notifications']::TEXT[], NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "category" = EXCLUDED."category",
    "icon" = EXCLUDED."icon",
    "sortOrder" = EXCLUDED."sortOrder",
    "dependencies" = EXCLUDED."dependencies",
    "updatedAt" = NOW();

-- =============================================
-- Habilitar todos los módulos para empresas existentes
-- =============================================
INSERT INTO "company_modules" ("id", "companyId", "moduleId", "isEnabled", "enabledAt")
SELECT
    gen_random_uuid()::text,
    c.id,
    m.id,
    true,
    NOW()
FROM "Company" c
CROSS JOIN "modules" m
ON CONFLICT ("companyId", "moduleId") DO NOTHING;

-- =============================================
-- FIN DE MIGRACIÓN
-- =============================================
