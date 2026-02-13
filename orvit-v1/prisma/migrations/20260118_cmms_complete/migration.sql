-- CMMS Complete Module - All remaining modules
-- Calibration, Lubrication, Contractors, Condition Monitoring

-- ============================================
-- CALIBRATION MANAGEMENT
-- ============================================

-- Calibration Records - Full lifecycle tracking
CREATE TABLE IF NOT EXISTS "Calibration" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "componentId" INTEGER,
    "calibrationNumber" VARCHAR(50) UNIQUE NOT NULL,
    "instrumentName" VARCHAR(255) NOT NULL,
    "instrumentSerial" VARCHAR(100),
    "status" VARCHAR(30) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, FAILED, OVERDUE
    "calibrationType" VARCHAR(50) DEFAULT 'INTERNAL', -- INTERNAL, EXTERNAL, VENDOR

    -- Scheduling
    "frequencyDays" INTEGER NOT NULL DEFAULT 365,
    "lastCalibrationDate" TIMESTAMP(3),
    "nextCalibrationDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),

    -- Results
    "calibrationDate" TIMESTAMP(3),
    "calibratedById" INTEGER,
    "calibrationProvider" VARCHAR(255),
    "certificateNumber" VARCHAR(100),
    "certificateUrl" TEXT,
    "result" VARCHAR(50), -- PASS, FAIL, ADJUSTED
    "notes" TEXT,

    -- Standards and tolerances
    "standardUsed" VARCHAR(255),
    "toleranceMin" DECIMAL,
    "toleranceMax" DECIMAL,
    "measuredValue" DECIMAL,
    "deviation" DECIMAL,

    -- Metadata
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Calibration_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "Calibration_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL,
    CONSTRAINT "Calibration_calibratedById_fkey" FOREIGN KEY ("calibratedById") REFERENCES "User"("id") ON DELETE SET NULL,
    CONSTRAINT "Calibration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- Calibration History
CREATE TABLE IF NOT EXISTS "CalibrationHistory" (
    "id" SERIAL PRIMARY KEY,
    "calibrationId" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL, -- CREATED, SCHEDULED, STARTED, COMPLETED, FAILED, RESCHEDULED
    "previousStatus" VARCHAR(30),
    "newStatus" VARCHAR(30),
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "CalibrationHistory_calibrationId_fkey" FOREIGN KEY ("calibrationId") REFERENCES "Calibration"("id") ON DELETE CASCADE,
    CONSTRAINT "CalibrationHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id")
);

-- ============================================
-- LUBRICATION MANAGEMENT
-- ============================================

-- Lubrication Points
CREATE TABLE IF NOT EXISTS "LubricationPoint" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "componentId" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "location" VARCHAR(255),
    "lubricantType" VARCHAR(100) NOT NULL,
    "lubricantBrand" VARCHAR(100),
    "quantity" DECIMAL,
    "quantityUnit" VARCHAR(20) DEFAULT 'ml',
    "method" VARCHAR(50) DEFAULT 'MANUAL', -- MANUAL, AUTOMATIC, CENTRALIZED
    "frequencyHours" INTEGER,
    "frequencyDays" INTEGER,
    "instructions" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LubricationPoint_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "LubricationPoint_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL,
    CONSTRAINT "LubricationPoint_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- Lubrication Schedules
CREATE TABLE IF NOT EXISTS "LubricationSchedule" (
    "id" SERIAL PRIMARY KEY,
    "lubricationPointId" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(30) DEFAULT 'PENDING', -- PENDING, COMPLETED, SKIPPED, OVERDUE
    "completedAt" TIMESTAMP(3),
    "completedById" INTEGER,
    "quantityUsed" DECIMAL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LubricationSchedule_lubricationPointId_fkey" FOREIGN KEY ("lubricationPointId") REFERENCES "LubricationPoint"("id") ON DELETE CASCADE,
    CONSTRAINT "LubricationSchedule_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id")
);

-- Lubrication Execution Records
CREATE TABLE IF NOT EXISTS "LubricationExecution" (
    "id" SERIAL PRIMARY KEY,
    "lubricationPointId" INTEGER NOT NULL,
    "scheduleId" INTEGER,
    "executedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "executedById" INTEGER NOT NULL,
    "lubricantUsed" VARCHAR(100),
    "quantityUsed" DECIMAL,
    "condition" VARCHAR(50), -- NORMAL, CONTAMINATED, LOW_LEVEL, NEEDS_REPLACEMENT
    "observations" TEXT,
    "imageUrl" TEXT,

    CONSTRAINT "LubricationExecution_lubricationPointId_fkey" FOREIGN KEY ("lubricationPointId") REFERENCES "LubricationPoint"("id") ON DELETE CASCADE,
    CONSTRAINT "LubricationExecution_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "LubricationSchedule"("id") ON DELETE SET NULL,
    CONSTRAINT "LubricationExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id")
);

-- ============================================
-- CONTRACTORS MANAGEMENT
-- ============================================

-- Contractors
CREATE TABLE IF NOT EXISTS "Contractor" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "legalName" VARCHAR(255),
    "taxId" VARCHAR(50),
    "contactName" VARCHAR(255),
    "contactEmail" VARCHAR(255),
    "contactPhone" VARCHAR(50),
    "address" TEXT,
    "website" VARCHAR(255),
    "status" VARCHAR(30) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SUSPENDED, BLACKLISTED
    "type" VARCHAR(50) DEFAULT 'MAINTENANCE', -- MAINTENANCE, INSPECTION, CALIBRATION, SPECIALIZED, GENERAL
    "rating" DECIMAL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contractor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- Contractor Services
CREATE TABLE IF NOT EXISTS "ContractorService" (
    "id" SERIAL PRIMARY KEY,
    "contractorId" INTEGER NOT NULL,
    "serviceName" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "hourlyRate" DECIMAL,
    "currency" VARCHAR(10) DEFAULT 'ARS',
    "isActive" BOOLEAN DEFAULT true,

    CONSTRAINT "ContractorService_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE
);

-- Contractor Qualifications/Certifications
CREATE TABLE IF NOT EXISTS "ContractorQualification" (
    "id" SERIAL PRIMARY KEY,
    "contractorId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "issuingAuthority" VARCHAR(255),
    "certificateNumber" VARCHAR(100),
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "documentUrl" TEXT,
    "status" VARCHAR(30) DEFAULT 'VALID', -- VALID, EXPIRED, PENDING_RENEWAL

    CONSTRAINT "ContractorQualification_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE
);

-- Contractor Assignments (to work orders)
CREATE TABLE IF NOT EXISTS "ContractorAssignment" (
    "id" SERIAL PRIMARY KEY,
    "contractorId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "serviceId" INTEGER,
    "assignedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "assignedById" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" VARCHAR(30) DEFAULT 'ASSIGNED', -- ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
    "hoursWorked" DECIMAL,
    "totalCost" DECIMAL,
    "invoiceNumber" VARCHAR(100),
    "rating" INTEGER,
    "feedback" TEXT,

    CONSTRAINT "ContractorAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE,
    CONSTRAINT "ContractorAssignment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "ContractorAssignment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ContractorService"("id") ON DELETE SET NULL,
    CONSTRAINT "ContractorAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id")
);

-- ============================================
-- CONDITION MONITORING
-- ============================================

-- Condition Monitor Types/Definitions
CREATE TABLE IF NOT EXISTS "ConditionMonitor" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "componentId" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "monitorType" VARCHAR(50) NOT NULL, -- VIBRATION, TEMPERATURE, PRESSURE, OIL_ANALYSIS, ULTRASOUND, THERMOGRAPHY, CURRENT
    "unit" VARCHAR(50) NOT NULL,
    "normalMin" DECIMAL,
    "normalMax" DECIMAL,
    "warningMin" DECIMAL,
    "warningMax" DECIMAL,
    "criticalMin" DECIMAL,
    "criticalMax" DECIMAL,
    "measurementLocation" VARCHAR(255),
    "measurementFrequency" VARCHAR(50) DEFAULT 'WEEKLY', -- CONTINUOUS, HOURLY, DAILY, WEEKLY, MONTHLY
    "sensorId" VARCHAR(100),
    "isActive" BOOLEAN DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConditionMonitor_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "ConditionMonitor_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL,
    CONSTRAINT "ConditionMonitor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- Condition Readings
CREATE TABLE IF NOT EXISTS "ConditionReading" (
    "id" SERIAL PRIMARY KEY,
    "monitorId" INTEGER NOT NULL,
    "value" DECIMAL NOT NULL,
    "status" VARCHAR(30) DEFAULT 'NORMAL', -- NORMAL, WARNING, CRITICAL, ERROR
    "readingAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "recordedById" INTEGER,
    "source" VARCHAR(50) DEFAULT 'MANUAL', -- MANUAL, AUTOMATIC, IOT
    "notes" TEXT,

    CONSTRAINT "ConditionReading_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "ConditionMonitor"("id") ON DELETE CASCADE,
    CONSTRAINT "ConditionReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id")
);

-- Condition Alerts
CREATE TABLE IF NOT EXISTS "ConditionAlert" (
    "id" SERIAL PRIMARY KEY,
    "monitorId" INTEGER NOT NULL,
    "readingId" INTEGER,
    "alertType" VARCHAR(30) NOT NULL, -- WARNING, CRITICAL
    "value" DECIMAL NOT NULL,
    "threshold" DECIMAL NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" INTEGER,
    "workOrderId" INTEGER,

    CONSTRAINT "ConditionAlert_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "ConditionMonitor"("id") ON DELETE CASCADE,
    CONSTRAINT "ConditionAlert_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "ConditionReading"("id") ON DELETE SET NULL,
    CONSTRAINT "ConditionAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id"),
    CONSTRAINT "ConditionAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id"),
    CONSTRAINT "ConditionAlert_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL
);

-- Condition Trends (aggregated data)
CREATE TABLE IF NOT EXISTS "ConditionTrend" (
    "id" SERIAL PRIMARY KEY,
    "monitorId" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "periodType" VARCHAR(20) NOT NULL, -- HOURLY, DAILY, WEEKLY, MONTHLY
    "avgValue" DECIMAL,
    "minValue" DECIMAL,
    "maxValue" DECIMAL,
    "stdDev" DECIMAL,
    "readingCount" INTEGER,
    "alertCount" INTEGER DEFAULT 0,

    CONSTRAINT "ConditionTrend_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "ConditionMonitor"("id") ON DELETE CASCADE
);

-- ============================================
-- KNOWLEDGE BASE (Enhanced)
-- ============================================

-- Knowledge Articles
CREATE TABLE IF NOT EXISTS "KnowledgeArticle" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "category" VARCHAR(100), -- PROCEDURE, TROUBLESHOOTING, SAFETY, MANUAL, BEST_PRACTICE
    "tags" TEXT[], -- Array of tags
    "machineId" INTEGER,
    "componentId" INTEGER,
    "status" VARCHAR(30) DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, ARCHIVED
    "viewCount" INTEGER DEFAULT 0,
    "helpfulCount" INTEGER DEFAULT 0,
    "authorId" INTEGER NOT NULL,
    "reviewedById" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeArticle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "KnowledgeArticle_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL,
    CONSTRAINT "KnowledgeArticle_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL,
    CONSTRAINT "KnowledgeArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id"),
    CONSTRAINT "KnowledgeArticle_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
);

-- Knowledge Article Attachments
CREATE TABLE IF NOT EXISTS "KnowledgeAttachment" (
    "id" SERIAL PRIMARY KEY,
    "articleId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" VARCHAR(50),
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeAttachment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE
);

-- ============================================
-- INDEXES
-- ============================================

-- Calibration indexes
CREATE INDEX IF NOT EXISTS "Calibration_companyId_idx" ON "Calibration"("companyId");
CREATE INDEX IF NOT EXISTS "Calibration_machineId_idx" ON "Calibration"("machineId");
CREATE INDEX IF NOT EXISTS "Calibration_status_idx" ON "Calibration"("status");
CREATE INDEX IF NOT EXISTS "Calibration_nextCalibrationDate_idx" ON "Calibration"("nextCalibrationDate");
CREATE INDEX IF NOT EXISTS "CalibrationHistory_calibrationId_idx" ON "CalibrationHistory"("calibrationId");

-- Lubrication indexes
CREATE INDEX IF NOT EXISTS "LubricationPoint_companyId_idx" ON "LubricationPoint"("companyId");
CREATE INDEX IF NOT EXISTS "LubricationPoint_machineId_idx" ON "LubricationPoint"("machineId");
CREATE INDEX IF NOT EXISTS "LubricationSchedule_lubricationPointId_idx" ON "LubricationSchedule"("lubricationPointId");
CREATE INDEX IF NOT EXISTS "LubricationSchedule_scheduledDate_idx" ON "LubricationSchedule"("scheduledDate");
CREATE INDEX IF NOT EXISTS "LubricationExecution_lubricationPointId_idx" ON "LubricationExecution"("lubricationPointId");

-- Contractor indexes
CREATE INDEX IF NOT EXISTS "Contractor_companyId_idx" ON "Contractor"("companyId");
CREATE INDEX IF NOT EXISTS "Contractor_status_idx" ON "Contractor"("status");
CREATE INDEX IF NOT EXISTS "ContractorService_contractorId_idx" ON "ContractorService"("contractorId");
CREATE INDEX IF NOT EXISTS "ContractorQualification_contractorId_idx" ON "ContractorQualification"("contractorId");
CREATE INDEX IF NOT EXISTS "ContractorAssignment_contractorId_idx" ON "ContractorAssignment"("contractorId");
CREATE INDEX IF NOT EXISTS "ContractorAssignment_workOrderId_idx" ON "ContractorAssignment"("workOrderId");

-- Condition Monitoring indexes
CREATE INDEX IF NOT EXISTS "ConditionMonitor_companyId_idx" ON "ConditionMonitor"("companyId");
CREATE INDEX IF NOT EXISTS "ConditionMonitor_machineId_idx" ON "ConditionMonitor"("machineId");
CREATE INDEX IF NOT EXISTS "ConditionReading_monitorId_idx" ON "ConditionReading"("monitorId");
CREATE INDEX IF NOT EXISTS "ConditionReading_readingAt_idx" ON "ConditionReading"("readingAt");
CREATE INDEX IF NOT EXISTS "ConditionAlert_monitorId_idx" ON "ConditionAlert"("monitorId");
CREATE INDEX IF NOT EXISTS "ConditionTrend_monitorId_idx" ON "ConditionTrend"("monitorId");
CREATE INDEX IF NOT EXISTS "ConditionTrend_periodStart_idx" ON "ConditionTrend"("periodStart");

-- Knowledge Base indexes
CREATE INDEX IF NOT EXISTS "KnowledgeArticle_companyId_idx" ON "KnowledgeArticle"("companyId");
CREATE INDEX IF NOT EXISTS "KnowledgeArticle_category_idx" ON "KnowledgeArticle"("category");
CREATE INDEX IF NOT EXISTS "KnowledgeArticle_status_idx" ON "KnowledgeArticle"("status");
CREATE INDEX IF NOT EXISTS "KnowledgeArticle_slug_idx" ON "KnowledgeArticle"("slug");
CREATE INDEX IF NOT EXISTS "KnowledgeAttachment_articleId_idx" ON "KnowledgeAttachment"("articleId");
