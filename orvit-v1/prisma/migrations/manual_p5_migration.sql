-- ============================================================
-- MIGRACIÓN P5: Modelos de Mantenimiento Correctivo Profesional
-- Fecha: 2026-01-03
-- Descripción:
--   1. Hacer failureId opcional en FailureOccurrence (para observaciones)
--   2. Crear tabla FailureOccurrenceEvent (normalizada, no JSON)
--   3. Crear tabla ActivityEvent (timeline unificado)
--   4. Crear tabla RootCauseAnalysis (5-Whys)
--   5. Crear tabla CorrectiveChecklistTemplate
--   6. Crear tabla WorkOrderChecklist
--
-- NOTA: Los nombres de tablas usan PascalCase según el schema Prisma:
--   - "Company" (no "companies")
--   - "User" (no "users")
--   - "Machine" (no "machines")
--   - "Component" (no "components")
--   - "work_orders" (snake_case)
--   - "failure_occurrences" (snake_case)
-- ============================================================

-- ============================================================
-- 1. Hacer failureId OPCIONAL en failure_occurrences
--    (Permite observaciones sin WorkOrder)
-- ============================================================
ALTER TABLE "failure_occurrences"
ALTER COLUMN "failureId" DROP NOT NULL;

-- ============================================================
-- 2. Crear tabla failure_occurrence_events
--    (Eventos "pasó otra vez" - normalizado)
-- ============================================================
CREATE TABLE IF NOT EXISTS "failure_occurrence_events" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "failureOccurrenceId" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "causedDowntime" BOOLEAN NOT NULL DEFAULT false,
  "isSafetyRelated" BOOLEAN NOT NULL DEFAULT false,
  "isIntermittent" BOOLEAN NOT NULL DEFAULT false,
  "workOrderId" INTEGER,
  "symptoms" JSONB,
  "attachments" JSONB,

  CONSTRAINT "failure_occurrence_events_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "failure_occurrence_events_failureOccurrenceId_fkey"
    FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE,
  CONSTRAINT "failure_occurrence_events_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id"),
  CONSTRAINT "failure_occurrence_events_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL
);

CREATE INDEX "fo_events_company_fo_occurred_idx"
  ON "failure_occurrence_events"("companyId", "failureOccurrenceId", "occurredAt");
CREATE INDEX "fo_events_workorder_idx"
  ON "failure_occurrence_events"("workOrderId");

-- ============================================================
-- 3. Crear tabla activity_events (Timeline unificado)
-- ============================================================
CREATE TABLE IF NOT EXISTS "activity_events" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eventType" VARCHAR(50) NOT NULL,
  "entityType" VARCHAR(30) NOT NULL,
  "entityId" INTEGER NOT NULL,
  "previousValue" VARCHAR(255),
  "newValue" VARCHAR(255),
  "metadata" JSONB,
  "performedById" INTEGER,

  CONSTRAINT "activity_events_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "activity_events_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "activity_events_company_entity_idx"
  ON "activity_events"("companyId", "entityType", "entityId");
CREATE INDEX "activity_events_occurred_idx"
  ON "activity_events"("occurredAt");
CREATE INDEX "activity_events_entity_occurred_idx"
  ON "activity_events"("entityType", "entityId", "occurredAt");

-- ============================================================
-- 4. Crear tabla root_cause_analyses (RCA - 5 Whys)
-- ============================================================
CREATE TABLE IF NOT EXISTS "root_cause_analyses" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "workOrderId" INTEGER UNIQUE,
  "failureOccurrenceId" INTEGER UNIQUE,
  "whys" JSONB NOT NULL DEFAULT '[]',
  "rootCause" TEXT,
  "conclusion" TEXT,
  "correctiveActions" JSONB,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

  CONSTRAINT "root_cause_analyses_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "root_cause_analyses_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE,
  CONSTRAINT "root_cause_analyses_failureOccurrenceId_fkey"
    FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE,
  CONSTRAINT "root_cause_analyses_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
);

CREATE INDEX "rca_company_workorder_idx"
  ON "root_cause_analyses"("companyId", "workOrderId");
CREATE INDEX "rca_status_idx"
  ON "root_cause_analyses"("status");

-- ============================================================
-- 5. Crear tabla corrective_checklist_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS "corrective_checklist_templates" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "machineId" INTEGER,
  "componentId" INTEGER,
  "failureTypeId" INTEGER,
  "minPriority" VARCHAR(10),
  "tags" JSONB,
  "phases" JSONB NOT NULL DEFAULT '[]',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "corrective_checklist_templates_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "corrective_checklist_templates_machineId_fkey"
    FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL,
  CONSTRAINT "corrective_checklist_templates_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL,
  CONSTRAINT "corrective_checklist_templates_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
);

CREATE INDEX "cc_templates_company_machine_idx"
  ON "corrective_checklist_templates"("companyId", "machineId");
CREATE INDEX "cc_templates_component_idx"
  ON "corrective_checklist_templates"("componentId");
CREATE INDEX "cc_templates_active_idx"
  ON "corrective_checklist_templates"("isActive");

-- ============================================================
-- 6. Crear tabla work_order_checklists
-- ============================================================
CREATE TABLE IF NOT EXISTS "work_order_checklists" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "workOrderId" INTEGER NOT NULL,
  "templateId" INTEGER,
  "name" VARCHAR(255) NOT NULL,
  "phases" JSONB NOT NULL DEFAULT '[]',
  "completedPhases" JSONB NOT NULL DEFAULT '[]',
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "completedById" INTEGER,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "work_order_checklists_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "work_order_checklists_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE,
  CONSTRAINT "work_order_checklists_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "corrective_checklist_templates"("id") ON DELETE SET NULL,
  CONSTRAINT "work_order_checklists_completedById_fkey"
    FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "wo_checklists_company_wo_idx"
  ON "work_order_checklists"("companyId", "workOrderId");
CREATE INDEX "wo_checklists_status_idx"
  ON "work_order_checklists"("status");
CREATE INDEX "wo_checklists_template_idx"
  ON "work_order_checklists"("templateId");

-- ============================================================
-- FIN DE MIGRACIÓN P5
-- ============================================================
