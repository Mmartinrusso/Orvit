-- Add production features safely (without data loss)

-- 1. Add productionWorkCenterId to Product table
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productionWorkCenterId" INTEGER;

-- Add foreign key constraint (if table work_centers exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_centers') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'Product_productionWorkCenterId_fkey'
        ) THEN
            ALTER TABLE "Product"
            ADD CONSTRAINT "Product_productionWorkCenterId_fkey"
            FOREIGN KEY ("productionWorkCenterId")
            REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

-- 2. Create ProductionProfile table
CREATE TABLE IF NOT EXISTS "production_profiles" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL UNIQUE,
    "primaryUnitOfWork" TEXT NOT NULL DEFAULT 'TURNO',
    "defaultUom" JSONB NOT NULL DEFAULT '{"length":"m","weight":"kg","volume":"m3","quantity":"u","time":"min"}',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Add uomCode and attributesSchema to production_resource_types
ALTER TABLE "production_resource_types" ADD COLUMN IF NOT EXISTS "uomCode" TEXT;
ALTER TABLE "production_resource_types" ADD COLUMN IF NOT EXISTS "attributesSchema" JSONB;

-- 4. Create DailyProductionEntry table
CREATE TABLE IF NOT EXISTS "daily_production_entries" (
    "id" SERIAL PRIMARY KEY,
    "date" DATE NOT NULL,
    "shiftId" INTEGER,
    "workCenterId" INTEGER,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "scrapQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL,
    "batchNumber" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "registeredById" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign keys for daily_production_entries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'daily_production_entries_shiftId_fkey'
    ) THEN
        ALTER TABLE "daily_production_entries"
        ADD CONSTRAINT "daily_production_entries_shiftId_fkey"
        FOREIGN KEY ("shiftId")
        REFERENCES "work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'daily_production_entries_workCenterId_fkey'
    ) THEN
        ALTER TABLE "daily_production_entries"
        ADD CONSTRAINT "daily_production_entries_workCenterId_fkey"
        FOREIGN KEY ("workCenterId")
        REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'daily_production_entries_productId_fkey'
    ) THEN
        ALTER TABLE "daily_production_entries"
        ADD CONSTRAINT "daily_production_entries_productId_fkey"
        FOREIGN KEY ("productId")
        REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'daily_production_entries_registeredById_fkey'
    ) THEN
        ALTER TABLE "daily_production_entries"
        ADD CONSTRAINT "daily_production_entries_registeredById_fkey"
        FOREIGN KEY ("registeredById")
        REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'daily_production_entries_companyId_fkey'
    ) THEN
        ALTER TABLE "daily_production_entries"
        ADD CONSTRAINT "daily_production_entries_companyId_fkey"
        FOREIGN KEY ("companyId")
        REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create indexes for daily_production_entries
CREATE INDEX IF NOT EXISTS "daily_production_entries_companyId_date_idx" ON "daily_production_entries"("companyId", "date");
CREATE INDEX IF NOT EXISTS "daily_production_entries_companyId_productId_idx" ON "daily_production_entries"("companyId", "productId");
CREATE INDEX IF NOT EXISTS "daily_production_entries_companyId_workCenterId_date_idx" ON "daily_production_entries"("companyId", "workCenterId", "date");

-- Done!
SELECT 'Migration completed successfully' as status;
