-- ============================================
-- PERFORMANCE OPTIMIZATION: Missing Indexes
-- Run this migration to significantly improve query performance
-- ============================================

-- ============================================
-- COMPONENT INDEXES (Critical - No indexes existed!)
-- ============================================

-- Index for filtering components by machine (most common query)
CREATE INDEX IF NOT EXISTS "Component_machineId_idx" ON "Component"("machineId");

-- Index for parent-child hierarchy traversal
CREATE INDEX IF NOT EXISTS "Component_parentId_idx" ON "Component"("parentId");

-- Compound index for machine + parent (common pattern: get root components of a machine)
CREATE INDEX IF NOT EXISTS "Component_machineId_parentId_idx" ON "Component"("machineId", "parentId");

-- Index for ordering and filtering by creation date
CREATE INDEX IF NOT EXISTS "Component_createdAt_idx" ON "Component"("createdAt");

-- Index for system filtering
CREATE INDEX IF NOT EXISTS "Component_system_idx" ON "Component"("system");

-- ============================================
-- MACHINE INDEXES (Critical for list queries)
-- ============================================

-- Index for company filtering (most common filter)
CREATE INDEX IF NOT EXISTS "Machine_companyId_idx" ON "Machine"("companyId");

-- Index for sector filtering
CREATE INDEX IF NOT EXISTS "Machine_sectorId_idx" ON "Machine"("sectorId");

-- Compound index for company + sector (common filter combination)
CREATE INDEX IF NOT EXISTS "Machine_companyId_sectorId_idx" ON "Machine"("companyId", "sectorId");

-- Index for status filtering
CREATE INDEX IF NOT EXISTS "Machine_status_idx" ON "Machine"("status");

-- Compound index for company + status (common: active machines in company)
CREATE INDEX IF NOT EXISTS "Machine_companyId_status_idx" ON "Machine"("companyId", "status");

-- Index for area filtering
CREATE INDEX IF NOT EXISTS "Machine_areaId_idx" ON "Machine"("areaId");

-- Index for plant zone filtering
CREATE INDEX IF NOT EXISTS "Machine_plantZoneId_idx" ON "Machine"("plantZoneId");

-- ============================================
-- DOCUMENT INDEXES (For machine/component docs)
-- ============================================

-- Index for machine documents
CREATE INDEX IF NOT EXISTS "Document_machineId_idx" ON "Document"("machineId");

-- Index for component documents
CREATE INDEX IF NOT EXISTS "Document_componentId_idx" ON "Document"("componentId");

-- Compound index for entity type + id (common pattern)
CREATE INDEX IF NOT EXISTS "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");

-- ============================================
-- HISTORY EVENT INDEXES (For timeline queries)
-- ============================================

-- Index for machine history
CREATE INDEX IF NOT EXISTS "HistoryEvent_machineId_idx" ON "HistoryEvent"("machineId");

-- Index for component history
CREATE INDEX IF NOT EXISTS "HistoryEvent_componentId_idx" ON "HistoryEvent"("componentId");

-- Compound index for machine + date (common: recent machine history)
CREATE INDEX IF NOT EXISTS "HistoryEvent_machineId_createdAt_idx" ON "HistoryEvent"("machineId", "createdAt");

-- ============================================
-- DOWNTIME LOG INDEXES (For downtime queries)
-- ============================================

-- Index for machine downtime
CREATE INDEX IF NOT EXISTS "DowntimeLog_machineId_idx" ON "DowntimeLog"("machineId");

-- Compound index for machine + start time
CREATE INDEX IF NOT EXISTS "DowntimeLog_machineId_startTime_idx" ON "DowntimeLog"("machineId", "startTime");

-- ============================================
-- MAINTENANCE CHECKLIST INDEXES
-- ============================================

-- Index for machine checklists
CREATE INDEX IF NOT EXISTS "MaintenanceChecklist_machineId_idx" ON "MaintenanceChecklist"("machineId");

-- Index for component checklists
CREATE INDEX IF NOT EXISTS "MaintenanceChecklist_componentId_idx" ON "MaintenanceChecklist"("componentId");

-- ============================================
-- ANALYZE TABLES (Update statistics for optimizer)
-- ============================================
ANALYZE "Component";
ANALYZE "Machine";
ANALYZE "Document";
ANALYZE "HistoryEvent";
ANALYZE "DowntimeLog";
ANALYZE "MaintenanceChecklist";
