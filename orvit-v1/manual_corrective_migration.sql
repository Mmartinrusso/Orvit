-- =====================================================
-- MIGRACIÓN MANUAL: Sistema Correctivo Profesional
-- Ejecutar en orden en tu cliente de PostgreSQL
-- NO pierde datos - solo agrega columnas y tablas nuevas
-- =====================================================

-- 1. Agregar columnas faltantes a failure_occurrences
-- =====================================================

-- Columna companyId (requerida)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'companyId') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "companyId" INTEGER;
    END IF;
END $$;

-- Actualizar companyId desde WorkOrder asociado
UPDATE "failure_occurrences" fo
SET "companyId" = wo."companyId"
FROM "work_orders" wo
WHERE fo."failureId" = wo."id" AND fo."companyId" IS NULL;

-- Columna subcomponentId
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'subcomponentId') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "subcomponentId" INTEGER;
    END IF;
END $$;

-- Columnas de estado
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'isIntermittent') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "isIntermittent" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'isObservation') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "isObservation" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'causedDowntime') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "causedDowntime" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'isSafetyRelated') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "isSafetyRelated" BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Columnas de vinculación de duplicados
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'linkedToOccurrenceId') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "linkedToOccurrenceId" INTEGER;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'linkedAt') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "linkedAt" TIMESTAMP(3);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'linkedById') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "linkedById" INTEGER;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'linkedReason') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "linkedReason" VARCHAR(255);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'isLinkedDuplicate') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "isLinkedDuplicate" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Columnas de reapertura
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'reopenedFrom') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "reopenedFrom" INTEGER;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'reopenReason') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "reopenReason" TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'reopenedAt') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "reopenedAt" TIMESTAMP(3);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'reopenedById') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "reopenedById" INTEGER;
    END IF;
END $$;

-- Columna de resolución inmediata
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'resolvedImmediately') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "resolvedImmediately" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Columnas JSON
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'symptoms') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "symptoms" JSONB;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failure_occurrences' AND column_name = 'photos') THEN
        ALTER TABLE "failure_occurrences" ADD COLUMN "photos" JSONB;
    END IF;
END $$;

-- 2. Crear tabla failure_watchers
-- =====================================================
CREATE TABLE IF NOT EXISTS "failure_watchers" (
    "id" SERIAL NOT NULL,
    "failureOccurrenceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "failure_watchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "failure_watchers_failureOccurrenceId_userId_key"
ON "failure_watchers"("failureOccurrenceId", "userId");

CREATE INDEX IF NOT EXISTS "failure_watchers_userId_idx" ON "failure_watchers"("userId");

-- 3. Crear tabla failure_occurrence_comments
-- =====================================================
CREATE TABLE IF NOT EXISTS "failure_occurrence_comments" (
    "id" SERIAL NOT NULL,
    "failureOccurrenceId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'comment',
    "mentionedUserIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "failure_occurrence_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "failure_occurrence_comments_failureOccurrenceId_createdAt_idx"
ON "failure_occurrence_comments"("failureOccurrenceId", "createdAt");

CREATE INDEX IF NOT EXISTS "failure_occurrence_comments_authorId_idx"
ON "failure_occurrence_comments"("authorId");

-- 4. Crear tabla downtime_logs
-- =====================================================
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
    "category" VARCHAR(20) NOT NULL DEFAULT 'UNPLANNED',
    "reason" TEXT,
    "productionImpact" TEXT,
    "companyId" INTEGER NOT NULL,
    CONSTRAINT "downtime_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "downtime_logs_failureOccurrenceId_idx" ON "downtime_logs"("failureOccurrenceId");
CREATE INDEX IF NOT EXISTS "downtime_logs_machineId_startedAt_idx" ON "downtime_logs"("machineId", "startedAt");
CREATE INDEX IF NOT EXISTS "downtime_logs_companyId_machineId_startedAt_idx" ON "downtime_logs"("companyId", "machineId", "startedAt");
CREATE INDEX IF NOT EXISTS "downtime_logs_workOrderId_endedAt_idx" ON "downtime_logs"("workOrderId", "endedAt");

-- 5. Crear tabla solutions_applied
-- =====================================================
CREATE TABLE IF NOT EXISTS "solutions_applied" (
    "id" SERIAL NOT NULL,
    "failureOccurrenceId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "diagnosis" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "outcome" VARCHAR(20) NOT NULL DEFAULT 'FUNCIONÓ',
    "performedById" INTEGER NOT NULL,
    "performedByIds" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualMinutes" INTEGER,
    "finalComponentId" INTEGER,
    "finalSubcomponentId" INTEGER,
    "confirmedCause" VARCHAR(255),
    "fixType" VARCHAR(20) NOT NULL DEFAULT 'DEFINITIVA',
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

CREATE INDEX IF NOT EXISTS "solutions_applied_failureOccurrenceId_idx" ON "solutions_applied"("failureOccurrenceId");
CREATE INDEX IF NOT EXISTS "solutions_applied_workOrderId_idx" ON "solutions_applied"("workOrderId");
CREATE INDEX IF NOT EXISTS "solutions_applied_performedById_performedAt_idx" ON "solutions_applied"("performedById", "performedAt");
CREATE INDEX IF NOT EXISTS "solutions_applied_companyId_performedAt_idx" ON "solutions_applied"("companyId", "performedAt");

-- 6. Crear tabla corrective_settings
-- =====================================================
CREATE TABLE IF NOT EXISTS "corrective_settings" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "corrective_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corrective_settings_companyId_key" ON "corrective_settings"("companyId");

-- 7. Índices adicionales para failure_occurrences
-- =====================================================
CREATE INDEX IF NOT EXISTS "failure_occurrences_linkedToOccurrenceId_idx" ON "failure_occurrences"("linkedToOccurrenceId");
CREATE INDEX IF NOT EXISTS "failure_occurrences_isLinkedDuplicate_idx" ON "failure_occurrences"("isLinkedDuplicate");
CREATE INDEX IF NOT EXISTS "failure_occurrences_isIntermittent_idx" ON "failure_occurrences"("isIntermittent");
CREATE INDEX IF NOT EXISTS "failure_occurrences_causedDowntime_idx" ON "failure_occurrences"("causedDowntime");
CREATE INDEX IF NOT EXISTS "failure_occurrences_companyId_status_reportedAt_idx" ON "failure_occurrences"("companyId", "status", "reportedAt");
CREATE INDEX IF NOT EXISTS "failure_occurrences_companyId_machineId_status_idx" ON "failure_occurrences"("companyId", "machineId", "status");

-- 8. Foreign Keys (ejecutar después de crear todas las tablas)
-- =====================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_watchers_failureOccurrenceId_fkey') THEN
        ALTER TABLE "failure_watchers" ADD CONSTRAINT "failure_watchers_failureOccurrenceId_fkey"
        FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_watchers_userId_fkey') THEN
        ALTER TABLE "failure_watchers" ADD CONSTRAINT "failure_watchers_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrence_comments_failureOccurrenceId_fkey') THEN
        ALTER TABLE "failure_occurrence_comments" ADD CONSTRAINT "failure_occurrence_comments_failureOccurrenceId_fkey"
        FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrence_comments_authorId_fkey') THEN
        ALTER TABLE "failure_occurrence_comments" ADD CONSTRAINT "failure_occurrence_comments_authorId_fkey"
        FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'solutions_applied_failureOccurrenceId_fkey') THEN
        ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_failureOccurrenceId_fkey"
        FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'solutions_applied_performedById_fkey') THEN
        ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_performedById_fkey"
        FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrences_linkedToOccurrenceId_fkey') THEN
        ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_linkedToOccurrenceId_fkey"
        FOREIGN KEY ("linkedToOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrences_linkedById_fkey') THEN
        ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_linkedById_fkey"
        FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'failure_occurrences_reopenedById_fkey') THEN
        ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_reopenedById_fkey"
        FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- Después de ejecutar esto en PostgreSQL, correr:
-- npx prisma generate
-- =====================================================
