-- Migración: Agregar tabla voice_purchase_logs para pedidos de compra por voz
-- Ejecutar manualmente: psql -d neondb -f manual_voice_purchase_log.sql

-- Crear tabla voice_purchase_logs
CREATE TABLE IF NOT EXISTS "voice_purchase_logs" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "discordUserId" VARCHAR(50) NOT NULL,
    "discordMessageId" VARCHAR(50) NOT NULL UNIQUE,
    "discordAttachmentId" VARCHAR(50) NOT NULL,
    "discordChannelId" VARCHAR(50),
    "audioUrl" TEXT,
    "audioHash" VARCHAR(64),
    "transcript" TEXT,
    "extractedData" JSONB,
    "confidence" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "purchaseRequestId" INTEGER UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    -- Foreign Keys
    CONSTRAINT "voice_purchase_logs_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "voice_purchase_logs_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT,
    CONSTRAINT "voice_purchase_logs_purchaseRequestId_fkey"
        FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS "voice_purchase_logs_discordMessageId_idx" ON "voice_purchase_logs"("discordMessageId");
CREATE INDEX IF NOT EXISTS "voice_purchase_logs_status_idx" ON "voice_purchase_logs"("status");
CREATE INDEX IF NOT EXISTS "voice_purchase_logs_companyId_idx" ON "voice_purchase_logs"("companyId");
CREATE INDEX IF NOT EXISTS "voice_purchase_logs_userId_idx" ON "voice_purchase_logs"("userId");

-- Comentarios
COMMENT ON TABLE "voice_purchase_logs" IS 'Logs de pedidos de compra creados desde audio de Discord';
COMMENT ON COLUMN "voice_purchase_logs"."discordMessageId" IS 'ID único del mensaje de Discord (para idempotencia)';
COMMENT ON COLUMN "voice_purchase_logs"."status" IS 'PENDING, PROCESSING, COMPLETED, FAILED';
COMMENT ON COLUMN "voice_purchase_logs"."confidence" IS 'Nivel de confianza de la extracción (0-100)';
