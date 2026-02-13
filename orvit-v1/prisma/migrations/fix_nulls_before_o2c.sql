-- Fix NULL values before O2C migration
-- Run this script before applying the O2C migration
-- Based on Prisma db push error output

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- QUOTE_VERSIONS
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE quote_versions SET "createdAt" = NOW() WHERE "createdAt" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- QUOTES
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE quotes SET estado = 'BORRADOR' WHERE estado IS NULL;
UPDATE quotes SET "descuentoGlobal" = 0 WHERE "descuentoGlobal" IS NULL;
UPDATE quotes SET "descuentoMonto" = 0 WHERE "descuentoMonto" IS NULL;
UPDATE quotes SET "tasaIva" = 21 WHERE "tasaIva" IS NULL;
UPDATE quotes SET impuestos = 0 WHERE impuestos IS NULL;
UPDATE quotes SET moneda = 'ARS' WHERE moneda IS NULL;
UPDATE quotes SET "requiereAprobacion" = false WHERE "requiereAprobacion" IS NULL;
UPDATE quotes SET "docType" = 'T1' WHERE "docType" IS NULL;
UPDATE quotes SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
UPDATE quotes SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SALARY_COMPONENTS
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE salary_components SET concept_type = 'EARNING' WHERE concept_type IS NULL;
UPDATE salary_components SET is_remunerative = true WHERE is_remunerative IS NULL;
UPDATE salary_components SET affects_employee_contrib = false WHERE affects_employee_contrib IS NULL;
UPDATE salary_components SET affects_employer_contrib = false WHERE affects_employer_contrib IS NULL;
UPDATE salary_components SET affects_income_tax = false WHERE affects_income_tax IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SALE_ACOPIOS
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE sale_acopios SET "docType" = 'T1' WHERE "docType" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SALE_ITEMS
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE sale_items SET "cantidadEntregada" = 0 WHERE "cantidadEntregada" IS NULL;
UPDATE sale_items SET descuento = 0 WHERE descuento IS NULL;
UPDATE sale_items SET orden = 0 WHERE orden IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SALES
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE sales SET estado = 'BORRADOR' WHERE estado IS NULL;
UPDATE sales SET "descuentoGlobal" = 0 WHERE "descuentoGlobal" IS NULL;
UPDATE sales SET "descuentoMonto" = 0 WHERE "descuentoMonto" IS NULL;
UPDATE sales SET "tasaIva" = 21 WHERE "tasaIva" IS NULL;
UPDATE sales SET impuestos = 0 WHERE impuestos IS NULL;
UPDATE sales SET moneda = 'ARS' WHERE moneda IS NULL;
UPDATE sales SET "requiereAprobacion" = false WHERE "requiereAprobacion" IS NULL;
UPDATE sales SET "comisionPagada" = false WHERE "comisionPagada" IS NULL;
UPDATE sales SET "docType" = 'T1' WHERE "docType" IS NULL;
UPDATE sales SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
UPDATE sales SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SALES_CONFIG
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE sales_config SET "quotePrefix" = 'COT' WHERE "quotePrefix" IS NULL;
UPDATE sales_config SET "quoteNextNumber" = 1 WHERE "quoteNextNumber" IS NULL;
UPDATE sales_config SET "salePrefix" = 'VTA' WHERE "salePrefix" IS NULL;
UPDATE sales_config SET "saleNextNumber" = 1 WHERE "saleNextNumber" IS NULL;
UPDATE sales_config SET "deliveryPrefix" = 'ENT' WHERE "deliveryPrefix" IS NULL;
UPDATE sales_config SET "deliveryNextNumber" = 1 WHERE "deliveryNextNumber" IS NULL;
UPDATE sales_config SET "remitoPrefix" = 'REM' WHERE "remitoPrefix" IS NULL;
UPDATE sales_config SET "remitoNextNumber" = 1 WHERE "remitoNextNumber" IS NULL;
UPDATE sales_config SET "invoicePrefix" = 'FAC' WHERE "invoicePrefix" IS NULL;
UPDATE sales_config SET "paymentPrefix" = 'REC' WHERE "paymentPrefix" IS NULL;
UPDATE sales_config SET "paymentNextNumber" = 1 WHERE "paymentNextNumber" IS NULL;
UPDATE sales_config SET "puntoVenta" = 1 WHERE "puntoVenta" IS NULL;
UPDATE sales_config SET "invoiceNextNumberA" = 1 WHERE "invoiceNextNumberA" IS NULL;
UPDATE sales_config SET "invoiceNextNumberB" = 1 WHERE "invoiceNextNumberB" IS NULL;
UPDATE sales_config SET "invoiceNextNumberC" = 1 WHERE "invoiceNextNumberC" IS NULL;
UPDATE sales_config SET "requiereAprobacionCotizacion" = false WHERE "requiereAprobacionCotizacion" IS NULL;
UPDATE sales_config SET "requiereAprobacionDescuento" = false WHERE "requiereAprobacionDescuento" IS NULL;
UPDATE sales_config SET "maxDescuentoSinAprobacion" = 100 WHERE "maxDescuentoSinAprobacion" IS NULL;
UPDATE sales_config SET "validarLimiteCredito" = true WHERE "validarLimiteCredito" IS NULL;
UPDATE sales_config SET "bloquearVentaSinCredito" = false WHERE "bloquearVentaSinCredito" IS NULL;
UPDATE sales_config SET "diasVencimientoDefault" = 30 WHERE "diasVencimientoDefault" IS NULL;
UPDATE sales_config SET "validarStockDisponible" = false WHERE "validarStockDisponible" IS NULL;
UPDATE sales_config SET "permitirVentaSinStock" = true WHERE "permitirVentaSinStock" IS NULL;
UPDATE sales_config SET "reservarStockEnCotizacion" = false WHERE "reservarStockEnCotizacion" IS NULL;
UPDATE sales_config SET "margenMinimoPermitido" = 0 WHERE "margenMinimoPermitido" IS NULL;
UPDATE sales_config SET "alertarMargenBajo" = false WHERE "alertarMargenBajo" IS NULL;
UPDATE sales_config SET "comisionVendedorDefault" = 0 WHERE "comisionVendedorDefault" IS NULL;
UPDATE sales_config SET "tasaIvaDefault" = 21 WHERE "tasaIvaDefault" IS NULL;
UPDATE sales_config SET "diasValidezCotizacion" = 30 WHERE "diasValidezCotizacion" IS NULL;
UPDATE sales_config SET "habilitarAcopios" = false WHERE "habilitarAcopios" IS NULL;
UPDATE sales_config SET "acopioPrefix" = 'ACO' WHERE "acopioPrefix" IS NULL;
UPDATE sales_config SET "acopioNextNumber" = 1 WHERE "acopioNextNumber" IS NULL;
UPDATE sales_config SET "retiroPrefix" = 'RET' WHERE "retiroPrefix" IS NULL;
UPDATE sales_config SET "retiroNextNumber" = 1 WHERE "retiroNextNumber" IS NULL;
UPDATE sales_config SET "diasAlertaAcopioDefault" = 7 WHERE "diasAlertaAcopioDefault" IS NULL;
UPDATE sales_config SET "diasVencimientoAcopioDefault" = 30 WHERE "diasVencimientoAcopioDefault" IS NULL;
UPDATE sales_config SET "bloquearVentaAcopioExcedido" = false WHERE "bloquearVentaAcopioExcedido" IS NULL;
UPDATE sales_config SET "alertarAcopioExcedido" = true WHERE "alertarAcopioExcedido" IS NULL;
UPDATE sales_config SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
UPDATE sales_config SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;
UPDATE sales_config SET "clientFormEnabledFields" = '["name","legalName","taxId","phone","email","address"]'::jsonb WHERE "clientFormEnabledFields" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STOCK_ADJUSTMENTS
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE stock_adjustments SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STOCK_MOVEMENTS
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE stock_movements SET "docType" = 'T1' WHERE "docType" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTION_PLANS
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE subscription_plans SET currency = 'ARS' WHERE currency IS NULL;
UPDATE subscription_plans SET "includedTokensMonthly" = 0 WHERE "includedTokensMonthly" IS NULL;
UPDATE subscription_plans SET "isActive" = true WHERE "isActive" IS NULL;
UPDATE subscription_plans SET "sortOrder" = 0 WHERE "sortOrder" IS NULL;
UPDATE subscription_plans SET color = '#3B82F6' WHERE color IS NULL;
UPDATE subscription_plans SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
UPDATE subscription_plans SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE subscriptions SET status = 'ACTIVE' WHERE status IS NULL;
UPDATE subscriptions SET "startDate" = NOW() WHERE "startDate" IS NULL;
UPDATE subscriptions SET "cancelAtPeriodEnd" = false WHERE "cancelAtPeriodEnd" IS NULL;
UPDATE subscriptions SET "billingCycle" = 'MONTHLY' WHERE "billingCycle" IS NULL;
UPDATE subscriptions SET "includedTokensRemaining" = 0 WHERE "includedTokensRemaining" IS NULL;
UPDATE subscriptions SET "purchasedTokensBalance" = 0 WHERE "purchasedTokensBalance" IS NULL;
UPDATE subscriptions SET "tokensUsedThisPeriod" = 0 WHERE "tokensUsedThisPeriod" IS NULL;
UPDATE subscriptions SET "createdAt" = NOW() WHERE "createdAt" IS NULL;
UPDATE subscriptions SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;

COMMIT;
