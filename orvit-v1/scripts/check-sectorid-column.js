const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSectorIdColumn() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Role' AND column_name = 'sectorId'
    `;
    
    console.log('🔍 Verificando columna sectorId en tabla Role...');
    console.log('Resultado:', result);
    
    if (Array.isArray(result) && result.length > 0) {
      console.log('✅ La columna sectorId EXISTE en la base de datos');
    } else {
      console.log('❌ La columna sectorId NO EXISTE en la base de datos');
      console.log('⚠️ Necesitas ejecutar la migración SQL manualmente');
    }
  } catch (error) {
    console.error('❌ Error verificando columna:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSectorIdColumn();

