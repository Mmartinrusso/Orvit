const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🚀 Agregando campo client a tabla Truck...\n');

    await prisma.$executeRaw`ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "client" TEXT`;
    console.log('✅ Campo client agregado exitosamente\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

