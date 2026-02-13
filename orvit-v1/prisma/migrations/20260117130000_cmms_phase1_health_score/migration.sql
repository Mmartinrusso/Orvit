-- CMMS Phase 1.1: Health Score and Criticality
-- Migration: cmms_phase1_health_score
-- Created: 2026-01-17
-- Safe migration - only adds columns, no data loss

-- ============================================================
-- 1. ADD Criticality and Health Score columns to Machine
-- ============================================================
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "criticalityScore" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "criticalityProduction" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "criticalitySafety" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "criticalityQuality" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "criticalityCost" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "healthScore" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "healthScoreUpdatedAt" TIMESTAMP(3);

-- ============================================================
-- 2. ADD Responsibility columns to Machine
-- ============================================================
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "ownerId" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "plannerId" INTEGER;
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "technicianId" INTEGER;

-- Foreign keys for Machine responsibilities
ALTER TABLE "Machine" DROP CONSTRAINT IF EXISTS "Machine_ownerId_fkey";
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Machine" DROP CONSTRAINT IF EXISTS "Machine_plannerId_fkey";
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_plannerId_fkey"
    FOREIGN KEY ("plannerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Machine" DROP CONSTRAINT IF EXISTS "Machine_technicianId_fkey";
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_technicianId_fkey"
    FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for Machine health and criticality
CREATE INDEX IF NOT EXISTS "Machine_healthScore_idx" ON "Machine"("healthScore");
CREATE INDEX IF NOT EXISTS "Machine_criticalityScore_idx" ON "Machine"("criticalityScore");

-- ============================================================
-- 3. ADD Criticality columns to Component
-- ============================================================
ALTER TABLE "Component" ADD COLUMN IF NOT EXISTS "criticality" INTEGER;
ALTER TABLE "Component" ADD COLUMN IF NOT EXISTS "isSafetyCritical" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- DONE: Migration complete
-- ============================================================
