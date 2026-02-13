-- ============================================================================
-- MIGRACIÓN: Módulo Compras Extendido
-- Fecha: 2026-01-09
-- Descripción: Agrega todas las tablas para el módulo de compras completo
-- IMPORTANTE: Esta migración NO elimina datos, solo agrega tablas y columnas
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Tipos de movimiento de stock
DO $$ BEGIN
    CREATE TYPE "StockMovementType" AS ENUM (
        'ENTRADA_RECEPCION',
        'SALIDA_DEVOLUCION',
        'TRANSFERENCIA_ENTRADA',
        'TRANSFERENCIA_SALIDA',
        'AJUSTE_POSITIVO',
        'AJUSTE_NEGATIVO',
        'CONSUMO_PRODUCCION',
        'RESERVA',
        'LIBERACION_RESERVA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de transferencia
DO $$ BEGIN
    CREATE TYPE "TransferStatus" AS ENUM (
        'BORRADOR',
        'SOLICITADO',
        'EN_TRANSITO',
        'RECIBIDO_PARCIAL',
        'COMPLETADO',
        'CANCELADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipos de ajuste de inventario
DO $$ BEGIN
    CREATE TYPE "AdjustmentType" AS ENUM (
        'INVENTARIO_FISICO',
        'ROTURA',
        'VENCIMIENTO',
        'MERMA',
        'CORRECCION',
        'OTRO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de orden de compra
DO $$ BEGIN
    CREATE TYPE "PurchaseOrderStatus" AS ENUM (
        'BORRADOR',
        'PENDIENTE_APROBACION',
        'APROBADA',
        'RECHAZADA',
        'ENVIADA_PROVEEDOR',
        'CONFIRMADA',
        'PARCIALMENTE_RECIBIDA',
        'COMPLETADA',
        'CANCELADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de recepción
DO $$ BEGIN
    CREATE TYPE "GoodsReceiptStatus" AS ENUM (
        'BORRADOR',
        'CONFIRMADA',
        'ANULADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de calidad
DO $$ BEGIN
    CREATE TYPE "QualityStatus" AS ENUM (
        'PENDIENTE',
        'APROBADO',
        'RECHAZADO',
        'APROBADO_PARCIAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipos de nota crédito/débito
DO $$ BEGIN
    CREATE TYPE "CreditDebitNoteType" AS ENUM (
        'NOTA_CREDITO',
        'NOTA_DEBITO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de nota crédito/débito
DO $$ BEGIN
    CREATE TYPE "CreditDebitNoteStatus" AS ENUM (
        'PENDIENTE',
        'APROBADA',
        'APLICADA',
        'RECHAZADA',
        'ANULADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de match
DO $$ BEGIN
    CREATE TYPE "MatchStatus" AS ENUM (
        'PENDIENTE',
        'MATCH_OK',
        'DISCREPANCIA',
        'RESUELTO',
        'BLOQUEADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipos de excepción de match
DO $$ BEGIN
    CREATE TYPE "MatchExceptionType" AS ENUM (
        'CANTIDAD_DIFERENTE',
        'PRECIO_DIFERENTE',
        'ITEM_FALTANTE',
        'ITEM_EXTRA',
        'IMPUESTO_DIFERENTE',
        'TOTAL_DIFERENTE',
        'SIN_OC',
        'SIN_RECEPCION',
        'DUPLICADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipos de aprobación
DO $$ BEGIN
    CREATE TYPE "ApprovalType" AS ENUM (
        'MONTO',
        'CATEGORIA',
        'PROVEEDOR',
        'EMERGENCIA',
        'DESVIACION_MATCH'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de aprobación
DO $$ BEGIN
    CREATE TYPE "ApprovalStatus" AS ENUM (
        'PENDIENTE',
        'EN_REVISION',
        'APROBADA',
        'RECHAZADA',
        'ESCALADA',
        'VENCIDA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Decisión de aprobación
DO $$ BEGIN
    CREATE TYPE "ApprovalDecision" AS ENUM (
        'APROBADA',
        'RECHAZADA',
        'APROBADA_CON_CONDICIONES'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de proyecto
DO $$ BEGIN
    CREATE TYPE "ProjectStatus" AS ENUM (
        'ACTIVO',
        'EN_PAUSA',
        'COMPLETADO',
        'CANCELADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de solicitud de pago
DO $$ BEGIN
    CREATE TYPE "PaymentRequestStatus" AS ENUM (
        'SOLICITADA',
        'EN_REVISION',
        'APROBADA',
        'RECHAZADA',
        'CONVERTIDA',
        'PAGADA',
        'CANCELADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de devolución
DO $$ BEGIN
    CREATE TYPE "PurchaseReturnStatus" AS ENUM (
        'BORRADOR',
        'SOLICITADA',
        'APROBADA_PROVEEDOR',
        'ENVIADA',
        'RECIBIDA_PROVEEDOR',
        'EN_EVALUACION',
        'RESUELTA',
        'RECHAZADA',
        'CANCELADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipos de devolución
DO $$ BEGIN
    CREATE TYPE "ReturnType" AS ENUM (
        'DEFECTO',
        'EXCESO',
        'ERROR_PEDIDO',
        'GARANTIA',
        'OTRO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de item de devolución
DO $$ BEGIN
    CREATE TYPE "ReturnItemStatus" AS ENUM (
        'PENDIENTE',
        'ACEPTADO',
        'RECHAZADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Urgencia de reposición
DO $$ BEGIN
    CREATE TYPE "ReplenishmentUrgency" AS ENUM (
        'BAJA',
        'NORMAL',
        'ALTA',
        'CRITICA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de reposición
DO $$ BEGIN
    CREATE TYPE "ReplenishmentStatus" AS ENUM (
        'PENDIENTE',
        'EN_PROCESO',
        'COMPLETADA',
        'IGNORADA',
        'EXPIRADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de duplicados
DO $$ BEGIN
    CREATE TYPE "DuplicateStatus" AS ENUM (
        'PENDIENTE',
        'CONFIRMADO',
        'DESCARTADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLAS NUEVAS
-- ============================================================================

-- Depósitos / Pañoles / Almacenes
CREATE TABLE IF NOT EXISTS "warehouses" (
    "id" SERIAL PRIMARY KEY,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "direccion" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "warehouses_companyId_codigo_key" UNIQUE ("companyId", "codigo"),
    CONSTRAINT "warehouses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "warehouses_companyId_idx" ON "warehouses"("companyId");
CREATE INDEX IF NOT EXISTS "warehouses_isActive_idx" ON "warehouses"("isActive");

-- Stock por ubicación
CREATE TABLE IF NOT EXISTS "stock_locations" (
    "id" SERIAL PRIMARY KEY,
    "warehouseId" INTEGER NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadReservada" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(15,4),
    "stockMaximo" DECIMAL(15,4),
    "ubicacion" VARCHAR(100),
    "companyId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_locations_warehouseId_supplierItemId_key" UNIQUE ("warehouseId", "supplierItemId"),
    CONSTRAINT "stock_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_locations_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "stock_locations_companyId_idx" ON "stock_locations"("companyId");
CREATE INDEX IF NOT EXISTS "stock_locations_warehouseId_idx" ON "stock_locations"("warehouseId");
CREATE INDEX IF NOT EXISTS "stock_locations_supplierItemId_idx" ON "stock_locations"("supplierItemId");

-- Transferencias entre depósitos
CREATE TABLE IF NOT EXISTS "stock_transfers" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "warehouseOrigenId" INTEGER NOT NULL,
    "warehouseDestinoId" INTEGER NOT NULL,
    "estado" "TransferStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaSolicitud" DATE NOT NULL,
    "fechaEnvio" DATE,
    "fechaRecepcion" DATE,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "stock_transfers_companyId_idx" ON "stock_transfers"("companyId");
CREATE INDEX IF NOT EXISTS "stock_transfers_estado_idx" ON "stock_transfers"("estado");

-- Items de transferencia
CREATE TABLE IF NOT EXISTS "stock_transfer_items" (
    "id" SERIAL PRIMARY KEY,
    "transferId" INTEGER NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "cantidadSolicitada" DECIMAL(15,4) NOT NULL,
    "cantidadEnviada" DECIMAL(15,4),
    "cantidadRecibida" DECIMAL(15,4),
    "notas" TEXT,
    CONSTRAINT "stock_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_transfer_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "stock_transfer_items_transferId_idx" ON "stock_transfer_items"("transferId");

-- Ajustes de inventario
CREATE TABLE IF NOT EXISTS "stock_adjustments" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "tipo" "AdjustmentType" NOT NULL,
    "motivo" TEXT NOT NULL,
    "notas" TEXT,
    "warehouseId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "stock_adjustments_companyId_idx" ON "stock_adjustments"("companyId");
CREATE INDEX IF NOT EXISTS "stock_adjustments_warehouseId_idx" ON "stock_adjustments"("warehouseId");

-- Items de ajuste
CREATE TABLE IF NOT EXISTS "stock_adjustment_items" (
    "id" SERIAL PRIMARY KEY,
    "adjustmentId" INTEGER NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "cantidadAnterior" DECIMAL(15,4) NOT NULL,
    "cantidadNueva" DECIMAL(15,4) NOT NULL,
    "diferencia" DECIMAL(15,4) NOT NULL,
    "motivo" TEXT,
    CONSTRAINT "stock_adjustment_items_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_adjustment_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "stock_adjustment_items_adjustmentId_idx" ON "stock_adjustment_items"("adjustmentId");

-- Movimientos de Stock (Kardex)
CREATE TABLE IF NOT EXISTS "stock_movements" (
    "id" SERIAL PRIMARY KEY,
    "tipo" "StockMovementType" NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadAnterior" DECIMAL(15,4) NOT NULL,
    "cantidadPosterior" DECIMAL(15,4) NOT NULL,
    "costoUnitario" DECIMAL(15,2),
    "costoTotal" DECIMAL(15,2),
    "supplierItemId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "goodsReceiptId" INTEGER,
    "purchaseReturnId" INTEGER,
    "transferId" INTEGER,
    "adjustmentId" INTEGER,
    "motivo" TEXT,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "stock_adjustments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "stock_movements_supplierItemId_idx" ON "stock_movements"("supplierItemId");
CREATE INDEX IF NOT EXISTS "stock_movements_warehouseId_idx" ON "stock_movements"("warehouseId");
CREATE INDEX IF NOT EXISTS "stock_movements_companyId_idx" ON "stock_movements"("companyId");
CREATE INDEX IF NOT EXISTS "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");
CREATE INDEX IF NOT EXISTS "stock_movements_tipo_idx" ON "stock_movements"("tipo");

-- Centros de Costo
CREATE TABLE IF NOT EXISTS "cost_centers" (
    "id" SERIAL PRIMARY KEY,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cost_centers_companyId_codigo_key" UNIQUE ("companyId", "codigo"),
    CONSTRAINT "cost_centers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cost_centers_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "cost_centers_companyId_idx" ON "cost_centers"("companyId");
CREATE INDEX IF NOT EXISTS "cost_centers_isActive_idx" ON "cost_centers"("isActive");

-- Proyectos / Obras
CREATE TABLE IF NOT EXISTS "projects" (
    "id" SERIAL PRIMARY KEY,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "estado" "ProjectStatus" NOT NULL DEFAULT 'ACTIVO',
    "fechaInicio" DATE,
    "fechaFin" DATE,
    "presupuesto" DECIMAL(15,2),
    "clienteId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_companyId_codigo_key" UNIQUE ("companyId", "codigo"),
    CONSTRAINT "projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "projects_companyId_idx" ON "projects"("companyId");
CREATE INDEX IF NOT EXISTS "projects_estado_idx" ON "projects"("estado");

-- Órdenes de Compra
CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "estado" "PurchaseOrderStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "fechaEntregaEsperada" DATE,
    "fechaEntregaReal" DATE,
    "condicionesPago" VARCHAR(255),
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "impuestos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "notas" TEXT,
    "notasInternas" TEXT,
    "requiereAprobacion" BOOLEAN NOT NULL DEFAULT false,
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "rechazadoPor" INTEGER,
    "rechazadoAt" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "esEmergencia" BOOLEAN NOT NULL DEFAULT false,
    "motivoEmergencia" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_orders_companyId_numero_key" UNIQUE ("companyId", "numero"),
    CONSTRAINT "purchase_orders_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_rechazadoPor_fkey" FOREIGN KEY ("rechazadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "purchase_orders_companyId_idx" ON "purchase_orders"("companyId");
CREATE INDEX IF NOT EXISTS "purchase_orders_proveedorId_idx" ON "purchase_orders"("proveedorId");
CREATE INDEX IF NOT EXISTS "purchase_orders_estado_idx" ON "purchase_orders"("estado");
CREATE INDEX IF NOT EXISTS "purchase_orders_fechaEmision_idx" ON "purchase_orders"("fechaEmision");
CREATE INDEX IF NOT EXISTS "purchase_orders_esEmergencia_idx" ON "purchase_orders"("esEmergencia");

-- Items de Orden de Compra
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
    "id" SERIAL PRIMARY KEY,
    "purchaseOrderId" INTEGER NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadRecibida" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cantidadPendiente" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "fechaEntregaEsperada" DATE,
    "notas" TEXT,
    CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_order_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "purchase_order_items_supplierItemId_idx" ON "purchase_order_items"("supplierItemId");

-- Recepciones / Remitos
CREATE TABLE IF NOT EXISTS "goods_receipts" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "purchaseOrderId" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "estado" "GoodsReceiptStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaRecepcion" DATE NOT NULL,
    "numeroRemito" VARCHAR(100),
    "tieneFactura" BOOLEAN NOT NULL DEFAULT false,
    "facturaId" INTEGER,
    "esEmergencia" BOOLEAN NOT NULL DEFAULT false,
    "requiereRegularizacion" BOOLEAN NOT NULL DEFAULT false,
    "fechaLimiteRegularizacion" TIMESTAMP(3),
    "regularizada" BOOLEAN NOT NULL DEFAULT false,
    "regularizadaAt" TIMESTAMP(3),
    "estadoCalidad" "QualityStatus" NOT NULL DEFAULT 'PENDIENTE',
    "notasCalidad" TEXT,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goods_receipts_companyId_numero_key" UNIQUE ("companyId", "numero"),
    CONSTRAINT "goods_receipts_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "goods_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "goods_receipts_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "goods_receipts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goods_receipts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "goods_receipts_companyId_idx" ON "goods_receipts"("companyId");
CREATE INDEX IF NOT EXISTS "goods_receipts_proveedorId_idx" ON "goods_receipts"("proveedorId");
CREATE INDEX IF NOT EXISTS "goods_receipts_purchaseOrderId_idx" ON "goods_receipts"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "goods_receipts_estado_idx" ON "goods_receipts"("estado");
CREATE INDEX IF NOT EXISTS "goods_receipts_fechaRecepcion_idx" ON "goods_receipts"("fechaRecepcion");
CREATE INDEX IF NOT EXISTS "goods_receipts_regularizacion_idx" ON "goods_receipts"("requiereRegularizacion", "regularizada");

-- Items de Recepción
CREATE TABLE IF NOT EXISTS "goods_receipt_items" (
    "id" SERIAL PRIMARY KEY,
    "goodsReceiptId" INTEGER NOT NULL,
    "purchaseOrderItemId" INTEGER,
    "supplierItemId" INTEGER NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidadEsperada" DECIMAL(15,4),
    "cantidadRecibida" DECIMAL(15,4) NOT NULL,
    "cantidadAceptada" DECIMAL(15,4) NOT NULL,
    "cantidadRechazada" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "unidad" VARCHAR(50) NOT NULL,
    "motivoRechazo" TEXT,
    "lote" VARCHAR(100),
    "fechaVencimiento" DATE,
    "notas" TEXT,
    CONSTRAINT "goods_receipt_items_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goods_receipt_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "goods_receipt_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "goods_receipt_items_goodsReceiptId_idx" ON "goods_receipt_items"("goodsReceiptId");
CREATE INDEX IF NOT EXISTS "goods_receipt_items_purchaseOrderItemId_idx" ON "goods_receipt_items"("purchaseOrderItemId");
CREATE INDEX IF NOT EXISTS "goods_receipt_items_supplierItemId_idx" ON "goods_receipt_items"("supplierItemId");

-- Notas de Crédito / Débito
CREATE TABLE IF NOT EXISTS "credit_debit_notes" (
    "id" SERIAL PRIMARY KEY,
    "tipo" "CreditDebitNoteType" NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "numeroSerie" VARCHAR(10) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "facturaId" INTEGER,
    "goodsReceiptId" INTEGER,
    "fechaEmision" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "neto" DECIMAL(15,2) NOT NULL,
    "iva21" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "estado" "CreditDebitNoteStatus" NOT NULL DEFAULT 'PENDIENTE',
    "aplicada" BOOLEAN NOT NULL DEFAULT false,
    "aplicadaAt" TIMESTAMP(3),
    "cae" VARCHAR(20),
    "fechaVtoCae" DATE,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_debit_notes_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "credit_debit_notes_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "credit_debit_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "credit_debit_notes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "credit_debit_notes_companyId_idx" ON "credit_debit_notes"("companyId");
CREATE INDEX IF NOT EXISTS "credit_debit_notes_proveedorId_idx" ON "credit_debit_notes"("proveedorId");
CREATE INDEX IF NOT EXISTS "credit_debit_notes_facturaId_idx" ON "credit_debit_notes"("facturaId");
CREATE INDEX IF NOT EXISTS "credit_debit_notes_tipo_idx" ON "credit_debit_notes"("tipo");
CREATE INDEX IF NOT EXISTS "credit_debit_notes_estado_idx" ON "credit_debit_notes"("estado");

-- Items de Nota Crédito/Débito
CREATE TABLE IF NOT EXISTS "credit_debit_note_items" (
    "id" SERIAL PRIMARY KEY,
    "noteId" INTEGER NOT NULL,
    "supplierItemId" INTEGER,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    CONSTRAINT "credit_debit_note_items_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "credit_debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "credit_debit_note_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "credit_debit_note_items_noteId_idx" ON "credit_debit_note_items"("noteId");

-- Resultados de Match (3-Way Match)
CREATE TABLE IF NOT EXISTS "match_results" (
    "id" SERIAL PRIMARY KEY,
    "purchaseOrderId" INTEGER,
    "goodsReceiptId" INTEGER,
    "facturaId" INTEGER NOT NULL,
    "estado" "MatchStatus" NOT NULL DEFAULT 'PENDIENTE',
    "matchOcRecepcion" BOOLEAN,
    "matchRecepcionFactura" BOOLEAN,
    "matchOcFactura" BOOLEAN,
    "matchCompleto" BOOLEAN NOT NULL DEFAULT false,
    "discrepancias" JSONB,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "resueltoPor" INTEGER,
    "resueltoAt" TIMESTAMP(3),
    "accionTomada" TEXT,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match_results_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "match_results_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "match_results_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "match_results_resueltoPor_fkey" FOREIGN KEY ("resueltoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "match_results_companyId_idx" ON "match_results"("companyId");
CREATE INDEX IF NOT EXISTS "match_results_estado_idx" ON "match_results"("estado");
CREATE INDEX IF NOT EXISTS "match_results_facturaId_idx" ON "match_results"("facturaId");

-- Excepciones de Match
CREATE TABLE IF NOT EXISTS "match_exceptions" (
    "id" SERIAL PRIMARY KEY,
    "matchResultId" INTEGER NOT NULL,
    "tipo" "MatchExceptionType" NOT NULL,
    "campo" VARCHAR(100) NOT NULL,
    "valorEsperado" TEXT,
    "valorRecibido" TEXT,
    "diferencia" DECIMAL(15,4),
    "porcentajeDiff" DECIMAL(5,2),
    "dentroTolerancia" BOOLEAN NOT NULL DEFAULT false,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "resueltoPor" INTEGER,
    "resueltoAt" TIMESTAMP(3),
    "accion" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match_exceptions_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "match_results"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_exceptions_resueltoPor_fkey" FOREIGN KEY ("resueltoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "match_exceptions_matchResultId_idx" ON "match_exceptions"("matchResultId");
CREATE INDEX IF NOT EXISTS "match_exceptions_tipo_idx" ON "match_exceptions"("tipo");
CREATE INDEX IF NOT EXISTS "match_exceptions_resuelto_idx" ON "match_exceptions"("resuelto");

-- Configuración de Compras
CREATE TABLE IF NOT EXISTS "purchase_configs" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL UNIQUE,
    "toleranciaCantidad" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "toleranciaPrecio" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "permitirPagoSinMatch" BOOLEAN NOT NULL DEFAULT false,
    "permitirRecepcionSinOc" BOOLEAN NOT NULL DEFAULT true,
    "requiereAprobacionMontoMinimo" DECIMAL(15,2),
    "diasAlertaRecepcionSinFactura" INTEGER NOT NULL DEFAULT 7,
    "diasAlertaFacturaVencer" INTEGER NOT NULL DEFAULT 7,
    "diasLimiteRegularizacion" INTEGER NOT NULL DEFAULT 15,
    "iaAutoMatch" BOOLEAN NOT NULL DEFAULT false,
    "iaConfianzaMinima" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Aprobaciones de Compras
CREATE TABLE IF NOT EXISTS "purchase_approvals" (
    "id" SERIAL PRIMARY KEY,
    "tipo" "ApprovalType" NOT NULL,
    "referenciaId" INTEGER NOT NULL,
    "referenciaTipo" VARCHAR(50) NOT NULL,
    "estado" "ApprovalStatus" NOT NULL DEFAULT 'PENDIENTE',
    "monto" DECIMAL(15,2),
    "motivo" TEXT,
    "asignadoA" INTEGER,
    "fechaLimite" TIMESTAMP(3),
    "resueltoPor" INTEGER,
    "resueltoAt" TIMESTAMP(3),
    "decision" "ApprovalDecision",
    "comentarios" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_approvals_asignadoA_fkey" FOREIGN KEY ("asignadoA") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_approvals_resueltoPor_fkey" FOREIGN KEY ("resueltoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_approvals_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_approvals_referenciaId_fkey" FOREIGN KEY ("referenciaId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "purchase_approvals_companyId_idx" ON "purchase_approvals"("companyId");
CREATE INDEX IF NOT EXISTS "purchase_approvals_tipo_idx" ON "purchase_approvals"("tipo");
CREATE INDEX IF NOT EXISTS "purchase_approvals_estado_idx" ON "purchase_approvals"("estado");
CREATE INDEX IF NOT EXISTS "purchase_approvals_asignadoA_idx" ON "purchase_approvals"("asignadoA");
CREATE INDEX IF NOT EXISTS "purchase_approvals_referenciaId_referenciaTipo_idx" ON "purchase_approvals"("referenciaId", "referenciaTipo");

-- Alias de Items de Proveedor (para IA)
CREATE TABLE IF NOT EXISTS "supplier_item_aliases" (
    "id" SERIAL PRIMARY KEY,
    "supplierItemId" INTEGER NOT NULL,
    "alias" VARCHAR(255) NOT NULL,
    "codigoProveedor" VARCHAR(100),
    "esNombreFactura" BOOLEAN NOT NULL DEFAULT true,
    "confianza" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "vecesUsado" INTEGER NOT NULL DEFAULT 0,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_item_aliases_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "supplier_item_aliases_supplierItemId_idx" ON "supplier_item_aliases"("supplierItemId");
CREATE INDEX IF NOT EXISTS "supplier_item_aliases_alias_idx" ON "supplier_item_aliases"("alias");
CREATE INDEX IF NOT EXISTS "supplier_item_aliases_codigoProveedor_idx" ON "supplier_item_aliases"("codigoProveedor");
CREATE INDEX IF NOT EXISTS "supplier_item_aliases_companyId_idx" ON "supplier_item_aliases"("companyId");

-- Solicitudes de Pago
CREATE TABLE IF NOT EXISTS "payment_requests" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "estado" "PaymentRequestStatus" NOT NULL DEFAULT 'SOLICITADA',
    "prioridad" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "fechaSolicitud" DATE NOT NULL,
    "fechaObjetivo" DATE,
    "fechaAprobacion" TIMESTAMP(3),
    "fechaPago" TIMESTAMP(3),
    "montoTotal" DECIMAL(15,2) NOT NULL,
    "motivo" TEXT,
    "comentarios" TEXT,
    "esUrgente" BOOLEAN NOT NULL DEFAULT false,
    "aprobadoPor" INTEGER,
    "rechazadoPor" INTEGER,
    "motivoRechazo" TEXT,
    "paymentOrderId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_requests_companyId_numero_key" UNIQUE ("companyId", "numero"),
    CONSTRAINT "payment_requests_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_requests_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_requests_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payment_requests_rechazadoPor_fkey" FOREIGN KEY ("rechazadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payment_requests_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "payment_requests_companyId_idx" ON "payment_requests"("companyId");
CREATE INDEX IF NOT EXISTS "payment_requests_proveedorId_idx" ON "payment_requests"("proveedorId");
CREATE INDEX IF NOT EXISTS "payment_requests_estado_idx" ON "payment_requests"("estado");
CREATE INDEX IF NOT EXISTS "payment_requests_prioridad_idx" ON "payment_requests"("prioridad");
CREATE INDEX IF NOT EXISTS "payment_requests_esUrgente_idx" ON "payment_requests"("esUrgente");

-- Facturas en Solicitudes de Pago
CREATE TABLE IF NOT EXISTS "payment_request_receipts" (
    "id" SERIAL PRIMARY KEY,
    "paymentRequestId" INTEGER NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "montoSolicitado" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_request_receipts_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_request_receipts_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "payment_request_receipts_paymentRequestId_idx" ON "payment_request_receipts"("paymentRequestId");
CREATE INDEX IF NOT EXISTS "payment_request_receipts_receiptId_idx" ON "payment_request_receipts"("receiptId");

-- Devoluciones a Proveedor (RMA)
CREATE TABLE IF NOT EXISTS "purchase_returns" (
    "id" SERIAL PRIMARY KEY,
    "numero" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "goodsReceiptId" INTEGER,
    "estado" "PurchaseReturnStatus" NOT NULL DEFAULT 'BORRADOR',
    "tipo" "ReturnType" NOT NULL,
    "fechaSolicitud" DATE NOT NULL,
    "fechaEnvio" DATE,
    "fechaResolucion" DATE,
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,
    "evidencias" JSONB,
    "resolucion" TEXT,
    "creditNoteId" INTEGER,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_returns_companyId_numero_key" UNIQUE ("companyId", "numero"),
    CONSTRAINT "purchase_returns_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_returns_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_returns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "purchase_returns_companyId_idx" ON "purchase_returns"("companyId");
CREATE INDEX IF NOT EXISTS "purchase_returns_proveedorId_idx" ON "purchase_returns"("proveedorId");
CREATE INDEX IF NOT EXISTS "purchase_returns_estado_idx" ON "purchase_returns"("estado");

-- Items de Devolución
CREATE TABLE IF NOT EXISTS "purchase_return_items" (
    "id" SERIAL PRIMARY KEY,
    "returnId" INTEGER NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "motivo" TEXT,
    "estado" "ReturnItemStatus" NOT NULL DEFAULT 'PENDIENTE',
    CONSTRAINT "purchase_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_return_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "purchase_return_items_returnId_idx" ON "purchase_return_items"("returnId");

-- Sugerencias de Reposición
CREATE TABLE IF NOT EXISTS "replenishment_suggestions" (
    "id" SERIAL PRIMARY KEY,
    "supplierItemId" INTEGER NOT NULL,
    "proveedorSugerido" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "cantidadSugerida" DECIMAL(15,4) NOT NULL,
    "cantidadActual" DECIMAL(15,4) NOT NULL,
    "stockMinimo" DECIMAL(15,4) NOT NULL,
    "consumoPromedio" DECIMAL(15,4),
    "leadTimeEstimado" INTEGER,
    "urgencia" "ReplenishmentUrgency" NOT NULL DEFAULT 'NORMAL',
    "motivo" TEXT,
    "estado" "ReplenishmentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "purchaseOrderId" INTEGER,
    "ignorada" BOOLEAN NOT NULL DEFAULT false,
    "ignoradaPor" INTEGER,
    "ignoradaMotivo" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "replenishment_suggestions_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "replenishment_suggestions_proveedorSugerido_fkey" FOREIGN KEY ("proveedorSugerido") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "replenishment_suggestions_companyId_idx" ON "replenishment_suggestions"("companyId");
CREATE INDEX IF NOT EXISTS "replenishment_suggestions_estado_idx" ON "replenishment_suggestions"("estado");
CREATE INDEX IF NOT EXISTS "replenishment_suggestions_urgencia_idx" ON "replenishment_suggestions"("urgencia");
CREATE INDEX IF NOT EXISTS "replenishment_suggestions_supplierItemId_idx" ON "replenishment_suggestions"("supplierItemId");

-- Lead Time por Proveedor
CREATE TABLE IF NOT EXISTS "supplier_lead_times" (
    "id" SERIAL PRIMARY KEY,
    "supplierId" INTEGER NOT NULL,
    "supplierItemId" INTEGER,
    "leadTimePromedio" INTEGER NOT NULL,
    "leadTimeMinimo" INTEGER,
    "leadTimeMaximo" INTEGER,
    "desviacionEstandar" DECIMAL(5,2),
    "cantidadMuestras" INTEGER NOT NULL DEFAULT 0,
    "ultimaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER NOT NULL,
    CONSTRAINT "supplier_lead_times_supplierId_supplierItemId_key" UNIQUE ("supplierId", "supplierItemId"),
    CONSTRAINT "supplier_lead_times_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supplier_lead_times_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "supplier_lead_times_companyId_idx" ON "supplier_lead_times"("companyId");
CREATE INDEX IF NOT EXISTS "supplier_lead_times_supplierId_idx" ON "supplier_lead_times"("supplierId");

-- Auditoría de Compras
CREATE TABLE IF NOT EXISTS "purchase_audit_logs" (
    "id" SERIAL PRIMARY KEY,
    "entidad" VARCHAR(100) NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "camposModificados" JSONB,
    "datosAnteriores" JSONB,
    "datosNuevos" JSONB,
    "ip" VARCHAR(50),
    "userAgent" TEXT,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "purchase_audit_logs_companyId_idx" ON "purchase_audit_logs"("companyId");
CREATE INDEX IF NOT EXISTS "purchase_audit_logs_entidad_entidadId_idx" ON "purchase_audit_logs"("entidad", "entidadId");
CREATE INDEX IF NOT EXISTS "purchase_audit_logs_userId_idx" ON "purchase_audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "purchase_audit_logs_createdAt_idx" ON "purchase_audit_logs"("createdAt");

-- Detección de Duplicados
CREATE TABLE IF NOT EXISTS "duplicate_detections" (
    "id" SERIAL PRIMARY KEY,
    "tipo" VARCHAR(50) NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "duplicadoDeId" INTEGER,
    "campos" JSONB NOT NULL,
    "confianza" DECIMAL(5,2) NOT NULL,
    "estado" "DuplicateStatus" NOT NULL DEFAULT 'PENDIENTE',
    "resueltoPor" INTEGER,
    "resueltoAt" TIMESTAMP(3),
    "esRealDuplicado" BOOLEAN,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "duplicate_detections_companyId_idx" ON "duplicate_detections"("companyId");
CREATE INDEX IF NOT EXISTS "duplicate_detections_tipo_idx" ON "duplicate_detections"("tipo");
CREATE INDEX IF NOT EXISTS "duplicate_detections_estado_idx" ON "duplicate_detections"("estado");
CREATE INDEX IF NOT EXISTS "duplicate_detections_entidadId_idx" ON "duplicate_detections"("entidadId");

-- ============================================================================
-- ALTERACIONES A TABLAS EXISTENTES
-- ============================================================================

-- Agregar columnas a PurchaseReceipt (facturas de compra)
ALTER TABLE "PurchaseReceipt" ADD COLUMN IF NOT EXISTS "cae" VARCHAR(20);
ALTER TABLE "PurchaseReceipt" ADD COLUMN IF NOT EXISTS "fechaVtoCae" DATE;
ALTER TABLE "PurchaseReceipt" ADD COLUMN IF NOT EXISTS "costCenterId" INTEGER;
ALTER TABLE "PurchaseReceipt" ADD COLUMN IF NOT EXISTS "projectId" INTEGER;

-- Agregar FK a PurchaseReceipt
DO $$ BEGIN
    ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_costCenterId_fkey"
        FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Índices adicionales para PurchaseReceipt
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_cae_idx" ON "PurchaseReceipt"("cae");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_costCenterId_idx" ON "PurchaseReceipt"("costCenterId");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_projectId_idx" ON "PurchaseReceipt"("projectId");

-- Agregar FK faltantes a stock_movements (dependen de purchase_returns y goods_receipts)
DO $$ BEGIN
    ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_goodsReceiptId_fkey"
        FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchaseReturnId_fkey"
        FOREIGN KEY ("purchaseReturnId") REFERENCES "purchase_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================

-- Verificación: Listar todas las tablas nuevas creadas
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
