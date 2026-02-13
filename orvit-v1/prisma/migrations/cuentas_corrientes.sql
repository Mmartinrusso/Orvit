-- =====================================================
-- SISTEMA DE CUENTAS CORRIENTES DE PROVEEDORES
-- =====================================================

-- Tabla de movimientos de cuenta corriente
-- Esta tabla registra TODOS los movimientos que afectan el saldo del proveedor
CREATE TABLE IF NOT EXISTS "SupplierAccountMovement" (
    "id" SERIAL PRIMARY KEY,
    "supplierId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,

    -- Tipo de movimiento
    "tipo" VARCHAR(30) NOT NULL, -- FACTURA, NC, ND, PAGO, ANTICIPO, RETENCION, AJUSTE

    -- Referencias opcionales según el tipo
    "facturaId" INTEGER NULL,      -- Si es FACTURA
    "notaCreditoDebitoId" INTEGER NULL, -- Si es NC o ND
    "pagoId" INTEGER NULL,         -- Si es PAGO

    -- Fechas
    "fecha" DATE NOT NULL,
    "fechaVencimiento" DATE NULL,

    -- Montos (debe = aumenta deuda, haber = disminuye deuda)
    "debe" DECIMAL(15,2) NOT NULL DEFAULT 0,    -- Facturas, ND aumentan la deuda
    "haber" DECIMAL(15,2) NOT NULL DEFAULT 0,   -- Pagos, NC disminuyen la deuda
    "saldoMovimiento" DECIMAL(15,2) NOT NULL DEFAULT 0, -- Saldo después de este movimiento

    -- Información del comprobante
    "comprobante" VARCHAR(100) NULL,  -- Número de comprobante
    "descripcion" TEXT NULL,

    -- Método de pago (si aplica)
    "metodoPago" VARCHAR(50) NULL,  -- EFECTIVO, TRANSFERENCIA, CHEQUE, etc.

    -- Estado
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "conciliadoAt" TIMESTAMP NULL,
    "conciliadoBy" INTEGER NULL,

    -- Auditoría
    "createdBy" INTEGER NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT "FK_SupplierAccountMovement_supplier"
        FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE,
    CONSTRAINT "FK_SupplierAccountMovement_company"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "FK_SupplierAccountMovement_factura"
        FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL,
    CONSTRAINT "FK_SupplierAccountMovement_nota"
        FOREIGN KEY ("notaCreditoDebitoId") REFERENCES "CreditDebitNote"("id") ON DELETE SET NULL,
    CONSTRAINT "FK_SupplierAccountMovement_pago"
        FOREIGN KEY ("pagoId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL,
    CONSTRAINT "FK_SupplierAccountMovement_conciliadoBy"
        FOREIGN KEY ("conciliadoBy") REFERENCES "User"("id") ON DELETE SET NULL,
    CONSTRAINT "FK_SupplierAccountMovement_createdBy"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS "idx_supplier_account_movement_supplier" ON "SupplierAccountMovement"("supplierId");
CREATE INDEX IF NOT EXISTS "idx_supplier_account_movement_company" ON "SupplierAccountMovement"("companyId");
CREATE INDEX IF NOT EXISTS "idx_supplier_account_movement_fecha" ON "SupplierAccountMovement"("fecha");
CREATE INDEX IF NOT EXISTS "idx_supplier_account_movement_tipo" ON "SupplierAccountMovement"("tipo");
CREATE INDEX IF NOT EXISTS "idx_supplier_account_movement_comprobante" ON "SupplierAccountMovement"("comprobante");
CREATE INDEX IF NOT EXISTS "idx_supplier_account_movement_conciliado" ON "SupplierAccountMovement"("supplierId", "conciliado");

-- Vista para obtener saldos actuales por proveedor
CREATE OR REPLACE VIEW "vw_supplier_balances" AS
SELECT
    s.id as "supplierId",
    s.name as "supplierName",
    s.cuit,
    s.company_id as "companyId",
    COALESCE(SUM(m."debe"), 0) as "totalDebe",
    COALESCE(SUM(m."haber"), 0) as "totalHaber",
    COALESCE(SUM(m."debe"), 0) - COALESCE(SUM(m."haber"), 0) as "saldoActual",
    COUNT(DISTINCT CASE WHEN m."tipo" = 'FACTURA' AND m."fechaVencimiento" < CURRENT_DATE
        AND (m."debe" - COALESCE(
            (SELECT SUM(por."montoAplicado")
             FROM "PaymentOrderReceipt" por
             WHERE por."receiptId" = m."facturaId"), 0)) > 0
        THEN m.id END) as "facturasVencidas",
    MAX(m."fecha") as "ultimoMovimiento"
FROM "suppliers" s
LEFT JOIN "SupplierAccountMovement" m ON s.id = m."supplierId"
GROUP BY s.id, s.name, s.cuit, s.company_id;

-- Vista de antigüedad de saldos (aging)
CREATE OR REPLACE VIEW "vw_supplier_aging" AS
SELECT
    s.id as "supplierId",
    s.name as "supplierName",
    s.company_id as "companyId",
    COALESCE(SUM(CASE WHEN m."fechaVencimiento" >= CURRENT_DATE THEN m."debe" - m."haber" ELSE 0 END), 0) as "corriente",
    COALESCE(SUM(CASE WHEN m."fechaVencimiento" < CURRENT_DATE
        AND m."fechaVencimiento" >= CURRENT_DATE - INTERVAL '30 days' THEN m."debe" - m."haber" ELSE 0 END), 0) as "vencido_1_30",
    COALESCE(SUM(CASE WHEN m."fechaVencimiento" < CURRENT_DATE - INTERVAL '30 days'
        AND m."fechaVencimiento" >= CURRENT_DATE - INTERVAL '60 days' THEN m."debe" - m."haber" ELSE 0 END), 0) as "vencido_31_60",
    COALESCE(SUM(CASE WHEN m."fechaVencimiento" < CURRENT_DATE - INTERVAL '60 days'
        AND m."fechaVencimiento" >= CURRENT_DATE - INTERVAL '90 days' THEN m."debe" - m."haber" ELSE 0 END), 0) as "vencido_61_90",
    COALESCE(SUM(CASE WHEN m."fechaVencimiento" < CURRENT_DATE - INTERVAL '90 days' THEN m."debe" - m."haber" ELSE 0 END), 0) as "vencido_mas_90"
FROM "suppliers" s
LEFT JOIN "SupplierAccountMovement" m ON s.id = m."supplierId" AND m."tipo" = 'FACTURA'
GROUP BY s.id, s.name, s.company_id;

-- =====================================================
-- FUNCIONES PARA SINCRONIZACIÓN AUTOMÁTICA
-- =====================================================

-- Función para crear movimiento desde factura
CREATE OR REPLACE FUNCTION fn_sync_factura_to_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO "SupplierAccountMovement" (
            "supplierId", "companyId", "tipo", "facturaId",
            "fecha", "fechaVencimiento", "debe", "haber",
            "comprobante", "descripcion", "createdBy"
        ) VALUES (
            NEW."proveedorId",
            NEW."companyId",
            'FACTURA',
            NEW.id,
            NEW."fechaEmision",
            NEW."fechaVencimiento",
            NEW."total",
            0,
            CONCAT(NEW."numeroSerie", '-', NEW."numeroFactura"),
            CONCAT('Factura ', NEW."tipo", ' ', NEW."numeroSerie", '-', NEW."numeroFactura"),
            NEW."userId"
        );
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE "SupplierAccountMovement"
        SET "debe" = NEW."total",
            "fecha" = NEW."fechaEmision",
            "fechaVencimiento" = NEW."fechaVencimiento",
            "comprobante" = CONCAT(NEW."numeroSerie", '-', NEW."numeroFactura"),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "facturaId" = NEW.id AND "tipo" = 'FACTURA';
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM "SupplierAccountMovement" WHERE "facturaId" = OLD.id AND "tipo" = 'FACTURA';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Función para crear movimiento desde pago
CREATE OR REPLACE FUNCTION fn_sync_pago_to_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO "SupplierAccountMovement" (
            "supplierId", "companyId", "tipo", "pagoId",
            "fecha", "haber", "debe",
            "comprobante", "descripcion", "metodoPago", "createdBy"
        ) VALUES (
            NEW."proveedorId",
            NEW."companyId",
            'PAGO',
            NEW.id,
            NEW."fechaPago",
            NEW."totalPago",
            0,
            CONCAT('OP-', NEW.id),
            CONCAT('Orden de Pago #', NEW.id),
            CASE
                WHEN NEW."efectivo" > 0 THEN 'EFECTIVO'
                WHEN NEW."transferencia" > 0 THEN 'TRANSFERENCIA'
                WHEN NEW."chequesTerceros" > 0 OR NEW."chequesPropios" > 0 THEN 'CHEQUE'
                ELSE 'OTROS'
            END,
            NEW."createdBy"
        );

        -- Si hay anticipo, crear movimiento separado
        IF NEW."anticipo" > 0 THEN
            INSERT INTO "SupplierAccountMovement" (
                "supplierId", "companyId", "tipo", "pagoId",
                "fecha", "haber", "debe",
                "comprobante", "descripcion", "createdBy"
            ) VALUES (
                NEW."proveedorId",
                NEW."companyId",
                'ANTICIPO',
                NEW.id,
                NEW."fechaPago",
                NEW."anticipo",
                0,
                CONCAT('ANT-', NEW.id),
                'Anticipo a proveedor',
                NEW."createdBy"
            );
        END IF;

        -- Si hay retenciones, crear movimientos separados
        IF NEW."retIVA" > 0 THEN
            INSERT INTO "SupplierAccountMovement" (
                "supplierId", "companyId", "tipo", "pagoId",
                "fecha", "haber", "debe",
                "comprobante", "descripcion", "createdBy"
            ) VALUES (
                NEW."proveedorId",
                NEW."companyId",
                'RETENCION',
                NEW.id,
                NEW."fechaPago",
                NEW."retIVA",
                0,
                CONCAT('RET-IVA-', NEW.id),
                'Retención IVA',
                NEW."createdBy"
            );
        END IF;

        IF NEW."retGanancias" > 0 THEN
            INSERT INTO "SupplierAccountMovement" (
                "supplierId", "companyId", "tipo", "pagoId",
                "fecha", "haber", "debe",
                "comprobante", "descripcion", "createdBy"
            ) VALUES (
                NEW."proveedorId",
                NEW."companyId",
                'RETENCION',
                NEW.id,
                NEW."fechaPago",
                NEW."retGanancias",
                0,
                CONCAT('RET-GAN-', NEW.id),
                'Retención Ganancias',
                NEW."createdBy"
            );
        END IF;

        IF NEW."retIngBrutos" > 0 THEN
            INSERT INTO "SupplierAccountMovement" (
                "supplierId", "companyId", "tipo", "pagoId",
                "fecha", "haber", "debe",
                "comprobante", "descripcion", "createdBy"
            ) VALUES (
                NEW."proveedorId",
                NEW."companyId",
                'RETENCION',
                NEW.id,
                NEW."fechaPago",
                NEW."retIngBrutos",
                0,
                CONCAT('RET-IIBB-', NEW.id),
                'Retención Ingresos Brutos',
                NEW."createdBy"
            );
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM "SupplierAccountMovement" WHERE "pagoId" = OLD.id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Función para crear movimiento desde NC/ND
CREATE OR REPLACE FUNCTION fn_sync_nota_to_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO "SupplierAccountMovement" (
            "supplierId", "companyId", "tipo", "notaCreditoDebitoId",
            "fecha", "debe", "haber",
            "comprobante", "descripcion", "createdBy"
        ) VALUES (
            NEW."proveedorId",
            NEW."companyId",
            CASE WHEN NEW."tipo" = 'NOTA_CREDITO' THEN 'NC' ELSE 'ND' END,
            NEW.id,
            NEW."fechaEmision",
            CASE WHEN NEW."tipo" = 'NOTA_DEBITO' THEN NEW."total" ELSE 0 END,
            CASE WHEN NEW."tipo" = 'NOTA_CREDITO' THEN NEW."total" ELSE 0 END,
            NEW."numero",
            CONCAT(CASE WHEN NEW."tipo" = 'NOTA_CREDITO' THEN 'Nota de Crédito ' ELSE 'Nota de Débito ' END, NEW."numero"),
            NEW."createdBy"
        );
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE "SupplierAccountMovement"
        SET "debe" = CASE WHEN NEW."tipo" = 'NOTA_DEBITO' THEN NEW."total" ELSE 0 END,
            "haber" = CASE WHEN NEW."tipo" = 'NOTA_CREDITO' THEN NEW."total" ELSE 0 END,
            "fecha" = NEW."fechaEmision",
            "comprobante" = NEW."numero",
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "notaCreditoDebitoId" = NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM "SupplierAccountMovement" WHERE "notaCreditoDebitoId" = OLD.id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Crear triggers (solo si no existen)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_factura_movement') THEN
        CREATE TRIGGER trg_sync_factura_movement
        AFTER INSERT OR UPDATE OR DELETE ON "PurchaseReceipt"
        FOR EACH ROW EXECUTE FUNCTION fn_sync_factura_to_movement();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_pago_movement') THEN
        CREATE TRIGGER trg_sync_pago_movement
        AFTER INSERT OR DELETE ON "PaymentOrder"
        FOR EACH ROW EXECUTE FUNCTION fn_sync_pago_to_movement();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_nota_movement') THEN
        CREATE TRIGGER trg_sync_nota_movement
        AFTER INSERT OR UPDATE OR DELETE ON "CreditDebitNote"
        FOR EACH ROW EXECUTE FUNCTION fn_sync_nota_to_movement();
    END IF;
END $$;

-- =====================================================
-- MIGRACIÓN DE DATOS EXISTENTES
-- =====================================================

-- Insertar movimientos de facturas existentes (si no existen)
INSERT INTO "SupplierAccountMovement" (
    "supplierId", "companyId", "tipo", "facturaId",
    "fecha", "fechaVencimiento", "debe", "haber",
    "comprobante", "descripcion", "createdBy"
)
SELECT
    pr."proveedorId",
    pr."companyId",
    'FACTURA',
    pr.id,
    pr."fechaEmision",
    pr."fechaVencimiento",
    pr."total",
    0,
    CONCAT(pr."numeroSerie", '-', pr."numeroFactura"),
    CONCAT('Factura ', pr."tipo", ' ', pr."numeroSerie", '-', pr."numeroFactura"),
    pr."userId"
FROM "PurchaseReceipt" pr
WHERE NOT EXISTS (
    SELECT 1 FROM "SupplierAccountMovement" sam
    WHERE sam."facturaId" = pr.id AND sam."tipo" = 'FACTURA'
);

-- Insertar movimientos de pagos existentes (si no existen)
INSERT INTO "SupplierAccountMovement" (
    "supplierId", "companyId", "tipo", "pagoId",
    "fecha", "haber", "debe",
    "comprobante", "descripcion", "metodoPago", "createdBy"
)
SELECT
    po."proveedorId",
    po."companyId",
    'PAGO',
    po.id,
    po."fechaPago",
    po."totalPago",
    0,
    CONCAT('OP-', po.id),
    CONCAT('Orden de Pago #', po.id),
    CASE
        WHEN po."efectivo" > 0 THEN 'EFECTIVO'
        WHEN po."transferencia" > 0 THEN 'TRANSFERENCIA'
        WHEN po."chequesTerceros" > 0 OR po."chequesPropios" > 0 THEN 'CHEQUE'
        ELSE 'OTROS'
    END,
    po."createdBy"
FROM "PaymentOrder" po
WHERE NOT EXISTS (
    SELECT 1 FROM "SupplierAccountMovement" sam
    WHERE sam."pagoId" = po.id AND sam."tipo" = 'PAGO'
);

-- Insertar movimientos de notas de crédito/débito existentes (si existen)
INSERT INTO "SupplierAccountMovement" (
    "supplierId", "companyId", "tipo", "notaCreditoDebitoId",
    "fecha", "debe", "haber",
    "comprobante", "descripcion", "createdBy"
)
SELECT
    cdn."proveedorId",
    cdn."companyId",
    CASE WHEN cdn."tipo" = 'NOTA_CREDITO' THEN 'NC' ELSE 'ND' END,
    cdn.id,
    cdn."fechaEmision",
    CASE WHEN cdn."tipo" = 'NOTA_DEBITO' THEN cdn."total" ELSE 0 END,
    CASE WHEN cdn."tipo" = 'NOTA_CREDITO' THEN cdn."total" ELSE 0 END,
    cdn."numero",
    CONCAT(CASE WHEN cdn."tipo" = 'NOTA_CREDITO' THEN 'Nota de Crédito ' ELSE 'Nota de Débito ' END, cdn."numero"),
    cdn."createdBy"
FROM "CreditDebitNote" cdn
WHERE NOT EXISTS (
    SELECT 1 FROM "SupplierAccountMovement" sam
    WHERE sam."notaCreditoDebitoId" = cdn.id
);

-- Recalcular saldos acumulados
WITH ordered_movements AS (
    SELECT
        id,
        "supplierId",
        "fecha",
        "debe",
        "haber",
        SUM("debe" - "haber") OVER (
            PARTITION BY "supplierId"
            ORDER BY "fecha", id
        ) as running_balance
    FROM "SupplierAccountMovement"
)
UPDATE "SupplierAccountMovement" sam
SET "saldoMovimiento" = om.running_balance
FROM ordered_movements om
WHERE sam.id = om.id;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
