-- Add CollectionAttempt model for tracking collection efforts on overdue invoices
-- This supports the Smart Collections AI feature

CREATE TABLE IF NOT EXISTS collection_attempts (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES "User"(id),

  -- Attempt details
  attempt_type VARCHAR(50) NOT NULL, -- 'EMAIL', 'PHONE', 'VISIT', 'LETTER', 'WHATSAPP', 'SMS'
  result VARCHAR(50) NOT NULL, -- 'CONTACTADO', 'NO_RESPUESTA', 'COMPROMISO_PAGO', 'RECHAZADO', 'PAGO_PARCIAL', 'PAGO_TOTAL'
  contact_method VARCHAR(100),
  notes TEXT,

  -- Follow-up
  next_follow_up_date DATE,

  -- Timestamps
  attempt_date TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_collection_attempts_invoice ON collection_attempts(invoice_id);
CREATE INDEX idx_collection_attempts_company ON collection_attempts(company_id);
CREATE INDEX idx_collection_attempts_date ON collection_attempts(attempt_date);
CREATE INDEX idx_collection_attempts_result ON collection_attempts(result);
CREATE INDEX idx_collection_attempts_company_invoice ON collection_attempts(company_id, invoice_id);
