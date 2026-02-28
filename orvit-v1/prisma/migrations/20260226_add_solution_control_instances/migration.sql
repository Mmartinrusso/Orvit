-- Migration: add_solution_control_instances
-- Adds follow-up control checkpoints to SolutionApplied

-- 1. Create enum
CREATE TYPE "SolutionControlStatus" AS ENUM (
  'WAITING',
  'PENDING',
  'NOTIFIED',
  'COMPLETED',
  'OVERDUE',
  'SKIPPED'
);

-- 2. Add controlPlan column to solutions_applied
ALTER TABLE "solutions_applied"
  ADD COLUMN IF NOT EXISTS "controlPlan" JSONB;

-- 3. Create solution_control_instances table
CREATE TABLE IF NOT EXISTS "solution_control_instances" (
  "id"                SERIAL PRIMARY KEY,
  "solutionAppliedId" INTEGER NOT NULL,
  "order"             INTEGER NOT NULL,
  "delayMinutes"      INTEGER NOT NULL,
  "description"       TEXT NOT NULL,
  "scheduledAt"       TIMESTAMP(3),
  "status"            "SolutionControlStatus" NOT NULL DEFAULT 'PENDING',
  "notifiedAt"        TIMESTAMP(3),
  "completedAt"       TIMESTAMP(3),
  "completedById"     INTEGER,
  "outcome"           TEXT,
  "notes"             TEXT,
  "photos"            JSONB,
  "requiresFollowup"  BOOLEAN NOT NULL DEFAULT false,
  "companyId"         INTEGER NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "solution_control_instances_solutionAppliedId_fkey"
    FOREIGN KEY ("solutionAppliedId")
    REFERENCES "solutions_applied"("id")
    ON DELETE CASCADE,

  CONSTRAINT "solution_control_instances_completedById_fkey"
    FOREIGN KEY ("completedById")
    REFERENCES "User"("id")
    ON DELETE SET NULL,

  CONSTRAINT "solution_control_instances_companyId_fkey"
    FOREIGN KEY ("companyId")
    REFERENCES "Company"("id")
    ON DELETE CASCADE
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS "solution_control_instances_solutionAppliedId_idx"
  ON "solution_control_instances"("solutionAppliedId");

CREATE INDEX IF NOT EXISTS "solution_control_instances_scheduledAt_status_idx"
  ON "solution_control_instances"("scheduledAt", "status");

CREATE INDEX IF NOT EXISTS "solution_control_instances_companyId_status_idx"
  ON "solution_control_instances"("companyId", "status");

-- 5. Auto-update updatedAt trigger (reuse pattern from other tables)
CREATE OR REPLACE FUNCTION update_solution_control_instances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS solution_control_instances_updated_at ON "solution_control_instances";
CREATE TRIGGER solution_control_instances_updated_at
  BEFORE UPDATE ON "solution_control_instances"
  FOR EACH ROW EXECUTE FUNCTION update_solution_control_instances_updated_at();
