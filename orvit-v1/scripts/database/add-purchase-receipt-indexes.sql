-- Índices compuestos para optimizar queries de PurchaseReceipt
-- Ejecutar manualmente en la base de datos si es necesario

-- Índice para queries con companyId + estado + pagoUrgente (pagos urgentes)
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_urgent 
ON "PurchaseReceipt"(companyId, estado, pagoUrgente) 
WHERE pagoUrgente = true AND estado = 'pendiente';

-- Índice para queries con companyId + proveedorId + estado
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_provider_status 
ON "PurchaseReceipt"(companyId, proveedorId, estado);

