const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Agregando campos a Truck y Load...');

    // Agregar campo isOwn a Truck
    await prisma.$executeRaw`
      ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "isOwn" BOOLEAN DEFAULT true;
    `;
    console.log('✅ Campo isOwn agregado a Truck');

    // Agregar campos a Load
    await prisma.$executeRaw`
      ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "deliveryClient" TEXT;
    `;
    console.log('✅ Campo deliveryClient agregado a Load');

    await prisma.$executeRaw`
      ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT;
    `;
    console.log('✅ Campo deliveryAddress agregado a Load');

    await prisma.$executeRaw`
      ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "isCorralon" BOOLEAN DEFAULT false;
    `;
    console.log('✅ Campo isCorralon agregado a Load');

    console.log('✅ Todos los campos agregados correctamente');
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

