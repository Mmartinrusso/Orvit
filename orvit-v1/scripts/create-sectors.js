const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createSectors() {
  try {
    console.log('🔍 Verificando sectores existentes...');
    
    // Obtener la empresa
    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No hay empresas en la base de datos');
      return;
    }
    
    console.log('🏢 Empresa encontrada:', company.name);
    
    // Verificar sectores existentes
    const existingSectors = await prisma.sector.findMany({
      where: { companyId: company.id }
    });
    
    console.log(`📋 Sectores existentes: ${existingSectors.length}`);
    existingSectors.forEach(sector => {
      console.log(`- ${sector.name} (ID: ${sector.id})`);
    });
    
    if (existingSectors.length === 0) {
      console.log('\n📝 Creando sectores de prueba...');
      
      const sectors = [
        { name: 'Producción', description: 'Sector de producción' },
        { name: 'Mantenimiento', description: 'Sector de mantenimiento' },
        { name: 'Calidad', description: 'Sector de control de calidad' },
        { name: 'Logística', description: 'Sector de logística' },
        { name: 'Administración', description: 'Sector administrativo' }
      ];
      
      for (const sectorData of sectors) {
        const sector = await prisma.sector.create({
          data: {
            name: sectorData.name,
            description: sectorData.description,
            companyId: company.id
          }
        });
        console.log(`✅ Sector creado: ${sector.name} (ID: ${sector.id})`);
      }
      
      console.log('\n🎉 Sectores creados exitosamente');
    } else {
      console.log('\n✅ Ya existen sectores en la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error creando sectores:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSectors()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  }); 