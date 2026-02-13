-- ============================================================================
-- Script SQL Directo para Aplicar Índices de Performance
-- 
-- Este script puede ejecutarse directamente en tu cliente SQL (pgAdmin, DBeaver, etc.)
-- o usando psql desde la línea de comandos
-- 
-- Uso con psql:
--   psql -U tu_usuario -d tu_database -f scripts/apply-performance-indexes-direct.sql
-- 
-- O copiar y pegar en tu cliente SQL favorito
-- ============================================================================

-- ============================================================================
-- MANTENIMIENTO - WorkOrder
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workorder_company_status 
ON "WorkOrder"("companyId", "status");

CREATE INDEX IF NOT EXISTS idx_workorder_scheduled 
ON "WorkOrder"("scheduledDate") 
WHERE "status" IN ('PENDING', 'IN_PROGRESS');

CREATE INDEX IF NOT EXISTS idx_workorder_completed 
ON "WorkOrder"("completedDate") 
WHERE "status" = 'COMPLETED';

CREATE INDEX IF NOT EXISTS idx_workorder_priority_status 
ON "WorkOrder"("priority", "status", "scheduledDate");

-- ============================================================================
-- MANTENIMIENTO - Machine
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_machine_company_sector 
ON "Machine"("companyId", "sectorId");

CREATE INDEX IF NOT EXISTS idx_machine_status 
ON "Machine"("status") 
WHERE "status" IS NOT NULL;

-- ============================================================================
-- MANTENIMIENTO - UnidadMovil
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_unidadmovil_company_sector 
ON "UnidadMovil"("companyId", "sectorId");

CREATE INDEX IF NOT EXISTS idx_unidadmovil_estado 
ON "UnidadMovil"("estado") 
WHERE "estado" = 'ACTIVO';

-- ============================================================================
-- PRODUCTOS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_company_active 
ON "products"("company_id", "is_active");

CREATE INDEX IF NOT EXISTS idx_product_category 
ON "products"("category_id", "company_id") 
WHERE "is_active" = true;

CREATE INDEX IF NOT EXISTS idx_product_subcategory 
ON "products"("subcategory_id", "company_id") 
WHERE "is_active" = true;

CREATE INDEX IF NOT EXISTS idx_product_sku 
ON "products"("sku");

-- ============================================================================
-- PRODUCT CATEGORIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_category_company 
ON "product_categories"("company_id");

-- ============================================================================
-- PRODUCT SUBCATEGORIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_subcategory_category_company 
ON "product_subcategories"("category_id", "company_id");

-- ============================================================================
-- INSUMOS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_insumo_company_active 
ON "insumos"("company_id", "is_active");

CREATE INDEX IF NOT EXISTS idx_insumo_supplier 
ON "insumos"("supplier_id") 
WHERE "supplier_id" IS NOT NULL;

-- ============================================================================
-- CLIENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_client_company_active 
ON "clients"("company_id", "is_active");

CREATE INDEX IF NOT EXISTS idx_client_email 
ON "clients"("email") 
WHERE "email" IS NOT NULL;

-- ============================================================================
-- SUPPLIERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_supplier_company_active 
ON "suppliers"("company_id", "is_active");

CREATE INDEX IF NOT EXISTS idx_supplier_email 
ON "suppliers"("email") 
WHERE "email" IS NOT NULL;

-- ============================================================================
-- TAREAS - Task
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_task_assigned_status 
ON "Task"("assignedToId", "status");

CREATE INDEX IF NOT EXISTS idx_task_created_status 
ON "Task"("createdById", "status");

CREATE INDEX IF NOT EXISTS idx_task_duedate 
ON "Task"("dueDate") 
WHERE "dueDate" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_priority_status 
ON "Task"("priority", "status", "dueDate");

-- ============================================================================
-- CONTACTOS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_contact_company_active 
ON "Contact"("companyId", "isActive");

-- ============================================================================
-- RECORDATORIOS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reminder_user_active 
ON "Reminder"("userId", "isActive", "reminderDate");

-- ============================================================================
-- PERMISOS - UserPermission
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_userpermission_user_permission 
ON "UserPermission"("userId", "permissionId");

CREATE INDEX IF NOT EXISTS idx_userpermission_expires 
ON "UserPermission"("expiresAt") 
WHERE "expiresAt" IS NOT NULL;

-- ============================================================================
-- PERMISOS - RolePermission
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rolepermission_role_permission 
ON "RolePermission"("roleId", "permissionId");

-- ============================================================================
-- COMPANY - UserOnCompany
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_useroncompany_user 
ON "UserOnCompany"("userId", "companyId");

CREATE INDEX IF NOT EXISTS idx_useroncompany_company 
ON "UserOnCompany"("companyId", "userId");

-- ============================================================================
-- FIN
-- ============================================================================

-- Verificar índices creados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

