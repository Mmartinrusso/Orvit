-- Manual Migration: Agregar docType a credit_debit_notes
-- Esta columna es necesaria para el filtrado por ViewMode (T1/T2)

DO $$
BEGIN
    -- Verificar si la columna docType ya existe en credit_debit_notes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'credit_debit_notes'
        AND column_name = 'docType'
    ) THEN
        -- Agregar columna docType con valor default T1
        ALTER TABLE credit_debit_notes ADD COLUMN "docType" "DocType" NOT NULL DEFAULT 'T1';
        RAISE NOTICE 'Columna docType agregada a credit_debit_notes';

        -- Crear índices para optimizar queries por viewMode
        CREATE INDEX IF NOT EXISTS "credit_debit_notes_docType_idx" ON credit_debit_notes("docType");
        CREATE INDEX IF NOT EXISTS "credit_debit_notes_companyId_docType_idx" ON credit_debit_notes("companyId", "docType");
        RAISE NOTICE 'Índices creados para docType en credit_debit_notes';
    ELSE
        RAISE NOTICE 'La columna docType ya existe en credit_debit_notes';
    END IF;
END $$;

-- Verificar resultado
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'credit_debit_notes'
AND column_name = 'docType';
