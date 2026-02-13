-- ============================================
-- MIGRACIÓN: Sistema de Compras
-- ============================================
-- Esta migración crea todas las tablas necesarias para el sistema de compras:
-- - PurchaseAccount: Cuentas contables
-- - PurchaseReceipt: Comprobantes de compra
-- - PurchaseReceiptItem: Items de comprobantes
-- - SupplierItem: Items de proveedores
-- - PriceHistory: Historial de precios
-- - Stock: Stock de items

-- ============================================
-- 1. TABLA: PurchaseAccount (Cuentas Contables)
-- ============================================
CREATE TABLE IF NOT EXISTS "PurchaseAccount" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseAccount_companyId_idx" ON "PurchaseAccount"("companyId");
CREATE INDEX IF NOT EXISTS "PurchaseAccount_activa_idx" ON "PurchaseAccount"("activa");

ALTER TABLE "PurchaseAccount" ADD CONSTRAINT "PurchaseAccount_companyId_fkey" 
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 2. TABLA: PurchaseReceipt (Comprobantes)
-- ============================================
CREATE TABLE IF NOT EXISTS "PurchaseReceipt" (
    "id" SERIAL NOT NULL,
    "numeroSerie" VARCHAR(10) NOT NULL,
    "numeroFactura" VARCHAR(20) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "fechaEmision" DATE NOT NULL,
    "fechaVencimiento" DATE,
    "fechaImputacion" DATE NOT NULL,
    "tipoPago" VARCHAR(20) NOT NULL,
    "metodoPago" VARCHAR(50),
    "neto" DECIMAL(15,2) NOT NULL,
    "iva21" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "noGravado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "impInter" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "percepcionIVA" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "percepcionIIBB" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otrosConceptos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "exento" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iibb" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "tipoCuentaId" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseReceipt_companyId_idx" ON "PurchaseReceipt"("companyId");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_proveedorId_idx" ON "PurchaseReceipt"("proveedorId");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_tipoCuentaId_idx" ON "PurchaseReceipt"("tipoCuentaId");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_fechaEmision_idx" ON "PurchaseReceipt"("fechaEmision");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_fechaImputacion_idx" ON "PurchaseReceipt"("fechaImputacion");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_estado_idx" ON "PurchaseReceipt"("estado");

ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_companyId_fkey" 
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_proveedorId_fkey" 
    FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_tipoCuentaId_fkey" 
    FOREIGN KEY ("tipoCuentaId") REFERENCES "PurchaseAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_createdBy_fkey" 
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 3. TABLA: PurchaseReceiptItem (Items de Comprobantes)
-- ============================================
CREATE TABLE IF NOT EXISTS "PurchaseReceiptItem" (
    "id" SERIAL NOT NULL,
    "comprobanteId" INTEGER NOT NULL,
    "itemId" INTEGER,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseReceiptItem_comprobanteId_idx" ON "PurchaseReceiptItem"("comprobanteId");
CREATE INDEX IF NOT EXISTS "PurchaseReceiptItem_proveedorId_idx" ON "PurchaseReceiptItem"("proveedorId");
CREATE INDEX IF NOT EXISTS "PurchaseReceiptItem_itemId_idx" ON "PurchaseReceiptItem"("itemId");
CREATE INDEX IF NOT EXISTS "PurchaseReceiptItem_companyId_idx" ON "PurchaseReceiptItem"("companyId");

ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_comprobanteId_fkey" 
    FOREIGN KEY ("comprobanteId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_proveedorId_fkey" 
    FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 4. TABLA: SupplierItem (Items de Proveedores)
-- ============================================
CREATE TABLE IF NOT EXISTS "SupplierItem" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "supplyId" INTEGER NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierItem_supplierId_supplyId_key" UNIQUE ("supplierId", "supplyId")
);

CREATE INDEX IF NOT EXISTS "SupplierItem_supplierId_idx" ON "SupplierItem"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierItem_supplyId_idx" ON "SupplierItem"("supplyId");
CREATE INDEX IF NOT EXISTS "SupplierItem_companyId_idx" ON "SupplierItem"("companyId");
CREATE INDEX IF NOT EXISTS "SupplierItem_activo_idx" ON "SupplierItem"("activo");

ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_supplierId_fkey" 
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_supplyId_fkey" 
    FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Agregar foreign key de PurchaseReceiptItem a SupplierItem (después de crear SupplierItem)
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_itemId_fkey" 
    FOREIGN KEY ("itemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 5. TABLA: PriceHistory (Historial de Precios)
-- ============================================
CREATE TABLE IF NOT EXISTS "PriceHistory" (
    "id" SERIAL NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "comprobanteId" INTEGER,
    "fecha" DATE NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PriceHistory_supplierItemId_idx" ON "PriceHistory"("supplierItemId");
CREATE INDEX IF NOT EXISTS "PriceHistory_fecha_idx" ON "PriceHistory"("fecha");
CREATE INDEX IF NOT EXISTS "PriceHistory_companyId_idx" ON "PriceHistory"("companyId");

ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_supplierItemId_fkey" 
    FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_comprobanteId_fkey" 
    FOREIGN KEY ("comprobanteId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 6. TABLA: Stock (Stock de Items)
-- ============================================
CREATE TABLE IF NOT EXISTS "Stock" (
    "id" SERIAL NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "ultimaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Stock_supplierItemId_key" UNIQUE ("supplierItemId")
);

CREATE INDEX IF NOT EXISTS "Stock_companyId_idx" ON "Stock"("companyId");

ALTER TABLE "Stock" ADD CONSTRAINT "Stock_supplierItemId_fkey" 
    FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 7. ACTUALIZAR TABLA: suppliers (Agregar campos)
-- ============================================
DO $$ 
BEGIN
    -- Agregar columna cuit si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'cuit'
    ) THEN
        ALTER TABLE "suppliers" ADD COLUMN "cuit" VARCHAR(20);
    END IF;

    -- Agregar columna razon_social si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'razon_social'
    ) THEN
        ALTER TABLE "suppliers" ADD COLUMN "razon_social" VARCHAR(255);
    END IF;

    -- Agregar columna codigo si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'codigo'
    ) THEN
        ALTER TABLE "suppliers" ADD COLUMN "codigo" VARCHAR(50);
    END IF;
END $$;

-- Crear índices en suppliers si no existen
CREATE INDEX IF NOT EXISTS "suppliers_cuit_idx" ON "suppliers"("cuit");
CREATE INDEX IF NOT EXISTS "suppliers_codigo_idx" ON "suppliers"("codigo");

