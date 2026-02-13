-- ============================================
-- AGREGAR VALORES FALTANTES A ENUMS EXISTENTES
-- Ejecutar ANTES de create_ventas_tables.sql
-- ============================================

-- Agregar CONFIRMADO a ClientPaymentStatus si no existe
DO $$ BEGIN
    ALTER TYPE "ClientPaymentStatus" ADD VALUE IF NOT EXISTS 'CONFIRMADO';
EXCEPTION
    WHEN others THEN null;
END $$;

-- Crear enums nuevos si no existen
DO $$ BEGIN
    CREATE TYPE "DeliveryStatus" AS ENUM ('PENDIENTE', 'PROGRAMADA', 'EN_PREPARACION', 'EN_TRANSITO', 'ENTREGADA', 'CANCELADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RemitoStatus" AS ENUM ('BORRADOR', 'EMITIDO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SalesInvoiceType" AS ENUM ('FACTURA', 'NOTA_DEBITO', 'NOTA_CREDITO', 'RECIBO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SalesInvoiceStatus" AS ENUM ('BORRADOR', 'EMITIDA', 'PARCIALMENTE_COBRADA', 'COBRADA', 'VENCIDA', 'ANULADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AFIPStatus" AS ENUM ('PENDIENTE', 'PROCESANDO', 'APROBADO', 'RECHAZADO', 'ERROR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SalesCreditDebitType" AS ENUM ('NOTA_CREDITO', 'NOTA_DEBITO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ChequeStatus - puede tener valores distintos en la BD
DO $$ BEGIN
    CREATE TYPE "ChequeStatus" AS ENUM ('CARTERA', 'DEPOSITADO', 'COBRADO', 'RECHAZADO', 'ENDOSADO');
EXCEPTION
    WHEN duplicate_object THEN
        -- El enum ya existe, agregar valores faltantes
        BEGIN
            ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'CARTERA';
        EXCEPTION WHEN others THEN null;
        END;
        BEGIN
            ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'DEPOSITADO';
        EXCEPTION WHEN others THEN null;
        END;
        BEGIN
            ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'COBRADO';
        EXCEPTION WHEN others THEN null;
        END;
        BEGIN
            ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'RECHAZADO';
        EXCEPTION WHEN others THEN null;
        END;
        BEGIN
            ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'ENDOSADO';
        EXCEPTION WHEN others THEN null;
        END;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClientMovementType" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'PAGO', 'ANTICIPO', 'AJUSTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CreditDebitNoteStatus" AS ENUM ('BORRADOR', 'EMITIDA', 'APLICADA', 'ANULADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
