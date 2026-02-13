-- ════════════════════════════════════════════════════════════════════════════
-- CHATBOT TABLES
-- ════════════════════════════════════════════════════════════════════════════

-- Chat Sessions (chat conversations)
CREATE TABLE IF NOT EXISTS "chat_sessions" (
  "id" VARCHAR(255) PRIMARY KEY,
  "company_id" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "user_id" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
  "client_id" INTEGER REFERENCES "Client"("id") ON DELETE SET NULL,
  "language" VARCHAR(10) DEFAULT 'es',
  "created_at" TIMESTAMP DEFAULT NOW(),
  "last_message_at" TIMESTAMP DEFAULT NOW(),
  "metadata" JSONB DEFAULT '{}'::jsonb
);

-- Chat Messages (individual messages in conversations)
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" SERIAL PRIMARY KEY,
  "session_id" VARCHAR(255) NOT NULL REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
  "role" VARCHAR(20) NOT NULL CHECK ("role" IN ('user', 'assistant', 'system')),
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "metadata" JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_company" ON "chat_sessions"("company_id");
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_user" ON "chat_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_client" ON "chat_sessions"("client_id");
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_last_message" ON "chat_sessions"("last_message_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_chat_messages_session" ON "chat_messages"("session_id");
CREATE INDEX IF NOT EXISTS "idx_chat_messages_created" ON "chat_messages"("created_at" DESC);

-- Comments
COMMENT ON TABLE "chat_sessions" IS 'AI Chatbot conversation sessions';
COMMENT ON TABLE "chat_messages" IS 'Individual messages within chatbot conversations';
