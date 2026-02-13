const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('📝 Creando tablas del sistema de impuestos...\n');
    
    // Crear enum TaxControlStatus si no existe
    console.log('0️⃣ Creando enum TaxControlStatus...');
    await prisma.$executeRaw`
      DO $$ BEGIN
        CREATE TYPE "TaxControlStatus" AS ENUM ('RECIBIDO', 'PAGADO', 'PENDIENTE', 'VENCIDO');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('✅ Enum TaxControlStatus listo\n');
    
    // Crear tabla TaxBase
    console.log('1️⃣ Creando tabla TaxBase...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "TaxBase" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "isRecurring" BOOLEAN NOT NULL DEFAULT true,
        "recurringDay" INTEGER NOT NULL,
        "companyId" INTEGER NOT NULL,
        "createdBy" INTEGER NOT NULL,
        "notes" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TaxBase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "TaxBase_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `;
    console.log('✅ TaxBase creada\n');

    // Crear tabla TaxRecord
    console.log('2️⃣ Creando tabla TaxRecord...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "TaxRecord" (
        "id" SERIAL PRIMARY KEY,
        "taxBaseId" INTEGER NOT NULL,
        "amount" DECIMAL(15,2) NOT NULL,
        "status" "TaxControlStatus" NOT NULL DEFAULT 'PENDIENTE',
        "receivedDate" TIMESTAMP(3),
        "paymentDate" TIMESTAMP(3),
        "alertDate" TIMESTAMP(3) NOT NULL,
        "month" VARCHAR(7) NOT NULL,
        "receivedBy" INTEGER,
        "paidBy" INTEGER,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TaxRecord_taxBaseId_fkey" FOREIGN KEY ("taxBaseId") REFERENCES "TaxBase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "TaxRecord_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "TaxRecord_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `;
    console.log('✅ TaxRecord creada\n');

    // Crear índices
    console.log('3️⃣ Creando índices...');
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "TaxBase_companyId_idx" ON "TaxBase"("companyId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "TaxBase_isActive_idx" ON "TaxBase"("isActive")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "TaxBase_recurring_idx" ON "TaxBase"("isRecurring", "recurringDay")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "TaxRecord_taxBaseId_idx" ON "TaxRecord"("taxBaseId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "TaxRecord_status_idx" ON "TaxRecord"("status")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "TaxRecord_alertDate_idx" ON "TaxRecord"("alertDate")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "TaxRecord_month_idx" ON "TaxRecord"("month")`;
    console.log('✅ Índices creados\n');

    // Crear constraint único (verificar primero si existe)
    console.log('4️⃣ Creando constraint único...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_taxBaseId_month_key" UNIQUE ("taxBaseId", "month")
      `;
      console.log('✅ Constraint único creado\n');
    } catch (error) {
      if (error.message && error.message.includes('ya existe')) {
        console.log('ℹ️  Constraint único ya existe\n');
      } else {
        throw error;
      }
    }

    console.log('✅ ¡Migración completada exitosamente!\n');
    console.log('📊 Tablas creadas:');
    console.log('  ✓ TaxBase (Bases de impuestos)');
    console.log('  ✓ TaxRecord (Registros mensuales)\n');
    console.log('🎯 Ya puedes crear bases de impuestos desde la interfaz!');

  } catch (error) {
    if (error.message && error.message.includes('ya existe')) {
      console.log('ℹ️  Las tablas ya existen en la base de datos');
    } else {
      console.error('❌ Error:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
