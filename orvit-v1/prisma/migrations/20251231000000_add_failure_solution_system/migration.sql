-- CreateTable: failure_occurrences (if not exists)
CREATE TABLE IF NOT EXISTS "failure_occurrences" (
    "id" SERIAL NOT NULL,
    "failureId" INTEGER NOT NULL,
    "failureTypeId" INTEGER,
    "machineId" INTEGER,
    "reportedBy" INTEGER NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "title" TEXT,
    "description" TEXT,
    "failureCategory" VARCHAR(50) DEFAULT 'MECANICA',
    "priority" VARCHAR(20) DEFAULT 'MEDIUM',
    "affectedComponents" JSONB,
    "status" VARCHAR(20) DEFAULT 'OPEN',
    "notes" TEXT,

    CONSTRAINT "failure_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable: failure_solutions (if not exists)
CREATE TABLE IF NOT EXISTS "failure_solutions" (
    "id" SERIAL NOT NULL,
    "occurrenceId" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "appliedById" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualHours" DECIMAL(5,2),
    "timeUnit" VARCHAR(20) NOT NULL DEFAULT 'hours',
    "toolsUsed" JSONB,
    "sparePartsUsed" JSONB,
    "rootCause" TEXT,
    "preventiveActions" TEXT,
    "attachments" JSONB,
    "effectiveness" INTEGER,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failure_solutions_pkey" PRIMARY KEY ("id")
);

-- Add columns to failures table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failures' AND column_name = 'companyId') THEN
        ALTER TABLE "failures" ADD COLUMN "companyId" INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failures' AND column_name = 'isActive') THEN
        ALTER TABLE "failures" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "failure_occurrences_failureId_idx" ON "failure_occurrences"("failureId");
CREATE INDEX IF NOT EXISTS "failure_occurrences_failureTypeId_idx" ON "failure_occurrences"("failureTypeId");
CREATE INDEX IF NOT EXISTS "failure_occurrences_machineId_idx" ON "failure_occurrences"("machineId");
CREATE INDEX IF NOT EXISTS "failure_occurrences_status_idx" ON "failure_occurrences"("status");
CREATE INDEX IF NOT EXISTS "failure_occurrences_reportedAt_idx" ON "failure_occurrences"("reportedAt");

CREATE INDEX IF NOT EXISTS "failure_solutions_occurrenceId_idx" ON "failure_solutions"("occurrenceId");
CREATE INDEX IF NOT EXISTS "failure_solutions_appliedById_idx" ON "failure_solutions"("appliedById");
CREATE INDEX IF NOT EXISTS "failure_solutions_isPreferred_idx" ON "failure_solutions"("isPreferred");

CREATE INDEX IF NOT EXISTS "failures_companyId_idx" ON "failures"("companyId");

-- AddForeignKey (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrences_failureId_fkey') THEN
        ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_failureId_fkey"
        FOREIGN KEY ("failureId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrences_failureTypeId_fkey') THEN
        ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_failureTypeId_fkey"
        FOREIGN KEY ("failureTypeId") REFERENCES "failures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrences_machineId_fkey') THEN
        ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_machineId_fkey"
        FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrences_reportedBy_fkey') THEN
        ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_reportedBy_fkey"
        FOREIGN KEY ("reportedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_solutions_occurrenceId_fkey') THEN
        ALTER TABLE "failure_solutions" ADD CONSTRAINT "failure_solutions_occurrenceId_fkey"
        FOREIGN KEY ("occurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_solutions_appliedById_fkey') THEN
        ALTER TABLE "failure_solutions" ADD CONSTRAINT "failure_solutions_appliedById_fkey"
        FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
