-- Migración: Estructura de Gremios v4.1
-- Fecha: 2026-01-13
-- Descripción: Crea tablas para la estructura Gremio -> Categoría -> Empleado <- Sector

-- ================================================
-- 1. PayrollUnion (Gremios/Sindicatos)
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_unions" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50),
    "convention_code" VARCHAR(50),
    "payment_schedule_type" VARCHAR(50) NOT NULL DEFAULT 'BIWEEKLY_FIXED',
    "payment_rule_json" JSONB,
    "attendance_policy_json" JSONB,
    "contribution_rules_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_unions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_unions_company_id_name_key" UNIQUE ("company_id", "name")
);

CREATE INDEX IF NOT EXISTS "payroll_unions_company_id_idx" ON "payroll_unions"("company_id");

-- ================================================
-- 2. UnionCategory (Categorías dentro del Gremio)
-- ================================================
CREATE TABLE IF NOT EXISTS "union_categories" (
    "id" SERIAL PRIMARY KEY,
    "union_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50),
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "union_categories_union_id_fkey"
    FOREIGN KEY ("union_id") REFERENCES "payroll_unions"("id") ON DELETE CASCADE,

    CONSTRAINT "union_categories_union_id_name_key" UNIQUE ("union_id", "name")
);

CREATE INDEX IF NOT EXISTS "union_categories_union_id_idx" ON "union_categories"("union_id");

-- ================================================
-- 3. WorkSector (Sectores de Trabajo)
-- ================================================
CREATE TABLE IF NOT EXISTS "work_sectors" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50),
    "description" TEXT,
    "cost_center_code" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_sectors_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,

    CONSTRAINT "work_sectors_company_id_name_key" UNIQUE ("company_id", "name")
);

CREATE INDEX IF NOT EXISTS "work_sectors_company_id_idx" ON "work_sectors"("company_id");

-- ================================================
-- 4. Agregar columnas a employees
-- ================================================
DO $$
BEGIN
    -- Agregar union_category_id si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'union_category_id'
    ) THEN
        ALTER TABLE "employees" ADD COLUMN "union_category_id" INTEGER;
        ALTER TABLE "employees" ADD CONSTRAINT "employees_union_category_id_fkey"
            FOREIGN KEY ("union_category_id") REFERENCES "union_categories"("id") ON UPDATE NO ACTION;
        RAISE NOTICE 'Columna union_category_id agregada a employees';
    END IF;

    -- Agregar work_sector_id si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'work_sector_id'
    ) THEN
        ALTER TABLE "employees" ADD COLUMN "work_sector_id" INTEGER;
        ALTER TABLE "employees" ADD CONSTRAINT "employees_work_sector_id_fkey"
            FOREIGN KEY ("work_sector_id") REFERENCES "work_sectors"("id") ON UPDATE NO ACTION;
        RAISE NOTICE 'Columna work_sector_id agregada a employees';
    END IF;
END $$;

-- Crear índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS "employees_union_category_id_idx" ON "employees"("union_category_id");
CREATE INDEX IF NOT EXISTS "employees_work_sector_id_idx" ON "employees"("work_sector_id");

-- ================================================
-- 5. Agregar union_id a payroll_periods
-- ================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payroll_periods' AND column_name = 'union_id'
    ) THEN
        ALTER TABLE "payroll_periods" ADD COLUMN "union_id" INTEGER;
        ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_union_id_fkey"
            FOREIGN KEY ("union_id") REFERENCES "payroll_unions"("id") ON DELETE SET NULL;
        RAISE NOTICE 'Columna union_id agregada a payroll_periods';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "payroll_periods_union_id_idx" ON "payroll_periods"("union_id");

-- ================================================
-- 6. AgreementRate (Tasas de Convenio por Categoría)
-- ================================================
CREATE TABLE IF NOT EXISTS "agreement_rates" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL,
    "union_category_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "daily_rate" DECIMAL(12,2) NOT NULL,
    "hourly_rate" DECIMAL(12,2),
    "presenteeism_rate" DECIMAL(12,2),
    "seniority_pct" DECIMAL(5,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_rates_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,

    CONSTRAINT "agreement_rates_union_category_id_fkey"
    FOREIGN KEY ("union_category_id") REFERENCES "union_categories"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "agreement_rates_union_category_id_effective_idx"
    ON "agreement_rates"("union_category_id", "effective_from");
CREATE INDEX IF NOT EXISTS "agreement_rates_company_id_idx" ON "agreement_rates"("company_id");

-- ================================================
-- 7. Actualizar salary_components con campos v4.1
-- ================================================
DO $$
BEGIN
    -- concept_type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'salary_components' AND column_name = 'concept_type'
    ) THEN
        ALTER TABLE "salary_components" ADD COLUMN "concept_type" VARCHAR(30) DEFAULT 'CALCULATED';
    END IF;

    -- is_remunerative
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'salary_components' AND column_name = 'is_remunerative'
    ) THEN
        ALTER TABLE "salary_components" ADD COLUMN "is_remunerative" BOOLEAN DEFAULT TRUE;
    END IF;

    -- affects_employee_contrib
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'salary_components' AND column_name = 'affects_employee_contrib'
    ) THEN
        ALTER TABLE "salary_components" ADD COLUMN "affects_employee_contrib" BOOLEAN DEFAULT TRUE;
    END IF;

    -- affects_employer_contrib
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'salary_components' AND column_name = 'affects_employer_contrib'
    ) THEN
        ALTER TABLE "salary_components" ADD COLUMN "affects_employer_contrib" BOOLEAN DEFAULT TRUE;
    END IF;

    -- affects_income_tax
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'salary_components' AND column_name = 'affects_income_tax'
    ) THEN
        ALTER TABLE "salary_components" ADD COLUMN "affects_income_tax" BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ================================================
-- 8. Mensaje final
-- ================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migración Gremios v4.1 completada!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Tablas creadas:';
    RAISE NOTICE '  - payroll_unions (gremios)';
    RAISE NOTICE '  - union_categories (categorías por gremio)';
    RAISE NOTICE '  - work_sectors (sectores de trabajo)';
    RAISE NOTICE '  - agreement_rates (tasas de convenio)';
    RAISE NOTICE '';
    RAISE NOTICE 'Columnas agregadas:';
    RAISE NOTICE '  - employees.union_category_id';
    RAISE NOTICE '  - employees.work_sector_id';
    RAISE NOTICE '  - payroll_periods.union_id';
    RAISE NOTICE '  - salary_components.concept_type';
    RAISE NOTICE '  - salary_components.is_remunerative';
    RAISE NOTICE '  - salary_components.affects_employee_contrib';
    RAISE NOTICE '  - salary_components.affects_employer_contrib';
    RAISE NOTICE '  - salary_components.affects_income_tax';
    RAISE NOTICE '';
END $$;
