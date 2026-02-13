-- Alter columns to have defaults and be NOT NULL
-- This directly modifies the columns to allow Prisma migration to proceed

BEGIN;

-- QUOTES
ALTER TABLE quotes ALTER COLUMN estado SET DEFAULT 'BORRADOR';
UPDATE quotes SET estado = 'BORRADOR' WHERE estado IS NULL;
ALTER TABLE quotes ALTER COLUMN estado SET NOT NULL;

ALTER TABLE quotes ALTER COLUMN "descuentoGlobal" SET DEFAULT 0;
UPDATE quotes SET "descuentoGlobal" = 0 WHERE "descuentoGlobal" IS NULL;
ALTER TABLE quotes ALTER COLUMN "descuentoGlobal" SET NOT NULL;

ALTER TABLE quotes ALTER COLUMN "descuentoMonto" SET DEFAULT 0;
UPDATE quotes SET "descuentoMonto" = 0 WHERE "descuentoMonto" IS NULL;
ALTER TABLE quotes ALTER COLUMN "descuentoMonto" SET NOT NULL;

ALTER TABLE quotes ALTER COLUMN "tasaIva" SET DEFAULT 21;
UPDATE quotes SET "tasaIva" = 21 WHERE "tasaIva" IS NULL;
ALTER TABLE quotes ALTER COLUMN "tasaIva" SET NOT NULL;

ALTER TABLE quotes ALTER COLUMN impuestos SET DEFAULT 0;
UPDATE quotes SET impuestos = 0 WHERE impuestos IS NULL;
ALTER TABLE quotes ALTER COLUMN impuestos SET NOT NULL;

ALTER TABLE quotes ALTER COLUMN moneda SET DEFAULT 'ARS';
UPDATE quotes SET moneda = 'ARS' WHERE moneda IS NULL;
ALTER TABLE quotes ALTER COLUMN moneda SET NOT NULL;

ALTER TABLE quotes ALTER COLUMN "requiereAprobacion" SET DEFAULT false;
UPDATE quotes SET "requiereAprobacion" = false WHERE "requiereAprobacion" IS NULL;
ALTER TABLE quotes ALTER COLUMN "requiereAprobacion" SET NOT NULL;

ALTER TABLE quotes ALTER COLUMN "docType" SET DEFAULT 'T1';
UPDATE quotes SET "docType" = 'T1' WHERE "docType" IS NULL;
ALTER TABLE quotes ALTER COLUMN "docType" SET NOT NULL;

ALTER TABLE quotes ALTER COLUMN "createdAt" SET DEFAULT NOW();
UPDATE quotes SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
ALTER TABLE quotes ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE quotes ALTER COLUMN "updatedAt" SET DEFAULT NOW();
UPDATE quotes SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;
ALTER TABLE quotes ALTER COLUMN "updatedAt" SET NOT NULL;

-- QUOTE_ITEMS
ALTER TABLE quote_items ALTER COLUMN descuento SET DEFAULT 0;
UPDATE quote_items SET descuento = 0 WHERE descuento IS NULL;
ALTER TABLE quote_items ALTER COLUMN descuento SET NOT NULL;

ALTER TABLE quote_items ALTER COLUMN orden SET DEFAULT 0;
UPDATE quote_items SET orden = 0 WHERE orden IS NULL;
ALTER TABLE quote_items ALTER COLUMN orden SET NOT NULL;

-- QUOTE_VERSIONS
ALTER TABLE quote_versions ALTER COLUMN "createdAt" SET DEFAULT NOW();
UPDATE quote_versions SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
ALTER TABLE quote_versions ALTER COLUMN "createdAt" SET NOT NULL;

-- SALES
ALTER TABLE sales ALTER COLUMN estado SET DEFAULT 'BORRADOR';
UPDATE sales SET estado = 'BORRADOR' WHERE estado IS NULL;
ALTER TABLE sales ALTER COLUMN estado SET NOT NULL;

ALTER TABLE sales ALTER COLUMN "descuentoGlobal" SET DEFAULT 0;
UPDATE sales SET "descuentoGlobal" = 0 WHERE "descuentoGlobal" IS NULL;
ALTER TABLE sales ALTER COLUMN "descuentoGlobal" SET NOT NULL;

ALTER TABLE sales ALTER COLUMN "descuentoMonto" SET DEFAULT 0;
UPDATE sales SET "descuentoMonto" = 0 WHERE "descuentoMonto" IS NULL;
ALTER TABLE sales ALTER COLUMN "descuentoMonto" SET NOT NULL;

ALTER TABLE sales ALTER COLUMN "tasaIva" SET DEFAULT 21;
UPDATE sales SET "tasaIva" = 21 WHERE "tasaIva" IS NULL;
ALTER TABLE sales ALTER COLUMN "tasaIva" SET NOT NULL;

ALTER TABLE sales ALTER COLUMN impuestos SET DEFAULT 0;
UPDATE sales SET impuestos = 0 WHERE impuestos IS NULL;
ALTER TABLE sales ALTER COLUMN impuestos SET NOT NULL;

ALTER TABLE sales ALTER COLUMN moneda SET DEFAULT 'ARS';
UPDATE sales SET moneda = 'ARS' WHERE moneda IS NULL;
ALTER TABLE sales ALTER COLUMN moneda SET NOT NULL;

ALTER TABLE sales ALTER COLUMN "requiereAprobacion" SET DEFAULT false;
UPDATE sales SET "requiereAprobacion" = false WHERE "requiereAprobacion" IS NULL;
ALTER TABLE sales ALTER COLUMN "requiereAprobacion" SET NOT NULL;

ALTER TABLE sales ALTER COLUMN "comisionPagada" SET DEFAULT false;
UPDATE sales SET "comisionPagada" = false WHERE "comisionPagada" IS NULL;
ALTER TABLE sales ALTER COLUMN "comisionPagada" SET NOT NULL;

ALTER TABLE sales ALTER COLUMN "docType" SET DEFAULT 'T1';
UPDATE sales SET "docType" = 'T1' WHERE "docType" IS NULL;
ALTER TABLE sales ALTER COLUMN "docType" SET NOT NULL;

ALTER TABLE sales ALTER COLUMN "createdAt" SET DEFAULT NOW();
UPDATE sales SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
ALTER TABLE sales ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE sales ALTER COLUMN "updatedAt" SET DEFAULT NOW();
UPDATE sales SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;
ALTER TABLE sales ALTER COLUMN "updatedAt" SET NOT NULL;

-- SALE_ITEMS
ALTER TABLE sale_items ALTER COLUMN "cantidadEntregada" SET DEFAULT 0;
UPDATE sale_items SET "cantidadEntregada" = 0 WHERE "cantidadEntregada" IS NULL;
ALTER TABLE sale_items ALTER COLUMN "cantidadEntregada" SET NOT NULL;

ALTER TABLE sale_items ALTER COLUMN descuento SET DEFAULT 0;
UPDATE sale_items SET descuento = 0 WHERE descuento IS NULL;
ALTER TABLE sale_items ALTER COLUMN descuento SET NOT NULL;

ALTER TABLE sale_items ALTER COLUMN orden SET DEFAULT 0;
UPDATE sale_items SET orden = 0 WHERE orden IS NULL;
ALTER TABLE sale_items ALTER COLUMN orden SET NOT NULL;

-- PURCHASE_ORDERS
ALTER TABLE purchase_orders ALTER COLUMN "docType" SET DEFAULT 'T1';
UPDATE purchase_orders SET "docType" = 'T1' WHERE "docType" IS NULL;
ALTER TABLE purchase_orders ALTER COLUMN "docType" SET NOT NULL;

-- SALARY_COMPONENTS
ALTER TABLE salary_components ALTER COLUMN concept_type SET DEFAULT 'EARNING';
UPDATE salary_components SET concept_type = 'EARNING' WHERE concept_type IS NULL;
ALTER TABLE salary_components ALTER COLUMN concept_type SET NOT NULL;

ALTER TABLE salary_components ALTER COLUMN is_remunerative SET DEFAULT true;
UPDATE salary_components SET is_remunerative = true WHERE is_remunerative IS NULL;
ALTER TABLE salary_components ALTER COLUMN is_remunerative SET NOT NULL;

ALTER TABLE salary_components ALTER COLUMN affects_employee_contrib SET DEFAULT false;
UPDATE salary_components SET affects_employee_contrib = false WHERE affects_employee_contrib IS NULL;
ALTER TABLE salary_components ALTER COLUMN affects_employee_contrib SET NOT NULL;

ALTER TABLE salary_components ALTER COLUMN affects_employer_contrib SET DEFAULT false;
UPDATE salary_components SET affects_employer_contrib = false WHERE affects_employer_contrib IS NULL;
ALTER TABLE salary_components ALTER COLUMN affects_employer_contrib SET NOT NULL;

ALTER TABLE salary_components ALTER COLUMN affects_income_tax SET DEFAULT false;
UPDATE salary_components SET affects_income_tax = false WHERE affects_income_tax IS NULL;
ALTER TABLE salary_components ALTER COLUMN affects_income_tax SET NOT NULL;

-- SALE_ACOPIOS
ALTER TABLE sale_acopios ALTER COLUMN "docType" SET DEFAULT 'T1';
UPDATE sale_acopios SET "docType" = 'T1' WHERE "docType" IS NULL;
ALTER TABLE sale_acopios ALTER COLUMN "docType" SET NOT NULL;

-- STOCK_MOVEMENTS
ALTER TABLE stock_movements ALTER COLUMN "docType" SET DEFAULT 'T1';
UPDATE stock_movements SET "docType" = 'T1' WHERE "docType" IS NULL;
ALTER TABLE stock_movements ALTER COLUMN "docType" SET NOT NULL;

-- STOCK_ADJUSTMENTS
ALTER TABLE stock_adjustments ALTER COLUMN "updatedAt" SET DEFAULT NOW();
UPDATE stock_adjustments SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;
ALTER TABLE stock_adjustments ALTER COLUMN "updatedAt" SET NOT NULL;

-- TREASURY_TRANSFERS
ALTER TABLE treasury_transfers ALTER COLUMN "docType" SET DEFAULT 'T1';
UPDATE treasury_transfers SET "docType" = 'T1' WHERE "docType" IS NULL;
ALTER TABLE treasury_transfers ALTER COLUMN "docType" SET NOT NULL;

-- WAREHOUSES
ALTER TABLE warehouses ALTER COLUMN "isTransit" SET DEFAULT false;
UPDATE warehouses SET "isTransit" = false WHERE "isTransit" IS NULL;
ALTER TABLE warehouses ALTER COLUMN "isTransit" SET NOT NULL;

-- WORK_ORDERS
ALTER TABLE work_orders ALTER COLUMN "requiresPTW" SET DEFAULT false;
UPDATE work_orders SET "requiresPTW" = false WHERE "requiresPTW" IS NULL;
ALTER TABLE work_orders ALTER COLUMN "requiresPTW" SET NOT NULL;

ALTER TABLE work_orders ALTER COLUMN "requiresLOTO" SET DEFAULT false;
UPDATE work_orders SET "requiresLOTO" = false WHERE "requiresLOTO" IS NULL;
ALTER TABLE work_orders ALTER COLUMN "requiresLOTO" SET NOT NULL;

ALTER TABLE work_orders ALTER COLUMN "ptwBlocked" SET DEFAULT false;
UPDATE work_orders SET "ptwBlocked" = false WHERE "ptwBlocked" IS NULL;
ALTER TABLE work_orders ALTER COLUMN "ptwBlocked" SET NOT NULL;

ALTER TABLE work_orders ALTER COLUMN "lotoBlocked" SET DEFAULT false;
UPDATE work_orders SET "lotoBlocked" = false WHERE "lotoBlocked" IS NULL;
ALTER TABLE work_orders ALTER COLUMN "lotoBlocked" SET NOT NULL;

-- WORK_LOGS
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
ALTER TABLE work_logs ALTER COLUMN "updatedAt" SET DEFAULT NOW();
UPDATE work_logs SET "updatedAt" = COALESCE("createdAt", NOW()) WHERE "updatedAt" IS NULL;
ALTER TABLE work_logs ALTER COLUMN "updatedAt" SET NOT NULL;

-- WORK_ORDER_CHECKLISTS
ALTER TABLE work_order_checklists ADD COLUMN IF NOT EXISTS responses JSONB;
ALTER TABLE work_order_checklists ALTER COLUMN responses SET DEFAULT '{}'::jsonb;
UPDATE work_order_checklists SET responses = '{}'::jsonb WHERE responses IS NULL;
ALTER TABLE work_order_checklists ALTER COLUMN responses SET NOT NULL;

-- For templateId, we need to handle missing references
UPDATE work_order_checklists
SET "templateId" = (SELECT id FROM maintenance_checklists LIMIT 1)
WHERE "templateId" IS NULL
  AND EXISTS (SELECT 1 FROM maintenance_checklists);

DELETE FROM work_order_checklists
WHERE "templateId" IS NULL;

-- WORK_CENTERS
ALTER TABLE work_centers ALTER COLUMN status SET DEFAULT 'active';
UPDATE work_centers SET status = 'active' WHERE status IS NULL;
ALTER TABLE work_centers ALTER COLUMN status SET NOT NULL;

ALTER TABLE work_centers ALTER COLUMN "createdAt" SET DEFAULT NOW();
UPDATE work_centers SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
ALTER TABLE work_centers ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE work_centers ALTER COLUMN "updatedAt" SET DEFAULT NOW();
UPDATE work_centers SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;
ALTER TABLE work_centers ALTER COLUMN "updatedAt" SET NOT NULL;

-- WORK_POSITIONS
ALTER TABLE work_positions ALTER COLUMN is_active SET DEFAULT true;
UPDATE work_positions SET is_active = true WHERE is_active IS NULL;
ALTER TABLE work_positions ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE work_positions ALTER COLUMN created_at SET DEFAULT NOW();
UPDATE work_positions SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE work_positions ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE work_positions ALTER COLUMN updated_at SET DEFAULT NOW();
UPDATE work_positions SET updated_at = NOW() WHERE updated_at IS NULL;
ALTER TABLE work_positions ALTER COLUMN updated_at SET NOT NULL;

-- WORK_SECTORS
ALTER TABLE work_sectors ALTER COLUMN is_active SET DEFAULT true;
UPDATE work_sectors SET is_active = true WHERE is_active IS NULL;
ALTER TABLE work_sectors ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE work_sectors ALTER COLUMN created_at SET DEFAULT NOW();
UPDATE work_sectors SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE work_sectors ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE work_sectors ALTER COLUMN updated_at SET DEFAULT NOW();
UPDATE work_sectors SET updated_at = NOW() WHERE updated_at IS NULL;
ALTER TABLE work_sectors ALTER COLUMN updated_at SET NOT NULL;

-- WORK_SHIFTS
ALTER TABLE work_shifts ALTER COLUMN type SET DEFAULT 'FIXED';
UPDATE work_shifts SET type = 'FIXED' WHERE type IS NULL;
ALTER TABLE work_shifts ALTER COLUMN type SET NOT NULL;

ALTER TABLE work_shifts ALTER COLUMN "breakMinutes" SET DEFAULT 0;
UPDATE work_shifts SET "breakMinutes" = 0 WHERE "breakMinutes" IS NULL;
ALTER TABLE work_shifts ALTER COLUMN "breakMinutes" SET NOT NULL;

ALTER TABLE work_shifts ALTER COLUMN "isActive" SET DEFAULT true;
UPDATE work_shifts SET "isActive" = true WHERE "isActive" IS NULL;
ALTER TABLE work_shifts ALTER COLUMN "isActive" SET NOT NULL;

ALTER TABLE work_shifts ALTER COLUMN "createdAt" SET DEFAULT NOW();
UPDATE work_shifts SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
ALTER TABLE work_shifts ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE work_shifts ALTER COLUMN "updatedAt" SET DEFAULT NOW();
UPDATE work_shifts SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;
ALTER TABLE work_shifts ALTER COLUMN "updatedAt" SET NOT NULL;

-- UNION_CATEGORIES
ALTER TABLE union_categories ALTER COLUMN level SET DEFAULT 0;
UPDATE union_categories SET level = 0 WHERE level IS NULL;
ALTER TABLE union_categories ALTER COLUMN level SET NOT NULL;

ALTER TABLE union_categories ALTER COLUMN is_active SET DEFAULT true;
UPDATE union_categories SET is_active = true WHERE is_active IS NULL;
ALTER TABLE union_categories ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE union_categories ALTER COLUMN created_at SET DEFAULT NOW();
UPDATE union_categories SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE union_categories ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE union_categories ALTER COLUMN updated_at SET DEFAULT NOW();
UPDATE union_categories SET updated_at = NOW() WHERE updated_at IS NULL;
ALTER TABLE union_categories ALTER COLUMN updated_at SET NOT NULL;

-- SUBSCRIPTIONS
ALTER TABLE subscriptions ALTER COLUMN status SET DEFAULT 'ACTIVE';
UPDATE subscriptions SET status = 'ACTIVE' WHERE status IS NULL;
ALTER TABLE subscriptions ALTER COLUMN status SET NOT NULL;

ALTER TABLE subscriptions ALTER COLUMN "startDate" SET DEFAULT NOW();
UPDATE subscriptions SET "startDate" = NOW() WHERE "startDate" IS NULL;
ALTER TABLE subscriptions ALTER COLUMN "startDate" SET NOT NULL;

ALTER TABLE subscriptions ALTER COLUMN "cancelAtPeriodEnd" SET DEFAULT false;
UPDATE subscriptions SET "cancelAtPeriodEnd" = false WHERE "cancelAtPeriodEnd" IS NULL;
ALTER TABLE subscriptions ALTER COLUMN "cancelAtPeriodEnd" SET NOT NULL;

ALTER TABLE subscriptions ALTER COLUMN "billingCycle" SET DEFAULT 'MONTHLY';
UPDATE subscriptions SET "billingCycle" = 'MONTHLY' WHERE "billingCycle" IS NULL;
ALTER TABLE subscriptions ALTER COLUMN "billingCycle" SET NOT NULL;

ALTER TABLE subscriptions ALTER COLUMN "includedTokensRemaining" SET DEFAULT 0;
UPDATE subscriptions SET "includedTokensRemaining" = 0 WHERE "includedTokensRemaining" IS NULL;
ALTER TABLE subscriptions ALTER COLUMN "includedTokensRemaining" SET NOT NULL;

ALTER TABLE subscriptions ALTER COLUMN "purchasedTokensBalance" SET DEFAULT 0;
UPDATE subscriptions SET "purchasedTokensBalance" = 0 WHERE "purchasedTokensBalance" IS NULL;
ALTER TABLE subscriptions ALTER COLUMN "purchasedTokensBalance" SET NOT NULL;

ALTER TABLE subscriptions ALTER COLUMN "tokensUsedThisPeriod" SET DEFAULT 0;
UPDATE subscriptions SET "tokensUsedThisPeriod" = 0 WHERE "tokensUsedThisPeriod" IS NULL;
ALTER TABLE subscriptions ALTER COLUMN "tokensUsedThisPeriod" SET NOT NULL;

ALTER TABLE subscriptions ALTER COLUMN "createdAt" SET DEFAULT NOW();
UPDATE subscriptions SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
ALTER TABLE subscriptions ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE subscriptions ALTER COLUMN "updatedAt" SET DEFAULT NOW();
UPDATE subscriptions SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;
ALTER TABLE subscriptions ALTER COLUMN "updatedAt" SET NOT NULL;

-- SUBSCRIPTION_PLANS
ALTER TABLE subscription_plans ALTER COLUMN currency SET DEFAULT 'ARS';
UPDATE subscription_plans SET currency = 'ARS' WHERE currency IS NULL;
ALTER TABLE subscription_plans ALTER COLUMN currency SET NOT NULL;

ALTER TABLE subscription_plans ALTER COLUMN "includedTokensMonthly" SET DEFAULT 0;
UPDATE subscription_plans SET "includedTokensMonthly" = 0 WHERE "includedTokensMonthly" IS NULL;
ALTER TABLE subscription_plans ALTER COLUMN "includedTokensMonthly" SET NOT NULL;

ALTER TABLE subscription_plans ALTER COLUMN "isActive" SET DEFAULT true;
UPDATE subscription_plans SET "isActive" = true WHERE "isActive" IS NULL;
ALTER TABLE subscription_plans ALTER COLUMN "isActive" SET NOT NULL;

ALTER TABLE subscription_plans ALTER COLUMN "sortOrder" SET DEFAULT 0;
UPDATE subscription_plans SET "sortOrder" = 0 WHERE "sortOrder" IS NULL;
ALTER TABLE subscription_plans ALTER COLUMN "sortOrder" SET NOT NULL;

ALTER TABLE subscription_plans ALTER COLUMN color SET DEFAULT '#3B82F6';
UPDATE subscription_plans SET color = '#3B82F6' WHERE color IS NULL;
ALTER TABLE subscription_plans ALTER COLUMN color SET NOT NULL;

ALTER TABLE subscription_plans ALTER COLUMN "createdAt" SET DEFAULT NOW();
UPDATE subscription_plans SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
ALTER TABLE subscription_plans ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE subscription_plans ALTER COLUMN "updatedAt" SET DEFAULT NOW();
UPDATE subscription_plans SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;
ALTER TABLE subscription_plans ALTER COLUMN "updatedAt" SET NOT NULL;

-- TOKEN_TRANSACTIONS
ALTER TABLE token_transactions ALTER COLUMN "createdAt" SET DEFAULT NOW();
UPDATE token_transactions SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
ALTER TABLE token_transactions ALTER COLUMN "createdAt" SET NOT NULL;

-- SALES_CONFIG (key fields)
ALTER TABLE sales_config ALTER COLUMN "quotePrefix" SET DEFAULT 'COT';
UPDATE sales_config SET "quotePrefix" = 'COT' WHERE "quotePrefix" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "quotePrefix" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "quoteNextNumber" SET DEFAULT 1;
UPDATE sales_config SET "quoteNextNumber" = 1 WHERE "quoteNextNumber" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "quoteNextNumber" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "salePrefix" SET DEFAULT 'VTA';
UPDATE sales_config SET "salePrefix" = 'VTA' WHERE "salePrefix" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "salePrefix" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "saleNextNumber" SET DEFAULT 1;
UPDATE sales_config SET "saleNextNumber" = 1 WHERE "saleNextNumber" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "saleNextNumber" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "createdAt" SET DEFAULT NOW();
UPDATE sales_config SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "updatedAt" SET DEFAULT NOW();
UPDATE sales_config SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "updatedAt" SET NOT NULL;

COMMIT;
