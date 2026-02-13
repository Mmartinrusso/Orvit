-- Fix Machine Import tables: rename from PascalCase to snake_case and fix warnings column type

-- ============================================
-- STEP 1: Drop all foreign key constraints first
-- ============================================
DO $$
BEGIN
    -- Old PascalCase constraints
    ALTER TABLE IF EXISTS "MachineImportFileAnalysis" DROP CONSTRAINT IF EXISTS "MachineImportFileAnalysis_fileId_fkey";
    ALTER TABLE IF EXISTS "MachineImportFileAnalysis" DROP CONSTRAINT IF EXISTS "MachineImportFileAnalysis_importJobId_fkey";
    ALTER TABLE IF EXISTS "MachineImportFile" DROP CONSTRAINT IF EXISTS "MachineImportFile_importJobId_fkey";
    ALTER TABLE IF EXISTS "MachineImportJob" DROP CONSTRAINT IF EXISTS "MachineImportJob_companyId_fkey";
    ALTER TABLE IF EXISTS "MachineImportJob" DROP CONSTRAINT IF EXISTS "MachineImportJob_createdById_fkey";
    ALTER TABLE IF EXISTS "MachineImportJob" DROP CONSTRAINT IF EXISTS "MachineImportJob_machineId_fkey";

    -- New snake_case constraints (in case they exist)
    ALTER TABLE IF EXISTS "machine_import_file_analyses" DROP CONSTRAINT IF EXISTS "machine_import_file_analyses_fileId_fkey";
    ALTER TABLE IF EXISTS "machine_import_file_analyses" DROP CONSTRAINT IF EXISTS "machine_import_file_analyses_importJobId_fkey";
    ALTER TABLE IF EXISTS "machine_import_files" DROP CONSTRAINT IF EXISTS "machine_import_files_importJobId_fkey";
    ALTER TABLE IF EXISTS "machine_import_jobs" DROP CONSTRAINT IF EXISTS "machine_import_jobs_companyId_fkey";
    ALTER TABLE IF EXISTS "machine_import_jobs" DROP CONSTRAINT IF EXISTS "machine_import_jobs_createdById_fkey";
    ALTER TABLE IF EXISTS "machine_import_jobs" DROP CONSTRAINT IF EXISTS "machine_import_jobs_machineId_fkey";
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors
    NULL;
END $$;

-- ============================================
-- STEP 2: Rename tables if they exist with PascalCase names
-- ============================================

-- Rename MachineImportJob -> machine_import_jobs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MachineImportJob')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'machine_import_jobs') THEN
        ALTER TABLE "MachineImportJob" RENAME TO "machine_import_jobs";
    END IF;
END $$;

-- Rename MachineImportFile -> machine_import_files
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MachineImportFile')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'machine_import_files') THEN
        ALTER TABLE "MachineImportFile" RENAME TO "machine_import_files";
    END IF;
END $$;

-- Rename MachineImportFileAnalysis -> machine_import_file_analyses
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MachineImportFileAnalysis')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'machine_import_file_analyses') THEN
        ALTER TABLE "MachineImportFileAnalysis" RENAME TO "machine_import_file_analyses";
    END IF;
END $$;

-- ============================================
-- STEP 3: Create tables if they don't exist
-- ============================================

-- Enum for import job status (if not exists)
DO $$ BEGIN
    CREATE TYPE "ImportJobStatus" AS ENUM ('UPLOADING', 'QUEUED', 'PROCESSING', 'DRAFT_READY', 'COMPLETED', 'ERROR', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- machine_import_jobs
CREATE TABLE IF NOT EXISTS "machine_import_jobs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'UPLOADING',
    "stage" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "createdById" INTEGER NOT NULL,
    "originalFileName" TEXT,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "extractedData" JSONB,
    "reviewedData" JSONB,
    "confidence" DOUBLE PRECISION,
    "machineId" INTEGER,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "translateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sourceLanguage" TEXT,
    "targetLanguage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "machine_import_jobs_pkey" PRIMARY KEY ("id")
);

-- machine_import_files
CREATE TABLE IF NOT EXISTS "machine_import_files" (
    "id" SERIAL NOT NULL,
    "importJobId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileTypes" JSONB NOT NULL DEFAULT '[]',
    "extractedTextS3Key" TEXT,
    "pageCount" INTEGER,
    "needsVision" BOOLEAN NOT NULL DEFAULT false,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "machine_import_files_pkey" PRIMARY KEY ("id")
);

-- machine_import_file_analyses
CREATE TABLE IF NOT EXISTS "machine_import_file_analyses" (
    "id" SERIAL NOT NULL,
    "fileId" INTEGER NOT NULL,
    "importJobId" INTEGER NOT NULL,
    "extractedJson" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warnings" JSONB DEFAULT '[]'::jsonb,
    "model" TEXT,
    "tokensUsed" INTEGER,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "machine_import_file_analyses_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 4: Add translation columns if not exist
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'machine_import_jobs' AND column_name = 'translateEnabled'
    ) THEN
        ALTER TABLE "machine_import_jobs" ADD COLUMN "translateEnabled" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'machine_import_jobs' AND column_name = 'sourceLanguage'
    ) THEN
        ALTER TABLE "machine_import_jobs" ADD COLUMN "sourceLanguage" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'machine_import_jobs' AND column_name = 'targetLanguage'
    ) THEN
        ALTER TABLE "machine_import_jobs" ADD COLUMN "targetLanguage" TEXT;
    END IF;
END $$;

-- ============================================
-- STEP 5: Fix warnings column type if it's TEXT[]
-- ============================================
DO $$
BEGIN
    -- Check if warnings column exists and is TEXT[]
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'machine_import_file_analyses'
        AND column_name = 'warnings'
        AND data_type = 'ARRAY'
    ) THEN
        -- Convert TEXT[] to JSONB
        ALTER TABLE "machine_import_file_analyses"
        ALTER COLUMN "warnings" TYPE JSONB
        USING COALESCE(to_jsonb("warnings"), '[]'::jsonb);

        -- Set default
        ALTER TABLE "machine_import_file_analyses"
        ALTER COLUMN "warnings" SET DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- ============================================
-- STEP 6: Add unique constraints
-- ============================================
ALTER TABLE "machine_import_jobs"
DROP CONSTRAINT IF EXISTS "machine_import_jobs_machineId_key";
ALTER TABLE "machine_import_jobs"
ADD CONSTRAINT "machine_import_jobs_machineId_key" UNIQUE ("machineId");

ALTER TABLE "machine_import_file_analyses"
DROP CONSTRAINT IF EXISTS "machine_import_file_analyses_fileId_key";
ALTER TABLE "machine_import_file_analyses"
ADD CONSTRAINT "machine_import_file_analyses_fileId_key" UNIQUE ("fileId");

-- ============================================
-- STEP 7: Add foreign keys
-- ============================================

-- machine_import_jobs foreign keys
ALTER TABLE "machine_import_jobs"
DROP CONSTRAINT IF EXISTS "machine_import_jobs_companyId_fkey";
ALTER TABLE "machine_import_jobs"
ADD CONSTRAINT "machine_import_jobs_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "machine_import_jobs"
DROP CONSTRAINT IF EXISTS "machine_import_jobs_createdById_fkey";
ALTER TABLE "machine_import_jobs"
ADD CONSTRAINT "machine_import_jobs_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "machine_import_jobs"
DROP CONSTRAINT IF EXISTS "machine_import_jobs_machineId_fkey";
ALTER TABLE "machine_import_jobs"
ADD CONSTRAINT "machine_import_jobs_machineId_fkey"
FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- machine_import_files foreign keys
ALTER TABLE "machine_import_files"
DROP CONSTRAINT IF EXISTS "machine_import_files_importJobId_fkey";
ALTER TABLE "machine_import_files"
ADD CONSTRAINT "machine_import_files_importJobId_fkey"
FOREIGN KEY ("importJobId") REFERENCES "machine_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- machine_import_file_analyses foreign keys
ALTER TABLE "machine_import_file_analyses"
DROP CONSTRAINT IF EXISTS "machine_import_file_analyses_fileId_fkey";
ALTER TABLE "machine_import_file_analyses"
ADD CONSTRAINT "machine_import_file_analyses_fileId_fkey"
FOREIGN KEY ("fileId") REFERENCES "machine_import_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "machine_import_file_analyses"
DROP CONSTRAINT IF EXISTS "machine_import_file_analyses_importJobId_fkey";
ALTER TABLE "machine_import_file_analyses"
ADD CONSTRAINT "machine_import_file_analyses_importJobId_fkey"
FOREIGN KEY ("importJobId") REFERENCES "machine_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- STEP 8: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS "machine_import_jobs_companyId_idx" ON "machine_import_jobs"("companyId");
CREATE INDEX IF NOT EXISTS "machine_import_jobs_status_idx" ON "machine_import_jobs"("status");
CREATE INDEX IF NOT EXISTS "machine_import_jobs_createdById_idx" ON "machine_import_jobs"("createdById");
CREATE INDEX IF NOT EXISTS "machine_import_jobs_lockedAt_idx" ON "machine_import_jobs"("lockedAt");
CREATE INDEX IF NOT EXISTS "machine_import_files_importJobId_idx" ON "machine_import_files"("importJobId");
CREATE INDEX IF NOT EXISTS "machine_import_files_sha256_idx" ON "machine_import_files"("sha256");
CREATE INDEX IF NOT EXISTS "machine_import_file_analyses_importJobId_idx" ON "machine_import_file_analyses"("importJobId");

-- ============================================
-- STEP 9: Clean up old PascalCase tables (if renamed successfully)
-- ============================================
DROP TABLE IF EXISTS "MachineImportFileAnalysis" CASCADE;
DROP TABLE IF EXISTS "MachineImportFile" CASCADE;
DROP TABLE IF EXISTS "MachineImportJob" CASCADE;
