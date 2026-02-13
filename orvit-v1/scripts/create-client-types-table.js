const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Creando tabla ClientType...');

    // Crear tabla ClientType
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ClientType" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "companyId" INTEGER NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ClientType_pkey" PRIMARY KEY ("id")
      );
    `;
    console.log('✅ Tabla ClientType creada');

    // Crear índices
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ClientType_companyId_idx" ON "ClientType"("companyId");
    `;
    console.log('✅ Índices de ClientType creados');

    // Crear constraint único
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "ClientType_companyId_name_key" 
      ON "ClientType"("companyId", "name");
    `;
    console.log('✅ Constraint único creado');

    // Agregar foreign key si no existe
    const fkExists = await prisma.$queryRaw`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'ClientType_companyId_fkey'
    `;

    if (!fkExists || fkExists.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE "ClientType" 
        ADD CONSTRAINT "ClientType_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
      `;
      console.log('✅ Foreign key ClientType -> Company agregada');
    } else {
      console.log('⚠️  Foreign key ya existe');
    }

    console.log('✅ Tabla ClientType creada correctamente');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

