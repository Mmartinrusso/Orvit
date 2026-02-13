const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🚀 Creando tablas de camiones y cargas...\n');

    // Crear enum TruckType
    console.log('1️⃣ Creando enum TruckType...');
    await prisma.$executeRaw`
      DO $$ BEGIN
          CREATE TYPE "TruckType" AS ENUM ('SEMI', 'EQUIPO', 'ACOPLADO');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('✅ Enum TruckType creado\n');

    // Crear tabla Truck
    console.log('2️⃣ Creando tabla Truck...');
    await prisma.$executeRaw`
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
    `;
    console.log('✅ Tabla Truck creada\n');

    // Crear tabla Load
    console.log('3️⃣ Creando tabla Load...');
    await prisma.$executeRaw`
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
    `;
    console.log('✅ Tabla Load creada\n');

    // Crear tabla LoadItem
    console.log('4️⃣ Creando tabla LoadItem...');
    await prisma.$executeRaw`
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
    `;
    console.log('✅ Tabla LoadItem creada\n');

    // Crear índices únicos
    console.log('5️⃣ Creando índices únicos...');
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "Truck_companyId_name_key" ON "Truck"("companyId", "name");
    `;
    console.log('✅ Índices únicos creados\n');

    // Crear índices
    console.log('6️⃣ Creando índices...');
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Truck_companyId_idx" ON "Truck"("companyId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Truck_type_idx" ON "Truck"("type")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Load_companyId_idx" ON "Load"("companyId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Load_truckId_idx" ON "Load"("truckId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Load_date_idx" ON "Load"("date")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "LoadItem_loadId_idx" ON "LoadItem"("loadId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "LoadItem_productId_idx" ON "LoadItem"("productId")`;
    console.log('✅ Índices creados\n');

    // Agregar foreign keys
    console.log('7️⃣ Agregando foreign keys...');
    await prisma.$executeRaw`
      DO $$ BEGIN
          ALTER TABLE "Truck" ADD CONSTRAINT "Truck_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `;
    await prisma.$executeRaw`
      DO $$ BEGIN
          ALTER TABLE "Load" ADD CONSTRAINT "Load_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `;
    await prisma.$executeRaw`
      DO $$ BEGIN
          ALTER TABLE "Load" ADD CONSTRAINT "Load_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `;
    await prisma.$executeRaw`
      DO $$ BEGIN
          ALTER TABLE "LoadItem" ADD CONSTRAINT "LoadItem_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('✅ Foreign keys agregadas\n');

    console.log('✅ ¡Todas las tablas creadas exitosamente!');
    console.log('🎯 Las APIs de camiones y cargas deberían funcionar ahora.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

