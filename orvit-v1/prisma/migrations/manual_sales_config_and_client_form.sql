-- Migración combinada: Crear tabla sales_config (si no existe) y agregar campos de configuración
-- Fecha: 2026-01-14

-- ═══════════════════════════════════════════════════════════════════════════
-- CREAR TABLA SALES_CONFIG SI NO EXISTE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "sales_config" (
    id SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL UNIQUE,

    -- Numeración automática
    "quotePrefix" VARCHAR(10) DEFAULT 'COT',
    "quoteNextNumber" INTEGER DEFAULT 1,
    "salePrefix" VARCHAR(10) DEFAULT 'VTA',
    "saleNextNumber" INTEGER DEFAULT 1,
    "deliveryPrefix" VARCHAR(10) DEFAULT 'ENT',
    "deliveryNextNumber" INTEGER DEFAULT 1,
    "remitoPrefix" VARCHAR(10) DEFAULT 'REM',
    "remitoNextNumber" INTEGER DEFAULT 1,
    "invoicePrefix" VARCHAR(10) DEFAULT 'FA',
    "paymentPrefix" VARCHAR(10) DEFAULT 'REC',
    "paymentNextNumber" INTEGER DEFAULT 1,

    -- Punto de venta
    "puntoVenta" VARCHAR(5) DEFAULT '0001',
    "invoiceNextNumberA" INTEGER DEFAULT 1,
    "invoiceNextNumberB" INTEGER DEFAULT 1,
    "invoiceNextNumberC" INTEGER DEFAULT 1,

    -- Aprobaciones
    "requiereAprobacionCotizacion" BOOLEAN DEFAULT false,
    "montoMinimoAprobacionCot" DECIMAL(15,2),
    "requiereAprobacionDescuento" BOOLEAN DEFAULT true,
    "maxDescuentoSinAprobacion" DECIMAL(5,2) DEFAULT 10,

    -- Crédito
    "validarLimiteCredito" BOOLEAN DEFAULT true,
    "bloquearVentaSinCredito" BOOLEAN DEFAULT false,
    "diasVencimientoDefault" INTEGER DEFAULT 30,

    -- Stock
    "validarStockDisponible" BOOLEAN DEFAULT true,
    "permitirVentaSinStock" BOOLEAN DEFAULT true,
    "reservarStockEnCotizacion" BOOLEAN DEFAULT false,

    -- Márgenes
    "margenMinimoPermitido" DECIMAL(5,2) DEFAULT 10,
    "alertarMargenBajo" BOOLEAN DEFAULT true,

    -- Comisiones
    "comisionVendedorDefault" DECIMAL(5,2) DEFAULT 0,

    -- IVA
    "tasaIvaDefault" DECIMAL(5,2) DEFAULT 21,

    -- Validez cotización
    "diasValidezCotizacion" INTEGER DEFAULT 30,

    -- Acopios
    "habilitarAcopios" BOOLEAN DEFAULT true,
    "acopioPrefix" VARCHAR(10) DEFAULT 'ACO',
    "acopioNextNumber" INTEGER DEFAULT 1,
    "retiroPrefix" VARCHAR(10) DEFAULT 'RET',
    "retiroNextNumber" INTEGER DEFAULT 1,
    "diasAlertaAcopioDefault" INTEGER DEFAULT 30,
    "diasVencimientoAcopioDefault" INTEGER DEFAULT 90,
    "bloquearVentaAcopioExcedido" BOOLEAN DEFAULT false,
    "alertarAcopioExcedido" BOOLEAN DEFAULT true,

    -- Timestamps
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),

    CONSTRAINT "sales_config_companyId_fkey" FOREIGN KEY ("companyId")
        REFERENCES "Company"(id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════════════════════════
-- AGREGAR CAMPOS DE CONFIGURACIÓN DEL FORMULARIO DE CLIENTES
-- ═══════════════════════════════════════════════════════════════════════════

-- Campo JSON para almacenar qué campos están habilitados
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "clientFormEnabledFields" JSONB DEFAULT '{}';

-- Límite máximo de funcionalidades (definido por superadmin, null = sin límite)
ALTER TABLE "sales_config" ADD COLUMN IF NOT EXISTS "maxClientFormFeatures" INTEGER DEFAULT NULL;

-- Comentarios descriptivos
COMMENT ON COLUMN "sales_config"."clientFormEnabledFields" IS 'JSON con campos habilitados del formulario de clientes';
COMMENT ON COLUMN "sales_config"."maxClientFormFeatures" IS 'Máximo de funcionalidades que puede habilitar la empresa (null = sin límite)';
