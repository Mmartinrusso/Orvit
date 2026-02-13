-- AlterTable: Add new columns to purchase_quotations
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(15, 4);
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "pricesIncludeVat" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5, 2) NOT NULL DEFAULT 21;
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "shippingCost" DECIMAL(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "otherCosts" DECIMAL(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "otherCostsDesc" VARCHAR(200);
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "notSelectedReason" VARCHAR(100);
ALTER TABLE "purchase_quotations" ADD COLUMN IF NOT EXISTS "isExpired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add new columns to purchase_quotation_items
ALTER TABLE "purchase_quotation_items" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "purchase_quotation_items" ADD COLUMN IF NOT EXISTS "normalizedKey" VARCHAR(200);
ALTER TABLE "purchase_quotation_items" ADD COLUMN IF NOT EXISTS "supplierSku" VARCHAR(100);
ALTER TABLE "purchase_quotation_items" ADD COLUMN IF NOT EXISTS "isSubstitute" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "purchase_quotation_items" ADD COLUMN IF NOT EXISTS "substituteFor" INTEGER;

-- CreateTable: quotation_status_history
CREATE TABLE IF NOT EXISTS "quotation_status_history" (
    "id" SERIAL NOT NULL,
    "quotationId" INTEGER NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "systemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "quotation_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: company_quotation_settings
CREATE TABLE IF NOT EXISTS "company_quotation_settings" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "autoRejectOnSelect" BOOLEAN NOT NULL DEFAULT false,
    "scorePriceWeight" INTEGER NOT NULL DEFAULT 50,
    "scoreDeliveryWeight" INTEGER NOT NULL DEFAULT 25,
    "scorePaymentWeight" INTEGER NOT NULL DEFAULT 25,
    "penaltyMissingItems" INTEGER NOT NULL DEFAULT 10,
    "penaltyExpired" INTEGER NOT NULL DEFAULT 20,
    "penaltyIncomplete" INTEGER NOT NULL DEFAULT 5,
    "alertDaysBefore" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_quotation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: quotation_status_history
CREATE INDEX IF NOT EXISTS "quotation_status_history_quotationId_changedAt_idx" ON "quotation_status_history"("quotationId", "changedAt");

-- CreateIndex: company_quotation_settings
CREATE UNIQUE INDEX IF NOT EXISTS "company_quotation_settings_companyId_key" ON "company_quotation_settings"("companyId");

-- CreateIndex: purchase_quotations composite indexes
CREATE INDEX IF NOT EXISTS "purchase_quotations_companyId_estado_createdAt_idx" ON "purchase_quotations"("companyId", "estado", "createdAt");
CREATE INDEX IF NOT EXISTS "purchase_quotations_companyId_validezHasta_idx" ON "purchase_quotations"("companyId", "validezHasta");
CREATE INDEX IF NOT EXISTS "purchase_quotations_requestId_estado_idx" ON "purchase_quotations"("requestId", "estado");

-- CreateIndex: purchase_quotation_items matching indexes
CREATE INDEX IF NOT EXISTS "purchase_quotation_items_productId_idx" ON "purchase_quotation_items"("productId");
CREATE INDEX IF NOT EXISTS "purchase_quotation_items_normalizedKey_idx" ON "purchase_quotation_items"("normalizedKey");

-- AddForeignKey: quotation_status_history -> purchase_quotations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotation_status_history_quotationId_fkey') THEN
        ALTER TABLE "quotation_status_history" ADD CONSTRAINT "quotation_status_history_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "purchase_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: quotation_status_history -> users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotation_status_history_changedBy_fkey') THEN
        ALTER TABLE "quotation_status_history" ADD CONSTRAINT "quotation_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: company_quotation_settings -> companies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_quotation_settings_companyId_fkey') THEN
        ALTER TABLE "company_quotation_settings" ADD CONSTRAINT "company_quotation_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
