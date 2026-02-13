-- Production Module - All Production Tables
-- Creates work_centers, work_shifts, production_orders, daily_production_reports,
-- production_downtimes, production_quality_controls, production_defects,
-- production_batch_lots, production_events, production_routine_templates,
-- production_routines, production_reason_codes

-- ============================================
-- WORK SHIFTS (Turnos)
-- ============================================
CREATE TABLE IF NOT EXISTS "work_shifts" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) DEFAULT 'MORNING',
    "startTime" VARCHAR(10) NOT NULL,
    "endTime" VARCHAR(10) NOT NULL,
    "breakMinutes" INTEGER DEFAULT 30,
    "isActive" BOOLEAN DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_shifts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "work_shifts_companyId_code_key" ON "work_shifts"("companyId", "code");

-- ============================================
-- WORK CENTERS (Centros de Trabajo)
-- ============================================
CREATE TABLE IF NOT EXISTS "work_centers" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "parentId" INTEGER,
    "theoreticalCapacity" DECIMAL(12, 4),
    "capacityUnit" VARCHAR(50),
    "standardCycleSeconds" INTEGER,
    "standardSetupMinutes" INTEGER,
    "status" VARCHAR(30) DEFAULT 'ACTIVE',
    "machineId" INTEGER,
    "lineId" VARCHAR(255),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_centers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "work_centers_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "work_centers"("id") ON DELETE SET NULL,
    CONSTRAINT "work_centers_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL,
    CONSTRAINT "work_centers_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "work_centers_companyId_code_key" ON "work_centers"("companyId", "code");
CREATE INDEX IF NOT EXISTS "work_centers_companyId_type_status_idx" ON "work_centers"("companyId", "type", "status");

-- ============================================
-- PRODUCTION REASON CODES (Codigos de Motivo)
-- ============================================
CREATE TABLE IF NOT EXISTS "production_reason_codes" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "parentId" INTEGER,
    "requiresNote" BOOLEAN DEFAULT false,
    "triggersMaintenance" BOOLEAN DEFAULT false,
    "affectsOEE" BOOLEAN DEFAULT true,
    "sortOrder" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_reason_codes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "production_reason_codes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "production_reason_codes"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "production_reason_codes_companyId_code_key" ON "production_reason_codes"("companyId", "code");
CREATE INDEX IF NOT EXISTS "production_reason_codes_companyId_type_isActive_idx" ON "production_reason_codes"("companyId", "type", "isActive");

-- ============================================
-- PRODUCTION ORDERS (Ordenes de Produccion)
-- ============================================
CREATE TABLE IF NOT EXISTS "production_orders" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "productId" VARCHAR(255) NOT NULL,
    "productVariantId" VARCHAR(255),
    "recipeId" VARCHAR(255),
    "plannedQuantity" DECIMAL(12, 4) NOT NULL,
    "producedQuantity" DECIMAL(12, 4) DEFAULT 0,
    "scrapQuantity" DECIMAL(12, 4) DEFAULT 0,
    "reworkQuantity" DECIMAL(12, 4) DEFAULT 0,
    "targetUom" VARCHAR(50) NOT NULL,
    "plannedCycleTimeSec" INTEGER,
    "plannedSetupMinutes" INTEGER,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "workCenterId" INTEGER,
    "sectorId" INTEGER,
    "responsibleId" INTEGER,
    "status" VARCHAR(30) DEFAULT 'DRAFT',
    "priority" VARCHAR(30) DEFAULT 'NORMAL',
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "production_orders_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL,
    CONSTRAINT "production_orders_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL,
    CONSTRAINT "production_orders_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL,
    CONSTRAINT "production_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "production_orders_companyId_code_key" ON "production_orders"("companyId", "code");
CREATE INDEX IF NOT EXISTS "production_orders_companyId_status_idx" ON "production_orders"("companyId", "status");
CREATE INDEX IF NOT EXISTS "production_orders_productId_idx" ON "production_orders"("productId");
CREATE INDEX IF NOT EXISTS "production_orders_workCenterId_idx" ON "production_orders"("workCenterId");

-- ============================================
-- DAILY PRODUCTION REPORTS (Partes Diarios)
-- ============================================
CREATE TABLE IF NOT EXISTS "daily_production_reports" (
    "id" SERIAL PRIMARY KEY,
    "date" DATE NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "productionOrderId" INTEGER,
    "workCenterId" INTEGER,
    "operatorId" INTEGER NOT NULL,
    "supervisorId" INTEGER,
    "teamSize" INTEGER,
    "crewMembers" JSONB,
    "goodQuantity" DECIMAL(12, 4) NOT NULL,
    "scrapQuantity" DECIMAL(12, 4) DEFAULT 0,
    "reworkQuantity" DECIMAL(12, 4) DEFAULT 0,
    "uom" VARCHAR(50) NOT NULL,
    "variantBreakdown" JSONB,
    "shiftDurationMinutes" INTEGER NOT NULL,
    "productiveMinutes" INTEGER NOT NULL,
    "downtimeMinutes" INTEGER DEFAULT 0,
    "setupMinutes" INTEGER DEFAULT 0,
    "observations" TEXT,
    "issues" TEXT,
    "attachmentUrls" JSONB,
    "isConfirmed" BOOLEAN DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" INTEGER,
    "isReviewed" BOOLEAN DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "reviewNotes" TEXT,
    "offlineId" VARCHAR(255),
    "syncedAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_production_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "daily_production_reports_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "work_shifts"("id"),
    CONSTRAINT "daily_production_reports_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "daily_production_reports_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL,
    CONSTRAINT "daily_production_reports_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id"),
    CONSTRAINT "daily_production_reports_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id"),
    CONSTRAINT "daily_production_reports_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id"),
    CONSTRAINT "daily_production_reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_production_reports_companyId_offlineId_key" ON "daily_production_reports"("companyId", "offlineId");
CREATE INDEX IF NOT EXISTS "daily_production_reports_companyId_date_idx" ON "daily_production_reports"("companyId", "date");
CREATE INDEX IF NOT EXISTS "daily_production_reports_productionOrderId_idx" ON "daily_production_reports"("productionOrderId");

-- ============================================
-- PRODUCTION DOWNTIMES (Paradas)
-- ============================================
CREATE TABLE IF NOT EXISTS "production_downtimes" (
    "id" SERIAL PRIMARY KEY,
    "dailyReportId" INTEGER,
    "productionOrderId" INTEGER,
    "shiftId" INTEGER,
    "workCenterId" INTEGER,
    "machineId" INTEGER,
    "type" VARCHAR(30) NOT NULL,
    "reasonCodeId" INTEGER,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "affectsLine" BOOLEAN DEFAULT true,
    "isMicrostop" BOOLEAN DEFAULT false,
    "detectedBy" VARCHAR(30) DEFAULT 'MANUAL',
    "workOrderId" INTEGER,
    "failureOccurrenceId" INTEGER,
    "qualityHoldId" INTEGER,
    "reportedById" INTEGER NOT NULL,
    "offlineId" VARCHAR(255),
    "syncedAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_downtimes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "production_downtimes_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_production_reports"("id") ON DELETE SET NULL,
    CONSTRAINT "production_downtimes_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "production_downtimes_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "work_shifts"("id") ON DELETE SET NULL,
    CONSTRAINT "production_downtimes_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL,
    CONSTRAINT "production_downtimes_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL,
    CONSTRAINT "production_downtimes_reasonCodeId_fkey" FOREIGN KEY ("reasonCodeId") REFERENCES "production_reason_codes"("id") ON DELETE SET NULL,
    CONSTRAINT "production_downtimes_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "production_downtimes_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "production_downtimes_companyId_offlineId_key" ON "production_downtimes"("companyId", "offlineId");
CREATE INDEX IF NOT EXISTS "production_downtimes_companyId_startTime_idx" ON "production_downtimes"("companyId", "startTime");
CREATE INDEX IF NOT EXISTS "production_downtimes_reasonCodeId_idx" ON "production_downtimes"("reasonCodeId");
CREATE INDEX IF NOT EXISTS "production_downtimes_workOrderId_idx" ON "production_downtimes"("workOrderId");

-- ============================================
-- PRODUCTION BATCH LOTS (Lotes)
-- ============================================
CREATE TABLE IF NOT EXISTS "production_batch_lots" (
    "id" SERIAL PRIMARY KEY,
    "lotCode" VARCHAR(100) NOT NULL,
    "productionOrderId" INTEGER NOT NULL,
    "quantity" DECIMAL(12, 4) NOT NULL,
    "uom" VARCHAR(50) NOT NULL,
    "qualityStatus" VARCHAR(30) DEFAULT 'PENDING',
    "blockedReason" TEXT,
    "blockedAt" TIMESTAMP(3),
    "blockedById" INTEGER,
    "releasedAt" TIMESTAMP(3),
    "releasedById" INTEGER,
    "productionDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "rawMaterialLots" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_batch_lots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "production_batch_lots_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id"),
    CONSTRAINT "production_batch_lots_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id"),
    CONSTRAINT "production_batch_lots_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "production_batch_lots_companyId_lotCode_key" ON "production_batch_lots"("companyId", "lotCode");
CREATE INDEX IF NOT EXISTS "production_batch_lots_qualityStatus_idx" ON "production_batch_lots"("qualityStatus");

-- ============================================
-- PRODUCTION QUALITY CONTROLS (Control de Calidad)
-- ============================================
CREATE TABLE IF NOT EXISTS "production_quality_controls" (
    "id" SERIAL PRIMARY KEY,
    "dailyReportId" INTEGER,
    "productionOrderId" INTEGER,
    "batchLotId" INTEGER,
    "controlType" VARCHAR(50) NOT NULL,
    "parameter" VARCHAR(255),
    "expectedValue" VARCHAR(255),
    "actualValue" VARCHAR(255),
    "unit" VARCHAR(50),
    "result" VARCHAR(30) NOT NULL,
    "rejectionReason" TEXT,
    "inspectedById" INTEGER NOT NULL,
    "inspectedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "attachmentUrls" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_quality_controls_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "production_quality_controls_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_production_reports"("id") ON DELETE SET NULL,
    CONSTRAINT "production_quality_controls_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "production_quality_controls_batchLotId_fkey" FOREIGN KEY ("batchLotId") REFERENCES "production_batch_lots"("id") ON DELETE SET NULL,
    CONSTRAINT "production_quality_controls_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "User"("id")
);

CREATE INDEX IF NOT EXISTS "production_quality_controls_productionOrderId_idx" ON "production_quality_controls"("productionOrderId");
CREATE INDEX IF NOT EXISTS "production_quality_controls_batchLotId_idx" ON "production_quality_controls"("batchLotId");
CREATE INDEX IF NOT EXISTS "production_quality_controls_result_idx" ON "production_quality_controls"("result");

-- ============================================
-- PRODUCTION DEFECTS (Defectos)
-- ============================================
CREATE TABLE IF NOT EXISTS "production_defects" (
    "id" SERIAL PRIMARY KEY,
    "dailyReportId" INTEGER,
    "productionOrderId" INTEGER,
    "batchLotId" INTEGER,
    "reasonCodeId" INTEGER NOT NULL,
    "quantity" DECIMAL(12, 4) NOT NULL,
    "uom" VARCHAR(50) NOT NULL,
    "disposition" VARCHAR(30) DEFAULT 'SCRAP',
    "description" TEXT,
    "attachmentUrls" JSONB,
    "reportedById" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_defects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "production_defects_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_production_reports"("id") ON DELETE SET NULL,
    CONSTRAINT "production_defects_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "production_defects_batchLotId_fkey" FOREIGN KEY ("batchLotId") REFERENCES "production_batch_lots"("id") ON DELETE SET NULL,
    CONSTRAINT "production_defects_reasonCodeId_fkey" FOREIGN KEY ("reasonCodeId") REFERENCES "production_reason_codes"("id"),
    CONSTRAINT "production_defects_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id")
);

CREATE INDEX IF NOT EXISTS "production_defects_productionOrderId_idx" ON "production_defects"("productionOrderId");
CREATE INDEX IF NOT EXISTS "production_defects_reasonCodeId_idx" ON "production_defects"("reasonCodeId");

-- ============================================
-- PRODUCTION EVENTS (Bitacora)
-- ============================================
CREATE TABLE IF NOT EXISTS "production_events" (
    "id" SERIAL PRIMARY KEY,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "notes" TEXT,
    "performedById" INTEGER NOT NULL,
    "performedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "productionOrderId" INTEGER,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "production_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "production_events_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id"),
    CONSTRAINT "production_events_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "production_events_entityType_entityId_idx" ON "production_events"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "production_events_productionOrderId_idx" ON "production_events"("productionOrderId");
CREATE INDEX IF NOT EXISTS "production_events_performedAt_idx" ON "production_events"("performedAt");

-- ============================================
-- PRODUCTION ROUTINE TEMPLATES (Plantillas de Rutinas)
-- ============================================
CREATE TABLE IF NOT EXISTS "production_routine_templates" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "workCenterId" INTEGER,
    "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "frequency" VARCHAR(30) DEFAULT 'EVERY_SHIFT',
    "isActive" BOOLEAN DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_routine_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "production_routine_templates_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "production_routine_templates_companyId_code_key" ON "production_routine_templates"("companyId", "code");

-- ============================================
-- PRODUCTION ROUTINES (Ejecucion de Rutinas)
-- ============================================
CREATE TABLE IF NOT EXISTS "production_routines" (
    "id" SERIAL PRIMARY KEY,
    "templateId" INTEGER NOT NULL,
    "workCenterId" INTEGER,
    "shiftId" INTEGER,
    "date" DATE NOT NULL,
    "responses" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "hasIssues" BOOLEAN DEFAULT false,
    "issueDescription" TEXT,
    "linkedDowntimeId" INTEGER,
    "linkedWorkOrderId" INTEGER,
    "executedById" INTEGER NOT NULL,
    "executedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "production_routines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "production_routines_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "production_routine_templates"("id"),
    CONSTRAINT "production_routines_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL,
    CONSTRAINT "production_routines_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "work_shifts"("id") ON DELETE SET NULL,
    CONSTRAINT "production_routines_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id")
);

CREATE INDEX IF NOT EXISTS "production_routines_companyId_date_idx" ON "production_routines"("companyId", "date");
CREATE INDEX IF NOT EXISTS "production_routines_templateId_idx" ON "production_routines"("templateId");

-- ============================================
-- PRESTRESSED MOLDS (Extension Pretensados)
-- ============================================
CREATE TABLE IF NOT EXISTS "prestressed_molds" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "moldType" VARCHAR(50) NOT NULL,
    "lengthMeters" DECIMAL(8, 2) NOT NULL,
    "widthMeters" DECIMAL(8, 2) NOT NULL,
    "maxCables" INTEGER NOT NULL,
    "maxTensionKN" DECIMAL(10, 2),
    "status" VARCHAR(30) DEFAULT 'AVAILABLE',
    "currentOrderId" INTEGER,
    "workCenterId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prestressed_molds_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "prestressed_molds_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "prestressed_molds_companyId_code_key" ON "prestressed_molds"("companyId", "code");

-- ============================================
-- CURING RECORDS (Registros de Curado)
-- ============================================
CREATE TABLE IF NOT EXISTS "curing_records" (
    "id" SERIAL PRIMARY KEY,
    "productionOrderId" INTEGER NOT NULL,
    "moldId" INTEGER NOT NULL,
    "batchLotId" INTEGER,
    "castingDateTime" TIMESTAMP(3) NOT NULL,
    "curingStartDateTime" TIMESTAMP(3),
    "curingEndDateTime" TIMESTAMP(3),
    "demoldingDateTime" TIMESTAMP(3),
    "ambientTemp" DECIMAL(5, 2),
    "concreteTemp" DECIMAL(5, 2),
    "humidity" DECIMAL(5, 2),
    "steamCuringUsed" BOOLEAN DEFAULT false,
    "steamTemp" DECIMAL(5, 2),
    "targetStrengthMPa" DECIMAL(8, 2),
    "actualStrengthMPa" DECIMAL(8, 2),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curing_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "curing_records_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id"),
    CONSTRAINT "curing_records_moldId_fkey" FOREIGN KEY ("moldId") REFERENCES "prestressed_molds"("id")
);

CREATE INDEX IF NOT EXISTS "curing_records_productionOrderId_idx" ON "curing_records"("productionOrderId");
CREATE INDEX IF NOT EXISTS "curing_records_moldId_idx" ON "curing_records"("moldId");
