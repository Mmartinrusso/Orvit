const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyLogoFields() {
  try {
    console.log('🔍 Verificando campos logoDark y logoLight en la tabla Company...');
    
    // Verificar si los campos existen usando SQL directo
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Company'
      AND column_name IN ('logoDark', 'logoLight')
      ORDER BY column_name
    `;
    
    console.log('📋 Columnas encontradas:', columns);
    
    if (columns.length === 0) {
      console.log('❌ Los campos NO existen en la base de datos');
      console.log('⚠️ Necesitas ejecutar el script add-logo-fields.js');
    } else if (columns.length === 1) {
      console.log('⚠️ Solo existe uno de los campos');
      console.log('Columnas:', columns);
    } else {
      console.log('✅ Los campos SÍ existen en la base de datos');
      console.log('Columnas:', columns);
    }
    
    // Intentar hacer una consulta con Prisma para ver si los reconoce
    try {
      const testCompany = await prisma.company.findFirst({
        select: {
          id: true,
          name: true,
          logo: true,
          logoDark: true,
          logoLight: true
        }
      });
      console.log('✅ Prisma Client reconoce los campos');
      console.log('Empresa de prueba:', testCompany);
    } catch (error) {
      if (error.message?.includes('Unknown arg') || error.message?.includes('logoDark') || error.message?.includes('logoLight')) {
        console.log('❌ Prisma Client NO reconoce los campos');
        console.log('⚠️ Necesitas ejecutar: npx prisma generate');
        console.log('Error:', error.message);
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyLogoFields();

