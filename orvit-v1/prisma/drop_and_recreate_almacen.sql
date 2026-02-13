-- Drop and recreate almacen tables properly
-- WARNING: This will delete all data in these tables!

-- First, drop the tables in reverse order of dependencies
DROP TABLE IF EXISTS "devolucion_material_items" CASCADE;
DROP TABLE IF EXISTS "devoluciones_material" CASCADE;
DROP TABLE IF EXISTS "despacho_items" CASCADE;
DROP TABLE IF EXISTS "despachos" CASCADE;
DROP TABLE IF EXISTS "material_request_items" CASCADE;
DROP TABLE IF EXISTS "material_requests" CASCADE;
DROP TABLE IF EXISTS "stock_reservations" CASCADE;

-- Drop the old enums that may have wrong values
DROP TYPE IF EXISTS "StockReservationStatus" CASCADE;
DROP TYPE IF EXISTS "StockReservationType" CASCADE;
DROP TYPE IF EXISTS "MaterialRequestStatus" CASCADE;
DROP TYPE IF EXISTS "MaterialRequestType" CASCADE;
DROP TYPE IF EXISTS "DespachoStatus" CASCADE;
DROP TYPE IF EXISTS "DespachoType" CASCADE;
DROP TYPE IF EXISTS "DevolucionStatus" CASCADE;
DROP TYPE IF EXISTS "DevolucionType" CASCADE;
DROP TYPE IF EXISTS "InventoryItemType" CASCADE;

-- Now recreate the enums with correct values (from Prisma schema)
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVA', 'CONSUMIDA_PARCIAL', 'CONSUMIDA', 'LIBERADA', 'EXPIRADA');
CREATE TYPE "StockReservationType" AS ENUM ('SOLICITUD_MATERIAL', 'ORDEN_PRODUCCION', 'ORDEN_TRABAJO', 'MANUAL');
CREATE TYPE "MaterialRequestStatus" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'PARCIALMENTE_DESPACHADA', 'DESPACHADA', 'CANCELADA', 'RECHAZADA');
CREATE TYPE "MaterialRequestType" AS ENUM ('OT_MANTENIMIENTO', 'OP_PRODUCCION', 'PROYECTO', 'INTERNO');
CREATE TYPE "DespachoStatus" AS ENUM ('BORRADOR', 'EN_PREPARACION', 'LISTO_DESPACHO', 'DESPACHADO', 'RECIBIDO', 'CANCELADO');
CREATE TYPE "DespachoType" AS ENUM ('ENTREGA_PERSONA', 'ENTREGA_OT', 'ENTREGA_OP', 'CONSUMO_INTERNO');
CREATE TYPE "DevolucionStatus" AS ENUM ('BORRADOR', 'PENDIENTE_REVISION', 'ACEPTADA', 'RECHAZADA');
CREATE TYPE "DevolucionType" AS ENUM ('SOBRANTE_OT', 'SOBRANTE_OP', 'NO_UTILIZADO', 'DEFECTUOSO');
CREATE TYPE "InventoryItemType" AS ENUM ('SUPPLIER_ITEM', 'TOOL');

-- Recreate stock_reservations table
CREATE TABLE "stock_reservations" (
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

-- Recreate material_requests table
CREATE TABLE "material_requests" (
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

-- Recreate material_request_items table
CREATE TABLE "material_request_items" (
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

-- Recreate despachos table
CREATE TABLE "despachos" (
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

-- Recreate despacho_items table
CREATE TABLE "despacho_items" (
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
    "costoTotal" DECIMAL(15,2),
    "metodoAsignacion" VARCHAR(20),
    "notas" TEXT,
    "stockMovementId" INTEGER,
    "toolMovementId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "despacho_items_pkey" PRIMARY KEY ("id")
);

-- Recreate devoluciones_material table
CREATE TABLE "devoluciones_material" (
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

-- Recreate devolucion_material_items table
CREATE TABLE "devolucion_material_items" (
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
CREATE INDEX "stock_reservations_supplierItemId_warehouseId_idx" ON "stock_reservations"("supplierItemId", "warehouseId");
CREATE INDEX "stock_reservations_estado_idx" ON "stock_reservations"("estado");
CREATE INDEX "stock_reservations_companyId_idx" ON "stock_reservations"("companyId");
CREATE INDEX "stock_reservations_materialRequestId_idx" ON "stock_reservations"("materialRequestId");
CREATE INDEX "stock_reservations_productionOrderId_idx" ON "stock_reservations"("productionOrderId");
CREATE INDEX "stock_reservations_workOrderId_idx" ON "stock_reservations"("workOrderId");

CREATE UNIQUE INDEX "material_requests_companyId_numero_key" ON "material_requests"("companyId", "numero");
CREATE INDEX "material_requests_companyId_estado_idx" ON "material_requests"("companyId", "estado");
CREATE INDEX "material_requests_workOrderId_idx" ON "material_requests"("workOrderId");
CREATE INDEX "material_requests_productionOrderId_idx" ON "material_requests"("productionOrderId");
CREATE INDEX "material_requests_solicitanteId_idx" ON "material_requests"("solicitanteId");

CREATE INDEX "material_request_items_requestId_idx" ON "material_request_items"("requestId");
CREATE INDEX "material_request_items_supplierItemId_idx" ON "material_request_items"("supplierItemId");
CREATE INDEX "material_request_items_toolId_idx" ON "material_request_items"("toolId");

CREATE UNIQUE INDEX "despachos_companyId_numero_key" ON "despachos"("companyId", "numero");
CREATE INDEX "despachos_companyId_estado_idx" ON "despachos"("companyId", "estado");
CREATE INDEX "despachos_workOrderId_idx" ON "despachos"("workOrderId");
CREATE INDEX "despachos_productionOrderId_idx" ON "despachos"("productionOrderId");
CREATE INDEX "despachos_fechaDespacho_idx" ON "despachos"("fechaDespacho");

CREATE INDEX "despacho_items_despachoId_idx" ON "despacho_items"("despachoId");
CREATE INDEX "despacho_items_supplierItemId_idx" ON "despacho_items"("supplierItemId");
CREATE INDEX "despacho_items_toolId_idx" ON "despacho_items"("toolId");
CREATE INDEX "despacho_items_stockLocationId_idx" ON "despacho_items"("stockLocationId");

CREATE UNIQUE INDEX "devoluciones_material_companyId_numero_key" ON "devoluciones_material"("companyId", "numero");
CREATE INDEX "devoluciones_material_companyId_estado_idx" ON "devoluciones_material"("companyId", "estado");
CREATE INDEX "devoluciones_material_despachoOrigenId_idx" ON "devoluciones_material"("despachoOrigenId");
CREATE INDEX "devoluciones_material_warehouseId_idx" ON "devoluciones_material"("warehouseId");

CREATE INDEX "devolucion_material_items_devolucionId_idx" ON "devolucion_material_items"("devolucionId");
CREATE INDEX "devolucion_material_items_supplierItemId_idx" ON "devolucion_material_items"("supplierItemId");
CREATE INDEX "devolucion_material_items_toolId_idx" ON "devolucion_material_items"("toolId");

-- Add foreign key constraints
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "material_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "material_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "despachos" ADD CONSTRAINT "despachos_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "material_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_despachadorId_fkey" FOREIGN KEY ("despachadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_receptorId_fkey" FOREIGN KEY ("receptorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_despachoId_fkey" FOREIGN KEY ("despachoId") REFERENCES "despachos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_despachoOrigenId_fkey" FOREIGN KEY ("despachoOrigenId") REFERENCES "despachos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_devolvienteId_fkey" FOREIGN KEY ("devolvienteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_recibidoPor_fkey" FOREIGN KEY ("recibidoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devolucion_material_items" ADD CONSTRAINT "devolucion_material_items_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "devolucion_material_items" ADD CONSTRAINT "devolucion_material_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "devolucion_material_items" ADD CONSTRAINT "devolucion_material_items_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
