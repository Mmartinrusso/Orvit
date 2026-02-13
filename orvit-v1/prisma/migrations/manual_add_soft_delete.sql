-- Migración: Agregar campos de Soft Delete a modelos críticos
-- Fecha: 2026-02-13
-- Descripción: Agrega campos deletedAt y deletedBy a WorkOrder, Task, FixedTask y MaintenanceChecklist

-- ============================================
-- 1. WorkOrder
-- ============================================
ALTER TABLE "work_orders"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

-- Índice parcial: solo registros eliminados (para consultas admin de recuperación)
CREATE INDEX IF NOT EXISTS "idx_work_orders_deleted"
  ON "work_orders" ("deletedAt")
  WHERE "deletedAt" IS NOT NULL;

-- ============================================
-- 2. Task
-- ============================================
ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

CREATE INDEX IF NOT EXISTS "idx_task_deleted"
  ON "Task" ("deletedAt")
  WHERE "deletedAt" IS NOT NULL;

-- ============================================
-- 3. FixedTask
-- ============================================
ALTER TABLE "FixedTask"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

CREATE INDEX IF NOT EXISTS "idx_fixed_task_deleted"
  ON "FixedTask" ("deletedAt")
  WHERE "deletedAt" IS NOT NULL;

-- ============================================
-- 4. MaintenanceChecklist
-- ============================================
ALTER TABLE "maintenance_checklists"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

CREATE INDEX IF NOT EXISTS "idx_maintenance_checklists_deleted"
  ON "maintenance_checklists" ("deletedAt")
  WHERE "deletedAt" IS NOT NULL;
