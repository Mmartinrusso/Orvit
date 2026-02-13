-- Migración: Sistema de Nóminas v4 - Corridas y Conceptos
-- Fecha: 2026-01-13
-- Descripción: Crea tablas para corridas de liquidación, conceptos fijos/variables y eventos de asistencia

-- ================================================
-- 1. PayrollRun (Corridas de Liquidación)
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_runs" (
    "id" SERIAL PRIMARY KEY,
    "period_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "run_number" INTEGER NOT NULL DEFAULT 1,
    "run_type" VARCHAR(30) NOT NULL DEFAULT 'REGULAR',
    -- REGULAR | ADJUSTMENT | RETROACTIVE

    -- Estado
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT | CALCULATED | APPROVED | PAID | VOID

    -- Totales
    "total_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_employer_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "employee_count" INTEGER NOT NULL DEFAULT 0,

    -- Auditoría
    "calculated_at" TIMESTAMP(3),
    "calculated_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "paid_at" TIMESTAMP(3),
    "paid_by" INTEGER,
    "locked_at" TIMESTAMP(3),
    "locked_by" INTEGER,
    "voided_at" TIMESTAMP(3),
    "voided_by" INTEGER,
    "void_reason" TEXT,

    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_runs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_runs_period_id_run_number_key" UNIQUE ("period_id", "run_number")
);

CREATE INDEX IF NOT EXISTS "payroll_runs_period_id_idx" ON "payroll_runs"("period_id");
CREATE INDEX IF NOT EXISTS "payroll_runs_company_id_status_idx" ON "payroll_runs"("company_id", "status");

-- ================================================
-- 2. PayrollRunItem (Detalle por empleado en la corrida)
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_run_items" (
    "id" SERIAL PRIMARY KEY,
    "run_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,

    -- Snapshot del empleado al momento del cálculo
    "employee_snapshot" JSONB,

    -- Cálculos
    "days_worked" INTEGER NOT NULL DEFAULT 30,
    "days_in_period" INTEGER NOT NULL DEFAULT 30,
    "prorate_factor" DECIMAL(5,4) NOT NULL DEFAULT 1,

    "base_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross_remunerative" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "advances_discounted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "employer_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "payroll_run_items_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_run_items_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_run_items_run_id_employee_id_key" UNIQUE ("run_id", "employee_id")
);

CREATE INDEX IF NOT EXISTS "payroll_run_items_run_id_idx" ON "payroll_run_items"("run_id");
CREATE INDEX IF NOT EXISTS "payroll_run_items_employee_id_idx" ON "payroll_run_items"("employee_id");

-- ================================================
-- 3. PayrollRunItemLine (Líneas de detalle por concepto)
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_run_item_lines" (
    "id" SERIAL PRIMARY KEY,
    "run_item_id" INTEGER NOT NULL,
    "component_id" INTEGER,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL,

    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "base_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "calculated_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    "formula_used" TEXT,
    "meta" JSONB,

    CONSTRAINT "payroll_run_item_lines_run_item_id_fkey"
    FOREIGN KEY ("run_item_id") REFERENCES "payroll_run_items"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_run_item_lines_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "payroll_run_item_lines_run_item_id_idx" ON "payroll_run_item_lines"("run_item_id");
CREATE INDEX IF NOT EXISTS "payroll_run_item_lines_code_idx" ON "payroll_run_item_lines"("code");

-- ================================================
-- 4. EmployeeFixedConcept (Conceptos fijos con vigencia)
-- ================================================
CREATE TABLE IF NOT EXISTS "employee_fixed_concepts" (
    "id" SERIAL PRIMARY KEY,
    "employee_id" VARCHAR(255) NOT NULL,
    "component_id" INTEGER NOT NULL,

    -- Valores
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "comment" VARCHAR(500),
    "no_delete" BOOLEAN NOT NULL DEFAULT FALSE,

    -- Vigencia
    "effective_from" DATE NOT NULL DEFAULT CURRENT_DATE,
    "effective_to" DATE,

    -- Origen
    "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    -- MANUAL | CATEGORY_DEFAULT | AGREEMENT_TABLE | IMPORT

    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "employee_fixed_concepts_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,

    CONSTRAINT "employee_fixed_concepts_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "employee_fixed_concepts_employee_id_idx" ON "employee_fixed_concepts"("employee_id");
CREATE INDEX IF NOT EXISTS "employee_fixed_concepts_effective_idx" ON "employee_fixed_concepts"("employee_id", "effective_from");
CREATE INDEX IF NOT EXISTS "employee_fixed_concepts_component_id_idx" ON "employee_fixed_concepts"("component_id");

-- ================================================
-- 5. PayrollVariableConcept (Conceptos variables por período)
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_variable_concepts" (
    "id" SERIAL PRIMARY KEY,
    "period_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "component_id" INTEGER NOT NULL,

    -- Valores
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "settlement_date" DATE,
    "transaction_date" DATE,
    "comment" VARCHAR(500),

    -- Estado
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT | APPROVED | VOID

    -- Origen
    "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    -- MANUAL | IMPORT | ADVANCE_SYSTEM | ATTENDANCE | TIME_CLOCK

    "created_by" INTEGER,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "attachment_id" INTEGER,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_variable_concepts_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_variable_concepts_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_variable_concepts_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "payroll_variable_concepts_period_employee_idx" ON "payroll_variable_concepts"("period_id", "employee_id");
CREATE INDEX IF NOT EXISTS "payroll_variable_concepts_status_idx" ON "payroll_variable_concepts"("status");

-- ================================================
-- 6. AttendanceEvent (Eventos de asistencia)
-- ================================================
CREATE TABLE IF NOT EXISTS "attendance_events" (
    "id" SERIAL PRIMARY KEY,
    "period_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    -- ABSENCE | LATE_ARRIVAL | EARLY_LEAVE | VACATION | SICK_LEAVE | ACCIDENT

    "event_date" DATE NOT NULL,
    "quantity" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "minutes_late" INTEGER,
    "comment" VARCHAR(500),

    -- Si genera concepto variable automáticamente
    "generated_concept_id" INTEGER,

    "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    -- MANUAL | TIME_CLOCK | IMPORT

    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_events_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE,

    CONSTRAINT "attendance_events_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "attendance_events_period_employee_idx" ON "attendance_events"("period_id", "employee_id");
CREATE INDEX IF NOT EXISTS "attendance_events_event_date_idx" ON "attendance_events"("event_date");

-- ================================================
-- 7. CategoryDefaultConcept (Conceptos por defecto de categoría)
-- ================================================
CREATE TABLE IF NOT EXISTS "category_default_concepts" (
    "id" SERIAL PRIMARY KEY,
    "union_category_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,

    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(12,2),
    "use_agreement_rate" BOOLEAN NOT NULL DEFAULT FALSE,
    "agreement_rate_field" VARCHAR(50),
    -- daily_rate | hourly_rate | presenteeism_rate

    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_default_concepts_union_category_id_fkey"
    FOREIGN KEY ("union_category_id") REFERENCES "union_categories"("id") ON DELETE CASCADE,

    CONSTRAINT "category_default_concepts_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE CASCADE,

    CONSTRAINT "category_default_concepts_category_component_key"
    UNIQUE ("union_category_id", "component_id")
);

CREATE INDEX IF NOT EXISTS "category_default_concepts_category_id_idx" ON "category_default_concepts"("union_category_id");

-- ================================================
-- 8. Actualizar payroll_audit_logs para soportar run_id
-- ================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payroll_audit_logs' AND column_name = 'run_id'
    ) THEN
        ALTER TABLE "payroll_audit_logs" ADD COLUMN "run_id" INTEGER;
        ALTER TABLE "payroll_audit_logs" ADD CONSTRAINT "payroll_audit_logs_run_id_fkey"
            FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS "payroll_audit_logs_run_id_idx" ON "payroll_audit_logs"("run_id");
    END IF;
END $$;

-- ================================================
-- 9. Mensaje final
-- ================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migración Nóminas v4 - Corridas completada!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Tablas creadas:';
    RAISE NOTICE '  - payroll_runs (corridas de liquidación)';
    RAISE NOTICE '  - payroll_run_items (detalle por empleado)';
    RAISE NOTICE '  - payroll_run_item_lines (líneas por concepto)';
    RAISE NOTICE '  - employee_fixed_concepts (conceptos fijos con vigencia)';
    RAISE NOTICE '  - payroll_variable_concepts (conceptos variables por período)';
    RAISE NOTICE '  - attendance_events (eventos de asistencia)';
    RAISE NOTICE '  - category_default_concepts (conceptos default por categoría)';
    RAISE NOTICE '';
END $$;
