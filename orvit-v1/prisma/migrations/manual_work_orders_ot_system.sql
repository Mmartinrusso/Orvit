-- =====================================================
-- Migración: Sistema OT Correctivo Completo
-- Fecha: 2026-01-04
-- Descripción: Agrega estados, SLA, watchers y campos de asignación
-- =====================================================

-- 1. Agregar nuevos valores al enum WorkOrderStatus
-- Los ADD VALUE no pueden estar dentro de transacciones, ejecutar por separado si falla
ALTER TYPE "WorkOrderStatus" ADD VALUE IF NOT EXISTS 'INCOMING';
ALTER TYPE "WorkOrderStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "WorkOrderStatus" ADD VALUE IF NOT EXISTS 'WAITING';

-- 2. Agregar campos de SLA a work_orders
ALTER TABLE "work_orders"
ADD COLUMN IF NOT EXISTS "slaDueAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "slaStatus" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "slaBreachedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "escalatedToId" INTEGER;

-- 3. Agregar campos de ejecutores y asignación
ALTER TABLE "work_orders"
ADD COLUMN IF NOT EXISTS "executorIds" INTEGER[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "plannedAt" TIMESTAMP(3);

-- 4. Crear tabla work_order_watchers (followers de OT)
CREATE TABLE IF NOT EXISTS "work_order_watchers" (
    "id" SERIAL PRIMARY KEY,
    "workOrderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_watchers_workOrderId_fkey"
        FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE,
    CONSTRAINT "work_order_watchers_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    CONSTRAINT "work_order_watchers_workOrderId_userId_key"
        UNIQUE ("workOrderId", "userId")
);

-- Índices para watchers
CREATE INDEX IF NOT EXISTS "work_order_watchers_userId_idx" ON "work_order_watchers"("userId");
CREATE INDEX IF NOT EXISTS "work_order_watchers_workOrderId_idx" ON "work_order_watchers"("workOrderId");

-- 5. Índices para SLA y estados
CREATE INDEX IF NOT EXISTS "work_orders_slaDueAt_idx" ON "work_orders"("slaDueAt");
CREATE INDEX IF NOT EXISTS "work_orders_slaStatus_idx" ON "work_orders"("slaStatus");
CREATE INDEX IF NOT EXISTS "work_orders_status_type_idx" ON "work_orders"("status", "type");

-- 6. Agregar campo resolvedImmediately a failure_occurrences si no existe
ALTER TABLE "failure_occurrences"
ADD COLUMN IF NOT EXISTS "resolvedImmediately" BOOLEAN DEFAULT false;

-- =====================================================
-- Fin de la migración
-- =====================================================
