-- Agregar valor ENVIADA al enum SalesInvoiceStatus
-- Ejecutar una vez en la DB y luego revertir el comentario en lib/costs/integrations/sales.ts
ALTER TYPE "SalesInvoiceStatus" ADD VALUE IF NOT EXISTS 'ENVIADA' AFTER 'EMITIDA';
