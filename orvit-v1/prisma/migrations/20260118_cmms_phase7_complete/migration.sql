-- CMMS Phase 7 - Complete Enterprise Features
-- Tool Crib extensions, Asset Lifecycle, PM Compliance, Asset Families, Escalation Rules
-- Note: Production tables already exist in the schema, so we only add new fields/tables

-- ============================================
-- TOOL LOAN - Extend existing table
-- ============================================

-- Add new columns to existing ToolLoan table
ALTER TABLE "ToolLoan" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
ALTER TABLE "ToolLoan" ADD COLUMN IF NOT EXISTS "requestedById" INTEGER;
ALTER TABLE "ToolLoan" ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ToolLoan" ADD COLUMN IF NOT EXISTS "workOrderId" INTEGER;
ALTER TABLE "ToolLoan" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
ALTER TABLE "ToolLoan" ADD COLUMN IF NOT EXISTS "approvedById" INTEGER;
ALTER TABLE "ToolLoan" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "ToolLoan" ADD COLUMN IF NOT EXISTS "expectedReturnAt" TIMESTAMP(3);
ALTER TABLE "ToolLoan" ADD COLUMN IF NOT EXISTS "returnedToId" INTEGER;
ALTER TABLE "ToolLoan" ADD COLUMN IF NOT EXISTS "returnCondition" VARCHAR(30);

-- Tool Condition Log (new table)
CREATE TABLE IF NOT EXISTS "ToolConditionLog" (
    "id" SERIAL PRIMARY KEY,
    "toolId" INTEGER NOT NULL,
    "previousStatus" VARCHAR(30),
    "newStatus" VARCHAR(30) NOT NULL,
    "reason" TEXT,
    "reportedById" INTEGER NOT NULL,
    "reportedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "repairWorkOrderId" INTEGER,
    "estimatedRepairDays" INTEGER,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "ToolConditionLog_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE,
    CONSTRAINT "ToolConditionLog_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id"),
    CONSTRAINT "ToolConditionLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- ============================================
-- ASSET LIFECYCLE / EAM
-- ============================================

-- Machine lifecycle fields
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "acquisitionDate" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "acquisitionCost" DECIMAL;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "commissioningDate" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "expectedLifeYears" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "depreciationMethod" VARCHAR(30);
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "currentBookValue" DECIMAL;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "disposalDate" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "disposalReason" TEXT;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "operatingHoursPerDay" INTEGER DEFAULT 8;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "hasBackup" BOOLEAN DEFAULT false;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "backupMachineId" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "ownerId" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "plannerId" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "technicianId" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "familyId" INTEGER;

-- Asset Lifecycle Events
CREATE TABLE IF NOT EXISTS "AssetLifecycleEvent" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "cost" DECIMAL,
    "supplierName" VARCHAR(255),
    "workOrderId" INTEGER,
    "description" TEXT,
    "fromLocationId" INTEGER,
    "toLocationId" INTEGER,
    "attachments" JSONB DEFAULT '[]'::jsonb,
    "performedById" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetLifecycleEvent_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "AssetLifecycleEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id"),
    CONSTRAINT "AssetLifecycleEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- TCO Snapshots
CREATE TABLE IF NOT EXISTS "AssetTCOSnapshot" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DECIMAL NOT NULL DEFAULT 0,
    "maintenanceCost" DECIMAL NOT NULL DEFAULT 0,
    "operatingCost" DECIMAL NOT NULL DEFAULT 0,
    "downtimeCost" DECIMAL NOT NULL DEFAULT 0,
    "thirdPartyCost" DECIMAL NOT NULL DEFAULT 0,
    "totalCost" DECIMAL NOT NULL DEFAULT 0,
    "costPerHour" DECIMAL,
    "costPerUnit" DECIMAL,
    "calculatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "AssetTCOSnapshot_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "AssetTCOSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- Repair vs Replace Analysis
CREATE TABLE IF NOT EXISTS "RepairReplaceAnalysis" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "analysisDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "remainingLifeYears" INTEGER,
    "annualMaintenanceCost" DECIMAL NOT NULL,
    "replacementCost" DECIMAL NOT NULL,
    "newEquipmentEfficiency" DECIMAL,
    "recommendation" VARCHAR(20) NOT NULL,
    "breakEvenYears" DECIMAL,
    "confidence" INTEGER,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "RepairReplaceAnalysis_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "RepairReplaceAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id"),
    CONSTRAINT "RepairReplaceAnalysis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- ============================================
-- PM COMPLIANCE
-- ============================================

CREATE TABLE IF NOT EXISTS "PMExecution" (
    "id" SERIAL PRIMARY KEY,
    "checklistId" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "executedDate" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "skipReason" VARCHAR(50),
    "skipApprovedById" INTEGER,
    "skipNotes" TEXT,
    "executedById" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PMExecution_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "maintenance_checklists"("id") ON DELETE CASCADE,
    CONSTRAINT "PMExecution_skipApprovedById_fkey" FOREIGN KEY ("skipApprovedById") REFERENCES "User"("id"),
    CONSTRAINT "PMExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id"),
    CONSTRAINT "PMExecution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- ============================================
-- ASSET FAMILIES
-- ============================================

CREATE TABLE IF NOT EXISTS "AssetFamily" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "checklistIds" JSONB DEFAULT '[]'::jsonb,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetFamily_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- ============================================
-- ESCALATION RULES
-- ============================================

CREATE TABLE IF NOT EXISTS "EscalationRule" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "entityType" VARCHAR(50) NOT NULL,
    "triggerCondition" VARCHAR(50) NOT NULL,
    "thresholdMinutes" INTEGER NOT NULL,
    "actions" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "notifyUserIds" JSONB DEFAULT '[]'::jsonb,
    "notifyRoleIds" JSONB DEFAULT '[]'::jsonb,
    "notifyEmail" TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "priority" INTEGER DEFAULT 1,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscalationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "EscalationLog" (
    "id" SERIAL PRIMARY KEY,
    "ruleId" INTEGER NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "triggeredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "action" VARCHAR(50) NOT NULL,
    "notificationsSent" JSONB DEFAULT '[]'::jsonb,
    "resolved" BOOLEAN DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "EscalationLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "EscalationRule"("id") ON DELETE CASCADE,
    CONSTRAINT "EscalationLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- ============================================
-- PRODUCTION EXTENSIONS (add to existing tables)
-- ============================================

-- Production Shifts (new - doesn't exist in schema)
CREATE TABLE IF NOT EXISTS "ProductionShift" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "areaId" INTEGER,
    "shiftDate" DATE NOT NULL,
    "startTime" TIME,
    "endTime" TIME,
    "supervisorId" INTEGER,
    "plannedOutput" DECIMAL,
    "actualOutput" DECIMAL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionShift_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "ProductionShift_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL,
    CONSTRAINT "ProductionShift_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id")
);

-- Production Work Centers (new - doesn't exist with this exact structure)
CREATE TABLE IF NOT EXISTS "ProductionWorkCenter" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "areaId" INTEGER,
    "machineIds" JSONB DEFAULT '[]'::jsonb,
    "capacity" DECIMAL,
    "capacityUnit" VARCHAR(20),
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionWorkCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "ProductionWorkCenter_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL
);

-- ============================================
-- ADDITIONAL TOOL FIELDS
-- ============================================

ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "isCritical" BOOLEAN DEFAULT false;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "requiresCalibration" BOOLEAN DEFAULT false;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "calibrationFrequencyDays" INTEGER;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "lastCalibrationDate" TIMESTAMP(3);
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "nextCalibrationDate" TIMESTAMP(3);
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "condition" VARCHAR(30) DEFAULT 'OK';

-- ============================================
-- INDEXES (only for new tables)
-- ============================================

CREATE INDEX IF NOT EXISTS "ToolConditionLog_toolId_idx" ON "ToolConditionLog"("toolId");
CREATE INDEX IF NOT EXISTS "AssetLifecycleEvent_machineId_idx" ON "AssetLifecycleEvent"("machineId");
CREATE INDEX IF NOT EXISTS "AssetLifecycleEvent_eventType_idx" ON "AssetLifecycleEvent"("eventType");
CREATE INDEX IF NOT EXISTS "AssetTCOSnapshot_machineId_idx" ON "AssetTCOSnapshot"("machineId");
CREATE INDEX IF NOT EXISTS "RepairReplaceAnalysis_machineId_idx" ON "RepairReplaceAnalysis"("machineId");
CREATE INDEX IF NOT EXISTS "PMExecution_checklistId_idx" ON "PMExecution"("checklistId");
CREATE INDEX IF NOT EXISTS "PMExecution_scheduledDate_idx" ON "PMExecution"("scheduledDate");
CREATE INDEX IF NOT EXISTS "PMExecution_status_idx" ON "PMExecution"("status");
CREATE INDEX IF NOT EXISTS "AssetFamily_companyId_idx" ON "AssetFamily"("companyId");
CREATE INDEX IF NOT EXISTS "EscalationRule_companyId_idx" ON "EscalationRule"("companyId");
CREATE INDEX IF NOT EXISTS "EscalationRule_entityType_idx" ON "EscalationRule"("entityType");
CREATE INDEX IF NOT EXISTS "EscalationLog_ruleId_idx" ON "EscalationLog"("ruleId");
CREATE INDEX IF NOT EXISTS "ProductionShift_companyId_shiftDate_idx" ON "ProductionShift"("companyId", "shiftDate");
CREATE INDEX IF NOT EXISTS "ProductionWorkCenter_companyId_idx" ON "ProductionWorkCenter"("companyId");
