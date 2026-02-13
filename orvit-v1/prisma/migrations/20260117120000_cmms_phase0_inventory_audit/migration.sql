-- CMMS Phase 0: Inventory Separation, Audit Log, and Lot Traceability
-- Migration: cmms_phase0_inventory_audit
-- Created: 2026-01-17
-- Safe migration - only adds columns and tables, no data loss

-- ============================================================
-- 1. EXPAND ItemType enum
-- ============================================================
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'SPARE_PART';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'HAND_TOOL';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'CONSUMABLE';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'MATERIAL';

-- ============================================================
-- 2. ADD LotStatus enum
-- ============================================================
DO $$ BEGIN
    CREATE TYPE "LotStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'CONSUMED', 'EXPIRED', 'DEFECTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 3. ADD AuditAction enum
-- ============================================================
DO $$ BEGIN
    CREATE TYPE "AuditAction" AS ENUM (
        'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE',
        'ASSIGN', 'APPROVE', 'REJECT', 'CLOSE', 'REOPEN',
        'RESERVE_STOCK', 'CONSUME_STOCK',
        'LOCK_LOTO', 'UNLOCK_LOTO', 'APPROVE_PTW', 'CLOSE_PTW',
        'LOGIN', 'LOGOUT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 4. ADD new columns to Tool table
-- ============================================================
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "reorderPoint" INTEGER;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "isCritical" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "alternativeIds" JSONB;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "requiresCalibration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "calibrationFrequencyDays" INTEGER;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "calibrationStatus" TEXT;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "lastCalibrationAt" TIMESTAMP(3);
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "nextCalibrationAt" TIMESTAMP(3);
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'unidad';

-- ============================================================
-- 5. CREATE InventoryItemSupplier table
-- ============================================================
CREATE TABLE IF NOT EXISTS "inventory_item_suppliers" (
    "id" SERIAL NOT NULL,
    "toolId" INTEGER NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "leadTimeDays" INTEGER,
    "unitPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "lastPurchaseAt" TIMESTAMP(3),
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_item_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_item_suppliers_toolId_idx" ON "inventory_item_suppliers"("toolId");
CREATE INDEX IF NOT EXISTS "inventory_item_suppliers_companyId_isPreferred_idx" ON "inventory_item_suppliers"("companyId", "isPreferred");

ALTER TABLE "inventory_item_suppliers" DROP CONSTRAINT IF EXISTS "inventory_item_suppliers_toolId_fkey";
ALTER TABLE "inventory_item_suppliers" ADD CONSTRAINT "inventory_item_suppliers_toolId_fkey"
    FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 6. CREATE InventoryLot table
-- ============================================================
CREATE TABLE IF NOT EXISTS "inventory_lots" (
    "id" SERIAL NOT NULL,
    "toolId" INTEGER NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "serialNumber" TEXT,
    "quantity" INTEGER NOT NULL,
    "remainingQty" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "purchaseOrderId" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "LotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "unitCost" DOUBLE PRECISION,
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_lots_toolId_lotNumber_companyId_key"
    ON "inventory_lots"("toolId", "lotNumber", "companyId");
CREATE INDEX IF NOT EXISTS "inventory_lots_companyId_status_idx" ON "inventory_lots"("companyId", "status");
CREATE INDEX IF NOT EXISTS "inventory_lots_expiresAt_idx" ON "inventory_lots"("expiresAt");

ALTER TABLE "inventory_lots" DROP CONSTRAINT IF EXISTS "inventory_lots_toolId_fkey";
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_toolId_fkey"
    FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 7. CREATE LotInstallation table
-- ============================================================
CREATE TABLE IF NOT EXISTS "lot_installations" (
    "id" SERIAL NOT NULL,
    "lotId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "componentId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installedById" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "removedAt" TIMESTAMP(3),
    "removedById" INTEGER,
    "removalReason" TEXT,
    "removalWorkOrderId" INTEGER,
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_installations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lot_installations_machineId_removedAt_idx" ON "lot_installations"("machineId", "removedAt");
CREATE INDEX IF NOT EXISTS "lot_installations_lotId_idx" ON "lot_installations"("lotId");
CREATE INDEX IF NOT EXISTS "lot_installations_companyId_idx" ON "lot_installations"("companyId");

ALTER TABLE "lot_installations" DROP CONSTRAINT IF EXISTS "lot_installations_lotId_fkey";
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_lotId_fkey"
    FOREIGN KEY ("lotId") REFERENCES "inventory_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lot_installations" DROP CONSTRAINT IF EXISTS "lot_installations_machineId_fkey";
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_machineId_fkey"
    FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lot_installations" DROP CONSTRAINT IF EXISTS "lot_installations_componentId_fkey";
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lot_installations" DROP CONSTRAINT IF EXISTS "lot_installations_installedById_fkey";
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_installedById_fkey"
    FOREIGN KEY ("installedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lot_installations" DROP CONSTRAINT IF EXISTS "lot_installations_removedById_fkey";
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_removedById_fkey"
    FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lot_installations" DROP CONSTRAINT IF EXISTS "lot_installations_workOrderId_fkey";
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 8. CREATE AuditLog table
-- ============================================================
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" "AuditAction" NOT NULL,
    "fieldChanged" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "summary" TEXT,
    "performedById" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "audit_logs_performedById_idx" ON "audit_logs"("performedById");
CREATE INDEX IF NOT EXISTS "audit_logs_performedAt_idx" ON "audit_logs"("performedAt");
CREATE INDEX IF NOT EXISTS "audit_logs_companyId_entityType_idx" ON "audit_logs"("companyId", "entityType");
CREATE INDEX IF NOT EXISTS "audit_logs_companyId_performedAt_idx" ON "audit_logs"("companyId", "performedAt");

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_performedById_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_companyId_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 9. CREATE InterventionKit table (BOM Kits)
-- ============================================================
CREATE TABLE IF NOT EXISTS "intervention_kits" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "componentId" INTEGER,
    "checklistId" INTEGER,
    "estimatedTime" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intervention_kits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "intervention_kits_companyId_isActive_idx" ON "intervention_kits"("companyId", "isActive");

ALTER TABLE "intervention_kits" DROP CONSTRAINT IF EXISTS "intervention_kits_componentId_fkey";
ALTER TABLE "intervention_kits" ADD CONSTRAINT "intervention_kits_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 10. ENHANCE ComponentTool table (BOM profesional)
-- ============================================================
ALTER TABLE "ComponentTool" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'unidad';
ALTER TABLE "ComponentTool" ADD COLUMN IF NOT EXISTS "isConsumable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ComponentTool" ADD COLUMN IF NOT EXISTS "alternativeItemIds" JSONB;
ALTER TABLE "ComponentTool" ADD COLUMN IF NOT EXISTS "kitId" INTEGER;

CREATE INDEX IF NOT EXISTS "ComponentTool_kitId_idx" ON "ComponentTool"("kitId");

ALTER TABLE "ComponentTool" DROP CONSTRAINT IF EXISTS "ComponentTool_kitId_fkey";
ALTER TABLE "ComponentTool" ADD CONSTRAINT "ComponentTool_kitId_fkey"
    FOREIGN KEY ("kitId") REFERENCES "intervention_kits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- DONE: Migration complete
-- Next steps:
-- 1. Review this migration file
-- 2. Run: npx prisma migrate resolve --applied "20260117120000_cmms_phase0_inventory_audit"
-- 3. Or run the SQL directly on your database
-- ============================================================
