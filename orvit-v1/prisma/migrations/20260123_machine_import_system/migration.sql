-- Machine Import System Migration
-- Creates tables for AI-powered machine import from technical documentation
-- IMPORTANT: Uses snake_case table names to match Prisma @@map directives

-- Enum for import job status
DO $$ BEGIN
    CREATE TYPE "ImportJobStatus" AS ENUM ('UPLOADING', 'QUEUED', 'PROCESSING', 'DRAFT_READY', 'COMPLETED', 'ERROR', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- machine_import_jobs table (matches @@map("machine_import_jobs"))
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

-- machine_import_files table (matches @@map("machine_import_files"))
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

-- machine_import_file_analyses table (matches @@map("machine_import_file_analyses"))
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

-- Unique constraints
ALTER TABLE "machine_import_jobs" DROP CONSTRAINT IF EXISTS "machine_import_jobs_machineId_key";
ALTER TABLE "machine_import_jobs" ADD CONSTRAINT "machine_import_jobs_machineId_key" UNIQUE ("machineId");

ALTER TABLE "machine_import_file_analyses" DROP CONSTRAINT IF EXISTS "machine_import_file_analyses_fileId_key";
ALTER TABLE "machine_import_file_analyses" ADD CONSTRAINT "machine_import_file_analyses_fileId_key" UNIQUE ("fileId");

-- Foreign keys
ALTER TABLE "machine_import_jobs" DROP CONSTRAINT IF EXISTS "machine_import_jobs_companyId_fkey";
ALTER TABLE "machine_import_jobs" ADD CONSTRAINT "machine_import_jobs_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "machine_import_jobs" DROP CONSTRAINT IF EXISTS "machine_import_jobs_createdById_fkey";
ALTER TABLE "machine_import_jobs" ADD CONSTRAINT "machine_import_jobs_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "machine_import_jobs" DROP CONSTRAINT IF EXISTS "machine_import_jobs_machineId_fkey";
ALTER TABLE "machine_import_jobs" ADD CONSTRAINT "machine_import_jobs_machineId_fkey"
    FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "machine_import_files" DROP CONSTRAINT IF EXISTS "machine_import_files_importJobId_fkey";
ALTER TABLE "machine_import_files" ADD CONSTRAINT "machine_import_files_importJobId_fkey"
    FOREIGN KEY ("importJobId") REFERENCES "machine_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "machine_import_file_analyses" DROP CONSTRAINT IF EXISTS "machine_import_file_analyses_fileId_fkey";
ALTER TABLE "machine_import_file_analyses" ADD CONSTRAINT "machine_import_file_analyses_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "machine_import_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "machine_import_file_analyses" DROP CONSTRAINT IF EXISTS "machine_import_file_analyses_importJobId_fkey";
ALTER TABLE "machine_import_file_analyses" ADD CONSTRAINT "machine_import_file_analyses_importJobId_fkey"
    FOREIGN KEY ("importJobId") REFERENCES "machine_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "machine_import_jobs_companyId_idx" ON "machine_import_jobs"("companyId");
CREATE INDEX IF NOT EXISTS "machine_import_jobs_status_idx" ON "machine_import_jobs"("status");
CREATE INDEX IF NOT EXISTS "machine_import_jobs_createdById_idx" ON "machine_import_jobs"("createdById");
CREATE INDEX IF NOT EXISTS "machine_import_jobs_lockedAt_idx" ON "machine_import_jobs"("lockedAt");
CREATE INDEX IF NOT EXISTS "machine_import_files_importJobId_idx" ON "machine_import_files"("importJobId");
CREATE INDEX IF NOT EXISTS "machine_import_files_sha256_idx" ON "machine_import_files"("sha256");
CREATE INDEX IF NOT EXISTS "machine_import_file_analyses_importJobId_idx" ON "machine_import_file_analyses"("importJobId");
