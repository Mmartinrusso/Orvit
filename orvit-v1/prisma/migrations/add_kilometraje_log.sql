-- ============================================
-- Tabla de historial de kilometraje
-- ============================================

-- Crear enum para tipo de registro
DO $$ BEGIN
  CREATE TYPE "KilometrajeLogTipo" AS ENUM ('MANUAL', 'MANTENIMIENTO', 'COMBUSTIBLE', 'VIAJE', 'INSPECCION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Crear tabla KilometrajeLog
CREATE TABLE IF NOT EXISTS "KilometrajeLog" (
  id SERIAL PRIMARY KEY,
  "unidadMovilId" INTEGER NOT NULL REFERENCES "UnidadMovil"(id) ON DELETE CASCADE,
  kilometraje INTEGER NOT NULL,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  tipo "KilometrajeLogTipo" DEFAULT 'MANUAL',
  "registradoPorId" INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
  notas TEXT,
  "companyId" INTEGER NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS "KilometrajeLog_unidadMovilId_fecha_idx"
  ON "KilometrajeLog"("unidadMovilId", fecha DESC);

CREATE INDEX IF NOT EXISTS "KilometrajeLog_companyId_fecha_idx"
  ON "KilometrajeLog"("companyId", fecha DESC);

-- Comentarios
COMMENT ON TABLE "KilometrajeLog" IS 'Historial de lecturas de odómetro para unidades móviles';
COMMENT ON COLUMN "KilometrajeLog".tipo IS 'MANUAL=Actualización manual, MANTENIMIENTO=Durante mantenimiento, COMBUSTIBLE=Al cargar, VIAJE=Inicio/fin viaje, INSPECCION=Inspección periódica';
