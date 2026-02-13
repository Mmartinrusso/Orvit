-- Migration: Crear tablas TransportCompany y BusinessSector + actualizar Client
-- Date: 2026-01-13

-- 1. Crear tabla TransportCompany
CREATE TABLE IF NOT EXISTS "TransportCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportCompany_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TransportCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. Crear tabla BusinessSector
CREATE TABLE IF NOT EXISTS "BusinessSector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessSector_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusinessSector_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Índices únicos (nombre único por empresa)
CREATE UNIQUE INDEX IF NOT EXISTS "TransportCompany_companyId_name_key" ON "TransportCompany"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessSector_companyId_name_key" ON "BusinessSector"("companyId", "name");

-- 4. Índices de búsqueda
CREATE INDEX IF NOT EXISTS "TransportCompany_companyId_idx" ON "TransportCompany"("companyId");
CREATE INDEX IF NOT EXISTS "BusinessSector_companyId_idx" ON "BusinessSector"("companyId");

-- 5. Renombrar columnas existentes en Client (si existen como String)
-- Primero verificamos si existen las columnas antiguas y las renombramos
DO $$
BEGIN
    -- Renombrar transportCompany a transportCompany_legacy si existe
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'Client' AND column_name = 'transportCompany') THEN
        ALTER TABLE "Client" RENAME COLUMN "transportCompany" TO "transportCompany_legacy";
    END IF;

    -- Renombrar businessSector a businessSector_legacy si existe
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'Client' AND column_name = 'businessSector') THEN
        ALTER TABLE "Client" RENAME COLUMN "businessSector" TO "businessSector_legacy";
    END IF;
END $$;

-- 6. Agregar nuevas columnas FK a Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "transportCompanyId" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "businessSectorId" TEXT;

-- 7. Agregar Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'Client_transportCompanyId_fkey') THEN
        ALTER TABLE "Client" ADD CONSTRAINT "Client_transportCompanyId_fkey"
            FOREIGN KEY ("transportCompanyId") REFERENCES "TransportCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'Client_businessSectorId_fkey') THEN
        ALTER TABLE "Client" ADD CONSTRAINT "Client_businessSectorId_fkey"
            FOREIGN KEY ("businessSectorId") REFERENCES "BusinessSector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 8. Índices para las nuevas FK
CREATE INDEX IF NOT EXISTS "Client_transportCompanyId_idx" ON "Client"("transportCompanyId");
CREATE INDEX IF NOT EXISTS "Client_businessSectorId_idx" ON "Client"("businessSectorId");

-- 9. Eliminar índice viejo de businessSector si existe
DROP INDEX IF EXISTS "Client_businessSector_idx";
