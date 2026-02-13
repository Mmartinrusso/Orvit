-- =====================================================
-- FIX CRITICAL BUG: Balance Desynchronization
-- =====================================================
-- Reconcilia los balances de clientes desincronizados
-- debido a operaciones masivas de facturas sin
-- actualización de currentDebt
-- =====================================================

-- PASO 1: Crear tabla temporal con balances correctos calculados desde ledger
CREATE TEMP TABLE correct_balances AS
SELECT
  cl.client_id,
  SUM(cl.debe) - SUM(cl.haber) AS correct_debt
FROM client_ledger_entries cl
GROUP BY cl.client_id;

-- PASO 2: Identificar clientes con desincronización
SELECT
  c.id,
  c.legal_name,
  c.current_debt AS current_incorrect_debt,
  COALESCE(cb.correct_debt, 0) AS correct_debt_from_ledger,
  (c.current_debt - COALESCE(cb.correct_debt, 0)) AS difference
FROM clients c
LEFT JOIN correct_balances cb ON c.id = cb.client_id
WHERE ABS(c.current_debt - COALESCE(cb.correct_debt, 0)) > 0.01  -- Tolerancia de 1 centavo
ORDER BY ABS(c.current_debt - COALESCE(cb.correct_debt, 0)) DESC;

-- PASO 3: Corregir balances desincronizados
-- ADVERTENCIA: Ejecutar solo después de revisar la query anterior

-- Descomentar para ejecutar corrección:
/*
UPDATE clients c
SET current_debt = COALESCE(cb.correct_debt, 0)
FROM correct_balances cb
WHERE c.id = cb.client_id
  AND ABS(c.current_debt - cb.correct_debt) > 0.01;
*/

-- PASO 4: Verificar que no haya clientes sin ledger entries pero con deuda
SELECT
  c.id,
  c.legal_name,
  c.current_debt
FROM clients c
LEFT JOIN correct_balances cb ON c.id = cb.client_id
WHERE cb.client_id IS NULL
  AND c.current_debt != 0;

-- =====================================================
-- ANÁLISIS ADICIONAL: Detectar facturas emitidas sin ledger entry
-- =====================================================

SELECT
  si.id AS invoice_id,
  si.numero,
  si.client_id,
  c.legal_name,
  si.total,
  si.estado,
  si.fecha_emision
FROM sales_invoices si
JOIN clients c ON c.id = si.client_id
WHERE si.estado IN ('EMITIDA', 'PARCIALMENTE_COBRADA', 'COBRADA')
  AND NOT EXISTS (
    SELECT 1
    FROM client_ledger_entries cle
    WHERE cle.reference_type = 'SALES_INVOICE'
      AND cle.reference_id = si.id
      AND cle.tipo = 'FACTURA'
  )
ORDER BY si.fecha_emision DESC
LIMIT 50;

-- =====================================================
-- CORRECCIÓN: Crear ledger entries faltantes
-- =====================================================

-- Descomentar para ejecutar:
/*
INSERT INTO client_ledger_entries (
  client_id,
  fecha,
  tipo,
  debe,
  haber,
  comprobante,
  descripcion,
  reference_type,
  reference_id,
  company_id,
  created_by
)
SELECT
  si.client_id,
  si.fecha_emision,
  'FACTURA',
  si.total,
  0,
  si.numero,
  'Factura ' || si.numero || ' (Recuperada por reconciliación)',
  'SALES_INVOICE',
  si.id,
  si.company_id,
  si.created_by
FROM sales_invoices si
WHERE si.estado IN ('EMITIDA', 'PARCIALMENTE_COBRADA', 'COBRADA')
  AND NOT EXISTS (
    SELECT 1
    FROM client_ledger_entries cle
    WHERE cle.reference_type = 'SALES_INVOICE'
      AND cle.reference_id = si.id
      AND cle.tipo = 'FACTURA'
  );
*/

-- =====================================================
-- REPORTE FINAL: Estado de sincronización
-- =====================================================

SELECT
  COUNT(DISTINCT c.id) AS total_clients,
  COUNT(DISTINCT CASE WHEN ABS(c.current_debt - COALESCE(cb.correct_debt, 0)) > 0.01 THEN c.id END) AS desynchronized_clients,
  SUM(CASE WHEN ABS(c.current_debt - COALESCE(cb.correct_debt, 0)) > 0.01 THEN ABS(c.current_debt - COALESCE(cb.correct_debt, 0)) ELSE 0 END) AS total_difference
FROM clients c
LEFT JOIN correct_balances cb ON c.id = cb.client_id;
