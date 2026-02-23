-- Migración: Desglose de Costos por Item + Sistema de Liquidaciones de Vendedores
-- Fecha: 2026-02-21
-- Descripción: Agrega tablas para desglose de costos en items de cotización/venta
--              y sistema completo de liquidaciones de vendedores

-- =============================================
-- 1. ENUM: Estado de liquidación
-- =============================================
DO $$ BEGIN
  CREATE TYPE "LiquidacionStatus" AS ENUM ('BORRADOR', 'CONFIRMADA', 'PAGADA', 'ANULADA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- 2. TABLA: Desglose de costos de items de cotización
-- =============================================
CREATE TABLE IF NOT EXISTS "quote_item_cost_breakdowns" (
  "id" SERIAL NOT NULL,
  "quoteItemId" INTEGER NOT NULL,
  "concepto" VARCHAR(100) NOT NULL,
  "monto" DECIMAL(15,2) NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "quote_item_cost_breakdowns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quote_item_cost_breakdowns_quoteItemId_idx" ON "quote_item_cost_breakdowns"("quoteItemId");

ALTER TABLE "quote_item_cost_breakdowns"
  DROP CONSTRAINT IF EXISTS "quote_item_cost_breakdowns_quoteItemId_fkey";
ALTER TABLE "quote_item_cost_breakdowns"
  ADD CONSTRAINT "quote_item_cost_breakdowns_quoteItemId_fkey"
  FOREIGN KEY ("quoteItemId") REFERENCES "quote_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================
-- 3. TABLA: Desglose de costos de items de venta
-- =============================================
CREATE TABLE IF NOT EXISTS "sale_item_cost_breakdowns" (
  "id" SERIAL NOT NULL,
  "saleItemId" INTEGER NOT NULL,
  "concepto" VARCHAR(100) NOT NULL,
  "monto" DECIMAL(15,2) NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "sale_item_cost_breakdowns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sale_item_cost_breakdowns_saleItemId_idx" ON "sale_item_cost_breakdowns"("saleItemId");

ALTER TABLE "sale_item_cost_breakdowns"
  DROP CONSTRAINT IF EXISTS "sale_item_cost_breakdowns_saleItemId_fkey";
ALTER TABLE "sale_item_cost_breakdowns"
  ADD CONSTRAINT "sale_item_cost_breakdowns_saleItemId_fkey"
  FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================
-- 4. TABLA: Liquidaciones de vendedores
-- =============================================
CREATE TABLE IF NOT EXISTS "seller_liquidaciones" (
  "id" SERIAL NOT NULL,
  "numero" VARCHAR(50) NOT NULL,
  "sellerId" INTEGER NOT NULL,
  "estado" "LiquidacionStatus" NOT NULL DEFAULT 'BORRADOR',
  "fechaDesde" DATE NOT NULL,
  "fechaHasta" DATE NOT NULL,
  "totalVentas" DECIMAL(15,2) NOT NULL,
  "comisionPorcentaje" DECIMAL(5,2) NOT NULL,
  "totalComisiones" DECIMAL(15,2) NOT NULL,
  "ajustes" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "totalLiquidacion" DECIMAL(15,2) NOT NULL,
  "notas" TEXT,
  "notasInternas" TEXT,
  "confirmadoPor" INTEGER,
  "confirmadoAt" TIMESTAMP(3),
  "pagadoPor" INTEGER,
  "pagadoAt" TIMESTAMP(3),
  "medioPago" VARCHAR(100),
  "referenciaPago" VARCHAR(255),
  "companyId" INTEGER NOT NULL,
  "createdBy" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "seller_liquidaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seller_liquidaciones_companyId_numero_key" ON "seller_liquidaciones"("companyId", "numero");
CREATE INDEX IF NOT EXISTS "seller_liquidaciones_companyId_idx" ON "seller_liquidaciones"("companyId");
CREATE INDEX IF NOT EXISTS "seller_liquidaciones_sellerId_idx" ON "seller_liquidaciones"("sellerId");
CREATE INDEX IF NOT EXISTS "seller_liquidaciones_estado_idx" ON "seller_liquidaciones"("estado");
CREATE INDEX IF NOT EXISTS "seller_liquidaciones_fechaDesde_fechaHasta_idx" ON "seller_liquidaciones"("fechaDesde", "fechaHasta");

ALTER TABLE "seller_liquidaciones"
  DROP CONSTRAINT IF EXISTS "seller_liquidaciones_sellerId_fkey";
ALTER TABLE "seller_liquidaciones"
  ADD CONSTRAINT "seller_liquidaciones_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "seller_liquidaciones"
  DROP CONSTRAINT IF EXISTS "seller_liquidaciones_companyId_fkey";
ALTER TABLE "seller_liquidaciones"
  ADD CONSTRAINT "seller_liquidaciones_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_liquidaciones"
  DROP CONSTRAINT IF EXISTS "seller_liquidaciones_createdBy_fkey";
ALTER TABLE "seller_liquidaciones"
  ADD CONSTRAINT "seller_liquidaciones_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "seller_liquidaciones"
  DROP CONSTRAINT IF EXISTS "seller_liquidaciones_confirmadoPor_fkey";
ALTER TABLE "seller_liquidaciones"
  ADD CONSTRAINT "seller_liquidaciones_confirmadoPor_fkey"
  FOREIGN KEY ("confirmadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "seller_liquidaciones"
  DROP CONSTRAINT IF EXISTS "seller_liquidaciones_pagadoPor_fkey";
ALTER TABLE "seller_liquidaciones"
  ADD CONSTRAINT "seller_liquidaciones_pagadoPor_fkey"
  FOREIGN KEY ("pagadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- 5. TABLA: Items de liquidación (snapshot de cada venta)
-- =============================================
CREATE TABLE IF NOT EXISTS "seller_liquidacion_items" (
  "id" SERIAL NOT NULL,
  "liquidacionId" INTEGER NOT NULL,
  "saleId" INTEGER NOT NULL,
  "saleNumero" VARCHAR(50) NOT NULL,
  "clienteNombre" VARCHAR(255) NOT NULL,
  "fechaVenta" DATE NOT NULL,
  "totalVenta" DECIMAL(15,2) NOT NULL,
  "comisionMonto" DECIMAL(15,2) NOT NULL,
  "incluido" BOOLEAN NOT NULL DEFAULT true,
  "motivoExclusion" VARCHAR(255),

  CONSTRAINT "seller_liquidacion_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seller_liquidacion_items_liquidacionId_idx" ON "seller_liquidacion_items"("liquidacionId");
CREATE INDEX IF NOT EXISTS "seller_liquidacion_items_saleId_idx" ON "seller_liquidacion_items"("saleId");

ALTER TABLE "seller_liquidacion_items"
  DROP CONSTRAINT IF EXISTS "seller_liquidacion_items_liquidacionId_fkey";
ALTER TABLE "seller_liquidacion_items"
  ADD CONSTRAINT "seller_liquidacion_items_liquidacionId_fkey"
  FOREIGN KEY ("liquidacionId") REFERENCES "seller_liquidaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_liquidacion_items"
  DROP CONSTRAINT IF EXISTS "seller_liquidacion_items_saleId_fkey";
ALTER TABLE "seller_liquidacion_items"
  ADD CONSTRAINT "seller_liquidacion_items_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
