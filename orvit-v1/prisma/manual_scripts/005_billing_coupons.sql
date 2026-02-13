-- ============================================
-- MIGRACIÓN: Sistema de Cupones de Descuento
-- Fecha: 2026-01-12
-- ============================================

-- ============================================
-- ENUM para tipo de descuento
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type') THEN
        CREATE TYPE discount_type AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
    END IF;
END $$;

-- ============================================
-- TABLA: Cupones de Descuento
-- ============================================
CREATE TABLE IF NOT EXISTS billing_coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,                    -- Código único (ej: WELCOME20)
    name TEXT NOT NULL,                           -- Nombre descriptivo
    description TEXT,

    -- Tipo de descuento
    "discountType" discount_type NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DECIMAL(12,2) NOT NULL,       -- Porcentaje o monto fijo
    currency TEXT DEFAULT 'ARS',                  -- Solo aplica si es FIXED_AMOUNT

    -- Restricciones
    "maxUses" INTEGER,                            -- NULL = ilimitado
    "maxUsesPerUser" INTEGER DEFAULT 1,           -- Cuántas veces puede usar un usuario
    "currentUses" INTEGER DEFAULT 0,              -- Contador de usos

    -- Validez
    "validFrom" TIMESTAMPTZ DEFAULT NOW(),
    "validUntil" TIMESTAMPTZ,                     -- NULL = sin fecha de expiración

    -- Aplicabilidad
    "appliesToPlans" TEXT[] DEFAULT '{}',         -- Array de plan IDs (vacío = todos)
    "appliesToCycles" TEXT[] DEFAULT '{}',        -- MONTHLY, ANNUAL (vacío = todos)
    "minAmount" DECIMAL(12,2),                    -- Monto mínimo para aplicar
    "firstPaymentOnly" BOOLEAN DEFAULT false,     -- Solo primer pago

    -- Duración del descuento
    "durationMonths" INTEGER,                     -- NULL = aplica solo una vez
                                                  -- Número = meses que dura el descuento

    -- Estado
    "isActive" BOOLEAN DEFAULT true,

    -- Metadata
    "createdBy" INTEGER REFERENCES "User"(id),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updatedAt
CREATE TRIGGER billing_coupons_updated_at
    BEFORE UPDATE ON billing_coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_billing_coupons_code ON billing_coupons(code);
CREATE INDEX IF NOT EXISTS idx_billing_coupons_active ON billing_coupons("isActive") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS idx_billing_coupons_valid ON billing_coupons("validFrom", "validUntil");

-- ============================================
-- TABLA: Uso de Cupones (redemptions)
-- ============================================
CREATE TABLE IF NOT EXISTS billing_coupon_redemptions (
    id TEXT PRIMARY KEY,
    "couponId" TEXT NOT NULL REFERENCES billing_coupons(id) ON DELETE CASCADE,
    "subscriptionId" TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    "invoiceId" TEXT REFERENCES invoices(id),     -- Factura donde se aplicó

    -- Descuento aplicado
    "discountAmount" DECIMAL(12,2) NOT NULL,      -- Monto descontado

    -- Control de duración
    "appliedCount" INTEGER DEFAULT 1,             -- Cuántas veces se ha aplicado
    "expiresAt" TIMESTAMPTZ,                      -- Cuándo expira el descuento recurrente

    "redeemedAt" TIMESTAMPTZ DEFAULT NOW(),

    -- Evitar duplicados
    UNIQUE("couponId", "subscriptionId")
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_subscription ON billing_coupon_redemptions("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON billing_coupon_redemptions("couponId");

-- ============================================
-- MODIFICAR FACTURAS: Agregar campo de descuento
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'discountAmount'
    ) THEN
        ALTER TABLE invoices ADD COLUMN "discountAmount" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE invoices ADD COLUMN "couponId" TEXT REFERENCES billing_coupons(id);
        RAISE NOTICE 'Columnas de descuento agregadas a invoices';
    END IF;
END $$;

-- ============================================
-- TABLA: Configuración de Débito Automático
-- ============================================
CREATE TABLE IF NOT EXISTS billing_auto_payment_configs (
    id TEXT PRIMARY KEY,
    "subscriptionId" TEXT UNIQUE NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

    -- Proveedor
    provider TEXT NOT NULL,                       -- 'STRIPE', 'MERCADOPAGO'

    -- Datos del proveedor
    "providerCustomerId" TEXT,                    -- ID del cliente en el proveedor
    "providerPaymentMethodId" TEXT,               -- ID del método de pago (tarjeta)
    "providerSubscriptionId" TEXT,                -- ID de suscripción en el proveedor

    -- Datos de la tarjeta (para mostrar)
    "cardLast4" TEXT,
    "cardBrand" TEXT,                             -- visa, mastercard, amex
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,

    -- Estado
    "isEnabled" BOOLEAN DEFAULT true,
    "failedAttempts" INTEGER DEFAULT 0,
    "lastFailureReason" TEXT,
    "lastPaymentAt" TIMESTAMPTZ,

    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER billing_auto_payment_configs_updated_at
    BEFORE UPDATE ON billing_auto_payment_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_auto_payment_subscription ON billing_auto_payment_configs("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_auto_payment_provider ON billing_auto_payment_configs(provider);

-- ============================================
-- SEED: Cupones de ejemplo
-- ============================================
INSERT INTO billing_coupons (id, code, name, description, "discountType", "discountValue", "maxUses", "durationMonths", "firstPaymentOnly")
VALUES
    ('coupon_welcome', 'BIENVENIDO20', 'Bienvenida 20%', '20% de descuento en tu primer mes', 'PERCENTAGE', 20, NULL, 1, true),
    ('coupon_annual', 'ANUAL15', 'Descuento Anual', '15% adicional en planes anuales', 'PERCENTAGE', 15, NULL, NULL, false)
ON CONFLICT (id) DO NOTHING;

-- Actualizar el cupón anual para que solo aplique a ciclos anuales
UPDATE billing_coupons
SET "appliesToCycles" = ARRAY['ANNUAL']
WHERE id = 'coupon_annual';

-- ============================================
-- MENSAJE FINAL
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migración de Cupones completada!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Tablas creadas:';
    RAISE NOTICE '  - billing_coupons';
    RAISE NOTICE '  - billing_coupon_redemptions';
    RAISE NOTICE '  - billing_auto_payment_configs';
    RAISE NOTICE '';
    RAISE NOTICE 'Columnas agregadas a invoices:';
    RAISE NOTICE '  - discountAmount';
    RAISE NOTICE '  - couponId';
    RAISE NOTICE '';
END $$;
