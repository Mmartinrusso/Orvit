-- ════════════════════════════════════════════════════════════════════════════
-- PERFORMANCE OPTIMIZATION INDEXES
-- ════════════════════════════════════════════════════════════════════════════

-- Sales module indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_company_fecha
  ON sales(company_id, fecha DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_company_estado
  ON sales(company_id, estado);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_items_product
  ON sale_items(product_id);

-- Products indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_company_code
  ON products(company_id, code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_company_active
  ON products(company_id, is_active) WHERE is_active = true;

-- Invoices indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_company_estado
  ON sale_invoices(company_id, estado);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_company_fecha
  ON sale_invoices(company_id, fecha DESC);

-- Deliveries indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_company_estado
  ON sale_deliveries(company_id, estado);

-- Chatbot indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_company_last_message
  ON chat_sessions(company_id, last_message_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_created
  ON chat_messages(session_id, created_at DESC);

-- Analyze tables
ANALYZE sales;
ANALYZE products;
ANALYZE sale_invoices;
ANALYZE chat_sessions;
