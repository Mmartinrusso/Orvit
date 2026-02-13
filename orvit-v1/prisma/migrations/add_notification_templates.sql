-- Add notification templates for all document types
-- These allow companies to customize their WhatsApp/Email messages

-- Quote notification templates
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS quote_notification_templates JSON DEFAULT '{
  "sent": "Hola {clientName}!\n\nLe enviamos la cotización *{quoteNumber}* de *{companyName}*.\n\nTotal: {total}\nVálida hasta: {validUntil}\n\nQuedamos a disposición.\nSaludos,\n{sellerName}",
  "followup_3days": "Hola {clientName}!\n\nQueríamos saber si pudo revisar la cotización *{quoteNumber}*.\n\nQuedamos atentos a sus consultas.\n\n{companyName}",
  "followup_7days": "Hola {clientName}!\n\n¿Tiene alguna duda sobre la cotización *{quoteNumber}*?\n\nEstamos para ayudarlo.\n\n{companyName}",
  "approved": "Hola {clientName}!\n\nLa cotización *{quoteNumber}* ha sido aprobada.\n\nProcederemos con la orden de venta.\n\n{companyName}",
  "rejected": "Hola {clientName}!\n\nGracias por considerar nuestra cotización *{quoteNumber}*.\n\nSi en el futuro podemos ayudarlo, estamos a disposición.\n\n{companyName}"
}'::json;

-- Order notification templates
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS order_notification_templates JSON DEFAULT '{
  "confirmed": "Hola {clientName}!\n\nConfirmamos su pedido *{orderNumber}* de *{companyName}*.\n\nTotal: {total}\nEntrega estimada: {deliveryDate}\n\nGracias por su compra!",
  "processing": "Hola {clientName}!\n\nSu pedido *{orderNumber}* está siendo preparado.\n\nLe avisaremos cuando esté listo.\n\n{companyName}",
  "ready": "Hola {clientName}!\n\nSu pedido *{orderNumber}* está listo para entrega/retiro.\n\n{companyName}",
  "cancelled": "Hola {clientName}!\n\nSu pedido *{orderNumber}* ha sido cancelado.\n\nMotivo: {reason}\n\nDisculpe las molestias.\n{companyName}"
}'::json;

-- Invoice notification templates
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS invoice_notification_templates JSON DEFAULT '{
  "issued": "Hola {clientName}!\n\nLe enviamos la factura *{invoiceNumber}* de *{companyName}*.\n\nTotal: {total}\nVencimiento: {dueDate}\n\nGracias por su confianza!",
  "reminder_before": "Hola {clientName}!\n\nLe recordamos que la factura *{invoiceNumber}* vence el {dueDate}.\n\nMonto: {total}\n\n{companyName}",
  "reminder_overdue": "Hola {clientName}!\n\nLa factura *{invoiceNumber}* venció hace {daysOverdue} días.\n\nMonto pendiente: {amount}\n\nPor favor regularice su situación.\n\n{companyName}",
  "paid": "Hola {clientName}!\n\nConfirmamos el pago de la factura *{invoiceNumber}*.\n\nGracias!\n{companyName}"
}'::json;

-- Payment notification templates
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS payment_notification_templates JSON DEFAULT '{
  "received": "Hola {clientName}!\n\nConfirmamos la recepción de su pago *{paymentNumber}*.\n\nMonto: {amount}\n\nMuchas gracias!\n{companyName}",
  "applied": "Hola {clientName}!\n\nSu pago *{paymentNumber}* fue aplicado a las facturas correspondientes.\n\nSaldo actual: {currentBalance}\n\n{companyName}",
  "rejected": "Hola {clientName}!\n\nEl pago *{paymentNumber}* fue rechazado.\n\nMotivo: {reason}\n\nPor favor contáctenos.\n{companyName}"
}'::json;

-- Collection reminder templates
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS collection_notification_templates JSON DEFAULT '{
  "scheduled_visit": "Hola {clientName}!\n\nLe informamos que mañana pasaremos a cobrar.\n\nFacturas pendientes: {pendingInvoices}\nMonto total: {totalAmount}\n\n{companyName}",
  "thank_you": "Hola {clientName}!\n\nGracias por su pago de hoy.\n\nRecibo: {receiptNumber}\nMonto: {amount}\n\n{companyName}"
}'::json;

-- Discount tier configuration (for volume discounts)
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS discount_tiers JSON DEFAULT '[]'::json;
-- Format: [{"minAmount": 10000, "discountPercent": 5}, {"minAmount": 50000, "discountPercent": 8}]

-- Commission configuration (for advanced commissions)
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS commission_config JSON DEFAULT '{
  "type": "FLAT",
  "defaultRate": 0,
  "tiers": [],
  "byCategory": {},
  "byProduct": {}
}'::json;
-- Types: FLAT, TIERED, BY_CATEGORY, BY_PRODUCT, MIXED
-- tiers: [{"minAmount": 0, "rate": 3}, {"minAmount": 100000, "rate": 5}]
-- byCategory: {"category_id": 4.5}
-- byProduct: {"product_id": 6.0}

-- Document number format configuration
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS number_format_config JSON DEFAULT '{
  "quote": "{prefix}-{number}",
  "order": "{prefix}-{number}",
  "delivery": "{prefix}-{number}",
  "invoice": "{prefix}-{pv}-{number}",
  "payment": "{prefix}-{number}",
  "padLength": 6,
  "includeYear": false,
  "includeMonth": false
}'::json;
-- Formats:
-- Simple: {prefix}-{number} -> COT-000001
-- With year: {prefix}-{year}-{number} -> COT-2025-000001
-- With month: {prefix}-{year}{month}-{number} -> COT-202501-000001
-- Invoice with PV: {prefix}-{pv}-{number} -> FA-0001-00000001

-- Quote follow-up automation
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS quote_followup_config JSON DEFAULT '{
  "enabled": false,
  "firstReminderDays": 3,
  "secondReminderDays": 7,
  "autoCloseAfterDays": 30,
  "notifySellerOnNoResponse": true,
  "escalateToManagerAfterDays": 14
}'::json;

-- Customer segment pricing rules
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS segment_pricing_config JSON DEFAULT '{
  "enabled": false,
  "segments": []
}'::json;
-- Format: {
--   "segments": [
--     {"id": "mayorista", "name": "Mayorista", "priceListId": "...", "discountPercent": 10},
--     {"id": "minorista", "name": "Minorista", "priceListId": "...", "discountPercent": 0}
--   ]
-- }

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_config_company ON sales_config(company_id);

COMMENT ON COLUMN sales_config.quote_notification_templates IS 'Plantillas de WhatsApp/Email para cotizaciones';
COMMENT ON COLUMN sales_config.order_notification_templates IS 'Plantillas de WhatsApp/Email para órdenes';
COMMENT ON COLUMN sales_config.invoice_notification_templates IS 'Plantillas de WhatsApp/Email para facturas';
COMMENT ON COLUMN sales_config.payment_notification_templates IS 'Plantillas de WhatsApp/Email para pagos';
COMMENT ON COLUMN sales_config.discount_tiers IS 'Configuración de descuentos escalonados por volumen';
COMMENT ON COLUMN sales_config.commission_config IS 'Configuración de comisiones avanzadas';
COMMENT ON COLUMN sales_config.number_format_config IS 'Formato de numeración de documentos';
COMMENT ON COLUMN sales_config.quote_followup_config IS 'Configuración de seguimiento automático de cotizaciones';
COMMENT ON COLUMN sales_config.segment_pricing_config IS 'Configuración de precios por segmento de cliente';
