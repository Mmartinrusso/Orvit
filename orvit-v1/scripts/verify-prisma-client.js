const { PrismaClient } = require('@prisma/client');

async function verifyPrismaClient() {
  const prisma = new PrismaClient();
  
  try {
    // Intentar acceder al modelo Role y ver si tiene sectorId
    const roleFields = Object.keys(prisma.role.fields || {});
    console.log('🔍 Campos disponibles en Role:', roleFields);
    
    if (roleFields.includes('sectorId')) {
      console.log('✅ El cliente de Prisma tiene el campo sectorId');
    } else {
      console.log('❌ El cliente de Prisma NO tiene el campo sectorId');
      console.log('⚠️ Necesitas ejecutar: npx prisma generate');
    }
    
    // Intentar hacer una consulta simple para verificar
    const testRole = await prisma.role.findFirst({
      select: {
        id: true,
        name: true,
        sectorId: true
      }
    });
    
    console.log('✅ Cliente de Prisma funciona correctamente');
    console.log('Rol de prueba:', testRole);
    
  } catch (error) {
    if (error.message.includes('Unknown argument') || error.message.includes('sectorId')) {
      console.log('❌ El cliente de Prisma NO reconoce sectorId');
      console.log('⚠️ Necesitas ejecutar: npx prisma generate');
      console.log('Error:', error.message);
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

verifyPrismaClient();

