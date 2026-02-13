-- Manual Almacen Tables Migration
-- Creates the missing almacen module tables

-- Enums (if not exist)
DO $$ BEGIN
    CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVA', 'CONSUMIDA_PARCIAL', 'CONSUMIDA', 'LIBERADA', 'EXPIRADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "StockReservationType" AS ENUM ('SOLICITUD_MATERIAL', 'ORDEN_PRODUCCION', 'ORDEN_TRABAJO', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MaterialRequestStatus" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'PARCIALMENTE_DESPACHADA', 'DESPACHADA', 'CANCELADA', 'RECHAZADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MaterialRequestType" AS ENUM ('INTERNO', 'OT_MANTENIMIENTO', 'OP_PRODUCCION', 'PROYECTO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DespachoStatus" AS ENUM ('BORRADOR', 'EN_PREPARACION', 'LISTO_DESPACHO', 'DESPACHADO', 'RECIBIDO', 'CANCELADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DespachoType" AS ENUM ('ENTREGA_PERSONA', 'ENTREGA_OT', 'ENTREGA_OP', 'CONSUMO_INTERNO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DevolucionStatus" AS ENUM ('BORRADOR', 'PENDIENTE_REVISION', 'ACEPTADA', 'RECHAZADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DevolucionType" AS ENUM ('SOBRANTE', 'DEFECTUOSO', 'NO_UTILIZADO', 'ERROR_DESPACHO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "InventoryItemType" AS ENUM ('SUPPLIER_ITEM', 'TOOL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- StockReservation table
CREATE TABLE IF NOT EXISTS "stock_reservations" (
    "id" SERIAL NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadConsumida" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "estado" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVA',
    "tipo" "StockReservationType" NOT NULL,
    "materialRequestId" INTEGER,
    "productionOrderId" INTEGER,
    "workOrderId" INTEGER,
    "fechaReserva" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaExpiracion" TIMESTAMP(3),
    "motivo" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- MaterialRequest table
CREATE TABLE IF NOT EXISTS "material_requests" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "tipo" "MaterialRequestType" NOT NULL,
    "estado" "MaterialRequestStatus" NOT NULL DEFAULT 'BORRADOR',
    "urgencia" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "workOrderId" INTEGER,
    "productionOrderId" INTEGER,
    "proyectoId" INTEGER,
    "solicitanteId" INTEGER NOT NULL,
    "destinatarioId" INTEGER,
    "warehouseId" INTEGER,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaNecesidad" TIMESTAMP(3),
    "fechaAprobacion" TIMESTAMP(3),
    "aprobadoPor" INTEGER,
    "motivo" TEXT,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

-- MaterialRequestItem table
CREATE TABLE IF NOT EXISTS "material_request_items" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "supplierItemId" INTEGER,
    "toolId" INTEGER,
    "cantidadSolicitada" DECIMAL(15,4) NOT NULL,
    "cantidadAprobada" DECIMAL(15,4),
    "cantidadReservada" DECIMAL(15,4) DEFAULT 0,
    "cantidadDespachada" DECIMAL(15,4) DEFAULT 0,
    "unidad" VARCHAR(50) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_request_items_pkey" PRIMARY KEY ("id")
);

-- Despacho table
CREATE TABLE IF NOT EXISTS "despachos" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "tipo" "DespachoType" NOT NULL,
    "estado" "DespachoStatus" NOT NULL DEFAULT 'BORRADOR',
    "materialRequestId" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "productionOrderId" INTEGER,
    "destinatarioId" INTEGER,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaDespacho" TIMESTAMP(3),
    "fechaRecepcion" TIMESTAMP(3),
    "despachadorId" INTEGER NOT NULL,
    "receptorId" INTEGER,
    "firmaUrl" VARCHAR(500),
    "firmaHash" VARCHAR(64),
    "firmadoAt" TIMESTAMP(3),
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "despachos_pkey" PRIMARY KEY ("id")
);

-- DespachoItem table
CREATE TABLE IF NOT EXISTS "despacho_items" (
    "id" SERIAL NOT NULL,
    "despachoId" INTEGER NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "supplierItemId" INTEGER,
    "toolId" INTEGER,
    "stockLocationId" INTEGER,
    "lote" VARCHAR(100),
    "cantidadSolicitada" DECIMAL(15,4) NOT NULL,
    "cantidadDespachada" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "costoUnitario" DECIMAL(15,4),
    "costoTotal" DECIMAL(15,4),
    "stockMovementId" INTEGER,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "despacho_items_pkey" PRIMARY KEY ("id")
);

-- DevolucionMaterial table
CREATE TABLE IF NOT EXISTS "devoluciones_material" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "tipo" "DevolucionType" NOT NULL,
    "estado" "DevolucionStatus" NOT NULL DEFAULT 'BORRADOR',
    "despachoOrigenId" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "devolvienteId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "notas" TEXT,
    "fechaDevolucion" TIMESTAMP(3),
    "recibidoPor" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devoluciones_material_pkey" PRIMARY KEY ("id")
);

-- DevolucionMaterialItem table
CREATE TABLE IF NOT EXISTS "devolucion_material_items" (
    "id" SERIAL NOT NULL,
    "devolucionId" INTEGER NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "supplierItemId" INTEGER,
    "toolId" INTEGER,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "estadoItem" VARCHAR(50),
    "stockMovementId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devolucion_material_items_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "stock_reservations_supplierItemId_warehouseId_idx" ON "stock_reservations"("supplierItemId", "warehouseId");
CREATE INDEX IF NOT EXISTS "stock_reservations_estado_idx" ON "stock_reservations"("estado");
CREATE INDEX IF NOT EXISTS "stock_reservations_companyId_idx" ON "stock_reservations"("companyId");
CREATE INDEX IF NOT EXISTS "stock_reservations_materialRequestId_idx" ON "stock_reservations"("materialRequestId");
CREATE INDEX IF NOT EXISTS "stock_reservations_productionOrderId_idx" ON "stock_reservations"("productionOrderId");
CREATE INDEX IF NOT EXISTS "stock_reservations_workOrderId_idx" ON "stock_reservations"("workOrderId");

CREATE UNIQUE INDEX IF NOT EXISTS "material_requests_companyId_numero_key" ON "material_requests"("companyId", "numero");
CREATE INDEX IF NOT EXISTS "material_requests_companyId_estado_idx" ON "material_requests"("companyId", "estado");
CREATE INDEX IF NOT EXISTS "material_requests_workOrderId_idx" ON "material_requests"("workOrderId");
CREATE INDEX IF NOT EXISTS "material_requests_productionOrderId_idx" ON "material_requests"("productionOrderId");
CREATE INDEX IF NOT EXISTS "material_requests_solicitanteId_idx" ON "material_requests"("solicitanteId");

CREATE UNIQUE INDEX IF NOT EXISTS "despachos_companyId_numero_key" ON "despachos"("companyId", "numero");
CREATE INDEX IF NOT EXISTS "despachos_companyId_estado_idx" ON "despachos"("companyId", "estado");
CREATE INDEX IF NOT EXISTS "despachos_workOrderId_idx" ON "despachos"("workOrderId");
CREATE INDEX IF NOT EXISTS "despachos_productionOrderId_idx" ON "despachos"("productionOrderId");
CREATE INDEX IF NOT EXISTS "despachos_fechaDespacho_idx" ON "despachos"("fechaDespacho");

CREATE UNIQUE INDEX IF NOT EXISTS "devoluciones_material_companyId_numero_key" ON "devoluciones_material"("companyId", "numero");
CREATE INDEX IF NOT EXISTS "devoluciones_material_companyId_estado_idx" ON "devoluciones_material"("companyId", "estado");
CREATE INDEX IF NOT EXISTS "devoluciones_material_despachoOrigenId_idx" ON "devoluciones_material"("despachoOrigenId");
CREATE INDEX IF NOT EXISTS "devoluciones_material_warehouseId_idx" ON "devoluciones_material"("warehouseId");

-- Add foreign key constraints (with IF NOT EXISTS simulation using DO blocks)
DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "material_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_despachadorId_fkey" FOREIGN KEY ("despachadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_despachoId_fkey" FOREIGN KEY ("despachoId") REFERENCES "despachos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_devolvienteId_fkey" FOREIGN KEY ("devolvienteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "devolucion_material_items" ADD CONSTRAINT "devolucion_material_items_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
