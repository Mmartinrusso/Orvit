const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Agregando columna images a la tabla products...');
    
    // Agregar columna images si no existe
    await prisma.$executeRaw`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS images JSONB
    `;
    console.log('✅ Columna images agregada a products');
    
    console.log('✅ Columna agregada exitosamente');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

