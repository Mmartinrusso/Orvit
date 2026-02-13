-- =============================================
-- SISTEMA DE TEMPLATES DE EMPRESAS
-- Permite crear presets de módulos para nuevas empresas
-- =============================================

-- =============================================
-- TABLA: company_templates
-- =============================================

CREATE TABLE IF NOT EXISTS "company_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT DEFAULT '#8B5CF6',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "moduleKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS "company_templates_name_key" ON "company_templates"("name");
CREATE INDEX IF NOT EXISTS "company_templates_isActive_idx" ON "company_templates"("isActive");
CREATE INDEX IF NOT EXISTS "company_templates_isDefault_idx" ON "company_templates"("isDefault");

-- Foreign Key
ALTER TABLE "company_templates" DROP CONSTRAINT IF EXISTS "company_templates_createdBy_fkey";
ALTER TABLE "company_templates" ADD CONSTRAINT "company_templates_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- MODIFICAR Company - Agregar templateId
-- =============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Company' AND column_name = 'templateId') THEN
        ALTER TABLE "Company" ADD COLUMN "templateId" TEXT;
    END IF;
END $$;

-- Foreign Key para templateId
ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_templateId_fkey";
ALTER TABLE "Company" ADD CONSTRAINT "Company_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "company_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- TRIGGER: Actualizar updatedAt
-- =============================================

CREATE OR REPLACE FUNCTION update_company_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_company_templates_updated_at ON "company_templates";
CREATE TRIGGER trigger_company_templates_updated_at
    BEFORE UPDATE ON "company_templates"
    FOR EACH ROW
    EXECUTE FUNCTION update_company_templates_updated_at();

-- =============================================
-- SEED: Templates Predeterminados
-- =============================================

INSERT INTO "company_templates" ("id", "name", "description", "icon", "color", "isDefault", "isActive", "moduleKeys", "config")
VALUES
    -- Básico
    (
        gen_random_uuid()::text,
        'Básico',
        'Configuración mínima para empresas pequeñas. Incluye módulos esenciales.',
        'Package',
        '#3B82F6',
        true,
        true,
        ARRAY['sales_core', 'purchases_core', 'tasks', 'notifications']::TEXT[],
        '{"maxUsers": 5, "maxStorage": "1GB"}'::JSONB
    ),
    -- Comercial
    (
        gen_random_uuid()::text,
        'Comercial',
        'Para empresas de comercio y distribución. Incluye ventas, compras y stock.',
        'ShoppingCart',
        '#10B981',
        false,
        true,
        ARRAY['sales_core', 'acopios', 'multi_price_lists', 'client_ledger', 'purchases_core', 'purchase_orders', 'supplier_ledger', 'stock_management', 'tasks', 'notifications', 'documents']::TEXT[],
        '{"maxUsers": 20, "maxStorage": "10GB"}'::JSONB
    ),
    -- Industrial
    (
        gen_random_uuid()::text,
        'Industrial',
        'Para fábricas y manufactura. Incluye mantenimiento, costos y producción.',
        'Factory',
        '#F59E0B',
        false,
        true,
        ARRAY['sales_core', 'purchases_core', 'purchase_orders', 'stock_management', 'maintenance_core', 'preventive_maintenance', 'corrective_maintenance', 'panol', 'costs_core', 'costs_dashboard', 'labor_costs', 'indirect_costs', 'tasks', 'fixed_tasks', 'notifications']::TEXT[],
        '{"maxUsers": 50, "maxStorage": "50GB"}'::JSONB
    ),
    -- Completo
    (
        gen_random_uuid()::text,
        'Enterprise',
        'Acceso completo a todas las funcionalidades. Para grandes empresas.',
        'Building2',
        '#8B5CF6',
        false,
        true,
        ARRAY['sales_core', 'acopios', 'mixed_sales_conditions', 'multi_price_lists', 'seller_commissions', 'client_portal', 'fiscal_invoicing', 'client_ledger', 'client_credit_limits', 'purchases_core', 'purchase_orders', 'supplier_ledger', 'stock_management', 'stock_replenishment', 'cost_centers', 'projects', 'maintenance_core', 'preventive_maintenance', 'corrective_maintenance', 'panol', 'mobile_units', 'downtime_tracking', 'costs_core', 'costs_dashboard', 'labor_costs', 'indirect_costs', 'cargas', 'controls', 'agenda', 'notifications', 'tasks', 'fixed_tasks', 'documents', 'advanced_reports', 'ai_assistant', 'whatsapp_integration']::TEXT[],
        '{"maxUsers": -1, "maxStorage": "unlimited"}'::JSONB
    ),
    -- Servicios
    (
        gen_random_uuid()::text,
        'Servicios',
        'Para empresas de servicios. Incluye tareas, agenda y gestión de clientes.',
        'Briefcase',
        '#EC4899',
        false,
        true,
        ARRAY['sales_core', 'client_ledger', 'tasks', 'fixed_tasks', 'agenda', 'notifications', 'documents', 'whatsapp_integration']::TEXT[],
        '{"maxUsers": 15, "maxStorage": "5GB"}'::JSONB
    ),
    -- Logística
    (
        gen_random_uuid()::text,
        'Logística',
        'Para empresas de transporte y logística. Incluye cargas y unidades móviles.',
        'Truck',
        '#06B6D4',
        false,
        true,
        ARRAY['sales_core', 'purchases_core', 'stock_management', 'cargas', 'mobile_units', 'tasks', 'notifications', 'documents']::TEXT[],
        '{"maxUsers": 30, "maxStorage": "20GB"}'::JSONB
    )
ON CONFLICT ("name") DO UPDATE SET
    "description" = EXCLUDED."description",
    "icon" = EXCLUDED."icon",
    "color" = EXCLUDED."color",
    "moduleKeys" = EXCLUDED."moduleKeys",
    "config" = EXCLUDED."config",
    "updatedAt" = NOW();

-- =============================================
-- FIN - Sistema de Templates Creado
-- =============================================

DO $$ BEGIN
    RAISE NOTICE 'Sistema de Templates - Migración completada exitosamente';
END $$;
