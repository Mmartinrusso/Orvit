const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Actualizando paymentTerms para que sea nullable...');

    // Cambiar paymentTerms a nullable
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Client" 
      ALTER COLUMN "paymentTerms" DROP NOT NULL;
    `);
    console.log('✅ Campo paymentTerms ahora es nullable');

    console.log('✅ Actualización completada');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

