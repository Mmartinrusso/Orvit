-- Add AI configuration fields to SalesConfig
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS enable_collection_reminders BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS reminder_escalation_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS enable_smart_collections BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS enable_payment_anomaly_detect BOOLEAN DEFAULT FALSE;

-- Create indexes for collection_attempts if not exist
CREATE INDEX IF NOT EXISTS idx_collection_attempts_next_followup ON collection_attempts(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;
