-- ============================================================================
-- CENTRO DE COSTOS EMPRESARIAL V2
-- Migración manual para agregar tablas de consolidación de costos
-- ============================================================================

-- Tabla: cost_system_configs
-- Configuración del sistema de costos por empresa
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'cost_system_configs') THEN
        CREATE TABLE "cost_system_configs" (
            "id" SERIAL PRIMARY KEY,
            "companyId" INTEGER NOT NULL UNIQUE,
            "version" VARCHAR(10) NOT NULL DEFAULT 'V1',
            "usePayrollData" BOOLEAN NOT NULL DEFAULT false,
            "useComprasData" BOOLEAN NOT NULL DEFAULT false,
            "useVentasData" BOOLEAN NOT NULL DEFAULT false,
            "useProdData" BOOLEAN NOT NULL DEFAULT false,
            "useIndirectData" BOOLEAN NOT NULL DEFAULT false,
            "useMaintData" BOOLEAN NOT NULL DEFAULT false,
            "v2EnabledAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "cost_system_configs_companyId_fkey"
                FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        RAISE NOTICE 'Tabla cost_system_configs creada exitosamente';
    ELSE
        RAISE NOTICE 'Tabla cost_system_configs ya existe, saltando...';
    END IF;
END $$;

-- Tabla: monthly_cost_consolidations
-- Consolidación mensual de costos (patrón SNAPSHOT)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'monthly_cost_consolidations') THEN
        CREATE TABLE "monthly_cost_consolidations" (
            "id" SERIAL PRIMARY KEY,
            "companyId" INTEGER NOT NULL,
            "month" VARCHAR(7) NOT NULL,

            -- Costos por categoría
            "payrollCost" DECIMAL(14, 2) NOT NULL DEFAULT 0,
            "purchasesCost" DECIMAL(14, 2) NOT NULL DEFAULT 0,
            "indirectCost" DECIMAL(14, 2) NOT NULL DEFAULT 0,
            "productionCost" DECIMAL(14, 2) NOT NULL DEFAULT 0,
            "maintenanceCost" DECIMAL(14, 2) NOT NULL DEFAULT 0,

            -- Ingresos
            "salesRevenue" DECIMAL(14, 2) NOT NULL DEFAULT 0,
            "salesCost" DECIMAL(14, 2) NOT NULL DEFAULT 0,
            "grossMargin" DECIMAL(14, 2) NOT NULL DEFAULT 0,

            -- Totales
            "totalCost" DECIMAL(14, 2) NOT NULL DEFAULT 0,
            "totalRevenue" DECIMAL(14, 2) NOT NULL DEFAULT 0,
            "netResult" DECIMAL(14, 2) NOT NULL DEFAULT 0,

            -- Metadata
            "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "calculatedById" INTEGER,
            "version" VARCHAR(10) NOT NULL DEFAULT 'V1',
            "details" JSONB,
            "isClosed" BOOLEAN NOT NULL DEFAULT false,

            CONSTRAINT "monthly_cost_consolidations_companyId_fkey"
                FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "monthly_cost_consolidations_calculatedById_fkey"
                FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT "monthly_cost_consolidations_companyId_month_key"
                UNIQUE ("companyId", "month")
        );

        -- Índices
        CREATE INDEX "monthly_cost_consolidations_companyId_month_idx"
            ON "monthly_cost_consolidations"("companyId", "month");

        RAISE NOTICE 'Tabla monthly_cost_consolidations creada exitosamente';
    ELSE
        RAISE NOTICE 'Tabla monthly_cost_consolidations ya existe, saltando...';
    END IF;
END $$;

-- Trigger para actualizar updatedAt en cost_system_configs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_cost_system_configs_updated_at') THEN
        CREATE OR REPLACE FUNCTION update_cost_system_configs_updated_at()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW."updatedAt" = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;

        CREATE TRIGGER set_cost_system_configs_updated_at
            BEFORE UPDATE ON "cost_system_configs"
            FOR EACH ROW
            EXECUTE FUNCTION update_cost_system_configs_updated_at();

        RAISE NOTICE 'Trigger para cost_system_configs creado exitosamente';
    END IF;
END $$;

-- Verificación final
DO $$
BEGIN
    RAISE NOTICE '=== Migración de Centro de Costos V2 completada ===';
    RAISE NOTICE 'Tablas creadas:';
    RAISE NOTICE '  - cost_system_configs';
    RAISE NOTICE '  - monthly_cost_consolidations';
END $$;
