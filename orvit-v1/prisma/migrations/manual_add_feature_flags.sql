-- Feature Flags: Sistema simple de feature toggles
-- Ejecutar manualmente después de agregar el modelo al schema.prisma

CREATE TABLE IF NOT EXISTS "feature_flags" (
  "id"         SERIAL       PRIMARY KEY,
  "name"       VARCHAR(100) NOT NULL,
  "enabled"    BOOLEAN      NOT NULL DEFAULT false,
  "company_id" INTEGER      REFERENCES "Company"("id") ON DELETE CASCADE,
  "user_id"    INTEGER      REFERENCES "User"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Constraint único compuesto: previene duplicados por scope
-- NULL se trata como valor distinto en PostgreSQL, así que usamos COALESCE
CREATE UNIQUE INDEX IF NOT EXISTS "feature_flags_name_company_user_key"
  ON "feature_flags" ("name", COALESCE("company_id", 0), COALESCE("user_id", 0));

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS "feature_flags_name_idx" ON "feature_flags" ("name");
CREATE INDEX IF NOT EXISTS "feature_flags_company_id_idx" ON "feature_flags" ("company_id");
CREATE INDEX IF NOT EXISTS "feature_flags_user_id_idx" ON "feature_flags" ("user_id");
