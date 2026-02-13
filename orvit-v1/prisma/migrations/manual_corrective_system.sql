-- =====================================================
-- MIGRACIÓN MANUAL: Sistema Profesional de Correctivo
-- Ejecutar en el orden indicado
-- =====================================================

-- =====================================================
-- PASO 1: Crear ENUMS
-- =====================================================

-- DowntimeCategory
DO $$ BEGIN
  CREATE TYPE "DowntimeCategory" AS ENUM ('UNPLANNED', 'PLANNED', 'EXTERNAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- FailureOccurrenceStatus
DO $$ BEGIN
  CREATE TYPE "FailureOccurrenceStatus" AS ENUM ('REPORTED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED', 'RESOLVED_IMMEDIATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- WorkOrderOrigin
DO $$ BEGIN
  CREATE TYPE "WorkOrderOrigin" AS ENUM ('FAILURE', 'REQUEST', 'MANUAL', 'PREVENTIVE', 'PREDICTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AssetCriticality
DO $$ BEGIN
  CREATE TYPE "AssetCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- QAStatus
DO $$ BEGIN
  CREATE TYPE "QAStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED_TO_PRODUCTION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- EvidenceLevel
DO $$ BEGIN
  CREATE TYPE "EvidenceLevel" AS ENUM ('OPTIONAL', 'BASIC', 'STANDARD', 'COMPLETE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- SolutionOutcome
DO $$ BEGIN
  CREATE TYPE "SolutionOutcome" AS ENUM ('FUNCIONÓ', 'PARCIAL', 'NO_FUNCIONÓ');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- FixType
DO $$ BEGIN
  CREATE TYPE "FixType" AS ENUM ('PARCHE', 'DEFINITIVA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- TemplateType
DO $$ BEGIN
  CREATE TYPE "TemplateType" AS ENUM ('QUICK_CLOSE', 'WORK_ORDER', 'SOLUTION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- PASO 2: Extender FailureOccurrence con nuevos campos
-- =====================================================

-- Agregar companyId si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'companyId') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Agregar subcomponentId
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'subcomponentId') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "subcomponentId" INTEGER;
  END IF;
END $$;

-- Agregar campos de estado y flags
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'isIntermittent') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "isIntermittent" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'isObservation') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "isObservation" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'causedDowntime') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "causedDowntime" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Agregar campos de vinculación de duplicados
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'linkedToOccurrenceId') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "linkedToOccurrenceId" INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'linkedAt') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "linkedAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'linkedById') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "linkedById" INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'linkedReason') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "linkedReason" VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'isLinkedDuplicate') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "isLinkedDuplicate" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Agregar campos de reapertura
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'reopenedFrom') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "reopenedFrom" INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'reopenReason') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "reopenReason" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'reopenedAt') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "reopenedAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'reopenedById') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "reopenedById" INTEGER;
  END IF;
END $$;

-- Agregar resolvedImmediately
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'resolvedImmediately') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "resolvedImmediately" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Agregar symptoms (JSON)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'symptoms') THEN
    ALTER TABLE "failure_occurrences" ADD COLUMN "symptoms" JSONB;
  END IF;
END $$;

-- =====================================================
-- PASO 3: Extender WorkOrder con nuevos campos
-- =====================================================

-- Agregar origin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'origin') THEN
    ALTER TABLE "work_orders" ADD COLUMN "origin" "WorkOrderOrigin" DEFAULT 'MANUAL';
  END IF;
END $$;

-- Agregar campos de espera (waiting)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'waitingReason') THEN
    ALTER TABLE "work_orders" ADD COLUMN "waitingReason" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'waitingDescription') THEN
    ALTER TABLE "work_orders" ADD COLUMN "waitingDescription" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'waitingETA') THEN
    ALTER TABLE "work_orders" ADD COLUMN "waitingETA" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'waitingSince') THEN
    ALTER TABLE "work_orders" ADD COLUMN "waitingSince" TIMESTAMP(3);
  END IF;
END $$;

-- Agregar campos de cierre guiado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'closingMode') THEN
    ALTER TABLE "work_orders" ADD COLUMN "closingMode" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'diagnosisNotes') THEN
    ALTER TABLE "work_orders" ADD COLUMN "diagnosisNotes" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'workPerformedNotes') THEN
    ALTER TABLE "work_orders" ADD COLUMN "workPerformedNotes" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'resultNotes') THEN
    ALTER TABLE "work_orders" ADD COLUMN "resultNotes" TEXT;
  END IF;
END $$;

-- Agregar isSafetyRelated
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'isSafetyRelated') THEN
    ALTER TABLE "work_orders" ADD COLUMN "isSafetyRelated" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Agregar assetCriticality
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'assetCriticality') THEN
    ALTER TABLE "work_orders" ADD COLUMN "assetCriticality" "AssetCriticality";
  END IF;
END $$;

-- Agregar campos de retorno a producción
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'requiresReturnToProduction') THEN
    ALTER TABLE "work_orders" ADD COLUMN "requiresReturnToProduction" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'returnToProductionConfirmed') THEN
    ALTER TABLE "work_orders" ADD COLUMN "returnToProductionConfirmed" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Agregar fromTemplate
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'fromTemplate') THEN
    ALTER TABLE "work_orders" ADD COLUMN "fromTemplate" INTEGER;
  END IF;
END $$;

-- =====================================================
-- PASO 4: Crear nuevas tablas
-- =====================================================

-- SymptomLibrary
CREATE TABLE IF NOT EXISTS "symptom_library" (
  "id" SERIAL NOT NULL,
  "title" VARCHAR(100) NOT NULL,
  "keywords" JSONB NOT NULL,
  "shortNote" VARCHAR(255),
  "componentId" INTEGER,
  "subcomponentId" INTEGER,
  "machineId" INTEGER,
  "companyId" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "symptom_library_pkey" PRIMARY KEY ("id")
);

-- DowntimeLog
CREATE TABLE IF NOT EXISTS "downtime_logs" (
  "id" SERIAL NOT NULL,
  "failureOccurrenceId" INTEGER NOT NULL,
  "workOrderId" INTEGER,
  "machineId" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "returnToProductionBy" INTEGER,
  "returnToProductionAt" TIMESTAMP(3),
  "totalMinutes" INTEGER,
  "category" "DowntimeCategory" NOT NULL DEFAULT 'UNPLANNED',
  "reason" TEXT,
  "productionImpact" TEXT,
  "companyId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "downtime_logs_pkey" PRIMARY KEY ("id")
);

-- WorkLog
CREATE TABLE IF NOT EXISTS "work_logs" (
  "id" SERIAL NOT NULL,
  "workOrderId" INTEGER NOT NULL,
  "performedById" INTEGER NOT NULL,
  "performedByType" TEXT NOT NULL DEFAULT 'USER',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "actualMinutes" INTEGER,
  "description" TEXT,
  "activityType" TEXT NOT NULL DEFAULT 'EXECUTION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id")
);

-- Template
CREATE TABLE IF NOT EXISTS "templates" (
  "id" SERIAL NOT NULL,
  "type" "TemplateType" NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "content" JSONB NOT NULL,
  "componentId" INTEGER,
  "machineId" INTEGER,
  "areaId" INTEGER,
  "companyId" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- QualityAssurance
CREATE TABLE IF NOT EXISTS "quality_assurance" (
  "id" SERIAL NOT NULL,
  "workOrderId" INTEGER NOT NULL UNIQUE,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "requiredReason" TEXT,
  "verifiedById" INTEGER,
  "verifiedAt" TIMESTAMP(3),
  "status" "QAStatus" NOT NULL DEFAULT 'PENDING',
  "checklist" JSONB,
  "notes" TEXT,
  "returnToProductionConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "returnConfirmedById" INTEGER,
  "returnConfirmedAt" TIMESTAMP(3),
  "evidenceRequired" "EvidenceLevel" NOT NULL DEFAULT 'OPTIONAL',
  "evidenceProvided" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quality_assurance_pkey" PRIMARY KEY ("id")
);

-- FailureWatcher
CREATE TABLE IF NOT EXISTS "failure_watchers" (
  "id" SERIAL NOT NULL,
  "failureOccurrenceId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "failure_watchers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "failure_watchers_failureOccurrenceId_userId_key" UNIQUE("failureOccurrenceId", "userId")
);

-- SolutionApplied
CREATE TABLE IF NOT EXISTS "solutions_applied" (
  "id" SERIAL NOT NULL,
  "failureOccurrenceId" INTEGER NOT NULL,
  "workOrderId" INTEGER,
  "diagnosis" TEXT NOT NULL,
  "solution" TEXT NOT NULL,
  "outcome" "SolutionOutcome" NOT NULL,
  "performedById" INTEGER NOT NULL,
  "performedByIds" JSONB,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualMinutes" INTEGER,
  "finalComponentId" INTEGER,
  "finalSubcomponentId" INTEGER,
  "confirmedCause" VARCHAR(255),
  "fixType" "FixType" NOT NULL DEFAULT 'DEFINITIVA',
  "templateUsedId" INTEGER,
  "sourceSolutionId" INTEGER,
  "toolsUsed" JSONB,
  "sparePartsUsed" JSONB,
  "effectiveness" INTEGER,
  "attachments" JSONB,
  "notes" TEXT,
  "companyId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "solutions_applied_pkey" PRIMARY KEY ("id")
);

-- CorrectiveSettings
CREATE TABLE IF NOT EXISTS "corrective_settings" (
  "id" SERIAL NOT NULL,
  "companyId" INTEGER NOT NULL UNIQUE,
  "duplicateWindowHours" INTEGER NOT NULL DEFAULT 48,
  "recurrenceWindowDays" INTEGER NOT NULL DEFAULT 7,
  "downtimeQaThresholdMin" INTEGER NOT NULL DEFAULT 60,
  "slaP1Hours" INTEGER NOT NULL DEFAULT 4,
  "slaP2Hours" INTEGER NOT NULL DEFAULT 8,
  "slaP3Hours" INTEGER NOT NULL DEFAULT 24,
  "slaP4Hours" INTEGER NOT NULL DEFAULT 72,
  "requireEvidenceP3" BOOLEAN NOT NULL DEFAULT true,
  "requireEvidenceP2" BOOLEAN NOT NULL DEFAULT true,
  "requireEvidenceP1" BOOLEAN NOT NULL DEFAULT true,
  "requireReturnConfirmationOnDowntime" BOOLEAN NOT NULL DEFAULT true,
  "requireReturnConfirmationOnQA" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "corrective_settings_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- PASO 5: Crear índices de performance
-- =====================================================

-- FailureOccurrence indexes
CREATE INDEX IF NOT EXISTS "failure_occurrences_status_idx" ON "failure_occurrences"("status");
CREATE INDEX IF NOT EXISTS "failure_occurrences_linkedToOccurrenceId_idx" ON "failure_occurrences"("linkedToOccurrenceId");
CREATE INDEX IF NOT EXISTS "failure_occurrences_isLinkedDuplicate_idx" ON "failure_occurrences"("isLinkedDuplicate");
CREATE INDEX IF NOT EXISTS "failure_occurrences_isIntermittent_idx" ON "failure_occurrences"("isIntermittent");
CREATE INDEX IF NOT EXISTS "failure_occurrences_causedDowntime_idx" ON "failure_occurrences"("causedDowntime");
CREATE INDEX IF NOT EXISTS "failure_occurrences_companyId_status_reportedAt_idx" ON "failure_occurrences"("companyId", "status", "reportedAt");
CREATE INDEX IF NOT EXISTS "failure_occurrences_companyId_machineId_status_idx" ON "failure_occurrences"("companyId", "machineId", "status");
CREATE INDEX IF NOT EXISTS "failure_occurrences_companyId_machineId_subcomponentId_reportedAt_idx" ON "failure_occurrences"("companyId", "machineId", "subcomponentId", "reportedAt");

-- WorkOrder indexes
CREATE INDEX IF NOT EXISTS "work_orders_origin_idx" ON "work_orders"("origin");
CREATE INDEX IF NOT EXISTS "work_orders_waitingReason_idx" ON "work_orders"("waitingReason");
CREATE INDEX IF NOT EXISTS "work_orders_isSafetyRelated_idx" ON "work_orders"("isSafetyRelated");

-- SymptomLibrary indexes
CREATE INDEX IF NOT EXISTS "symptom_library_companyId_componentId_idx" ON "symptom_library"("companyId", "componentId");
CREATE INDEX IF NOT EXISTS "symptom_library_companyId_subcomponentId_idx" ON "symptom_library"("companyId", "subcomponentId");

-- DowntimeLog indexes
CREATE INDEX IF NOT EXISTS "downtime_logs_failureOccurrenceId_idx" ON "downtime_logs"("failureOccurrenceId");
CREATE INDEX IF NOT EXISTS "downtime_logs_machineId_startedAt_idx" ON "downtime_logs"("machineId", "startedAt");
CREATE INDEX IF NOT EXISTS "downtime_logs_companyId_machineId_startedAt_idx" ON "downtime_logs"("companyId", "machineId", "startedAt");
CREATE INDEX IF NOT EXISTS "downtime_logs_workOrderId_endedAt_idx" ON "downtime_logs"("workOrderId", "endedAt");

-- WorkLog indexes
CREATE INDEX IF NOT EXISTS "work_logs_workOrderId_idx" ON "work_logs"("workOrderId");
CREATE INDEX IF NOT EXISTS "work_logs_performedById_startedAt_idx" ON "work_logs"("performedById", "startedAt");

-- Template indexes
CREATE INDEX IF NOT EXISTS "templates_companyId_type_idx" ON "templates"("companyId", "type");
CREATE INDEX IF NOT EXISTS "templates_componentId_idx" ON "templates"("componentId");

-- QualityAssurance indexes
CREATE INDEX IF NOT EXISTS "quality_assurance_workOrderId_idx" ON "quality_assurance"("workOrderId");
CREATE INDEX IF NOT EXISTS "quality_assurance_status_idx" ON "quality_assurance"("status");

-- FailureWatcher indexes
CREATE INDEX IF NOT EXISTS "failure_watchers_userId_idx" ON "failure_watchers"("userId");

-- SolutionApplied indexes
CREATE INDEX IF NOT EXISTS "solutions_applied_failureOccurrenceId_idx" ON "solutions_applied"("failureOccurrenceId");
CREATE INDEX IF NOT EXISTS "solutions_applied_workOrderId_idx" ON "solutions_applied"("workOrderId");
CREATE INDEX IF NOT EXISTS "solutions_applied_performedById_performedAt_idx" ON "solutions_applied"("performedById", "performedAt");
CREATE INDEX IF NOT EXISTS "solutions_applied_companyId_performedAt_idx" ON "solutions_applied"("companyId", "performedAt");
CREATE INDEX IF NOT EXISTS "solutions_applied_finalSubcomponentId_effectiveness_idx" ON "solutions_applied"("finalSubcomponentId", "effectiveness");
CREATE INDEX IF NOT EXISTS "solutions_applied_companyId_finalSubcomponentId_performedAt_idx" ON "solutions_applied"("companyId", "finalSubcomponentId", "performedAt");

-- =====================================================
-- PASO 6: Agregar Foreign Keys
-- =====================================================

-- FailureOccurrence FKs (solo las nuevas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrences_companyId_fkey') THEN
    ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrences_linkedToOccurrenceId_fkey') THEN
    ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_linkedToOccurrenceId_fkey"
    FOREIGN KEY ("linkedToOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrences_linkedById_fkey') THEN
    ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_linkedById_fkey"
    FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- DowntimeLog FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'downtime_logs_failureOccurrenceId_fkey') THEN
    ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_failureOccurrenceId_fkey"
    FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'downtime_logs_workOrderId_fkey') THEN
    ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'downtime_logs_machineId_fkey') THEN
    ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_machineId_fkey"
    FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'downtime_logs_companyId_fkey') THEN
    ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- WorkLog FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'work_logs_workOrderId_fkey') THEN
    ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'work_logs_performedById_fkey') THEN
    ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Template FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'templates_companyId_fkey') THEN
    ALTER TABLE "templates" ADD CONSTRAINT "templates_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'templates_createdById_fkey') THEN
    ALTER TABLE "templates" ADD CONSTRAINT "templates_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- QualityAssurance FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'quality_assurance_workOrderId_fkey') THEN
    ALTER TABLE "quality_assurance" ADD CONSTRAINT "quality_assurance_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'quality_assurance_verifiedById_fkey') THEN
    ALTER TABLE "quality_assurance" ADD CONSTRAINT "quality_assurance_verifiedById_fkey"
    FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- FailureWatcher FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_watchers_failureOccurrenceId_fkey') THEN
    ALTER TABLE "failure_watchers" ADD CONSTRAINT "failure_watchers_failureOccurrenceId_fkey"
    FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_watchers_userId_fkey') THEN
    ALTER TABLE "failure_watchers" ADD CONSTRAINT "failure_watchers_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- SolutionApplied FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'solutions_applied_failureOccurrenceId_fkey') THEN
    ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_failureOccurrenceId_fkey"
    FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'solutions_applied_workOrderId_fkey') THEN
    ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'solutions_applied_performedById_fkey') THEN
    ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'solutions_applied_templateUsedId_fkey') THEN
    ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_templateUsedId_fkey"
    FOREIGN KEY ("templateUsedId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'solutions_applied_companyId_fkey') THEN
    ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CorrectiveSettings FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'corrective_settings_companyId_fkey') THEN
    ALTER TABLE "corrective_settings" ADD CONSTRAINT "corrective_settings_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- SymptomLibrary FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'symptom_library_companyId_fkey') THEN
    ALTER TABLE "symptom_library" ADD CONSTRAINT "symptom_library_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- =====================================================
-- FINALIZADO: Sistema Profesional de Correctivo
-- =====================================================
