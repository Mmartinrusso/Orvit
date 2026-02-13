-- Fix Almacen Tables Enum Types
-- This script alters the TEXT columns to use proper PostgreSQL ENUM types

-- First, ensure all enums exist
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
    CREATE TYPE "DevolucionType" AS ENUM ('SOBRANTE_OT', 'SOBRANTE_OP', 'NO_UTILIZADO', 'DEFECTUOSO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "InventoryItemType" AS ENUM ('SUPPLIER_ITEM', 'TOOL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alter stock_reservations table (drop default, alter type, add default)
ALTER TABLE "stock_reservations" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "stock_reservations" ALTER COLUMN "estado" TYPE "StockReservationStatus" USING "estado"::"StockReservationStatus";
ALTER TABLE "stock_reservations" ALTER COLUMN "estado" SET DEFAULT 'ACTIVA'::"StockReservationStatus";
ALTER TABLE "stock_reservations" ALTER COLUMN "tipo" TYPE "StockReservationType" USING "tipo"::"StockReservationType";

-- Alter material_requests table
ALTER TABLE "material_requests" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "material_requests" ALTER COLUMN "estado" TYPE "MaterialRequestStatus" USING "estado"::"MaterialRequestStatus";
ALTER TABLE "material_requests" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR'::"MaterialRequestStatus";
ALTER TABLE "material_requests" ALTER COLUMN "tipo" TYPE "MaterialRequestType" USING "tipo"::"MaterialRequestType";
ALTER TABLE "material_requests" ALTER COLUMN "urgencia" DROP DEFAULT;
ALTER TABLE "material_requests" ALTER COLUMN "urgencia" TYPE "Priority" USING "urgencia"::"Priority";
ALTER TABLE "material_requests" ALTER COLUMN "urgencia" SET DEFAULT 'MEDIUM'::"Priority";

-- Alter material_request_items table
ALTER TABLE "material_request_items" ALTER COLUMN "itemType" TYPE "InventoryItemType" USING "itemType"::"InventoryItemType";

-- Alter despachos table
ALTER TABLE "despachos" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "despachos" ALTER COLUMN "estado" TYPE "DespachoStatus" USING "estado"::"DespachoStatus";
ALTER TABLE "despachos" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR'::"DespachoStatus";
ALTER TABLE "despachos" ALTER COLUMN "tipo" TYPE "DespachoType" USING "tipo"::"DespachoType";

-- Alter despacho_items table
ALTER TABLE "despacho_items" ALTER COLUMN "itemType" TYPE "InventoryItemType" USING "itemType"::"InventoryItemType";

-- Alter devoluciones_material table
ALTER TABLE "devoluciones_material" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "devoluciones_material" ALTER COLUMN "estado" TYPE "DevolucionStatus" USING "estado"::"DevolucionStatus";
ALTER TABLE "devoluciones_material" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR'::"DevolucionStatus";
ALTER TABLE "devoluciones_material" ALTER COLUMN "tipo" TYPE "DevolucionType" USING "tipo"::"DevolucionType";

-- Alter devolucion_material_items table
ALTER TABLE "devolucion_material_items" ALTER COLUMN "itemType" TYPE "InventoryItemType" USING "itemType"::"InventoryItemType";

-- Add missing foreign key constraints (with IF NOT EXISTS simulation)

-- stock_reservations foreign keys
DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "material_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- material_requests foreign keys
DO $$ BEGIN
    ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- material_request_items foreign keys
DO $$ BEGIN
    ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "material_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- despachos foreign keys
DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "material_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_despachadorId_fkey" FOREIGN KEY ("despachadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_receptorId_fkey" FOREIGN KEY ("receptorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "despachos" ADD CONSTRAINT "despachos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- despacho_items foreign keys
DO $$ BEGIN
    ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_despachoId_fkey" FOREIGN KEY ("despachoId") REFERENCES "despachos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- devoluciones_material foreign keys
DO $$ BEGIN
    ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_despachoOrigenId_fkey" FOREIGN KEY ("despachoOrigenId") REFERENCES "despachos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_devolvienteId_fkey" FOREIGN KEY ("devolvienteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_recibidoPor_fkey" FOREIGN KEY ("recibidoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- devolucion_material_items foreign keys
DO $$ BEGIN
    ALTER TABLE "devolucion_material_items" ADD CONSTRAINT "devolucion_material_items_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "devolucion_material_items" ADD CONSTRAINT "devolucion_material_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "devolucion_material_items" ADD CONSTRAINT "devolucion_material_items_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
