const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Creando tablas de clientes...');

    // Crear tabla Client
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Client" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "cuit" TEXT,
        "taxCondition" TEXT NOT NULL DEFAULT 'consumidor_final',
        "creditLimit" DOUBLE PRECISION,
        "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "paymentTerms" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "observations" TEXT,
        "companyId" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
      );
    `;
    console.log('✅ Tabla Client creada');

    // Crear índices para Client
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Client_companyId_idx" ON "Client"("companyId");
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Client_isActive_idx" ON "Client"("isActive");
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Client_name_idx" ON "Client"("name");
    `;
    console.log('✅ Índices de Client creados');

    // Crear tabla ClientDiscount
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ClientDiscount" (
        "id" TEXT NOT NULL,
        "clientId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "percentage" DOUBLE PRECISION,
        "amount" DOUBLE PRECISION,
        "categoryId" INTEGER,
        "productId" TEXT,
        "minQuantity" INTEGER,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "validFrom" TIMESTAMP(3),
        "validUntil" TIMESTAMP(3),
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ClientDiscount_pkey" PRIMARY KEY ("id")
      );
    `;
    console.log('✅ Tabla ClientDiscount creada');

    // Crear índices para ClientDiscount
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ClientDiscount_clientId_idx" ON "ClientDiscount"("clientId");
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ClientDiscount_isActive_idx" ON "ClientDiscount"("isActive");
    `;
    console.log('✅ Índices de ClientDiscount creados');

    // Crear tabla ClientPriceList
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ClientPriceList" (
        "id" TEXT NOT NULL,
        "clientId" TEXT NOT NULL,
        "priceListId" TEXT NOT NULL,
        "priceListName" TEXT NOT NULL,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ClientPriceList_pkey" PRIMARY KEY ("id")
      );
    `;
    console.log('✅ Tabla ClientPriceList creada');

    // Crear índices para ClientPriceList
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ClientPriceList_clientId_idx" ON "ClientPriceList"("clientId");
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ClientPriceList_isActive_idx" ON "ClientPriceList"("isActive");
    `;
    console.log('✅ Índices de ClientPriceList creados');

    // Agregar foreign keys (con manejo de errores si ya existen)
    try {
      await prisma.$executeRaw`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'Client_companyId_fkey'
          ) THEN
            ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" 
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `;
      console.log('✅ Foreign key Client -> Company agregada');
    } catch (error) {
      console.log('⚠️ Foreign key Client -> Company ya existe o error:', error.message);
    }

    try {
      await prisma.$executeRaw`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ClientDiscount_clientId_fkey'
          ) THEN
            ALTER TABLE "ClientDiscount" ADD CONSTRAINT "ClientDiscount_clientId_fkey" 
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `;
      console.log('✅ Foreign key ClientDiscount -> Client agregada');
    } catch (error) {
      console.log('⚠️ Foreign key ClientDiscount -> Client ya existe o error:', error.message);
    }

    try {
      await prisma.$executeRaw`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ClientPriceList_clientId_fkey'
          ) THEN
            ALTER TABLE "ClientPriceList" ADD CONSTRAINT "ClientPriceList_clientId_fkey" 
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `;
      console.log('✅ Foreign key ClientPriceList -> Client agregada');
    } catch (error) {
      console.log('⚠️ Foreign key ClientPriceList -> Client ya existe o error:', error.message);
    }

    console.log('✅ Todas las tablas de clientes creadas correctamente');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el script:', error);
    process.exit(1);
  });

