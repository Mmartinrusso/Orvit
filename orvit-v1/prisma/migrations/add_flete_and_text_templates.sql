-- ============================================================
-- Agregar incluyeFlete a quotes + tabla quote_text_templates
-- ============================================================

-- 1. Campo "Nosotros hacemos el flete" en cotizaciones
ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "incluyeFlete" BOOLEAN NOT NULL DEFAULT false;

-- 2. Tabla de plantillas de texto por empresa (para notas, condiciones de pago y entrega)
CREATE TABLE IF NOT EXISTS "quote_text_templates" (
  "id"        SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "tipo"      VARCHAR(20) NOT NULL, -- NOTA | PAGO | ENTREGA
  "nombre"    VARCHAR(100) NOT NULL,
  "contenido" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "orden"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quote_text_templates_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "quote_text_templates_companyId_idx"
  ON "quote_text_templates"("companyId");

CREATE INDEX IF NOT EXISTS "quote_text_templates_companyId_tipo_idx"
  ON "quote_text_templates"("companyId", "tipo");
