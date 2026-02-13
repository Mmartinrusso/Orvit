-- Crear enum TruckType si no existe
DO $$ BEGIN
    CREATE TYPE "TruckType" AS ENUM ('SEMI', 'EQUIPO', 'ACOPLADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Crear tabla Truck
CREATE TABLE IF NOT EXISTS "Truck" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TruckType" NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "maxWeight" DOUBLE PRECISION,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- Crear tabla Load
CREATE TABLE IF NOT EXISTS "Load" (
    "id" SERIAL NOT NULL,
    "truckId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Load_pkey" PRIMARY KEY ("id")
);

-- Crear tabla LoadItem
CREATE TABLE IF NOT EXISTS "LoadItem" (
    "id" SERIAL NOT NULL,
    "loadId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "length" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "position" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadItem_pkey" PRIMARY KEY ("id")
);

-- Crear índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS "Truck_companyId_name_key" ON "Truck"("companyId", "name");

-- Crear índices
CREATE INDEX IF NOT EXISTS "Truck_companyId_idx" ON "Truck"("companyId");
CREATE INDEX IF NOT EXISTS "Truck_type_idx" ON "Truck"("type");
CREATE INDEX IF NOT EXISTS "Load_companyId_idx" ON "Load"("companyId");
CREATE INDEX IF NOT EXISTS "Load_truckId_idx" ON "Load"("truckId");
CREATE INDEX IF NOT EXISTS "Load_date_idx" ON "Load"("date");
CREATE INDEX IF NOT EXISTS "LoadItem_loadId_idx" ON "LoadItem"("loadId");
CREATE INDEX IF NOT EXISTS "LoadItem_productId_idx" ON "LoadItem"("productId");

-- Agregar foreign keys
DO $$ BEGIN
    ALTER TABLE "Truck" ADD CONSTRAINT "Truck_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Load" ADD CONSTRAINT "Load_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Load" ADD CONSTRAINT "Load_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "LoadItem" ADD CONSTRAINT "LoadItem_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

