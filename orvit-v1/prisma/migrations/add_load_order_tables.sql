-- Migration: Add LoadOrder and LoadOrderItem tables
-- O2C Phase 2 - Load Order Management

-- Create LoadOrderStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoadOrderStatus') THEN
    CREATE TYPE "LoadOrderStatus" AS ENUM ('PENDIENTE', 'CARGANDO', 'CARGADA', 'DESPACHADA', 'CANCELADA');
  END IF;
END$$;

-- Create load_orders table
CREATE TABLE IF NOT EXISTS "load_orders" (
  "id" SERIAL PRIMARY KEY,
  "numero" VARCHAR(50) NOT NULL,
  "saleId" INTEGER NOT NULL,
  "deliveryId" INTEGER,
  "estado" "LoadOrderStatus" NOT NULL DEFAULT 'PENDIENTE',

  -- Fecha
  "fecha" DATE NOT NULL,

  -- Vehiculo
  "vehiculo" VARCHAR(100),
  "vehiculoPatente" VARCHAR(20),
  "vehiculoTipo" VARCHAR(50),

  -- Conductor
  "chofer" VARCHAR(255),
  "choferDNI" VARCHAR(20),

  -- Transportista
  "transportista" VARCHAR(255),

  -- Capacidad calculada
  "pesoTotal" DECIMAL(15, 2),
  "volumenTotal" DECIMAL(15, 4),

  -- Notas
  "observaciones" TEXT,

  -- Confirmacion
  "confirmadoAt" TIMESTAMP(3),
  "confirmedById" INTEGER,

  -- Firma
  "firmaOperario" TEXT,

  -- ViewMode
  "docType" "DocType" NOT NULL DEFAULT 'T1',

  -- Tracking
  "companyId" INTEGER NOT NULL,
  "createdBy" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT "load_orders_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "load_orders_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sale_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "load_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "load_orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "load_orders_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create unique index on (companyId, numero)
CREATE UNIQUE INDEX IF NOT EXISTS "load_orders_companyId_numero_key" ON "load_orders"("companyId", "numero");

-- Create indexes
CREATE INDEX IF NOT EXISTS "load_orders_companyId_idx" ON "load_orders"("companyId");
CREATE INDEX IF NOT EXISTS "load_orders_saleId_idx" ON "load_orders"("saleId");
CREATE INDEX IF NOT EXISTS "load_orders_deliveryId_idx" ON "load_orders"("deliveryId");
CREATE INDEX IF NOT EXISTS "load_orders_estado_idx" ON "load_orders"("estado");
CREATE INDEX IF NOT EXISTS "load_orders_fecha_idx" ON "load_orders"("fecha");
CREATE INDEX IF NOT EXISTS "load_orders_docType_idx" ON "load_orders"("docType");
CREATE INDEX IF NOT EXISTS "load_orders_companyId_docType_idx" ON "load_orders"("companyId", "docType");

-- Create load_order_items table
CREATE TABLE IF NOT EXISTS "load_order_items" (
  "id" SERIAL PRIMARY KEY,
  "loadOrderId" INTEGER NOT NULL,
  "saleItemId" INTEGER NOT NULL,
  "productId" TEXT,

  -- Cantidades
  "cantidad" DECIMAL(15, 4) NOT NULL,
  "cantidadCargada" DECIMAL(15, 4),

  -- Dimensiones para auto-acomodo
  "pesoUnitario" DECIMAL(15, 4),
  "volumenUnitario" DECIMAL(15, 6),
  "largoUnitario" DECIMAL(10, 3),
  "anchoUnitario" DECIMAL(10, 3),
  "altoUnitario" DECIMAL(10, 3),

  -- Posicion en el vehiculo (bin packing)
  "secuencia" INTEGER,
  "posX" DECIMAL(10, 3),
  "posY" DECIMAL(10, 3),
  "posZ" DECIMAL(10, 3),

  -- Diferencias
  "motivoDiferencia" TEXT,

  -- Notas
  "observaciones" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT "load_order_items_loadOrderId_fkey" FOREIGN KEY ("loadOrderId") REFERENCES "load_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "load_order_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "load_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "load_order_items_loadOrderId_idx" ON "load_order_items"("loadOrderId");
CREATE INDEX IF NOT EXISTS "load_order_items_saleItemId_idx" ON "load_order_items"("saleItemId");
CREATE INDEX IF NOT EXISTS "load_order_items_productId_idx" ON "load_order_items"("productId");

-- Add comment to document the migration
COMMENT ON TABLE "load_orders" IS 'O2C Phase 2 - Load orders for truck loading management with auto-accommodation';
COMMENT ON TABLE "load_order_items" IS 'O2C Phase 2 - Load order items with position data for bin packing';
