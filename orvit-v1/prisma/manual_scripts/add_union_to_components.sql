-- Migración: Agregar union_id a salary_components
-- Fecha: 2026-01-13
-- Descripción: Permite asociar componentes salariales a gremios específicos

-- ================================================
-- 1. Agregar columna union_id a salary_components
-- ================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'salary_components' AND column_name = 'union_id'
    ) THEN
        ALTER TABLE "salary_components" ADD COLUMN "union_id" INTEGER;

        ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_union_id_fkey"
            FOREIGN KEY ("union_id") REFERENCES "payroll_unions"("id") ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS "salary_components_union_id_idx" ON "salary_components"("union_id");

        RAISE NOTICE 'Columna union_id agregada a salary_components';
    ELSE
        RAISE NOTICE 'La columna union_id ya existe en salary_components';
    END IF;
END $$;

-- ================================================
-- 2. Mensaje final
-- ================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migración union_id en componentes completada!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Los componentes sin union_id son globales (aplican a todos los gremios)';
    RAISE NOTICE 'Los componentes con union_id solo aplican a ese gremio específico';
    RAISE NOTICE '';
END $$;
