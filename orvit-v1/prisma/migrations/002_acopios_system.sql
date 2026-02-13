-- =============================================
-- SISTEMA DE ACOPIOS - Fase B
-- Mercadería pagada pendiente de retiro
-- =============================================

-- =============================================
-- ENUMS
-- =============================================

DO $$ BEGIN
    CREATE TYPE "SaleConditionType" AS ENUM ('FORMAL', 'INFORMAL', 'MIXTO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AcopioStatus" AS ENUM ('ACTIVO', 'PARCIAL', 'RETIRADO', 'VENCIDO', 'CANCELADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- MODIFICAR TABLA Client - Agregar campos de acopio y condiciones
-- =============================================

DO $$
BEGIN
    -- Tipo de condición de venta
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'tipoCondicionVenta') THEN
        ALTER TABLE "Client" ADD COLUMN "tipoCondicionVenta" "SaleConditionType" DEFAULT 'FORMAL';
    END IF;

    -- Porcentaje formal para MIXTO
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'porcentajeFormal') THEN
        ALTER TABLE "Client" ADD COLUMN "porcentajeFormal" DECIMAL(5,2);
    END IF;

    -- Límite de acopio
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'limiteAcopio') THEN
        ALTER TABLE "Client" ADD COLUMN "limiteAcopio" DECIMAL(15,2);
    END IF;

    -- Acopio actual
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'acopioActual') THEN
        ALTER TABLE "Client" ADD COLUMN "acopioActual" DECIMAL(15,2) DEFAULT 0;
    END IF;

    -- Días de alerta de acopio
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'diasAlertaAcopio') THEN
        ALTER TABLE "Client" ADD COLUMN "diasAlertaAcopio" INTEGER;
    END IF;
END $$;

-- =============================================
-- MODIFICAR TABLA SalesConfig - Agregar configuración de acopios
-- =============================================

DO $$
BEGIN
    -- Habilitar acopios
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SalesConfig' AND column_name = 'habilitarAcopios') THEN
        ALTER TABLE "SalesConfig" ADD COLUMN "habilitarAcopios" BOOLEAN DEFAULT true;
    END IF;

    -- Días de alerta por defecto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SalesConfig' AND column_name = 'diasAlertaAcopioDefault') THEN
        ALTER TABLE "SalesConfig" ADD COLUMN "diasAlertaAcopioDefault" INTEGER DEFAULT 30;
    END IF;

    -- Días de vencimiento por defecto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SalesConfig' AND column_name = 'diasVencimientoAcopioDefault') THEN
        ALTER TABLE "SalesConfig" ADD COLUMN "diasVencimientoAcopioDefault" INTEGER DEFAULT 90;
    END IF;

    -- Bloquear venta si acopio excedido
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SalesConfig' AND column_name = 'bloquearVentaAcopioExcedido') THEN
        ALTER TABLE "SalesConfig" ADD COLUMN "bloquearVentaAcopioExcedido" BOOLEAN DEFAULT false;
    END IF;
END $$;

-- =============================================
-- TABLA: sale_acopios (Acopios)
-- =============================================

CREATE TABLE IF NOT EXISTS "sale_acopios" (
    "id" SERIAL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "saleId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "estado" "AcopioStatus" NOT NULL DEFAULT 'ACTIVO',
    "fechaIngreso" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fechaVencimiento" DATE,
    "montoTotal" DECIMAL(15,2) NOT NULL,
    "montoRetirado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "montoPendiente" DECIMAL(15,2) NOT NULL,
    "notas" TEXT,
    "docType" "DocType" DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS "sale_acopios_companyId_numero_key" ON "sale_acopios"("companyId", "numero");
CREATE INDEX IF NOT EXISTS "sale_acopios_clientId_idx" ON "sale_acopios"("clientId");
CREATE INDEX IF NOT EXISTS "sale_acopios_saleId_idx" ON "sale_acopios"("saleId");
CREATE INDEX IF NOT EXISTS "sale_acopios_estado_idx" ON "sale_acopios"("estado");
CREATE INDEX IF NOT EXISTS "sale_acopios_companyId_idx" ON "sale_acopios"("companyId");
CREATE INDEX IF NOT EXISTS "sale_acopios_fechaVencimiento_idx" ON "sale_acopios"("fechaVencimiento");

-- Foreign Keys
ALTER TABLE "sale_acopios" DROP CONSTRAINT IF EXISTS "sale_acopios_clientId_fkey";
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_acopios" DROP CONSTRAINT IF EXISTS "sale_acopios_saleId_fkey";
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_acopios" DROP CONSTRAINT IF EXISTS "sale_acopios_paymentId_fkey";
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "ClientPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sale_acopios" DROP CONSTRAINT IF EXISTS "sale_acopios_companyId_fkey";
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_acopios" DROP CONSTRAINT IF EXISTS "sale_acopios_createdBy_fkey";
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================
-- TABLA: sale_acopio_items (Items de Acopio)
-- =============================================

CREATE TABLE IF NOT EXISTS "sale_acopio_items" (
    "id" SERIAL PRIMARY KEY,
    "acopioId" INTEGER NOT NULL,
    "saleItemId" INTEGER,
    "productId" INTEGER,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadRetirada" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cantidadPendiente" DECIMAL(15,4) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'UN',
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS "sale_acopio_items_acopioId_idx" ON "sale_acopio_items"("acopioId");
CREATE INDEX IF NOT EXISTS "sale_acopio_items_productId_idx" ON "sale_acopio_items"("productId");

-- Foreign Keys
ALTER TABLE "sale_acopio_items" DROP CONSTRAINT IF EXISTS "sale_acopio_items_acopioId_fkey";
ALTER TABLE "sale_acopio_items" ADD CONSTRAINT "sale_acopio_items_acopioId_fkey"
    FOREIGN KEY ("acopioId") REFERENCES "sale_acopios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_acopio_items" DROP CONSTRAINT IF EXISTS "sale_acopio_items_saleItemId_fkey";
ALTER TABLE "sale_acopio_items" ADD CONSTRAINT "sale_acopio_items_saleItemId_fkey"
    FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sale_acopio_items" DROP CONSTRAINT IF EXISTS "sale_acopio_items_productId_fkey";
ALTER TABLE "sale_acopio_items" ADD CONSTRAINT "sale_acopio_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- TABLA: acopio_retiros (Retiros de Acopio)
-- =============================================

CREATE TABLE IF NOT EXISTS "acopio_retiros" (
    "id" SERIAL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "acopioId" INTEGER NOT NULL,
    "fechaRetiro" DATE NOT NULL DEFAULT CURRENT_DATE,
    "retiraNombre" TEXT,
    "retiraDNI" TEXT,
    "retiraRelacion" TEXT,
    "montoRetirado" DECIMAL(15,2) NOT NULL,
    "transportista" TEXT,
    "vehiculo" TEXT,
    "patente" TEXT,
    "firmaRetiro" TEXT,
    "notas" TEXT,
    "docType" "DocType" DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS "acopio_retiros_companyId_numero_key" ON "acopio_retiros"("companyId", "numero");
CREATE INDEX IF NOT EXISTS "acopio_retiros_acopioId_idx" ON "acopio_retiros"("acopioId");
CREATE INDEX IF NOT EXISTS "acopio_retiros_companyId_idx" ON "acopio_retiros"("companyId");
CREATE INDEX IF NOT EXISTS "acopio_retiros_fechaRetiro_idx" ON "acopio_retiros"("fechaRetiro");

-- Foreign Keys
ALTER TABLE "acopio_retiros" DROP CONSTRAINT IF EXISTS "acopio_retiros_acopioId_fkey";
ALTER TABLE "acopio_retiros" ADD CONSTRAINT "acopio_retiros_acopioId_fkey"
    FOREIGN KEY ("acopioId") REFERENCES "sale_acopios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acopio_retiros" DROP CONSTRAINT IF EXISTS "acopio_retiros_companyId_fkey";
ALTER TABLE "acopio_retiros" ADD CONSTRAINT "acopio_retiros_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acopio_retiros" DROP CONSTRAINT IF EXISTS "acopio_retiros_createdBy_fkey";
ALTER TABLE "acopio_retiros" ADD CONSTRAINT "acopio_retiros_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================
-- TABLA: acopio_retiro_items (Items de Retiro)
-- =============================================

CREATE TABLE IF NOT EXISTS "acopio_retiro_items" (
    "id" SERIAL PRIMARY KEY,
    "retiroId" INTEGER NOT NULL,
    "acopioItemId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS "acopio_retiro_items_retiroId_idx" ON "acopio_retiro_items"("retiroId");
CREATE INDEX IF NOT EXISTS "acopio_retiro_items_acopioItemId_idx" ON "acopio_retiro_items"("acopioItemId");

-- Foreign Keys
ALTER TABLE "acopio_retiro_items" DROP CONSTRAINT IF EXISTS "acopio_retiro_items_retiroId_fkey";
ALTER TABLE "acopio_retiro_items" ADD CONSTRAINT "acopio_retiro_items_retiroId_fkey"
    FOREIGN KEY ("retiroId") REFERENCES "acopio_retiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acopio_retiro_items" DROP CONSTRAINT IF EXISTS "acopio_retiro_items_acopioItemId_fkey";
ALTER TABLE "acopio_retiro_items" ADD CONSTRAINT "acopio_retiro_items_acopioItemId_fkey"
    FOREIGN KEY ("acopioItemId") REFERENCES "sale_acopio_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================
-- TRIGGER: Actualizar updatedAt en sale_acopios
-- =============================================

CREATE OR REPLACE FUNCTION update_sale_acopios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sale_acopios_updated_at ON "sale_acopios";
CREATE TRIGGER trigger_sale_acopios_updated_at
    BEFORE UPDATE ON "sale_acopios"
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_acopios_updated_at();

-- =============================================
-- FIN - Sistema de Acopios Creado
-- =============================================

DO $$ BEGIN
    RAISE NOTICE 'Sistema de Acopios - Migración completada exitosamente';
END $$;
