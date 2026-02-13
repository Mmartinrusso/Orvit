const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Actualizando campos de la tabla Client...');

    // Eliminar campos bancarios
    const fieldsToRemove = ['bank', 'cbu', 'aliasCbu', 'accountNumber'];
    
    for (const field of fieldsToRemove) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Client" 
          DROP COLUMN IF EXISTS "${field}";
        `);
        console.log(`✅ Campo ${field} eliminado`);
      } catch (error) {
        if (error.message.includes('does not exist') || error.message.includes('column')) {
          console.log(`⚠️  Campo ${field} no existe, omitiendo...`);
        } else {
          console.error(`❌ Error eliminando ${field}:`, error.message);
        }
      }
    }

    // Agregar campo de mercadería pendiente
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Client" 
        ADD COLUMN IF NOT EXISTS "merchandisePendingDays" INTEGER;
      `);
      console.log('✅ Campo merchandisePendingDays agregado');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️  Campo merchandisePendingDays ya existe, omitiendo...');
      } else {
        throw error;
      }
    }

    console.log('✅ Actualización completada');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

