-- Manual Migration: Agregar docType a goods_receipts
-- Esta columna es necesaria para el sistema ViewMode (T1/T2)

DO $$
BEGIN
    -- Agregar columna docType si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'goods_receipts'
        AND column_name = 'docType'
    ) THEN
        -- Primero, verificar si el enum DocType existe
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocType') THEN
            ALTER TABLE goods_receipts ADD COLUMN "docType" "DocType" NOT NULL DEFAULT 'T1';
            RAISE NOTICE 'Columna docType agregada a goods_receipts con enum DocType';
        ELSE
            -- Crear enum si no existe
            CREATE TYPE "DocType" AS ENUM ('T1', 'T2');
            ALTER TABLE goods_receipts ADD COLUMN "docType" "DocType" NOT NULL DEFAULT 'T1';
            RAISE NOTICE 'Enum DocType creado y columna docType agregada a goods_receipts';
        END IF;
    ELSE
        RAISE NOTICE 'La columna docType ya existe en goods_receipts';
    END IF;
END $$;

-- Verificar
SELECT column_name, data_type, udt_name, column_default
FROM information_schema.columns
WHERE table_name = 'goods_receipts'
AND column_name = 'docType';
