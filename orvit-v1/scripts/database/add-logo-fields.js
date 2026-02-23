const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addLogoFields() {
  try {
    console.log('🔄 Agregando campos logoDark y logoLight a la tabla Company...');
    
    await prisma.$executeRaw`
      ALTER TABLE "Company" 
      ADD COLUMN IF NOT EXISTS "logoDark" TEXT,
      ADD COLUMN IF NOT EXISTS "logoLight" TEXT;
    `;
    
    console.log('✅ Campos agregados exitosamente');
  } catch (error) {
    console.error('❌ Error agregando campos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addLogoFields();

