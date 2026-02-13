-- CMMS Phase 6 - Extended Modules
-- Warranties, Lessons Learned, Measuring Points, Shutdowns, MRO

-- ============================================
-- WARRANTY AND CLAIMS MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS "Warranty" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "componentId" INTEGER,
    "warrantyNumber" VARCHAR(100) UNIQUE,
    "vendor" VARCHAR(255) NOT NULL,
    "vendorContact" VARCHAR(255),
    "vendorEmail" VARCHAR(255),
    "vendorPhone" VARCHAR(50),

    -- Warranty Terms
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "coverageType" VARCHAR(50) DEFAULT 'FULL', -- FULL, LIMITED, PARTS_ONLY, LABOR_ONLY
    "terms" TEXT,
    "exclusions" TEXT,

    -- Financial
    "originalCost" DECIMAL,
    "warrantyCost" DECIMAL,
    "currency" VARCHAR(10) DEFAULT 'ARS',

    -- Documents
    "documentUrl" TEXT,
    "purchaseOrderRef" VARCHAR(100),

    -- Status
    "status" VARCHAR(30) DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, CLAIMED, VOIDED
    "isActive" BOOLEAN DEFAULT true,

    -- Metadata
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warranty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "Warranty_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "Warranty_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL,
    CONSTRAINT "Warranty_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id")
);

-- Warranty Claims
CREATE TABLE IF NOT EXISTS "WarrantyClaim" (
    "id" SERIAL PRIMARY KEY,
    "warrantyId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "claimNumber" VARCHAR(100) UNIQUE,
    "claimDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    -- Claim Details
    "description" TEXT NOT NULL,
    "failureMode" VARCHAR(255),
    "failureDate" TIMESTAMP(3),
    "discoveredById" INTEGER,

    -- Status tracking
    "status" VARCHAR(30) DEFAULT 'SUBMITTED', -- SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED, CLOSED
    "vendorResponse" TEXT,
    "vendorResponseDate" TIMESTAMP(3),
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),

    -- Financial
    "claimedAmount" DECIMAL,
    "approvedAmount" DECIMAL,
    "creditReceived" DECIMAL,
    "creditDate" TIMESTAMP(3),

    -- Documents
    "attachments" JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    "submittedById" INTEGER NOT NULL,
    "reviewedById" INTEGER,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyClaim_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id") ON DELETE CASCADE,
    CONSTRAINT "WarrantyClaim_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "WarrantyClaim_discoveredById_fkey" FOREIGN KEY ("discoveredById") REFERENCES "User"("id"),
    CONSTRAINT "WarrantyClaim_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id"),
    CONSTRAINT "WarrantyClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
);

-- ============================================
-- LESSONS LEARNED
-- ============================================

CREATE TABLE IF NOT EXISTS "LessonLearned" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "failureOccurrenceId" INTEGER,

    -- Content
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "whatWorked" TEXT,
    "whatDidnt" TEXT,
    "recommendation" TEXT NOT NULL,

    -- Classification
    "category" VARCHAR(50) DEFAULT 'TECHNICAL', -- TECHNICAL, PROCESS, SAFETY, QUALITY, ENVIRONMENTAL
    "tags" JSONB DEFAULT '[]'::jsonb,
    "severity" VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL

    -- Impact
    "impactArea" VARCHAR(100), -- SAFETY, PRODUCTION, QUALITY, COST, ENVIRONMENT
    "estimatedSavings" DECIMAL,
    "currency" VARCHAR(10) DEFAULT 'ARS',

    -- Applicability
    "applicableMachineTypes" TEXT[],
    "applicableAreas" INTEGER[],

    -- Status
    "status" VARCHAR(30) DEFAULT 'DRAFT', -- DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, ARCHIVED
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    -- Attachments
    "attachments" JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonLearned_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "LessonLearned_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "LessonLearned_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id"),
    CONSTRAINT "LessonLearned_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id")
);

-- ============================================
-- MEASURING POINTS AND INSPECTION ROUNDS
-- ============================================

-- Measuring Points Definition
CREATE TABLE IF NOT EXISTS "MeasuringPoint" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "componentId" INTEGER,

    -- Identification
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(255),

    -- Measurement Configuration
    "measurementType" VARCHAR(50) NOT NULL, -- TEMPERATURE, PRESSURE, VIBRATION, LEVEL, FLOW, SPEED, ELECTRICAL, VISUAL
    "unit" VARCHAR(50) NOT NULL,
    "decimalPlaces" INTEGER DEFAULT 2,

    -- Thresholds
    "normalMin" DECIMAL,
    "normalMax" DECIMAL,
    "warningMin" DECIMAL,
    "warningMax" DECIMAL,
    "criticalMin" DECIMAL,
    "criticalMax" DECIMAL,

    -- Frequency
    "measurementFrequency" VARCHAR(30) DEFAULT 'DAILY', -- HOURLY, DAILY, WEEKLY, MONTHLY, PER_SHIFT

    -- Visual aids
    "imageUrl" TEXT,
    "instructions" TEXT,

    -- Status
    "isActive" BOOLEAN DEFAULT true,
    "lastReadingAt" TIMESTAMP(3),
    "lastValue" DECIMAL,
    "lastStatus" VARCHAR(30),

    -- Metadata
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeasuringPoint_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "MeasuringPoint_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "MeasuringPoint_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL
);

-- Measuring Point Readings
CREATE TABLE IF NOT EXISTS "MeasuringPointReading" (
    "id" SERIAL PRIMARY KEY,
    "measuringPointId" INTEGER NOT NULL,
    "inspectionRoundId" INTEGER,

    -- Reading
    "value" DECIMAL NOT NULL,
    "status" VARCHAR(30) DEFAULT 'NORMAL', -- NORMAL, WARNING, CRITICAL, OUT_OF_RANGE
    "readingAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    -- Context
    "recordedById" INTEGER NOT NULL,
    "notes" TEXT,
    "imageUrl" TEXT,

    -- If abnormal
    "actionTaken" TEXT,
    "workOrderId" INTEGER,

    CONSTRAINT "MeasuringPointReading_measuringPointId_fkey" FOREIGN KEY ("measuringPointId") REFERENCES "MeasuringPoint"("id") ON DELETE CASCADE,
    CONSTRAINT "MeasuringPointReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id"),
    CONSTRAINT "MeasuringPointReading_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL
);

-- Inspection Routes
CREATE TABLE IF NOT EXISTS "InspectionRoute" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "areaId" INTEGER,
    "sectorId" INTEGER,

    -- Schedule
    "frequency" VARCHAR(30) DEFAULT 'DAILY', -- HOURLY, PER_SHIFT, DAILY, WEEKLY
    "scheduledTime" TIME,
    "estimatedDuration" INTEGER, -- minutes

    -- Configuration
    "isActive" BOOLEAN DEFAULT true,
    "requiresSequence" BOOLEAN DEFAULT false, -- Must complete in order

    -- Metadata
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionRoute_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "InspectionRoute_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL,
    CONSTRAINT "InspectionRoute_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL,
    CONSTRAINT "InspectionRoute_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id")
);

-- Route Points (linking routes to measuring points)
CREATE TABLE IF NOT EXISTS "InspectionRoutePoint" (
    "id" SERIAL PRIMARY KEY,
    "routeId" INTEGER NOT NULL,
    "measuringPointId" INTEGER NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN DEFAULT true,

    CONSTRAINT "InspectionRoutePoint_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "InspectionRoute"("id") ON DELETE CASCADE,
    CONSTRAINT "InspectionRoutePoint_measuringPointId_fkey" FOREIGN KEY ("measuringPointId") REFERENCES "MeasuringPoint"("id") ON DELETE CASCADE
);

-- Inspection Rounds (executions of routes)
CREATE TABLE IF NOT EXISTS "InspectionRound" (
    "id" SERIAL PRIMARY KEY,
    "routeId" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "shift" VARCHAR(20), -- MORNING, AFTERNOON, NIGHT

    -- Execution
    "status" VARCHAR(30) DEFAULT 'SCHEDULED', -- SCHEDULED, IN_PROGRESS, COMPLETED, INCOMPLETE, CANCELLED
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "executedById" INTEGER,

    -- Results
    "totalPoints" INTEGER DEFAULT 0,
    "completedPoints" INTEGER DEFAULT 0,
    "normalCount" INTEGER DEFAULT 0,
    "warningCount" INTEGER DEFAULT 0,
    "criticalCount" INTEGER DEFAULT 0,

    -- Notes
    "notes" TEXT,
    "issues" JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionRound_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "InspectionRoute"("id") ON DELETE CASCADE,
    CONSTRAINT "InspectionRound_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id")
);

-- ============================================
-- SHUTDOWN/TURNAROUND MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS "Shutdown" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "shutdownNumber" VARCHAR(50) UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,

    -- Type and scope
    "type" VARCHAR(50) DEFAULT 'PLANNED', -- PLANNED, TURNAROUND, EMERGENCY, MAINTENANCE_WINDOW
    "scope" VARCHAR(50) DEFAULT 'PARTIAL', -- FULL, PARTIAL, AREA_SPECIFIC

    -- Affected areas
    "affectedAreas" INTEGER[],
    "affectedMachines" INTEGER[],

    -- Schedule
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3) NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),

    -- Status
    "status" VARCHAR(30) DEFAULT 'PLANNING', -- PLANNING, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED, POSTPONED
    "phase" VARCHAR(30), -- PREPARATION, EXECUTION, STARTUP, CLOSEOUT

    -- Budget
    "budgetedCost" DECIMAL,
    "actualCost" DECIMAL,
    "currency" VARCHAR(10) DEFAULT 'ARS',

    -- Resources
    "estimatedManHours" INTEGER,
    "actualManHours" INTEGER,
    "contractorsInvolved" INTEGER[],

    -- Progress
    "progress" INTEGER DEFAULT 0, -- 0-100
    "totalWorkOrders" INTEGER DEFAULT 0,
    "completedWorkOrders" INTEGER DEFAULT 0,

    -- Metadata
    "managerId" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shutdown_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "Shutdown_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id"),
    CONSTRAINT "Shutdown_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id")
);

-- Shutdown Work Orders (linking work orders to shutdowns)
CREATE TABLE IF NOT EXISTS "ShutdownWorkOrder" (
    "id" SERIAL PRIMARY KEY,
    "shutdownId" INTEGER NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "priority" INTEGER DEFAULT 1, -- Sequence priority
    "phase" VARCHAR(30), -- Which phase of shutdown
    "isCriticalPath" BOOLEAN DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "ShutdownWorkOrder_shutdownId_fkey" FOREIGN KEY ("shutdownId") REFERENCES "Shutdown"("id") ON DELETE CASCADE,
    CONSTRAINT "ShutdownWorkOrder_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE
);

-- Shutdown Milestones
CREATE TABLE IF NOT EXISTS "ShutdownMilestone" (
    "id" SERIAL PRIMARY KEY,
    "shutdownId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "status" VARCHAR(30) DEFAULT 'PENDING', -- PENDING, COMPLETED, DELAYED, CANCELLED
    "sequenceOrder" INTEGER,

    CONSTRAINT "ShutdownMilestone_shutdownId_fkey" FOREIGN KEY ("shutdownId") REFERENCES "Shutdown"("id") ON DELETE CASCADE
);

-- ============================================
-- MRO REQUEST (Maintenance Procurement)
-- ============================================

CREATE TABLE IF NOT EXISTS "MRORequest" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "requestNumber" VARCHAR(50) UNIQUE,

    -- Request details
    "workOrderId" INTEGER,
    "machineId" INTEGER,
    "description" TEXT NOT NULL,
    "urgency" VARCHAR(20) DEFAULT 'NORMAL', -- EMERGENCY, URGENT, NORMAL, LOW

    -- Items
    "items" JSONB DEFAULT '[]'::jsonb, -- Array of {partNumber, description, quantity, unit, estimatedCost}
    "totalEstimatedCost" DECIMAL,
    "currency" VARCHAR(10) DEFAULT 'ARS',

    -- Status tracking
    "status" VARCHAR(30) DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, APPROVED, REJECTED, ORDERED, RECEIVED, CLOSED
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),

    -- Approvals
    "requestedById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "approvalNotes" TEXT,

    -- Procurement link
    "purchaseOrderId" INTEGER,
    "vendorId" INTEGER,

    -- Delivery
    "requiredByDate" TIMESTAMP(3),
    "expectedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),

    -- Metadata
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MRORequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "MRORequest_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "MRORequest_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL,
    CONSTRAINT "MRORequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id"),
    CONSTRAINT "MRORequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id")
);

-- MRO Request History
CREATE TABLE IF NOT EXISTS "MRORequestHistory" (
    "id" SERIAL PRIMARY KEY,
    "mroRequestId" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "previousStatus" VARCHAR(30),
    "newStatus" VARCHAR(30),
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "MRORequestHistory_mroRequestId_fkey" FOREIGN KEY ("mroRequestId") REFERENCES "MRORequest"("id") ON DELETE CASCADE,
    CONSTRAINT "MRORequestHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id")
);

-- ============================================
-- FAILURE OCCURRENCE (Enhanced)
-- ============================================

-- Add missing columns to failure_occurrences if not exists
ALTER TABLE "failure_occurrences" ADD COLUMN IF NOT EXISTS "attachments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "failure_occurrences" ADD COLUMN IF NOT EXISTS "reportLocation" VARCHAR(255);
ALTER TABLE "failure_occurrences" ADD COLUMN IF NOT EXISTS "discoveryMethod" VARCHAR(50); -- OPERATOR, INSPECTION, MONITORING, CUSTOMER
ALTER TABLE "failure_occurrences" ADD COLUMN IF NOT EXISTS "immediateAction" TEXT;
ALTER TABLE "failure_occurrences" ADD COLUMN IF NOT EXISTS "productionImpact" VARCHAR(50); -- NONE, PARTIAL, FULL_STOP
ALTER TABLE "failure_occurrences" ADD COLUMN IF NOT EXISTS "qualityImpact" BOOLEAN DEFAULT false;
ALTER TABLE "failure_occurrences" ADD COLUMN IF NOT EXISTS "safetyImpact" BOOLEAN DEFAULT false;

-- ============================================
-- INDEXES
-- ============================================

-- Warranty indexes
CREATE INDEX IF NOT EXISTS "Warranty_companyId_idx" ON "Warranty"("companyId");
CREATE INDEX IF NOT EXISTS "Warranty_machineId_idx" ON "Warranty"("machineId");
CREATE INDEX IF NOT EXISTS "Warranty_status_idx" ON "Warranty"("status");
CREATE INDEX IF NOT EXISTS "Warranty_endDate_idx" ON "Warranty"("endDate");
CREATE INDEX IF NOT EXISTS "WarrantyClaim_warrantyId_idx" ON "WarrantyClaim"("warrantyId");
CREATE INDEX IF NOT EXISTS "WarrantyClaim_status_idx" ON "WarrantyClaim"("status");

-- Lesson Learned indexes
CREATE INDEX IF NOT EXISTS "LessonLearned_companyId_idx" ON "LessonLearned"("companyId");
CREATE INDEX IF NOT EXISTS "LessonLearned_category_idx" ON "LessonLearned"("category");
CREATE INDEX IF NOT EXISTS "LessonLearned_status_idx" ON "LessonLearned"("status");

-- Measuring Point indexes
CREATE INDEX IF NOT EXISTS "MeasuringPoint_companyId_idx" ON "MeasuringPoint"("companyId");
CREATE INDEX IF NOT EXISTS "MeasuringPoint_machineId_idx" ON "MeasuringPoint"("machineId");
CREATE INDEX IF NOT EXISTS "MeasuringPoint_code_idx" ON "MeasuringPoint"("code");
CREATE INDEX IF NOT EXISTS "MeasuringPointReading_measuringPointId_idx" ON "MeasuringPointReading"("measuringPointId");
CREATE INDEX IF NOT EXISTS "MeasuringPointReading_readingAt_idx" ON "MeasuringPointReading"("readingAt");
CREATE INDEX IF NOT EXISTS "InspectionRoute_companyId_idx" ON "InspectionRoute"("companyId");
CREATE INDEX IF NOT EXISTS "InspectionRound_routeId_idx" ON "InspectionRound"("routeId");
CREATE INDEX IF NOT EXISTS "InspectionRound_scheduledDate_idx" ON "InspectionRound"("scheduledDate");

-- Shutdown indexes
CREATE INDEX IF NOT EXISTS "Shutdown_companyId_idx" ON "Shutdown"("companyId");
CREATE INDEX IF NOT EXISTS "Shutdown_status_idx" ON "Shutdown"("status");
CREATE INDEX IF NOT EXISTS "Shutdown_plannedStartDate_idx" ON "Shutdown"("plannedStartDate");
CREATE INDEX IF NOT EXISTS "ShutdownWorkOrder_shutdownId_idx" ON "ShutdownWorkOrder"("shutdownId");
CREATE INDEX IF NOT EXISTS "ShutdownMilestone_shutdownId_idx" ON "ShutdownMilestone"("shutdownId");

-- MRO Request indexes
CREATE INDEX IF NOT EXISTS "MRORequest_companyId_idx" ON "MRORequest"("companyId");
CREATE INDEX IF NOT EXISTS "MRORequest_status_idx" ON "MRORequest"("status");
CREATE INDEX IF NOT EXISTS "MRORequest_workOrderId_idx" ON "MRORequest"("workOrderId");
CREATE INDEX IF NOT EXISTS "MRORequestHistory_mroRequestId_idx" ON "MRORequestHistory"("mroRequestId");
