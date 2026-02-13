-- Índice único parcial para garantizar solo 1 cotización SELECCIONADA por pedido
-- Este índice previene race conditions: si dos requests intentan seleccionar
-- diferentes cotizaciones del mismo pedido al mismo tiempo, una fallará
CREATE UNIQUE INDEX IF NOT EXISTS "idx_quotation_selected_per_request"
ON "purchase_quotations" ("requestId")
WHERE "estado" = 'SELECCIONADA';
