-- Migration: Add Automation Engine and Ideas Book
-- Date: 2025-01-13
-- Description: Creates tables for automation rules, executions, and ideas system

-- ============================================================================
-- ENUMS FOR AUTOMATION
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE "AutomationTriggerType" AS ENUM (
        'WORK_ORDER_CREATED',
        'WORK_ORDER_STATUS_CHANGED',
        'WORK_ORDER_ASSIGNED',
        'FAILURE_REPORTED',
        'FAILURE_RECURRENCE',
        'STOCK_LOW',
        'PREVENTIVE_DUE',
        'MACHINE_STATUS_CHANGED',
        'SCHEDULED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AutomationExecutionStatus" AS ENUM (
        'PENDING',
        'RUNNING',
        'COMPLETED',
        'FAILED',
        'SKIPPED',
        'SIMULATED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- ENUMS FOR IDEAS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE "IdeaCategory" AS ENUM (
        'SOLUCION_FALLA',
        'MEJORA_PROCESO',
        'MEJORA_EQUIPO',
        'SEGURIDAD',
        'AHORRO_COSTOS',
        'CALIDAD',
        'OTRO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "IdeaPriority" AS ENUM (
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "IdeaStatus" AS ENUM (
        'NEW',
        'UNDER_REVIEW',
        'APPROVED',
        'IN_PROGRESS',
        'IMPLEMENTED',
        'REJECTED',
        'ARCHIVED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- AUTOMATION TABLES
-- ============================================================================

-- Automation Rules
CREATE TABLE IF NOT EXISTS "automation_rules" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTestMode" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "triggerType" "AutomationTriggerType" NOT NULL,
    "triggerConfig" JSONB,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_rules_companyId_fkey" FOREIGN KEY ("companyId")
        REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "automation_rules_createdById_fkey" FOREIGN KEY ("createdById")
        REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Indexes for automation_rules
CREATE INDEX IF NOT EXISTS "automation_rules_companyId_isActive_idx" ON "automation_rules"("companyId", "isActive");
CREATE INDEX IF NOT EXISTS "automation_rules_companyId_triggerType_idx" ON "automation_rules"("companyId", "triggerType");

-- Automation Executions (log)
CREATE TABLE IF NOT EXISTS "automation_executions" (
    "id" SERIAL PRIMARY KEY,
    "ruleId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "triggerType" VARCHAR(100) NOT NULL,
    "triggerData" JSONB NOT NULL,
    "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "conditionsPassed" BOOLEAN NOT NULL DEFAULT false,
    "actionsExecuted" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "automation_executions_ruleId_fkey" FOREIGN KEY ("ruleId")
        REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "automation_executions_companyId_fkey" FOREIGN KEY ("companyId")
        REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for automation_executions
CREATE INDEX IF NOT EXISTS "automation_executions_ruleId_idx" ON "automation_executions"("ruleId");
CREATE INDEX IF NOT EXISTS "automation_executions_companyId_startedAt_idx" ON "automation_executions"("companyId", "startedAt");
CREATE INDEX IF NOT EXISTS "automation_executions_companyId_status_idx" ON "automation_executions"("companyId", "status");

-- ============================================================================
-- IDEAS TABLES
-- ============================================================================

-- Ideas
CREATE TABLE IF NOT EXISTS "ideas" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "machineId" INTEGER,
    "componentId" INTEGER,
    "failureOccurrenceId" INTEGER,
    "workOrderId" INTEGER,
    "category" "IdeaCategory" NOT NULL,
    "priority" "IdeaPriority" NOT NULL DEFAULT 'MEDIUM',
    "tags" JSONB,
    "status" "IdeaStatus" NOT NULL DEFAULT 'NEW',
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "implementedAt" TIMESTAMP(3),
    "implementedById" INTEGER,
    "implementationNotes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachments" JSONB,

    CONSTRAINT "ideas_companyId_fkey" FOREIGN KEY ("companyId")
        REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ideas_machineId_fkey" FOREIGN KEY ("machineId")
        REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ideas_componentId_fkey" FOREIGN KEY ("componentId")
        REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ideas_failureOccurrenceId_fkey" FOREIGN KEY ("failureOccurrenceId")
        REFERENCES "failure_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ideas_workOrderId_fkey" FOREIGN KEY ("workOrderId")
        REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ideas_createdById_fkey" FOREIGN KEY ("createdById")
        REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ideas_reviewedById_fkey" FOREIGN KEY ("reviewedById")
        REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ideas_implementedById_fkey" FOREIGN KEY ("implementedById")
        REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes for ideas
CREATE INDEX IF NOT EXISTS "ideas_companyId_status_idx" ON "ideas"("companyId", "status");
CREATE INDEX IF NOT EXISTS "ideas_companyId_category_idx" ON "ideas"("companyId", "category");
CREATE INDEX IF NOT EXISTS "ideas_companyId_createdAt_idx" ON "ideas"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "ideas_machineId_idx" ON "ideas"("machineId");

-- Idea Votes
CREATE TABLE IF NOT EXISTS "idea_votes" (
    "id" SERIAL PRIMARY KEY,
    "ideaId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_votes_ideaId_fkey" FOREIGN KEY ("ideaId")
        REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "idea_votes_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "idea_votes_ideaId_userId_key" UNIQUE ("ideaId", "userId")
);

-- Idea Comments
CREATE TABLE IF NOT EXISTS "idea_comments" (
    "id" SERIAL PRIMARY KEY,
    "ideaId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_comments_ideaId_fkey" FOREIGN KEY ("ideaId")
        REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "idea_comments_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index for idea_comments
CREATE INDEX IF NOT EXISTS "idea_comments_ideaId_idx" ON "idea_comments"("ideaId");

-- ============================================================================
-- TRIGGER FOR updatedAt
-- ============================================================================

-- Create function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updatedAt
DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON "automation_rules";
CREATE TRIGGER update_automation_rules_updated_at
    BEFORE UPDATE ON "automation_rules"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ideas_updated_at ON "ideas";
CREATE TRIGGER update_ideas_updated_at
    BEFORE UPDATE ON "ideas"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_idea_comments_updated_at ON "idea_comments";
CREATE TRIGGER update_idea_comments_updated_at
    BEFORE UPDATE ON "idea_comments"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE
-- ============================================================================
SELECT 'Migration completed: Automation Engine and Ideas Book tables created' as status;
