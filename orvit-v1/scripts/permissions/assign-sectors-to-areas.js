const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function assignSectorsToAreas() {
  try {
    console.log('🔍 Asignando sectores a áreas...');
    
    // Obtener la empresa
    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No hay empresas en la base de datos');
      return;
    }
    
    console.log('🏢 Empresa encontrada:', company.name);
    
    // Obtener áreas
    const areas = await prisma.area.findMany({
      where: { companyId: company.id }
    });
    
    console.log(`📋 Áreas encontradas: ${areas.length}`);
    areas.forEach(area => {
      console.log(`- ${area.name} (ID: ${area.id})`);
    });
    
    // Obtener sectores
    const sectors = await prisma.sector.findMany({
      where: { companyId: company.id }
    });
    
    console.log(`📋 Sectores encontrados: ${sectors.length}`);
    sectors.forEach(sector => {
      console.log(`- ${sector.name} (ID: ${sector.id})`);
    });
    
    // Mapeo de sectores a áreas
    const sectorAreaMapping = {
      'Producción': 'Producción',
      'Mantenimiento': 'Mantenimiento', 
      'Calidad': 'Producción',
      'Logística': 'Producción',
      'Administración': 'Administración'
    };
    
    console.log('\n📝 Asignando sectores a áreas...');
    
    for (const sector of sectors) {
      const areaName = sectorAreaMapping[sector.name];
      if (areaName) {
        const area = areas.find(a => a.name.toLowerCase().includes(areaName.toLowerCase()));
        if (area) {
          await prisma.sector.update({
            where: { id: sector.id },
            data: { areaId: area.id }
          });
          console.log(`✅ Sector "${sector.name}" asignado a área "${area.name}"`);
        } else {
          console.log(`⚠️  No se encontró área para sector "${sector.name}"`);
        }
      } else {
        console.log(`⚠️  No hay mapeo definido para sector "${sector.name}"`);
      }
    }
    
    console.log('\n🎉 Asignación completada');
    
  } catch (error) {
    console.error('❌ Error asignando sectores:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignSectorsToAreas()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  }); 