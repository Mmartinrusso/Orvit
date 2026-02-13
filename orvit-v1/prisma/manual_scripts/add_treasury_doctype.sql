-- Migración: Agregar campo docType a treasury_transfers
-- Fecha: 2026-01-13
-- Descripción: Agrega campo docType para soporte ViewMode (T1/T2) en transferencias

-- ================================================
-- 1. TreasuryTransfer - Agregar docType
-- ================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'treasury_transfers' AND column_name = 'docType'
    ) THEN
        ALTER TABLE "treasury_transfers"
        ADD COLUMN "docType" "DocType" DEFAULT 'T1';

        -- Crear índices
        CREATE INDEX IF NOT EXISTS "treasury_transfers_docType_idx"
        ON "treasury_transfers"("docType");

        CREATE INDEX IF NOT EXISTS "treasury_transfers_companyId_docType_idx"
        ON "treasury_transfers"("companyId", "docType");

        RAISE NOTICE 'Columna docType agregada a treasury_transfers';
    ELSE
        RAISE NOTICE 'Columna docType ya existe en treasury_transfers';
    END IF;
END $$;

-- ================================================
-- 2. Mensaje final
-- ================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migración Treasury docType completada!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Ejecuta: npx prisma generate';
    RAISE NOTICE 'Para regenerar el cliente Prisma.';
    RAISE NOTICE '';
END $$;
