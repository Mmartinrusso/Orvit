-- Fix para enums existentes - ejecutar ANTES del SQL principal
-- Este script agrega valores faltantes a enums que ya existen

-- CreditDebitNoteStatus - agregar valores si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'BORRADOR' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditDebitNoteStatus')) THEN
        ALTER TYPE "CreditDebitNoteStatus" ADD VALUE 'BORRADOR';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EMITIDA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditDebitNoteStatus')) THEN
        ALTER TYPE "CreditDebitNoteStatus" ADD VALUE 'EMITIDA';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'APLICADA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditDebitNoteStatus')) THEN
        ALTER TYPE "CreditDebitNoteStatus" ADD VALUE 'APLICADA';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ANULADA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditDebitNoteStatus')) THEN
        ALTER TYPE "CreditDebitNoteStatus" ADD VALUE 'ANULADA';
    END IF;
END $$;

-- Verificar valores actuales del enum
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditDebitNoteStatus')
ORDER BY enumsortorder;
