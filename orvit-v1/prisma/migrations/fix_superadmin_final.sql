-- =============================================
-- FIX FINAL: SUPERADMIN Tables
-- Crea/actualiza las tablas necesarias para SUPERADMIN
-- =============================================

-- =============================================
-- PASO 1: ENUMs
-- =============================================

DO $$ BEGIN CREATE TYPE "ModuleCategory" AS ENUM ('VENTAS', 'COMPRAS', 'MANTENIMIENTO', 'COSTOS', 'ADMINISTRACION', 'GENERAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- PASO 2: Eliminar y recrear tablas de módulos (sin datos importantes)
-- =============================================

DROP TABLE IF EXISTS "company_modules" CASCADE;
DROP TABLE IF EXISTS "modules" CASCADE;
DROP TABLE IF EXISTS "company_templates" CASCADE;

-- =============================================
-- PASO 3: Crear tablas correctamente
-- =============================================

CREATE TABLE "modules" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ModuleCategory" NOT NULL DEFAULT 'GENERAL',
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dependencies" TEXT[] DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "modules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "modules_key_key" UNIQUE ("key")
);

CREATE TABLE "company_templates" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT DEFAULT 'Package',
    "color" TEXT DEFAULT '#8B5CF6',
    "moduleKeys" TEXT[] DEFAULT '{}',
    "config" JSONB DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "company_templates_name_key" UNIQUE ("name")
);

CREATE TABLE "company_modules" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "companyId" INTEGER NOT NULL,
    "moduleId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledBy" INTEGER,
    "config" JSONB,
    CONSTRAINT "company_modules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "company_modules_companyId_moduleId_key" UNIQUE ("companyId", "moduleId")
);

-- =============================================
-- PASO 4: Agregar templateId a Company
-- =============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Company' AND column_name = 'templateId') THEN
        ALTER TABLE "Company" ADD COLUMN "templateId" TEXT;
    END IF;
END $$;

-- =============================================
-- PASO 5: Índices
-- =============================================

CREATE INDEX "modules_category_idx" ON "modules"("category");
CREATE INDEX "modules_isActive_idx" ON "modules"("isActive");
CREATE INDEX "company_modules_companyId_idx" ON "company_modules"("companyId");
CREATE INDEX "company_modules_moduleId_idx" ON "company_modules"("moduleId");
CREATE INDEX "company_modules_isEnabled_idx" ON "company_modules"("isEnabled");
CREATE INDEX "company_templates_isDefault_idx" ON "company_templates"("isDefault");

-- =============================================
-- PASO 6: Foreign Keys
-- =============================================

ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_enabledBy_fkey"
    FOREIGN KEY ("enabledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "company_templates" ADD CONSTRAINT "company_templates_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FK para Company.templateId (solo si no existe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Company_templateId_fkey') THEN
        ALTER TABLE "Company" ADD CONSTRAINT "Company_templateId_fkey"
            FOREIGN KEY ("templateId") REFERENCES "company_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- =============================================
-- PASO 7: SEED de módulos
-- =============================================

INSERT INTO "modules" ("key", "name", "description", "category", "icon", "sortOrder") VALUES
('ventas_cotizaciones', 'Cotizaciones', 'Gestión de cotizaciones', 'VENTAS', 'FileText', 1),
('ventas_ordenes', 'Órdenes de Venta', 'Gestión de órdenes', 'VENTAS', 'ShoppingCart', 2),
('ventas_facturacion', 'Facturación', 'Emisión de facturas', 'VENTAS', 'Receipt', 3),
('ventas_cobranzas', 'Cobranzas', 'Gestión de cobros', 'VENTAS', 'Wallet', 4),
('ventas_clientes', 'Clientes', 'Gestión de clientes', 'VENTAS', 'Users', 5),
('ventas_precios', 'Listas de Precios', 'Gestión de precios', 'VENTAS', 'Tag', 6),
('ventas_acopios', 'Acopios', 'Sistema de acopios', 'VENTAS', 'Package', 7),
('ventas_comisiones', 'Comisiones', 'Comisiones vendedores', 'VENTAS', 'Percent', 8),
('compras_ordenes', 'Órdenes de Compra', 'Gestión de OC', 'COMPRAS', 'ShoppingBag', 10),
('compras_recepciones', 'Recepciones', 'Recepción de mercadería', 'COMPRAS', 'PackageCheck', 11),
('compras_proveedores', 'Proveedores', 'Gestión de proveedores', 'COMPRAS', 'Building', 12),
('compras_stock', 'Stock', 'Gestión de inventario', 'COMPRAS', 'Warehouse', 13),
('compras_cuentas_corrientes', 'Cuentas Corrientes', 'CC Proveedores', 'COMPRAS', 'CreditCard', 14),
('mantenimiento_preventivo', 'Mant. Preventivo', 'Mantenimiento preventivo', 'MANTENIMIENTO', 'Calendar', 20),
('mantenimiento_correctivo', 'Mant. Correctivo', 'Mantenimiento correctivo', 'MANTENIMIENTO', 'Wrench', 21),
('mantenimiento_ordenes', 'Órdenes de Trabajo', 'Gestión de OT', 'MANTENIMIENTO', 'ClipboardList', 22),
('mantenimiento_maquinas', 'Máquinas', 'Gestión de equipos', 'MANTENIMIENTO', 'Cog', 23),
('mantenimiento_panol', 'Pañol', 'Gestión de herramientas', 'MANTENIMIENTO', 'Hammer', 24),
('mantenimiento_unidades_moviles', 'Unidades Móviles', 'Vehículos', 'MANTENIMIENTO', 'Truck', 25),
('costos_dashboard', 'Dashboard Costos', 'Análisis de costos', 'COSTOS', 'BarChart3', 30),
('costos_productos', 'Costos Productos', 'Costos por producto', 'COSTOS', 'DollarSign', 31),
('costos_laborales', 'Costos Laborales', 'Mano de obra', 'COSTOS', 'Users', 32),
('costos_indirectos', 'Costos Indirectos', 'Costos indirectos', 'COSTOS', 'Layers', 33),
('admin_cargas', 'Cargas', 'Sistema de cargas', 'ADMINISTRACION', 'Truck', 40),
('admin_controles', 'Controles', 'Controles fiscales', 'ADMINISTRACION', 'Shield', 41),
('admin_tesoreria', 'Tesorería', 'Gestión de tesorería', 'ADMINISTRACION', 'Landmark', 42),
('admin_usuarios', 'Usuarios', 'Gestión de usuarios', 'ADMINISTRACION', 'UserCog', 43),
('admin_roles', 'Roles y Permisos', 'Gestión de roles', 'ADMINISTRACION', 'Key', 44),
('general_dashboard', 'Dashboard', 'Panel principal', 'GENERAL', 'LayoutDashboard', 50),
('general_tareas', 'Tareas', 'Gestión de tareas', 'GENERAL', 'CheckSquare', 51),
('general_calendario', 'Calendario', 'Calendario y agenda', 'GENERAL', 'Calendar', 52),
('general_reportes', 'Reportes', 'Generación de reportes', 'GENERAL', 'FileBarChart', 53);

-- =============================================
-- PASO 8: SEED de templates
-- =============================================

INSERT INTO "company_templates" ("name", "description", "icon", "color", "moduleKeys", "isDefault") VALUES
('Industria Completa', 'Template completo para industrias con todos los módulos', 'Factory', '#8B5CF6',
 ARRAY['ventas_cotizaciones','ventas_ordenes','ventas_facturacion','ventas_cobranzas','ventas_clientes','ventas_precios',
       'compras_ordenes','compras_recepciones','compras_proveedores','compras_stock','compras_cuentas_corrientes',
       'mantenimiento_preventivo','mantenimiento_correctivo','mantenimiento_ordenes','mantenimiento_maquinas','mantenimiento_panol',
       'costos_dashboard','costos_productos','costos_laborales','costos_indirectos',
       'admin_usuarios','admin_roles',
       'general_dashboard','general_tareas','general_calendario','general_reportes'], true),

('Comercio', 'Para empresas comerciales (compra/venta)', 'Store', '#3B82F6',
 ARRAY['ventas_cotizaciones','ventas_ordenes','ventas_facturacion','ventas_cobranzas','ventas_clientes','ventas_precios',
       'compras_ordenes','compras_recepciones','compras_proveedores','compras_stock',
       'admin_usuarios',
       'general_dashboard','general_tareas','general_reportes'], false),

('Servicio Técnico', 'Para empresas de servicio técnico', 'Wrench', '#F97316',
 ARRAY['ventas_cotizaciones','ventas_ordenes','ventas_facturacion','ventas_cobranzas','ventas_clientes',
       'mantenimiento_preventivo','mantenimiento_correctivo','mantenimiento_ordenes','mantenimiento_panol',
       'admin_usuarios',
       'general_dashboard','general_tareas','general_calendario'], false),

('Básico', 'Configuración mínima', 'Briefcase', '#6B7280',
 ARRAY['ventas_clientes','general_dashboard','general_tareas'], false);

-- =============================================
-- PASO 9: Habilitar todos los módulos para empresas existentes
-- =============================================

INSERT INTO "company_modules" ("companyId", "moduleId", "isEnabled", "enabledAt")
SELECT c.id, m.id, true, NOW()
FROM "Company" c
CROSS JOIN "modules" m;

-- =============================================
-- FIN
-- =============================================

DO $$
DECLARE
    v_modules INT;
    v_templates INT;
    v_company_modules INT;
BEGIN
    SELECT COUNT(*) INTO v_modules FROM modules;
    SELECT COUNT(*) INTO v_templates FROM company_templates;
    SELECT COUNT(*) INTO v_company_modules FROM company_modules;

    RAISE NOTICE '==============================================';
    RAISE NOTICE 'SUPERADMIN - Migración completada exitosamente';
    RAISE NOTICE 'Módulos: %', v_modules;
    RAISE NOTICE 'Templates: %', v_templates;
    RAISE NOTICE 'Company-Módulos: %', v_company_modules;
    RAISE NOTICE '==============================================';
END $$;
