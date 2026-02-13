-- Script seguro: Solo crea tablas nuevas, no modifica datos existentes
-- Sistema de Solicitudes de Compra y Cotizaciones

-- Crear enums nuevos (si no existen)
DO $$ BEGIN
    CREATE TYPE "PurchaseRequestStatus" AS ENUM ('BORRADOR', 'ENVIADA', 'EN_COTIZACION', 'COTIZADA', 'EN_APROBACION', 'APROBADA', 'EN_PROCESO', 'COMPLETADA', 'RECHAZADA', 'CANCELADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RequestPriority" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'URGENTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "QuotationStatus" AS ENUM ('BORRADOR', 'RECIBIDA', 'EN_REVISION', 'SELECCIONADA', 'CONVERTIDA_OC', 'RECHAZADA', 'VENCIDA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PurchaseCommentType" AS ENUM ('COMENTARIO', 'ACTUALIZACION', 'PREGUNTA', 'RESPUESTA', 'SISTEMA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Crear tabla PurchaseRequest
CREATE TABLE IF NOT EXISTS "purchase_requests" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "estado" "PurchaseRequestStatus" NOT NULL DEFAULT 'BORRADOR',
    "prioridad" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "solicitanteId" INTEGER NOT NULL,
    "departamento" VARCHAR(100),
    "fechaNecesidad" DATE,
    "fechaLimite" DATE,
    "presupuestoEstimado" DECIMAL(15,2),
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "adjuntos" TEXT[],
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- Crear tabla PurchaseRequestItem
CREATE TABLE IF NOT EXISTS "purchase_request_items" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "supplierItemId" INTEGER,
    "especificaciones" TEXT,

    CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id")
);

-- Crear tabla PurchaseQuotation
CREATE TABLE IF NOT EXISTS "purchase_quotations" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "requestId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "estado" "QuotationStatus" NOT NULL DEFAULT 'RECIBIDA',
    "fechaCotizacion" DATE NOT NULL,
    "validezHasta" DATE,
    "plazoEntrega" INTEGER,
    "fechaEntregaEstimada" DATE,
    "condicionesPago" VARCHAR(200),
    "formaPago" VARCHAR(100),
    "garantia" VARCHAR(200),
    "subtotal" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "beneficios" TEXT,
    "observaciones" TEXT,
    "adjuntos" TEXT[],
    "esSeleccionada" BOOLEAN NOT NULL DEFAULT false,
    "seleccionadaPor" INTEGER,
    "seleccionadaAt" TIMESTAMP(3),
    "motivoSeleccion" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_quotations_pkey" PRIMARY KEY ("id")
);

-- Crear tabla PurchaseQuotationItem
CREATE TABLE IF NOT EXISTS "purchase_quotation_items" (
    "id" SERIAL NOT NULL,
    "quotationId" INTEGER NOT NULL,
    "requestItemId" INTEGER,
    "supplierItemId" INTEGER,
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,4) NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "notas" TEXT,

    CONSTRAINT "purchase_quotation_items_pkey" PRIMARY KEY ("id")
);

-- Crear tabla PurchaseComment
CREATE TABLE IF NOT EXISTS "purchase_comments" (
    "id" SERIAL NOT NULL,
    "entidad" VARCHAR(50) NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "tipo" "PurchaseCommentType" NOT NULL DEFAULT 'COMENTARIO',
    "contenido" TEXT NOT NULL,
    "adjuntos" TEXT[],
    "mencionados" INTEGER[],
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_comments_pkey" PRIMARY KEY ("id")
);

-- Agregar columnas a purchase_orders (si no existen)
DO $$ BEGIN
    ALTER TABLE "purchase_orders" ADD COLUMN "purchaseRequestId" INTEGER;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_orders" ADD COLUMN "purchaseQuotationId" INTEGER;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Crear índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_requests_companyId_numero_key" ON "purchase_requests"("companyId", "numero");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_quotations_companyId_numero_key" ON "purchase_quotations"("companyId", "numero");

-- Crear índices
CREATE INDEX IF NOT EXISTS "purchase_requests_companyId_idx" ON "purchase_requests"("companyId");
CREATE INDEX IF NOT EXISTS "purchase_requests_estado_idx" ON "purchase_requests"("estado");
CREATE INDEX IF NOT EXISTS "purchase_requests_solicitanteId_idx" ON "purchase_requests"("solicitanteId");
CREATE INDEX IF NOT EXISTS "purchase_requests_prioridad_idx" ON "purchase_requests"("prioridad");

CREATE INDEX IF NOT EXISTS "purchase_request_items_requestId_idx" ON "purchase_request_items"("requestId");

CREATE INDEX IF NOT EXISTS "purchase_quotations_requestId_idx" ON "purchase_quotations"("requestId");
CREATE INDEX IF NOT EXISTS "purchase_quotations_supplierId_idx" ON "purchase_quotations"("supplierId");
CREATE INDEX IF NOT EXISTS "purchase_quotations_companyId_idx" ON "purchase_quotations"("companyId");
CREATE INDEX IF NOT EXISTS "purchase_quotations_estado_idx" ON "purchase_quotations"("estado");

CREATE INDEX IF NOT EXISTS "purchase_quotation_items_quotationId_idx" ON "purchase_quotation_items"("quotationId");

CREATE INDEX IF NOT EXISTS "purchase_comments_entidad_entidadId_idx" ON "purchase_comments"("entidad", "entidadId");
CREATE INDEX IF NOT EXISTS "purchase_comments_companyId_idx" ON "purchase_comments"("companyId");
CREATE INDEX IF NOT EXISTS "purchase_comments_createdAt_idx" ON "purchase_comments"("createdAt");

-- Crear Foreign Keys (si no existen)
DO $$ BEGIN
    ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_solicitanteId_fkey"
    FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_supplierItemId_fkey"
    FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_seleccionadaPor_fkey"
    FOREIGN KEY ("seleccionadaPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_quotation_items" ADD CONSTRAINT "purchase_quotation_items_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "purchase_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_quotation_items" ADD CONSTRAINT "purchase_quotation_items_requestItemId_fkey"
    FOREIGN KEY ("requestItemId") REFERENCES "purchase_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_quotation_items" ADD CONSTRAINT "purchase_quotation_items_supplierItemId_fkey"
    FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_comments" ADD CONSTRAINT "purchase_comments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_comments" ADD CONSTRAINT "purchase_comments_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchaseRequestId_fkey"
    FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchaseQuotationId_fkey"
    FOREIGN KEY ("purchaseQuotationId") REFERENCES "purchase_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Mensaje de confirmación
SELECT 'Tablas de Solicitudes de Compra y Cotizaciones creadas exitosamente' AS result;
