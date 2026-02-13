-- Manual Migration: Mejoras PurchaseReturn y Allocation Tables
-- Agrega campos para trazabilidad, idempotencia, y tablas de imputación

DO $$
BEGIN
    -- ============================================
    -- 1. CAMPOS EN PurchaseReturn
    -- ============================================

    -- Evidencia por evento
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_returns' AND column_name = 'evidenciaProblema'
    ) THEN
        ALTER TABLE purchase_returns ADD COLUMN "evidenciaProblema" TEXT;
        RAISE NOTICE 'Columna evidenciaProblema agregada a purchase_returns';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_returns' AND column_name = 'evidenciaEnvio'
    ) THEN
        ALTER TABLE purchase_returns ADD COLUMN "evidenciaEnvio" TEXT;
        RAISE NOTICE 'Columna evidenciaEnvio agregada a purchase_returns';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_returns' AND column_name = 'evidenciaRecepcion'
    ) THEN
        ALTER TABLE purchase_returns ADD COLUMN "evidenciaRecepcion" TEXT;
        RAISE NOTICE 'Columna evidenciaRecepcion agregada a purchase_returns';
    END IF;

    -- Transporte
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_returns' AND column_name = 'carrier'
    ) THEN
        ALTER TABLE purchase_returns ADD COLUMN "carrier" TEXT;
        RAISE NOTICE 'Columna carrier agregada a purchase_returns';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_returns' AND column_name = 'trackingNumber'
    ) THEN
        ALTER TABLE purchase_returns ADD COLUMN "trackingNumber" TEXT;
        RAISE NOTICE 'Columna trackingNumber agregada a purchase_returns';
    END IF;

    -- Depósito origen
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_returns' AND column_name = 'warehouseId'
    ) THEN
        ALTER TABLE purchase_returns ADD COLUMN "warehouseId" INTEGER;
        ALTER TABLE purchase_returns ADD CONSTRAINT "purchase_returns_warehouseId_fkey"
            FOREIGN KEY ("warehouseId") REFERENCES warehouses(id);
        CREATE INDEX IF NOT EXISTS "purchase_returns_warehouseId_idx" ON purchase_returns("warehouseId");
        RAISE NOTICE 'Columna warehouseId agregada a purchase_returns';
    END IF;

    -- Control de idempotencia
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_returns' AND column_name = 'stockMovementCreated'
    ) THEN
        ALTER TABLE purchase_returns ADD COLUMN "stockMovementCreated" BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Columna stockMovementCreated agregada a purchase_returns';
    END IF;

    -- ============================================
    -- 2. CAMPOS EN PurchaseReturnItem
    -- ============================================

    -- Trazabilidad al GoodsReceiptItem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_return_items' AND column_name = 'goodsReceiptItemId'
    ) THEN
        ALTER TABLE purchase_return_items ADD COLUMN "goodsReceiptItemId" INTEGER;
        ALTER TABLE purchase_return_items ADD CONSTRAINT "purchase_return_items_goodsReceiptItemId_fkey"
            FOREIGN KEY ("goodsReceiptItemId") REFERENCES goods_receipt_items(id);
        CREATE INDEX IF NOT EXISTS "purchase_return_items_goodsReceiptItemId_idx" ON purchase_return_items("goodsReceiptItemId");
        RAISE NOTICE 'Columna goodsReceiptItemId agregada a purchase_return_items';
    END IF;

    -- Precio de referencia
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_return_items' AND column_name = 'precioReferencia'
    ) THEN
        ALTER TABLE purchase_return_items ADD COLUMN "precioReferencia" DECIMAL(15, 2);
        RAISE NOTICE 'Columna precioReferencia agregada a purchase_return_items';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_return_items' AND column_name = 'fuentePrecio'
    ) THEN
        ALTER TABLE purchase_return_items ADD COLUMN "fuentePrecio" TEXT;
        RAISE NOTICE 'Columna fuentePrecio agregada a purchase_return_items';
    END IF;

    -- Constraint único (trazabilidad)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'purchase_return_items_returnId_goodsReceiptItemId_key'
    ) THEN
        CREATE UNIQUE INDEX "purchase_return_items_returnId_goodsReceiptItemId_key"
            ON purchase_return_items("returnId", "goodsReceiptItemId")
            WHERE "goodsReceiptItemId" IS NOT NULL;
        RAISE NOTICE 'Índice único returnId+goodsReceiptItemId creado en purchase_return_items';
    END IF;

    -- ============================================
    -- 3. CONSTRAINT EN StockMovement (idempotencia)
    -- ============================================

    -- Index para purchaseReturnId
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'stock_movements_purchaseReturnId_idx'
    ) THEN
        CREATE INDEX "stock_movements_purchaseReturnId_idx" ON stock_movements("purchaseReturnId");
        RAISE NOTICE 'Índice purchaseReturnId creado en stock_movements';
    END IF;

    -- Constraint único para idempotencia (un PR no puede generar más de un movimiento por item)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'unique_return_movement'
    ) THEN
        CREATE UNIQUE INDEX "unique_return_movement"
            ON stock_movements("purchaseReturnId", "supplierItemId")
            WHERE "purchaseReturnId" IS NOT NULL;
        RAISE NOTICE 'Índice único unique_return_movement creado en stock_movements';
    END IF;

    -- ============================================
    -- 4. CAMPOS EN CompanySettings (tolerancias)
    -- ============================================

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'CompanySettings' AND column_name = 'toleranciaFaltante'
    ) THEN
        ALTER TABLE "CompanySettings" ADD COLUMN "toleranciaFaltante" DECIMAL(5, 4) NOT NULL DEFAULT 0.02;
        RAISE NOTICE 'Columna toleranciaFaltante agregada a CompanySettings';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'CompanySettings' AND column_name = 'toleranciaPrecio'
    ) THEN
        ALTER TABLE "CompanySettings" ADD COLUMN "toleranciaPrecio" DECIMAL(5, 4) NOT NULL DEFAULT 0.05;
        RAISE NOTICE 'Columna toleranciaPrecio agregada a CompanySettings';
    END IF;

    -- ============================================
    -- 5. TABLA SupplierCreditAllocation
    -- ============================================

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'supplier_credit_allocations'
    ) THEN
        CREATE TABLE supplier_credit_allocations (
            id SERIAL PRIMARY KEY,
            "creditNoteId" INTEGER NOT NULL,
            "receiptId" INTEGER,
            "debitNoteId" INTEGER,
            "tipoImputacion" VARCHAR(20) NOT NULL DEFAULT 'FACTURA',
            amount DECIMAL(15, 2) NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'ARS',
            "fxRate" DECIMAL(10, 6),
            "amountBase" DECIMAL(15, 2),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "supplier_credit_allocations_creditNoteId_fkey"
                FOREIGN KEY ("creditNoteId") REFERENCES credit_debit_notes(id) ON DELETE CASCADE,
            CONSTRAINT "supplier_credit_allocations_receiptId_fkey"
                FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"(id),
            CONSTRAINT "supplier_credit_allocations_debitNoteId_fkey"
                FOREIGN KEY ("debitNoteId") REFERENCES credit_debit_notes(id)
        );

        -- Índices
        CREATE INDEX "supplier_credit_allocations_creditNoteId_idx" ON supplier_credit_allocations("creditNoteId");
        CREATE INDEX "supplier_credit_allocations_receiptId_idx" ON supplier_credit_allocations("receiptId");
        CREATE INDEX "supplier_credit_allocations_debitNoteId_idx" ON supplier_credit_allocations("debitNoteId");

        -- Constraints únicos
        CREATE UNIQUE INDEX "supplier_credit_allocations_creditNoteId_receiptId_key"
            ON supplier_credit_allocations("creditNoteId", "receiptId")
            WHERE "receiptId" IS NOT NULL;
        CREATE UNIQUE INDEX "supplier_credit_allocations_creditNoteId_debitNoteId_key"
            ON supplier_credit_allocations("creditNoteId", "debitNoteId")
            WHERE "debitNoteId" IS NOT NULL;

        RAISE NOTICE 'Tabla supplier_credit_allocations creada';
    ELSE
        RAISE NOTICE 'Tabla supplier_credit_allocations ya existe';
    END IF;

END $$;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar campos en purchase_returns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'purchase_returns'
AND column_name IN ('evidenciaProblema', 'evidenciaEnvio', 'evidenciaRecepcion', 'carrier', 'trackingNumber', 'warehouseId', 'stockMovementCreated');

-- Verificar campos en purchase_return_items
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'purchase_return_items'
AND column_name IN ('goodsReceiptItemId', 'precioReferencia', 'fuentePrecio');

-- Verificar tabla supplier_credit_allocations
SELECT table_name FROM information_schema.tables WHERE table_name = 'supplier_credit_allocations';
