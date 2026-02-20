-- Migración manual: Crear tabla business_metrics
-- Ejecutar con: psql o desde el panel de Supabase SQL Editor

CREATE TABLE IF NOT EXISTS "business_metrics" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" VARCHAR(30),
    "tags" JSONB,
    "company_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_metrics_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "business_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL
);

-- Índices compuestos para queries eficientes
CREATE INDEX IF NOT EXISTS "business_metrics_company_id_name_timestamp_idx" ON "business_metrics"("company_id", "name", "timestamp");
CREATE INDEX IF NOT EXISTS "business_metrics_company_id_timestamp_idx" ON "business_metrics"("company_id", "timestamp");
CREATE INDEX IF NOT EXISTS "business_metrics_user_id_timestamp_idx" ON "business_metrics"("user_id", "timestamp");
CREATE INDEX IF NOT EXISTS "business_metrics_timestamp_idx" ON "business_metrics"("timestamp");
