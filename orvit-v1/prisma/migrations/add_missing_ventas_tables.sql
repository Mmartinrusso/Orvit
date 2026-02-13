-- ===================================================================
-- ADD MISSING VENTAS TABLES FOR SEED SCRIPT
-- Safe script using IF NOT EXISTS - won't lose existing data
-- ===================================================================

BEGIN;

-- ===================================================================
-- ENUMS (IF NOT EXIST)
-- ===================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMedium') THEN
        CREATE TYPE "PaymentMedium" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE_TERCERO', 'CHEQUE_PROPIO', 'ECHEQ', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'DEPOSITO', 'COMISION', 'INTERES', 'AJUSTE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
        CREATE TYPE "DeliveryStatus" AS ENUM ('PENDIENTE', 'EN_PREPARACION', 'LISTA_PARA_DESPACHO', 'EN_TRANSITO', 'RETIRADA', 'ENTREGADA', 'ENTREGA_FALLIDA', 'CANCELADA');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryType') THEN
        CREATE TYPE "DeliveryType" AS ENUM ('ENVIO', 'RETIRO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RMAStatus') THEN
        CREATE TYPE "RMAStatus" AS ENUM ('SOLICITADO', 'APROBADO', 'RECHAZADO', 'RECIBIDO', 'EN_REVISION', 'REEMPLAZADO', 'REEMBOLSADO', 'CERRADO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RMAType') THEN
        CREATE TYPE "RMAType" AS ENUM ('DEVOLUCION', 'GARANTIA', 'CAMBIO', 'RECLAMO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GoalPeriod') THEN
        CREATE TYPE "GoalPeriod" AS ENUM ('DIARIO', 'SEMANAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SalesInvoiceStatus') THEN
        CREATE TYPE "SalesInvoiceStatus" AS ENUM ('BORRADOR', 'EMITIDA', 'PARCIALMENTE_COBRADA', 'COBRADA', 'ANULADA');
    END IF;
END $$;

-- ===================================================================
-- TABLE: client_payments
-- ===================================================================

CREATE TABLE IF NOT EXISTS "client_payments" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "fechaPago" DATE NOT NULL,
    "totalPago" DECIMAL(15,2) NOT NULL,
    "efectivo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transferencia" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "chequeTercero" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tarjetaCredito" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tarjetaDebito" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otrosMedios" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "cuentaBancariaId" INTEGER,
    "cajaId" INTEGER,
    "reciboUrl" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_payments_companyId_numero_key') THEN
        ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_companyId_numero_key" UNIQUE ("companyId", "numero");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "client_payments_companyId_idx" ON "client_payments"("companyId");
CREATE INDEX IF NOT EXISTS "client_payments_clientId_idx" ON "client_payments"("clientId");
CREATE INDEX IF NOT EXISTS "client_payments_fechaPago_idx" ON "client_payments"("fechaPago");
CREATE INDEX IF NOT EXISTS "client_payments_docType_idx" ON "client_payments"("docType");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_payments_clientId_fkey') THEN
        ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_clientId_fkey"
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_payments_companyId_fkey') THEN
        ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_payments_createdBy_fkey') THEN
        ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- ===================================================================
-- TABLE: client_payment_allocations
-- ===================================================================

CREATE TABLE IF NOT EXISTS "client_payment_allocations" (
    "id" SERIAL PRIMARY KEY,
    "paymentId" INTEGER NOT NULL,
    "facturaId" INTEGER NOT NULL,
    "montoAplicado" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "client_payment_allocations_paymentId_idx" ON "client_payment_allocations"("paymentId");
CREATE INDEX IF NOT EXISTS "client_payment_allocations_facturaId_idx" ON "client_payment_allocations"("facturaId");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_payment_allocations_paymentId_fkey') THEN
        ALTER TABLE "client_payment_allocations" ADD CONSTRAINT "client_payment_allocations_paymentId_fkey"
            FOREIGN KEY ("paymentId") REFERENCES "client_payments"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- ===================================================================
-- TABLE: sale_deliveries
-- ===================================================================

CREATE TABLE IF NOT EXISTS "sale_deliveries" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "saleId" INTEGER NOT NULL,
    "estado" "DeliveryStatus" NOT NULL DEFAULT 'PENDIENTE',
    "tipo" "DeliveryType" NOT NULL DEFAULT 'ENVIO',
    "fechaProgramada" TIMESTAMP(3),
    "fechaEntrega" TIMESTAMP(3),
    "direccionEntrega" TEXT,
    "transportista" VARCHAR(255),
    "vehiculo" VARCHAR(100),
    "conductorNombre" VARCHAR(255),
    "conductorDNI" VARCHAR(20),
    "notas" TEXT,
    "latitud" DECIMAL(10,8),
    "longitud" DECIMAL(11,8),
    "firmaReceptor" TEXT,
    "nombreReceptor" VARCHAR(255),
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_deliveries_companyId_numero_key') THEN
        ALTER TABLE "sale_deliveries" ADD CONSTRAINT "sale_deliveries_companyId_numero_key" UNIQUE ("companyId", "numero");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sale_deliveries_companyId_idx" ON "sale_deliveries"("companyId");
CREATE INDEX IF NOT EXISTS "sale_deliveries_saleId_idx" ON "sale_deliveries"("saleId");
CREATE INDEX IF NOT EXISTS "sale_deliveries_estado_idx" ON "sale_deliveries"("estado");
CREATE INDEX IF NOT EXISTS "sale_deliveries_fechaProgramada_idx" ON "sale_deliveries"("fechaProgramada");
CREATE INDEX IF NOT EXISTS "sale_deliveries_docType_idx" ON "sale_deliveries"("docType");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_deliveries_saleId_fkey') THEN
        ALTER TABLE "sale_deliveries" ADD CONSTRAINT "sale_deliveries_saleId_fkey"
            FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_deliveries_companyId_fkey') THEN
        ALTER TABLE "sale_deliveries" ADD CONSTRAINT "sale_deliveries_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_deliveries_createdBy_fkey') THEN
        ALTER TABLE "sale_deliveries" ADD CONSTRAINT "sale_deliveries_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- ===================================================================
-- TABLE: sale_delivery_items
-- ===================================================================

CREATE TABLE IF NOT EXISTS "sale_delivery_items" (
    "id" SERIAL PRIMARY KEY,
    "deliveryId" INTEGER NOT NULL,
    "saleItemId" INTEGER NOT NULL,
    "productId" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad" VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS "sale_delivery_items_deliveryId_idx" ON "sale_delivery_items"("deliveryId");
CREATE INDEX IF NOT EXISTS "sale_delivery_items_saleItemId_idx" ON "sale_delivery_items"("saleItemId");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_delivery_items_deliveryId_fkey') THEN
        ALTER TABLE "sale_delivery_items" ADD CONSTRAINT "sale_delivery_items_deliveryId_fkey"
            FOREIGN KEY ("deliveryId") REFERENCES "sale_deliveries"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_delivery_items_saleItemId_fkey') THEN
        ALTER TABLE "sale_delivery_items" ADD CONSTRAINT "sale_delivery_items_saleItemId_fkey"
            FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- ===================================================================
-- TABLE: sale_delivery_evidences
-- ===================================================================

CREATE TABLE IF NOT EXISTS "sale_delivery_evidences" (
    "id" SERIAL PRIMARY KEY,
    "deliveryId" INTEGER NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "url" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "sale_delivery_evidences_deliveryId_idx" ON "sale_delivery_evidences"("deliveryId");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_delivery_evidences_deliveryId_fkey') THEN
        ALTER TABLE "sale_delivery_evidences" ADD CONSTRAINT "sale_delivery_evidences_deliveryId_fkey"
            FOREIGN KEY ("deliveryId") REFERENCES "sale_deliveries"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- ===================================================================
-- TABLE: sale_rmas
-- ===================================================================

CREATE TABLE IF NOT EXISTS "sale_rmas" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "saleId" INTEGER,
    "facturaId" INTEGER,
    "tipo" "RMAType" NOT NULL,
    "estado" "RMAStatus" NOT NULL DEFAULT 'SOLICITADO',
    "fechaSolicitud" DATE NOT NULL,
    "fechaAprobacion" DATE,
    "fechaCierre" DATE,
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,
    "resolucion" TEXT,
    "montoTotal" DECIMAL(15,2),
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "aprobadoPor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_rmas_companyId_numero_key') THEN
        ALTER TABLE "sale_rmas" ADD CONSTRAINT "sale_rmas_companyId_numero_key" UNIQUE ("companyId", "numero");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sale_rmas_companyId_idx" ON "sale_rmas"("companyId");
CREATE INDEX IF NOT EXISTS "sale_rmas_clientId_idx" ON "sale_rmas"("clientId");
CREATE INDEX IF NOT EXISTS "sale_rmas_saleId_idx" ON "sale_rmas"("saleId");
CREATE INDEX IF NOT EXISTS "sale_rmas_estado_idx" ON "sale_rmas"("estado");
CREATE INDEX IF NOT EXISTS "sale_rmas_docType_idx" ON "sale_rmas"("docType");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_rmas_clientId_fkey') THEN
        ALTER TABLE "sale_rmas" ADD CONSTRAINT "sale_rmas_clientId_fkey"
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_rmas_companyId_fkey') THEN
        ALTER TABLE "sale_rmas" ADD CONSTRAINT "sale_rmas_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_rmas_createdBy_fkey') THEN
        ALTER TABLE "sale_rmas" ADD CONSTRAINT "sale_rmas_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_rmas_aprobadoPor_fkey') THEN
        ALTER TABLE "sale_rmas" ADD CONSTRAINT "sale_rmas_aprobadoPor_fkey"
            FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- ===================================================================
-- TABLE: sale_rma_items
-- ===================================================================

CREATE TABLE IF NOT EXISTS "sale_rma_items" (
    "id" SERIAL PRIMARY KEY,
    "rmaId" INTEGER NOT NULL,
    "saleItemId" INTEGER,
    "productId" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "motivo" TEXT,
    "accionTomada" TEXT
);

CREATE INDEX IF NOT EXISTS "sale_rma_items_rmaId_idx" ON "sale_rma_items"("rmaId");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_rma_items_rmaId_fkey') THEN
        ALTER TABLE "sale_rma_items" ADD CONSTRAINT "sale_rma_items_rmaId_fkey"
            FOREIGN KEY ("rmaId") REFERENCES "sale_rmas"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- ===================================================================
-- TABLE: sale_rma_history
-- ===================================================================

CREATE TABLE IF NOT EXISTS "sale_rma_history" (
    "id" SERIAL PRIMARY KEY,
    "rmaId" INTEGER NOT NULL,
    "estadoAnterior" "RMAStatus",
    "estadoNuevo" "RMAStatus" NOT NULL,
    "notas" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "sale_rma_history_rmaId_idx" ON "sale_rma_history"("rmaId");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_rma_history_rmaId_fkey') THEN
        ALTER TABLE "sale_rma_history" ADD CONSTRAINT "sale_rma_history_rmaId_fkey"
            FOREIGN KEY ("rmaId") REFERENCES "sale_rmas"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_rma_history_userId_fkey') THEN
        ALTER TABLE "sale_rma_history" ADD CONSTRAINT "sale_rma_history_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- ===================================================================
-- TABLE: sales_goals
-- ===================================================================

CREATE TABLE IF NOT EXISTS "sales_goals" (
    "id" SERIAL PRIMARY KEY,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "periodo" "GoalPeriod" NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "sellerId" INTEGER,
    "montoObjetivo" DECIMAL(15,2),
    "cantidadObjetivo" DECIMAL(15,4),
    "montoActual" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cantidadActual" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "porcentajeAvance" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "sales_goals_companyId_idx" ON "sales_goals"("companyId");
CREATE INDEX IF NOT EXISTS "sales_goals_sellerId_idx" ON "sales_goals"("sellerId");
CREATE INDEX IF NOT EXISTS "sales_goals_periodo_idx" ON "sales_goals"("periodo");
CREATE INDEX IF NOT EXISTS "sales_goals_fechaInicio_idx" ON "sales_goals"("fechaInicio");
CREATE INDEX IF NOT EXISTS "sales_goals_docType_idx" ON "sales_goals"("docType");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_goals_companyId_fkey') THEN
        ALTER TABLE "sales_goals" ADD CONSTRAINT "sales_goals_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_goals_sellerId_fkey') THEN
        ALTER TABLE "sales_goals" ADD CONSTRAINT "sales_goals_sellerId_fkey"
            FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_goals_createdBy_fkey') THEN
        ALTER TABLE "sales_goals" ADD CONSTRAINT "sales_goals_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- ===================================================================
-- TABLE: sales_goal_progress
-- ===================================================================

CREATE TABLE IF NOT EXISTS "sales_goal_progress" (
    "id" SERIAL PRIMARY KEY,
    "goalId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "montoAcumulado" DECIMAL(15,2) NOT NULL,
    "cantidadAcumulada" DECIMAL(15,4) NOT NULL,
    "porcentajeAvance" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "sales_goal_progress_goalId_idx" ON "sales_goal_progress"("goalId");
CREATE INDEX IF NOT EXISTS "sales_goal_progress_fecha_idx" ON "sales_goal_progress"("fecha");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_goal_progress_goalId_fkey') THEN
        ALTER TABLE "sales_goal_progress" ADD CONSTRAINT "sales_goal_progress_goalId_fkey"
            FOREIGN KEY ("goalId") REFERENCES "sales_goals"("id") ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;

-- ===================================================================
-- SUCCESS MESSAGE
-- ===================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Missing Ventas tables created successfully';
    RAISE NOTICE '   - client_payments, client_payment_allocations';
    RAISE NOTICE '   - sale_deliveries, sale_delivery_items, sale_delivery_evidences';
    RAISE NOTICE '   - sale_rmas, sale_rma_items, sale_rma_history';
    RAISE NOTICE '   - sales_goals, sales_goal_progress';
END $$;
