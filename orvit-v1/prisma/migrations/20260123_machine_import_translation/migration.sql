-- Machine Import Translation Settings Migration
-- Adds translation configuration fields to machine_import_jobs

-- Note: These columns already exist from the machine_import_system migration
-- This migration is kept for consistency but the IF NOT EXISTS clause ensures idempotency
ALTER TABLE "machine_import_jobs" ADD COLUMN IF NOT EXISTS "translateEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "machine_import_jobs" ADD COLUMN IF NOT EXISTS "sourceLanguage" TEXT;
ALTER TABLE "machine_import_jobs" ADD COLUMN IF NOT EXISTS "targetLanguage" TEXT;
