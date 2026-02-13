-- Migración: Agregar campo docType para ViewMode
-- Fecha: 2026-01-12
-- Descripción: Agrega campo docType a tablas que necesitan filtrado por ViewMode

-- ================================================
-- 1. PurchaseAuditLog - Historial de auditoría
-- ================================================
-- Agregar columna si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_audit_logs' AND column_name = 'docType'
    ) THEN
        ALTER TABLE "purchase_audit_logs"
        ADD COLUMN "docType" "DocType" DEFAULT 'T1';

        -- Crear índices
        CREATE INDEX IF NOT EXISTS "purchase_audit_logs_docType_idx"
        ON "purchase_audit_logs"("docType");

        CREATE INDEX IF NOT EXISTS "purchase_audit_logs_companyId_docType_idx"
        ON "purchase_audit_logs"("companyId", "docType");

        RAISE NOTICE 'Columna docType agregada a purchase_audit_logs';
    ELSE
        RAISE NOTICE 'Columna docType ya existe en purchase_audit_logs';
    END IF;
END $$;

-- ================================================
-- 2. SupplierAccountMovement - Cuentas corrientes
-- ================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'SupplierAccountMovement' AND column_name = 'docType'
    ) THEN
        ALTER TABLE "SupplierAccountMovement"
        ADD COLUMN "docType" "DocType" DEFAULT 'T1';

        -- Crear índices
        CREATE INDEX IF NOT EXISTS "SupplierAccountMovement_docType_idx"
        ON "SupplierAccountMovement"("docType");

        CREATE INDEX IF NOT EXISTS "SupplierAccountMovement_companyId_docType_idx"
        ON "SupplierAccountMovement"("companyId", "docType");

        RAISE NOTICE 'Columna docType agregada a SupplierAccountMovement';
    ELSE
        RAISE NOTICE 'Columna docType ya existe en SupplierAccountMovement';
    END IF;
END $$;

-- ================================================
-- 3. Verificar StockMovement (ya debería existir)
-- ================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_movements' AND column_name = 'docType'
    ) THEN
        ALTER TABLE "stock_movements"
        ADD COLUMN "docType" "DocType" DEFAULT 'T1';

        -- Crear índices
        CREATE INDEX IF NOT EXISTS "stock_movements_docType_idx"
        ON "stock_movements"("docType");

        CREATE INDEX IF NOT EXISTS "stock_movements_companyId_docType_idx"
        ON "stock_movements"("companyId", "docType");

        RAISE NOTICE 'Columna docType agregada a stock_movements';
    ELSE
        RAISE NOTICE 'Columna docType ya existe en stock_movements';
    END IF;
END $$;

-- ================================================
-- 4. Mensaje final
-- ================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migración ViewMode completada exitosamente!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Tablas actualizadas:';
    RAISE NOTICE '  - purchase_audit_logs (docType)';
    RAISE NOTICE '  - SupplierAccountMovement (docType)';
    RAISE NOTICE '  - stock_movements (docType)';
    RAISE NOTICE '';
    RAISE NOTICE 'Ejecuta: npx prisma generate';
    RAISE NOTICE 'Para regenerar el cliente Prisma.';
    RAISE NOTICE '';
END $$;
