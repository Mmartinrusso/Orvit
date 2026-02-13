-- CMMS Phase 2: Criticality, Health Score, FMEA, and Audit Log
-- Critical schema updates for industrial CMMS

-- ============================================
-- MACHINE CRITICALITY AND HEALTH SCORE
-- ============================================

-- Add criticality and health score fields to Machine
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "criticalityScore" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "criticalityProduction" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "criticalitySafety" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "criticalityQuality" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "criticalityCost" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "healthScore" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "healthScoreUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "ownerId" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "plannerId" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "technicianId" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "expectedLifeYears" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "acquisitionDate" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "acquisitionCost" DECIMAL;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "commissioningDate" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "productionLineId" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "hasBackup" BOOLEAN DEFAULT false;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "backupMachineId" INTEGER;

-- Add criticality to Component
ALTER TABLE "Component" ADD COLUMN IF NOT EXISTS "criticality" INTEGER;
ALTER TABLE "Component" ADD COLUMN IF NOT EXISTS "isSafetyCritical" BOOLEAN DEFAULT false;

-- ============================================
-- COMPONENT FAILURE MODES (FMEA)
-- ============================================

CREATE TABLE IF NOT EXISTS "ComponentFailureMode" (
    "id" SERIAL PRIMARY KEY,
    "componentId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "symptoms" JSONB,
    "causes" JSONB,
    "effects" JSONB,
    "detectability" INTEGER, -- 1-10
    "severity" INTEGER, -- 1-10
    "occurrence" INTEGER, -- 1-10
    "rpn" INTEGER, -- Risk Priority Number (detectability * severity * occurrence)
    "recommendedActions" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComponentFailureMode_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE,
    CONSTRAINT "ComponentFailureMode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- ============================================
-- PRODUCTION LINES
-- ============================================

CREATE TABLE IF NOT EXISTS "ProductionLine" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) UNIQUE,
    "description" TEXT,
    "sectorId" INTEGER NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionLine_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE,
    CONSTRAINT "ProductionLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- ============================================
-- ASSET DEPENDENCIES
-- ============================================

CREATE TABLE IF NOT EXISTS "AssetDependency" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "dependsOnId" INTEGER NOT NULL,
    "dependencyType" VARCHAR(50) NOT NULL, -- CRITICAL, BACKUP, FEEDS, FED_BY
    "impactLevel" INTEGER, -- 1-10
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDependency_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "AssetDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "AssetDependency_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "AssetDependency_machineId_dependsOnId_key" UNIQUE ("machineId", "dependsOnId")
);

-- ============================================
-- GLOBAL AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" SERIAL PRIMARY KEY,
    "entityType" VARCHAR(100) NOT NULL, -- WorkOrder, Machine, PermitToWork, etc.
    "entityId" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, STATUS_CHANGE, ASSIGN, APPROVE, etc.
    "fieldChanged" VARCHAR(255),
    "oldValue" JSONB,
    "newValue" JSONB,
    "performedById" INTEGER NOT NULL,
    "performedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "AuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id"),
    CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- ============================================
-- HEALTH SCORE HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS "HealthScoreHistory" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "factors" JSONB, -- Breakdown of factors that contributed to score
    "notes" TEXT,

    CONSTRAINT "HealthScoreHistory_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE
);

-- ============================================
-- ASSET LIFECYCLE EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS "AssetLifecycleEvent" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "eventType" VARCHAR(50) NOT NULL, -- ACQUISITION, INSTALLATION, COMMISSIONING, RELOCATION, UPGRADE, OVERHAUL, DECOMMISSION, DISPOSAL
    "eventDate" TIMESTAMP(3) NOT NULL,
    "fromLocationId" INTEGER,
    "toLocationId" INTEGER,
    "cost" DECIMAL,
    "supplierName" VARCHAR(255),
    "workOrderId" INTEGER,
    "description" TEXT,
    "attachments" JSONB,
    "performedById" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetLifecycleEvent_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "AssetLifecycleEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id"),
    CONSTRAINT "AssetLifecycleEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- ============================================
-- REPAIR VS REPLACE ANALYSIS
-- ============================================

CREATE TABLE IF NOT EXISTS "RepairReplaceAnalysis" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "analysisDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "remainingLifeYears" INTEGER,
    "annualMaintenanceCost" DECIMAL,
    "replacementCost" DECIMAL,
    "newEquipmentEfficiency" DECIMAL,
    "recommendation" VARCHAR(50), -- REPAIR, REPLACE, MONITOR
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
-- INDEXES
-- ============================================

-- Machine criticality indexes
CREATE INDEX IF NOT EXISTS "Machine_criticalityScore_idx" ON "Machine"("criticalityScore");
CREATE INDEX IF NOT EXISTS "Machine_healthScore_idx" ON "Machine"("healthScore");
CREATE INDEX IF NOT EXISTS "Machine_productionLineId_idx" ON "Machine"("productionLineId");

-- Component criticality indexes
CREATE INDEX IF NOT EXISTS "Component_criticality_idx" ON "Component"("criticality");
CREATE INDEX IF NOT EXISTS "Component_isSafetyCritical_idx" ON "Component"("isSafetyCritical");

-- FMEA indexes
CREATE INDEX IF NOT EXISTS "ComponentFailureMode_componentId_idx" ON "ComponentFailureMode"("componentId");
CREATE INDEX IF NOT EXISTS "ComponentFailureMode_companyId_idx" ON "ComponentFailureMode"("companyId");
CREATE INDEX IF NOT EXISTS "ComponentFailureMode_rpn_idx" ON "ComponentFailureMode"("rpn");

-- Production Line indexes
CREATE INDEX IF NOT EXISTS "ProductionLine_sectorId_idx" ON "ProductionLine"("sectorId");
CREATE INDEX IF NOT EXISTS "ProductionLine_companyId_idx" ON "ProductionLine"("companyId");

-- Asset Dependency indexes
CREATE INDEX IF NOT EXISTS "AssetDependency_machineId_idx" ON "AssetDependency"("machineId");
CREATE INDEX IF NOT EXISTS "AssetDependency_dependsOnId_idx" ON "AssetDependency"("dependsOnId");
CREATE INDEX IF NOT EXISTS "AssetDependency_companyId_idx" ON "AssetDependency"("companyId");

-- Audit Log indexes
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_performedById_idx" ON "AuditLog"("performedById");
CREATE INDEX IF NOT EXISTS "AuditLog_performedAt_idx" ON "AuditLog"("performedAt");
CREATE INDEX IF NOT EXISTS "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- Health Score History indexes
CREATE INDEX IF NOT EXISTS "HealthScoreHistory_machineId_idx" ON "HealthScoreHistory"("machineId");
CREATE INDEX IF NOT EXISTS "HealthScoreHistory_calculatedAt_idx" ON "HealthScoreHistory"("calculatedAt");

-- Asset Lifecycle indexes
CREATE INDEX IF NOT EXISTS "AssetLifecycleEvent_machineId_idx" ON "AssetLifecycleEvent"("machineId");
CREATE INDEX IF NOT EXISTS "AssetLifecycleEvent_eventType_idx" ON "AssetLifecycleEvent"("eventType");
CREATE INDEX IF NOT EXISTS "AssetLifecycleEvent_companyId_idx" ON "AssetLifecycleEvent"("companyId");
