-- Sistema de Costos de Mantenimiento
-- Tablas: maintenance_cost_breakdowns, technician_cost_rates, third_party_costs, maintenance_budgets
-- Idempotente: usa IF NOT EXISTS y DO $$ BEGIN...EXCEPTION

-- 1. maintenance_cost_breakdowns
CREATE TABLE IF NOT EXISTS "maintenance_cost_breakdowns" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "laborCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sparePartsCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "thirdPartyCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "extrasCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "maintenance_cost_breakdowns_pkey" PRIMARY KEY ("id")
);

-- 2. technician_cost_rates
CREATE TABLE IF NOT EXISTS "technician_cost_rates" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "overtimeRate" DECIMAL(10,2),
    "role" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "technician_cost_rates_pkey" PRIMARY KEY ("id")
);

-- 3. third_party_costs
CREATE TABLE IF NOT EXISTS "third_party_costs" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierRUT" TEXT,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "costType" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    CONSTRAINT "third_party_costs_pkey" PRIMARY KEY ("id")
);

-- 4. maintenance_budgets
CREATE TABLE IF NOT EXISTS "maintenance_budgets" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "sectorId" INTEGER,
    "totalBudget" DECIMAL(14,2) NOT NULL,
    "laborBudget" DECIMAL(14,2),
    "partsBudget" DECIMAL(14,2),
    "thirdPartyBudget" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    CONSTRAINT "maintenance_budgets_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_cost_breakdowns_workOrderId_key" ON "maintenance_cost_breakdowns"("workOrderId");
CREATE INDEX IF NOT EXISTS "maintenance_cost_breakdowns_companyId_idx" ON "maintenance_cost_breakdowns"("companyId");
CREATE INDEX IF NOT EXISTS "maintenance_cost_breakdowns_calculatedAt_idx" ON "maintenance_cost_breakdowns"("calculatedAt");

CREATE INDEX IF NOT EXISTS "technician_cost_rates_companyId_isActive_idx" ON "technician_cost_rates"("companyId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "technician_cost_rates_userId_companyId_effectiveFrom_key" ON "technician_cost_rates"("userId", "companyId", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "third_party_costs_workOrderId_idx" ON "third_party_costs"("workOrderId");
CREATE INDEX IF NOT EXISTS "third_party_costs_companyId_idx" ON "third_party_costs"("companyId");

CREATE INDEX IF NOT EXISTS "maintenance_budgets_companyId_year_idx" ON "maintenance_budgets"("companyId", "year");
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_budgets_companyId_year_month_sectorId_key" ON "maintenance_budgets"("companyId", "year", "month", "sectorId");

-- Foreign Keys (idempotente)
DO $$ BEGIN
  ALTER TABLE "maintenance_cost_breakdowns" ADD CONSTRAINT "maintenance_cost_breakdowns_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "maintenance_cost_breakdowns" ADD CONSTRAINT "maintenance_cost_breakdowns_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "technician_cost_rates" ADD CONSTRAINT "technician_cost_rates_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "technician_cost_rates" ADD CONSTRAINT "technician_cost_rates_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "third_party_costs" ADD CONSTRAINT "third_party_costs_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "third_party_costs" ADD CONSTRAINT "third_party_costs_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "third_party_costs" ADD CONSTRAINT "third_party_costs_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "maintenance_budgets" ADD CONSTRAINT "maintenance_budgets_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "maintenance_budgets" ADD CONSTRAINT "maintenance_budgets_sectorId_fkey"
    FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "maintenance_budgets" ADD CONSTRAINT "maintenance_budgets_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
