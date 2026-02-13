-- Migración: Módulo de Nóminas/Payroll
-- Fecha: 2026-01-12
-- Descripción: Crea todas las tablas necesarias para el módulo de nóminas

-- ================================================
-- 1. PayrollConfig - Configuración por empresa
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_configs" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL UNIQUE,
    "payment_frequency" VARCHAR(20) NOT NULL DEFAULT 'BIWEEKLY',
    "first_payment_day" INTEGER NOT NULL DEFAULT 15,
    "second_payment_day" INTEGER NOT NULL DEFAULT 30,
    "quincena_percentage" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "payment_day_rule" VARCHAR(30) NOT NULL DEFAULT 'PREVIOUS_BUSINESS_DAY',
    "max_advance_percent" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "max_active_advances" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_configs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "payroll_configs_company_id_idx" ON "payroll_configs"("company_id");

-- ================================================
-- 2. CompanyHoliday - Feriados por empresa
-- ================================================
CREATE TABLE IF NOT EXISTS "company_holidays" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_national" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_holidays_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,

    CONSTRAINT "company_holidays_company_id_date_key" UNIQUE ("company_id", "date")
);

CREATE INDEX IF NOT EXISTS "company_holidays_company_id_date_idx" ON "company_holidays"("company_id", "date");

-- ================================================
-- 3. SalaryComponent - Componentes salariales
-- ================================================
CREATE TABLE IF NOT EXISTS "salary_components" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "calc_type" VARCHAR(20) NOT NULL,
    "calc_value" DECIMAL(12,4),
    "calc_formula" TEXT,
    "base_variable" VARCHAR(20) NOT NULL DEFAULT 'gross',
    "depends_on" TEXT[] DEFAULT '{}',
    "rounding_mode" VARCHAR(20) NOT NULL DEFAULT 'HALF_UP',
    "rounding_decimals" INTEGER NOT NULL DEFAULT 2,
    "cap_min" DECIMAL(12,2),
    "cap_max" DECIMAL(12,2),
    "is_taxable" BOOLEAN NOT NULL DEFAULT TRUE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "apply_to" VARCHAR(255) NOT NULL DEFAULT 'ALL',
    "prorate_on_partial" BOOLEAN NOT NULL DEFAULT TRUE,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_components_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,

    CONSTRAINT "salary_components_company_id_code_key" UNIQUE ("company_id", "code")
);

CREATE INDEX IF NOT EXISTS "salary_components_company_id_idx" ON "salary_components"("company_id");
CREATE INDEX IF NOT EXISTS "salary_components_is_active_idx" ON "salary_components"("is_active");

-- ================================================
-- 4. EmployeeSalaryComponent - Override por empleado
-- ================================================
CREATE TABLE IF NOT EXISTS "employee_salary_components" (
    "id" SERIAL PRIMARY KEY,
    "employee_id" VARCHAR(255) NOT NULL,
    "component_id" INTEGER NOT NULL,
    "custom_value" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "employee_salary_components_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,

    CONSTRAINT "employee_salary_components_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "employee_salary_components_employee_id_idx" ON "employee_salary_components"("employee_id");
CREATE INDEX IF NOT EXISTS "employee_salary_components_effective_from_idx" ON "employee_salary_components"("employee_id", "effective_from");

-- ================================================
-- 5. PayrollPeriod - Períodos de nómina
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_periods" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL,
    "period_type" VARCHAR(20) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "payment_date" DATE NOT NULL,
    "business_days" INTEGER NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_periods_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_periods_company_id_year_month_period_type_key"
    UNIQUE ("company_id", "year", "month", "period_type")
);

CREATE INDEX IF NOT EXISTS "payroll_periods_company_id_year_month_idx" ON "payroll_periods"("company_id", "year", "month");
CREATE INDEX IF NOT EXISTS "payroll_periods_payment_date_idx" ON "payroll_periods"("payment_date");

-- ================================================
-- 6. PayrollInput - Variables de período por empleado
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_inputs" (
    "id" SERIAL PRIMARY KEY,
    "period_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "input_key" VARCHAR(100) NOT NULL,
    "input_value" DECIMAL(12,4) NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_inputs_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_inputs_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_inputs_period_id_employee_id_input_key_key"
    UNIQUE ("period_id", "employee_id", "input_key")
);

CREATE INDEX IF NOT EXISTS "payroll_inputs_period_id_idx" ON "payroll_inputs"("period_id");

-- ================================================
-- 7. Payroll - Liquidaciones
-- ================================================
CREATE TABLE IF NOT EXISTS "payrolls" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL,
    "period_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "total_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_employer_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "calculated_at" TIMESTAMP(3),
    "calculated_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "paid_at" TIMESTAMP(3),
    "paid_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" INTEGER,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payrolls_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,

    CONSTRAINT "payrolls_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "payrolls_company_id_status_idx" ON "payrolls"("company_id", "status");
CREATE INDEX IF NOT EXISTS "payrolls_period_id_idx" ON "payrolls"("period_id");

-- ================================================
-- 8. PayrollItem - Detalle por empleado
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_items" (
    "id" SERIAL PRIMARY KEY,
    "payroll_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "cost_center_id" INTEGER,
    "days_worked" INTEGER NOT NULL DEFAULT 30,
    "days_in_period" INTEGER NOT NULL DEFAULT 30,
    "prorate_factor" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "base_salary" DECIMAL(12,2) NOT NULL,
    "total_earnings" DECIMAL(12,2) NOT NULL,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "advances_discounted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_salary" DECIMAL(12,2) NOT NULL,
    "employer_cost" DECIMAL(12,2) NOT NULL,
    "snapshot" JSONB,

    CONSTRAINT "payroll_items_payroll_id_fkey"
    FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_items_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_items_payroll_id_employee_id_key"
    UNIQUE ("payroll_id", "employee_id")
);

CREATE INDEX IF NOT EXISTS "payroll_items_payroll_id_idx" ON "payroll_items"("payroll_id");

-- ================================================
-- 9. PayrollItemLine - Líneas por componente
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_item_lines" (
    "id" SERIAL PRIMARY KEY,
    "payroll_item_id" INTEGER NOT NULL,
    "component_id" INTEGER,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "calculated_amount" DECIMAL(12,2) NOT NULL,
    "final_amount" DECIMAL(12,2) NOT NULL,
    "formula_used" TEXT,
    "meta" JSONB,

    CONSTRAINT "payroll_item_lines_payroll_item_id_fkey"
    FOREIGN KEY ("payroll_item_id") REFERENCES "payroll_items"("id") ON DELETE CASCADE,

    CONSTRAINT "payroll_item_lines_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "payroll_item_lines_payroll_item_id_idx" ON "payroll_item_lines"("payroll_item_id");
CREATE INDEX IF NOT EXISTS "payroll_item_lines_code_idx" ON "payroll_item_lines"("code");

-- ================================================
-- 10. SalaryAdvance - Adelantos de sueldo
-- ================================================
CREATE TABLE IF NOT EXISTS "salary_advances" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "installments_count" INTEGER NOT NULL DEFAULT 1,
    "installment_amount" DECIMAL(12,2) NOT NULL,
    "remaining_amount" DECIMAL(12,2) NOT NULL,
    "request_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" INTEGER,
    "reject_reason" TEXT,
    "payroll_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_advances_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,

    CONSTRAINT "salary_advances_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,

    CONSTRAINT "salary_advances_payroll_id_fkey"
    FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "salary_advances_company_id_status_idx" ON "salary_advances"("company_id", "status");
CREATE INDEX IF NOT EXISTS "salary_advances_employee_id_idx" ON "salary_advances"("employee_id");

-- ================================================
-- 11. AdvanceInstallment - Cuotas de adelanto
-- ================================================
CREATE TABLE IF NOT EXISTS "advance_installments" (
    "id" SERIAL PRIMARY KEY,
    "advance_id" INTEGER NOT NULL,
    "installment_num" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_period_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "discounted_at" TIMESTAMP(3),
    "payroll_item_id" INTEGER,

    CONSTRAINT "advance_installments_advance_id_fkey"
    FOREIGN KEY ("advance_id") REFERENCES "salary_advances"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "advance_installments_advance_id_idx" ON "advance_installments"("advance_id");
CREATE INDEX IF NOT EXISTS "advance_installments_due_period_id_status_idx" ON "advance_installments"("due_period_id", "status");

-- ================================================
-- 12. PayrollAuditLog - Auditoría
-- ================================================
CREATE TABLE IF NOT EXISTS "payroll_audit_logs" (
    "id" SERIAL PRIMARY KEY,
    "payroll_id" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "details" JSONB,
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_audit_logs_payroll_id_fkey"
    FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "payroll_audit_logs_payroll_id_idx" ON "payroll_audit_logs"("payroll_id");

-- ================================================
-- 13. Modificar Employee - Agregar campos de nómina
-- ================================================
DO $$
BEGIN
    -- Agregar hire_date si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'hire_date'
    ) THEN
        ALTER TABLE "employees" ADD COLUMN "hire_date" DATE;
        RAISE NOTICE 'Columna hire_date agregada a employees';
    END IF;

    -- Agregar termination_date si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'termination_date'
    ) THEN
        ALTER TABLE "employees" ADD COLUMN "termination_date" DATE;
        RAISE NOTICE 'Columna termination_date agregada a employees';
    END IF;

    -- Agregar cost_center_id si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'cost_center_id'
    ) THEN
        ALTER TABLE "employees" ADD COLUMN "cost_center_id" INTEGER;
        RAISE NOTICE 'Columna cost_center_id agregada a employees';
    END IF;
END $$;

-- ================================================
-- 14. Mensaje final
-- ================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migración Módulo Nóminas completada!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Tablas creadas:';
    RAISE NOTICE '  - payroll_configs';
    RAISE NOTICE '  - company_holidays';
    RAISE NOTICE '  - salary_components';
    RAISE NOTICE '  - employee_salary_components';
    RAISE NOTICE '  - payroll_periods';
    RAISE NOTICE '  - payroll_inputs';
    RAISE NOTICE '  - payrolls';
    RAISE NOTICE '  - payroll_items';
    RAISE NOTICE '  - payroll_item_lines';
    RAISE NOTICE '  - salary_advances';
    RAISE NOTICE '  - advance_installments';
    RAISE NOTICE '  - payroll_audit_logs';
    RAISE NOTICE '';
    RAISE NOTICE 'Columnas agregadas a employees:';
    RAISE NOTICE '  - hire_date';
    RAISE NOTICE '  - termination_date';
    RAISE NOTICE '  - cost_center_id';
    RAISE NOTICE '';
    RAISE NOTICE 'Ejecuta: npx prisma generate';
    RAISE NOTICE 'Para regenerar el cliente Prisma.';
    RAISE NOTICE '';
END $$;
