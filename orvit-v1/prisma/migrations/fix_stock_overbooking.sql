-- =====================================================
-- FIX CRITICAL BUG: Stock Overbooking
-- =====================================================
-- Agrega configuración para decrementar stock automáticamente
-- al confirmar órdenes de venta
-- =====================================================

-- Agregar campo para controlar decremento automático de stock
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS decrementar_stock_en_confirmacion BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN sales_config.decrementar_stock_en_confirmacion IS 'Si TRUE, al confirmar una orden de venta se decrementa automáticamente el stock físico del producto';

-- Agregar índices para optimizar consultas de stock
CREATE INDEX IF NOT EXISTS idx_products_current_stock ON products(current_stock) WHERE current_stock <= min_stock;
CREATE INDEX IF NOT EXISTS idx_product_stock_movements_product_date ON product_stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_stock_movements_source ON product_stock_movements(source_type, source_id);
