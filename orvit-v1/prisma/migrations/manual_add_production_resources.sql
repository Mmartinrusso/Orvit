-- Migración manual: Agregar sistema de recursos de producción

-- 1. Crear tabla de tipos de recursos
CREATE TABLE IF NOT EXISTS "production_resource_types" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "config" JSONB,
    "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_resource_types_companyId_code_key" UNIQUE ("companyId", "code")
);

CREATE INDEX IF NOT EXISTS "production_resource_types_companyId_idx" ON "production_resource_types"("companyId");

-- 2. Crear tabla de recursos
CREATE TABLE IF NOT EXISTS "production_resources" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "resourceTypeId" INTEGER NOT NULL REFERENCES "production_resource_types"("id"),
    "workCenterId" INTEGER REFERENCES "work_centers"("id"),
    "metadata" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "order" INTEGER NOT NULL DEFAULT 0,
    "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_resources_companyId_code_key" UNIQUE ("companyId", "code")
);

CREATE INDEX IF NOT EXISTS "production_resources_companyId_resourceTypeId_idx" ON "production_resources"("companyId", "resourceTypeId");
CREATE INDEX IF NOT EXISTS "production_resources_companyId_status_idx" ON "production_resources"("companyId", "status");

-- 3. Agregar nuevas columnas a production_routines
ALTER TABLE "production_routines"
    ADD COLUMN IF NOT EXISTS "preExecutionResponses" JSONB,
    ADD COLUMN IF NOT EXISTS "counters" JSONB,
    ADD COLUMN IF NOT EXISTS "generatedIncidents" INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "generatedWorkOrders" INTEGER[] DEFAULT '{}';
