-- =============================================================================
-- Script: Agregar campo t2DbEnabled a CompanyViewConfig
-- Descripción: Permite habilitar/deshabilitar acceso a BD T2 por empresa
-- =============================================================================

-- Agregar columna t2DbEnabled (default false = deshabilitado)
ALTER TABLE "company_view_config"
ADD COLUMN IF NOT EXISTS "t2DbEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Comentario explicativo
COMMENT ON COLUMN "company_view_config"."t2DbEnabled" IS
'Controla si la empresa puede acceder a la BD T2. Solo superadmin puede modificar.';

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- Ejecutar después para verificar:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'company_view_config' AND column_name = 't2DbEnabled';
