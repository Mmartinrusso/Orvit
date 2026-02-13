-- ============================================
-- MIGRACIÓN BILLING SYSTEM - SAFE (NO DATA LOSS)
-- Todas las operaciones son idempotentes
-- ============================================

-- ============================================
-- ENUMS (solo crear si no existen)
-- ============================================

-- SubscriptionStatus
DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- BillingInvoiceStatus
DO $$ BEGIN
    CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- BillingCycle
DO $$ BEGIN
    CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- TokenTransactionType
DO $$ BEGIN
    CREATE TYPE "TokenTransactionType" AS ENUM ('MONTHLY_CREDIT', 'PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT', 'EXPIRATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- BillingPaymentStatus
DO $$ BEGIN
    CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- DiscountType
DO $$ BEGIN
    CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- DocType (puede que ya exista del sistema de ventas)
DO $$ BEGIN
    CREATE TYPE "DocType" AS ENUM ('T1', 'T2', 'T3');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLAS DE BILLING
-- ============================================

-- Planes de Suscripción
CREATE TABLE IF NOT EXISTS "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "monthlyPrice" DECIMAL(12,2) NOT NULL,
    "annualPrice" DECIMAL(12,2),
    "maxCompanies" INTEGER,
    "maxUsersPerCompany" INTEGER,
    "maxStorageGB" INTEGER,
    "includedTokensMonthly" INTEGER NOT NULL DEFAULT 0,
    "moduleKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#8B5CF6',
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- Índice único para name si no existe
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_name_key" ON "subscription_plans"("name");

-- Suscripciones
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "nextBillingDate" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "includedTokensRemaining" INTEGER NOT NULL DEFAULT 0,
    "purchasedTokensBalance" INTEGER NOT NULL DEFAULT 0,
    "tokensUsedThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "trialEndsAt" TIMESTAMP(3),
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- Índices para subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_nextBillingDate_idx" ON "subscriptions"("nextBillingDate");
CREATE INDEX IF NOT EXISTS "subscriptions_planId_idx" ON "subscriptions"("planId");

-- Facturas
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "planSnapshot" JSONB NOT NULL,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "discountAmount" DECIMAL(12,2) DEFAULT 0,
    "couponId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- Índices para invoices
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_number_key" ON "invoices"("number");
CREATE INDEX IF NOT EXISTS "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "invoices_dueDate_idx" ON "invoices"("dueDate");
CREATE INDEX IF NOT EXISTS "invoices_createdAt_idx" ON "invoices"("createdAt");

-- Items de Factura
CREATE TABLE IF NOT EXISTS "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- Índices para invoice_items
CREATE INDEX IF NOT EXISTS "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
CREATE INDEX IF NOT EXISTS "invoice_items_type_idx" ON "invoice_items"("type");

-- Pagos
CREATE TABLE IF NOT EXISTS "billing_payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "method" TEXT NOT NULL,
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerPaymentId" TEXT,
    "providerRef" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "notes" TEXT,
    "receivedBy" INTEGER,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- Índices para billing_payments
CREATE INDEX IF NOT EXISTS "billing_payments_invoiceId_idx" ON "billing_payments"("invoiceId");
CREATE INDEX IF NOT EXISTS "billing_payments_status_idx" ON "billing_payments"("status");

-- Transacciones de Tokens
CREATE TABLE IF NOT EXISTS "token_transactions" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "type" "TokenTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "includedBalanceAfter" INTEGER NOT NULL,
    "purchasedBalanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "unitPrice" DECIMAL(12,2),
    "totalPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_transactions_pkey" PRIMARY KEY ("id")
);

-- Índices para token_transactions
CREATE UNIQUE INDEX IF NOT EXISTS "token_transactions_idempotencyKey_key" ON "token_transactions"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "token_transactions_subscriptionId_idx" ON "token_transactions"("subscriptionId");
CREATE INDEX IF NOT EXISTS "token_transactions_createdAt_idx" ON "token_transactions"("createdAt");
CREATE INDEX IF NOT EXISTS "token_transactions_type_idx" ON "token_transactions"("type");

-- Audit Log de Billing
CREATE TABLE IF NOT EXISTS "billing_audit_log" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_audit_log_pkey" PRIMARY KEY ("id")
);

-- Índices para billing_audit_log
CREATE INDEX IF NOT EXISTS "billing_audit_log_entityType_entityId_idx" ON "billing_audit_log"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "billing_audit_log_createdAt_idx" ON "billing_audit_log"("createdAt");

-- Cupones de Descuento
CREATE TABLE IF NOT EXISTS "billing_coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "maxUses" INTEGER,
    "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "appliesToPlans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appliesToCycles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minAmount" DECIMAL(12,2),
    "firstPaymentOnly" BOOLEAN NOT NULL DEFAULT false,
    "durationMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_coupons_pkey" PRIMARY KEY ("id")
);

-- Índices para billing_coupons
CREATE UNIQUE INDEX IF NOT EXISTS "billing_coupons_code_key" ON "billing_coupons"("code");
CREATE INDEX IF NOT EXISTS "billing_coupons_code_idx" ON "billing_coupons"("code");
CREATE INDEX IF NOT EXISTS "billing_coupons_isActive_idx" ON "billing_coupons"("isActive");
CREATE INDEX IF NOT EXISTS "billing_coupons_validFrom_validUntil_idx" ON "billing_coupons"("validFrom", "validUntil");

-- Uso de Cupones (Redemptions)
CREATE TABLE IF NOT EXISTS "billing_coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "appliedCount" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- Índices para billing_coupon_redemptions
CREATE UNIQUE INDEX IF NOT EXISTS "billing_coupon_redemptions_couponId_subscriptionId_key" ON "billing_coupon_redemptions"("couponId", "subscriptionId");
CREATE INDEX IF NOT EXISTS "billing_coupon_redemptions_subscriptionId_idx" ON "billing_coupon_redemptions"("subscriptionId");
CREATE INDEX IF NOT EXISTS "billing_coupon_redemptions_couponId_idx" ON "billing_coupon_redemptions"("couponId");

-- Configuración de Débito Automático
CREATE TABLE IF NOT EXISTS "billing_auto_payment_configs" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCustomerId" TEXT,
    "providerPaymentMethodId" TEXT,
    "providerSubscriptionId" TEXT,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailureReason" TEXT,
    "lastPaymentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_auto_payment_configs_pkey" PRIMARY KEY ("id")
);

-- Índices para billing_auto_payment_configs
CREATE UNIQUE INDEX IF NOT EXISTS "billing_auto_payment_configs_subscriptionId_key" ON "billing_auto_payment_configs"("subscriptionId");
CREATE INDEX IF NOT EXISTS "billing_auto_payment_configs_subscriptionId_idx" ON "billing_auto_payment_configs"("subscriptionId");
CREATE INDEX IF NOT EXISTS "billing_auto_payment_configs_provider_idx" ON "billing_auto_payment_configs"("provider");

-- ============================================
-- FOREIGN KEYS (solo agregar si no existen)
-- ============================================

-- subscriptions -> User
DO $$ BEGIN
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- subscriptions -> subscription_plans
DO $$ BEGIN
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- invoices -> subscriptions
DO $$ BEGIN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- invoices -> billing_coupons
DO $$ BEGIN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "billing_coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- invoice_items -> invoices
DO $$ BEGIN
    ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- billing_payments -> invoices
DO $$ BEGIN
    ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- billing_payments -> User
DO $$ BEGIN
    ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_receivedBy_fkey"
    FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- token_transactions -> subscriptions
DO $$ BEGIN
    ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- billing_audit_log -> User
DO $$ BEGIN
    ALTER TABLE "billing_audit_log" ADD CONSTRAINT "billing_audit_log_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- billing_coupons -> User
DO $$ BEGIN
    ALTER TABLE "billing_coupons" ADD CONSTRAINT "billing_coupons_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- billing_coupon_redemptions -> billing_coupons
DO $$ BEGIN
    ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "billing_coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- billing_coupon_redemptions -> subscriptions
DO $$ BEGIN
    ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- billing_coupon_redemptions -> invoices
DO $$ BEGIN
    ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- billing_auto_payment_configs -> subscriptions
DO $$ BEGIN
    ALTER TABLE "billing_auto_payment_configs" ADD CONSTRAINT "billing_auto_payment_configs_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- COLUMNAS EN TABLAS EXISTENTES (si no existen)
-- ============================================

-- Company.subscriptionId
DO $$ BEGIN
    ALTER TABLE "Company" ADD COLUMN "subscriptionId" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Company -> subscriptions FK
DO $$ BEGIN
    ALTER TABLE "Company" ADD CONSTRAINT "Company_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Índice para Company.subscriptionId
CREATE INDEX IF NOT EXISTS "Company_subscriptionId_idx" ON "Company"("subscriptionId");

-- User.phone
DO $$ BEGIN
    ALTER TABLE "User" ADD COLUMN "phone" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- ============================================
-- SEED: PLANES POR DEFECTO (solo si no existen)
-- ============================================

INSERT INTO "subscription_plans" ("id", "name", "displayName", "description", "monthlyPrice", "maxCompanies", "maxUsersPerCompany", "includedTokensMonthly", "features", "moduleKeys", "sortOrder", "updatedAt")
SELECT 'plan_basico', 'BASICO', 'Básico', 'Para emprendedores y pequeños negocios', 9999.00, 1, 5, 100,
    ARRAY['Soporte por email', '1 empresa', '5 usuarios', 'Módulos básicos'],
    ARRAY['general_dashboard', 'general_tasks', 'general_calendar'], 1, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "subscription_plans" WHERE "id" = 'plan_basico');

INSERT INTO "subscription_plans" ("id", "name", "displayName", "description", "monthlyPrice", "maxCompanies", "maxUsersPerCompany", "includedTokensMonthly", "features", "moduleKeys", "sortOrder", "updatedAt")
SELECT 'plan_profesional', 'PROFESIONAL', 'Profesional', 'Para PyMEs en crecimiento', 29999.00, 3, 15, 500,
    ARRAY['Soporte prioritario', 'Hasta 3 empresas', '15 usuarios/empresa', 'Reportes avanzados', 'Integraciones básicas'],
    ARRAY['general_dashboard', 'general_tasks', 'general_calendar', 'sales_core', 'purchases_core', 'treasury_core'], 2, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "subscription_plans" WHERE "id" = 'plan_profesional');

INSERT INTO "subscription_plans" ("id", "name", "displayName", "description", "monthlyPrice", "maxCompanies", "maxUsersPerCompany", "includedTokensMonthly", "features", "moduleKeys", "sortOrder", "updatedAt")
SELECT 'plan_enterprise', 'ENTERPRISE', 'Enterprise', 'Para grandes empresas', 99999.00, NULL, NULL, 2000,
    ARRAY['Soporte 24/7', 'Empresas ilimitadas', 'Usuarios ilimitados', 'Todos los módulos', 'API access', 'Integraciones avanzadas', 'SLA garantizado'],
    ARRAY[]::TEXT[], 3, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "subscription_plans" WHERE "id" = 'plan_enterprise');
