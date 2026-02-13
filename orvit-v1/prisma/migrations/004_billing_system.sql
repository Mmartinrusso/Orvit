-- ============================================
-- BILLING SYSTEM - ORVIT
-- Fecha: Enero 2026
-- ============================================

-- ============================================
-- ENUMS para estados (evitar typos)
-- ============================================
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM ('MONTHLY', 'ANNUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE token_transaction_type AS ENUM ('MONTHLY_CREDIT', 'PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT', 'EXPIRATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TRIGGER FUNCTION para updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PLANES DE SUSCRIPCION
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  "displayName" TEXT NOT NULL,
  description TEXT,

  -- Precios con moneda
  currency TEXT DEFAULT 'ARS',
  "monthlyPrice" DECIMAL(12,2) NOT NULL,
  "annualPrice" DECIMAL(12,2),

  -- Limites (NULL = ilimitado)
  "maxCompanies" INTEGER,
  "maxUsersPerCompany" INTEGER,
  "maxStorageGB" INTEGER,
  "includedTokensMonthly" INTEGER DEFAULT 0,

  -- Modulos permitidos (entitlement)
  "moduleKeys" TEXT[] DEFAULT '{}',
  features TEXT[] DEFAULT '{}',

  -- Estado y orden
  "isActive" BOOLEAN DEFAULT true,
  "sortOrder" INTEGER DEFAULT 0,
  color TEXT DEFAULT '#8B5CF6',
  icon TEXT,

  -- Timestamps con timezone
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updatedAt
DROP TRIGGER IF EXISTS subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SUSCRIPCIONES (1 por owner/cuenta)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "planId" TEXT NOT NULL REFERENCES subscription_plans(id),

  -- Estado
  status subscription_status DEFAULT 'ACTIVE',

  -- Fechas (TIMESTAMPTZ!)
  "startDate" TIMESTAMPTZ DEFAULT NOW(),
  "currentPeriodStart" TIMESTAMPTZ NOT NULL,
  "currentPeriodEnd" TIMESTAMPTZ NOT NULL,
  "nextBillingDate" TIMESTAMPTZ NOT NULL,

  -- Cancelacion
  "cancelAtPeriodEnd" BOOLEAN DEFAULT false,
  "canceledAt" TIMESTAMPTZ,

  -- Ciclo
  "billingCycle" billing_cycle DEFAULT 'MONTHLY',

  -- Tokens: 2 bolsillos separados
  "includedTokensRemaining" INTEGER DEFAULT 0,
  "purchasedTokensBalance" INTEGER DEFAULT 0,
  "tokensUsedThisPeriod" INTEGER DEFAULT 0,

  -- Trial
  "trialEndsAt" TIMESTAMPTZ,

  -- Provider (para futuro Stripe/MP)
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,

  -- Timestamps
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE("userId")
);

-- Trigger para updatedAt
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indices
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions("nextBillingDate");
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions("planId");

-- ============================================
-- FACTURAS
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  "subscriptionId" TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

  -- Montos con moneda
  currency TEXT DEFAULT 'ARS',
  subtotal DECIMAL(12,2) NOT NULL,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,

  -- Estado
  status invoice_status DEFAULT 'DRAFT',

  -- Periodo facturado
  "periodStart" TIMESTAMPTZ NOT NULL,
  "periodEnd" TIMESTAMPTZ NOT NULL,
  "dueDate" TIMESTAMPTZ NOT NULL,
  "paidAt" TIMESTAMPTZ,

  -- Snapshot del plan (no muta si cambia el plan)
  "planSnapshot" JSONB NOT NULL,

  -- ViewMode (T1=fiscal, T2=efectivo sin factura)
  "docType" TEXT DEFAULT 'T1',

  notes TEXT,

  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updatedAt
DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indices
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices("dueDate");
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices("createdAt");

-- ============================================
-- ITEMS DE FACTURA
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  type TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,

  metadata JSONB,

  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items("invoiceId");
CREATE INDEX IF NOT EXISTS idx_invoice_items_type ON invoice_items(type);

-- ============================================
-- PAGOS
-- ============================================
CREATE TABLE IF NOT EXISTS billing_payments (
  id TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'ARS',

  -- Metodo
  method TEXT NOT NULL,
  status payment_status DEFAULT 'PENDING',

  -- Provider (Stripe/MP)
  "providerPaymentId" TEXT,
  "providerRef" TEXT,

  -- ViewMode (T1=fiscal, T2=efectivo)
  "docType" TEXT DEFAULT 'T1',

  -- Datos adicionales
  notes TEXT,
  "receivedBy" INTEGER REFERENCES "User"(id),

  "paidAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice ON billing_payments("invoiceId");
CREATE INDEX IF NOT EXISTS idx_billing_payments_status ON billing_payments(status);

-- ============================================
-- TRANSACCIONES DE TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS token_transactions (
  id TEXT PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

  type token_transaction_type NOT NULL,
  amount INTEGER NOT NULL,

  -- Balance despues de la transaccion
  "includedBalanceAfter" INTEGER NOT NULL,
  "purchasedBalanceAfter" INTEGER NOT NULL,

  description TEXT NOT NULL,

  -- Referencia (para idempotencia y trazabilidad)
  "referenceType" TEXT,
  "referenceId" TEXT,
  "idempotencyKey" TEXT,

  -- Precio si fue compra
  "unitPrice" DECIMAL(12,2),
  "totalPrice" DECIMAL(12,2),

  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_tx_subscription ON token_transactions("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_token_tx_created ON token_transactions("createdAt");
CREATE INDEX IF NOT EXISTS idx_token_tx_type ON token_transactions(type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_tx_idempotency ON token_transactions("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;

-- ============================================
-- AUDIT LOG DE BILLING
-- ============================================
CREATE TABLE IF NOT EXISTS billing_audit_log (
  id TEXT PRIMARY KEY,
  "userId" INTEGER REFERENCES "User"(id),
  action TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_entity ON billing_audit_log("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_billing_audit_created ON billing_audit_log("createdAt");

-- ============================================
-- MODIFICAR TABLAS EXISTENTES
-- ============================================
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT REFERENCES subscriptions(id);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "primaryAdminId" INTEGER REFERENCES "User"(id);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS phone TEXT;

-- Indices para Company
CREATE INDEX IF NOT EXISTS idx_company_subscription ON "Company"("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_company_primary_admin ON "Company"("primaryAdminId");

-- ============================================
-- SEED: PLANES POR DEFECTO
-- ============================================
INSERT INTO subscription_plans (id, name, "displayName", description, "monthlyPrice", "maxCompanies", "maxUsersPerCompany", "includedTokensMonthly", features, "moduleKeys", "sortOrder")
VALUES
(
  'plan_basico',
  'BASICO',
  'Basico',
  'Para emprendedores y pequenos negocios',
  9999.00,
  1,
  5,
  100,
  ARRAY['Soporte por email', '1 empresa', '5 usuarios', 'Modulos basicos'],
  ARRAY['general_dashboard', 'general_tasks', 'general_calendar'],
  1
),
(
  'plan_profesional',
  'PROFESIONAL',
  'Profesional',
  'Para PyMEs en crecimiento',
  29999.00,
  3,
  15,
  500,
  ARRAY['Soporte prioritario', 'Hasta 3 empresas', '15 usuarios/empresa', 'Reportes avanzados', 'Integraciones basicas'],
  ARRAY['general_dashboard', 'general_tasks', 'general_calendar', 'sales_core', 'purchases_core', 'treasury_core'],
  2
),
(
  'plan_enterprise',
  'ENTERPRISE',
  'Enterprise',
  'Para grandes empresas',
  99999.00,
  NULL,
  NULL,
  2000,
  ARRAY['Soporte 24/7', 'Empresas ilimitadas', 'Usuarios ilimitados', 'Todos los modulos', 'API access', 'Integraciones avanzadas', 'SLA garantizado'],
  ARRAY[]::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "displayName" = EXCLUDED."displayName",
  description = EXCLUDED.description,
  "monthlyPrice" = EXCLUDED."monthlyPrice",
  "maxCompanies" = EXCLUDED."maxCompanies",
  "maxUsersPerCompany" = EXCLUDED."maxUsersPerCompany",
  "includedTokensMonthly" = EXCLUDED."includedTokensMonthly",
  features = EXCLUDED.features,
  "moduleKeys" = EXCLUDED."moduleKeys",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();

-- ============================================
-- FIN DE MIGRACION
-- ============================================
