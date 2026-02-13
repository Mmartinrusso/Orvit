-- CreateTable
CREATE TABLE IF NOT EXISTS "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "batchLabel" TEXT NOT NULL DEFAULT 'batea',
    "intermediateLabel" TEXT NOT NULL DEFAULT 'placa',
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InputItem" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "currentPrice" DECIMAL(12,4) NOT NULL,
    "supplier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InputItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InputPriceHistory" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "inputId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InputPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmployeeCompHistory" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "grossSalary" DECIMAL(12,2) NOT NULL,
    "payrollTaxes" DECIMAL(12,2) NOT NULL,
    "changePct" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeCompHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IndirectItem" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndirectItem_pkey" PRIMARY KEY ("id")
);

-- Add companyId to existing tables with default value (assuming company 1 exists)
DO $$
BEGIN
    -- Add companyId to Line table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Line' AND column_name = 'companyId') THEN
        ALTER TABLE "Line" ADD COLUMN "companyId" INTEGER;
        UPDATE "Line" SET "companyId" = 1 WHERE "companyId" IS NULL;
        ALTER TABLE "Line" ALTER COLUMN "companyId" SET NOT NULL;
    END IF;

    -- Add companyId to CostProduct table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CostProduct' AND column_name = 'companyId') THEN
        ALTER TABLE "CostProduct" ADD COLUMN "companyId" INTEGER;
        UPDATE "CostProduct" SET "companyId" = 1 WHERE "companyId" IS NULL;
        ALTER TABLE "CostProduct" ALTER COLUMN "companyId" SET NOT NULL;
    END IF;

    -- Add companyId to CostEmployee table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CostEmployee' AND column_name = 'companyId') THEN
        ALTER TABLE "CostEmployee" ADD COLUMN "companyId" INTEGER;
        UPDATE "CostEmployee" SET "companyId" = 1 WHERE "companyId" IS NULL;
        ALTER TABLE "CostEmployee" ALTER COLUMN "companyId" SET NOT NULL;
    END IF;

    -- Add companyId to MonthlyIndirect table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MonthlyIndirect' AND column_name = 'companyId') THEN
        ALTER TABLE "MonthlyIndirect" ADD COLUMN "companyId" INTEGER;
        UPDATE "MonthlyIndirect" SET "companyId" = 1 WHERE "companyId" IS NULL;
        ALTER TABLE "MonthlyIndirect" ALTER COLUMN "companyId" SET NOT NULL;
    END IF;

    -- Add itemId to MonthlyIndirect table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MonthlyIndirect' AND column_name = 'itemId') THEN
        ALTER TABLE "MonthlyIndirect" ADD COLUMN "itemId" TEXT;
    END IF;

    -- Add companyId to Recipe table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Recipe' AND column_name = 'companyId') THEN
        ALTER TABLE "Recipe" ADD COLUMN "companyId" INTEGER;
        UPDATE "Recipe" SET "companyId" = 1 WHERE "companyId" IS NULL;
        ALTER TABLE "Recipe" ALTER COLUMN "companyId" SET NOT NULL;
    END IF;

    -- Add companyId to MonthlyProduction table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MonthlyProduction' AND column_name = 'companyId') THEN
        ALTER TABLE "MonthlyProduction" ADD COLUMN "companyId" INTEGER;
        UPDATE "MonthlyProduction" SET "companyId" = 1 WHERE "companyId" IS NULL;
        ALTER TABLE "MonthlyProduction" ALTER COLUMN "companyId" SET NOT NULL;
    END IF;

    -- Add companyId to ProductCostHistory table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductCostHistory' AND column_name = 'companyId') THEN
        ALTER TABLE "ProductCostHistory" ADD COLUMN "companyId" INTEGER;
        UPDATE "ProductCostHistory" SET "companyId" = 1 WHERE "companyId" IS NULL;
        ALTER TABLE "ProductCostHistory" ALTER COLUMN "companyId" SET NOT NULL;
    END IF;

    -- Add usesIntermediate to YieldConfig table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'YieldConfig' AND column_name = 'usesIntermediate') THEN
        ALTER TABLE "YieldConfig" ADD COLUMN "usesIntermediate" BOOLEAN DEFAULT false;
        UPDATE "YieldConfig" SET "usesIntermediate" = false WHERE "usesIntermediate" IS NULL;
        ALTER TABLE "YieldConfig" ALTER COLUMN "usesIntermediate" SET NOT NULL;
    END IF;
END $$;

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InputItem_companyId_name_key" ON "InputItem"("companyId", "name");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IndirectItem_companyId_code_key" ON "IndirectItem"("companyId", "code");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Line_companyId_code_key" ON "Line"("companyId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InputPriceHistory_inputId_effectiveFrom_idx" ON "InputPriceHistory"("inputId", "effectiveFrom");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InputPriceHistory_companyId_effectiveFrom_idx" ON "InputPriceHistory"("companyId", "effectiveFrom");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CompanySettings_companyId_fkey') THEN
        ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InputItem_companyId_fkey') THEN
        ALTER TABLE "InputItem" ADD CONSTRAINT "InputItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InputPriceHistory_inputId_fkey') THEN
        ALTER TABLE "InputPriceHistory" ADD CONSTRAINT "InputPriceHistory_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "InputItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'EmployeeCompHistory_employeeId_fkey') THEN
        ALTER TABLE "EmployeeCompHistory" ADD CONSTRAINT "EmployeeCompHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "CostEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'IndirectItem_companyId_fkey') THEN
        ALTER TABLE "IndirectItem" ADD CONSTRAINT "IndirectItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MonthlyIndirect_itemId_fkey') THEN
        ALTER TABLE "MonthlyIndirect" ADD CONSTRAINT "MonthlyIndirect_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "IndirectItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
