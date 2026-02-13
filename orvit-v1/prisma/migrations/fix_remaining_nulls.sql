-- Fix remaining NULL values in sales_config and work_order_checklists

BEGIN;

-- SALES_CONFIG - All remaining fields
ALTER TABLE sales_config ALTER COLUMN "deliveryPrefix" SET DEFAULT 'ENT';
UPDATE sales_config SET "deliveryPrefix" = 'ENT' WHERE "deliveryPrefix" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "deliveryPrefix" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "deliveryNextNumber" SET DEFAULT 1;
UPDATE sales_config SET "deliveryNextNumber" = 1 WHERE "deliveryNextNumber" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "deliveryNextNumber" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "remitoPrefix" SET DEFAULT 'REM';
UPDATE sales_config SET "remitoPrefix" = 'REM' WHERE "remitoPrefix" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "remitoPrefix" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "remitoNextNumber" SET DEFAULT 1;
UPDATE sales_config SET "remitoNextNumber" = 1 WHERE "remitoNextNumber" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "remitoNextNumber" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "invoicePrefix" SET DEFAULT 'FAC';
UPDATE sales_config SET "invoicePrefix" = 'FAC' WHERE "invoicePrefix" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "invoicePrefix" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "paymentPrefix" SET DEFAULT 'REC';
UPDATE sales_config SET "paymentPrefix" = 'REC' WHERE "paymentPrefix" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "paymentPrefix" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "paymentNextNumber" SET DEFAULT 1;
UPDATE sales_config SET "paymentNextNumber" = 1 WHERE "paymentNextNumber" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "paymentNextNumber" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "puntoVenta" SET DEFAULT 1;
UPDATE sales_config SET "puntoVenta" = 1 WHERE "puntoVenta" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "puntoVenta" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "invoiceNextNumberA" SET DEFAULT 1;
UPDATE sales_config SET "invoiceNextNumberA" = 1 WHERE "invoiceNextNumberA" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "invoiceNextNumberA" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "invoiceNextNumberB" SET DEFAULT 1;
UPDATE sales_config SET "invoiceNextNumberB" = 1 WHERE "invoiceNextNumberB" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "invoiceNextNumberB" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "invoiceNextNumberC" SET DEFAULT 1;
UPDATE sales_config SET "invoiceNextNumberC" = 1 WHERE "invoiceNextNumberC" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "invoiceNextNumberC" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "requiereAprobacionCotizacion" SET DEFAULT false;
UPDATE sales_config SET "requiereAprobacionCotizacion" = false WHERE "requiereAprobacionCotizacion" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "requiereAprobacionCotizacion" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "requiereAprobacionDescuento" SET DEFAULT false;
UPDATE sales_config SET "requiereAprobacionDescuento" = false WHERE "requiereAprobacionDescuento" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "requiereAprobacionDescuento" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "maxDescuentoSinAprobacion" SET DEFAULT 100;
UPDATE sales_config SET "maxDescuentoSinAprobacion" = 100 WHERE "maxDescuentoSinAprobacion" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "maxDescuentoSinAprobacion" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "validarLimiteCredito" SET DEFAULT true;
UPDATE sales_config SET "validarLimiteCredito" = true WHERE "validarLimiteCredito" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "validarLimiteCredito" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "bloquearVentaSinCredito" SET DEFAULT false;
UPDATE sales_config SET "bloquearVentaSinCredito" = false WHERE "bloquearVentaSinCredito" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "bloquearVentaSinCredito" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "diasVencimientoDefault" SET DEFAULT 30;
UPDATE sales_config SET "diasVencimientoDefault" = 30 WHERE "diasVencimientoDefault" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "diasVencimientoDefault" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "validarStockDisponible" SET DEFAULT false;
UPDATE sales_config SET "validarStockDisponible" = false WHERE "validarStockDisponible" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "validarStockDisponible" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "permitirVentaSinStock" SET DEFAULT true;
UPDATE sales_config SET "permitirVentaSinStock" = true WHERE "permitirVentaSinStock" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "permitirVentaSinStock" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "reservarStockEnCotizacion" SET DEFAULT false;
UPDATE sales_config SET "reservarStockEnCotizacion" = false WHERE "reservarStockEnCotizacion" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "reservarStockEnCotizacion" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "margenMinimoPermitido" SET DEFAULT 0;
UPDATE sales_config SET "margenMinimoPermitido" = 0 WHERE "margenMinimoPermitido" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "margenMinimoPermitido" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "alertarMargenBajo" SET DEFAULT false;
UPDATE sales_config SET "alertarMargenBajo" = false WHERE "alertarMargenBajo" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "alertarMargenBajo" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "comisionVendedorDefault" SET DEFAULT 0;
UPDATE sales_config SET "comisionVendedorDefault" = 0 WHERE "comisionVendedorDefault" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "comisionVendedorDefault" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "tasaIvaDefault" SET DEFAULT 21;
UPDATE sales_config SET "tasaIvaDefault" = 21 WHERE "tasaIvaDefault" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "tasaIvaDefault" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "diasValidezCotizacion" SET DEFAULT 30;
UPDATE sales_config SET "diasValidezCotizacion" = 30 WHERE "diasValidezCotizacion" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "diasValidezCotizacion" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "habilitarAcopios" SET DEFAULT false;
UPDATE sales_config SET "habilitarAcopios" = false WHERE "habilitarAcopios" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "habilitarAcopios" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "acopioPrefix" SET DEFAULT 'ACO';
UPDATE sales_config SET "acopioPrefix" = 'ACO' WHERE "acopioPrefix" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "acopioPrefix" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "acopioNextNumber" SET DEFAULT 1;
UPDATE sales_config SET "acopioNextNumber" = 1 WHERE "acopioNextNumber" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "acopioNextNumber" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "retiroPrefix" SET DEFAULT 'RET';
UPDATE sales_config SET "retiroPrefix" = 'RET' WHERE "retiroPrefix" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "retiroPrefix" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "retiroNextNumber" SET DEFAULT 1;
UPDATE sales_config SET "retiroNextNumber" = 1 WHERE "retiroNextNumber" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "retiroNextNumber" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "diasAlertaAcopioDefault" SET DEFAULT 7;
UPDATE sales_config SET "diasAlertaAcopioDefault" = 7 WHERE "diasAlertaAcopioDefault" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "diasAlertaAcopioDefault" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "diasVencimientoAcopioDefault" SET DEFAULT 30;
UPDATE sales_config SET "diasVencimientoAcopioDefault" = 30 WHERE "diasVencimientoAcopioDefault" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "diasVencimientoAcopioDefault" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "bloquearVentaAcopioExcedido" SET DEFAULT false;
UPDATE sales_config SET "bloquearVentaAcopioExcedido" = false WHERE "bloquearVentaAcopioExcedido" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "bloquearVentaAcopioExcedido" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "alertarAcopioExcedido" SET DEFAULT true;
UPDATE sales_config SET "alertarAcopioExcedido" = true WHERE "alertarAcopioExcedido" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "alertarAcopioExcedido" SET NOT NULL;

ALTER TABLE sales_config ALTER COLUMN "clientFormEnabledFields" SET DEFAULT '["name","legalName","taxId","phone","email","address"]'::jsonb;
UPDATE sales_config SET "clientFormEnabledFields" = '["name","legalName","taxId","phone","email","address"]'::jsonb WHERE "clientFormEnabledFields" IS NULL;
ALTER TABLE sales_config ALTER COLUMN "clientFormEnabledFields" SET NOT NULL;

-- WORK_ORDER_CHECKLISTS - Fix templateId
-- Delete orphaned records where templateId is still NULL
DELETE FROM work_order_checklists WHERE "templateId" IS NULL;

-- Make templateId required (it should already have valid values now)
ALTER TABLE work_order_checklists ALTER COLUMN "templateId" SET NOT NULL;

COMMIT;
