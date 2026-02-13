-- Migration: Add client blocking and delivery zones
-- Safe to run on existing data - only adds new columns/tables

-- 1. Crear tabla DeliveryZone (Zonas de Reparto)
CREATE TABLE IF NOT EXISTS "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- Índices para DeliveryZone
CREATE INDEX IF NOT EXISTS "DeliveryZone_companyId_idx" ON "DeliveryZone"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryZone_companyId_name_key" ON "DeliveryZone"("companyId", "name");

-- FK de DeliveryZone a Company
ALTER TABLE "DeliveryZone"
ADD CONSTRAINT "DeliveryZone_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Agregar campos a Client

-- Clasificación
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "clientTypeId" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deliveryZoneId" TEXT;

-- Sistema de Bloqueo
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "blockedReason" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "blockedByUserId" INTEGER;

-- 3. Índices para nuevos campos de Client
CREATE INDEX IF NOT EXISTS "Client_clientTypeId_idx" ON "Client"("clientTypeId");
CREATE INDEX IF NOT EXISTS "Client_deliveryZoneId_idx" ON "Client"("deliveryZoneId");
CREATE INDEX IF NOT EXISTS "Client_isBlocked_idx" ON "Client"("isBlocked");

-- 4. Foreign Keys para Client
ALTER TABLE "Client"
ADD CONSTRAINT "Client_clientTypeId_fkey"
FOREIGN KEY ("clientTypeId") REFERENCES "ClientType"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "Client"
ADD CONSTRAINT "Client_deliveryZoneId_fkey"
FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "Client"
ADD CONSTRAINT "Client_blockedByUserId_fkey"
FOREIGN KEY ("blockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- ==========================================
-- DATOS INICIALES (Seed)
-- ==========================================

-- Tipos de Cliente básicos (si no existen)
-- Nota: Reemplazar COMPANY_ID con el ID de tu empresa
/*
INSERT INTO "ClientType" ("id", "name", "description", "companyId", "isActive", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    name,
    description,
    COMPANY_ID,
    true,
    NOW(),
    NOW()
FROM (VALUES
    ('Mayorista', 'Compra en grandes volúmenes'),
    ('Minorista', 'Compra en pequeñas cantidades'),
    ('Distribuidor', 'Revende a otros comercios'),
    ('Consumidor Final', 'Cliente final')
) AS tipos(name, description)
WHERE NOT EXISTS (
    SELECT 1 FROM "ClientType" WHERE "companyId" = COMPANY_ID AND "name" = tipos.name
);
*/
