const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixSectorArea() {
  try {
    console.log('🔍 Arreglando sectores sin areaId...');
    
    // Obtener la empresa
    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No hay empresas en la base de datos');
      return;
    }
    
    console.log('🏢 Empresa encontrada:', company.name);
    
    // Obtener todas las áreas
    const areas = await prisma.area.findMany({
      where: { companyId: company.id }
    });
    
    console.log(`📋 Áreas encontradas: ${areas.length}`);
    areas.forEach(area => {
      console.log(`- ${area.name} (ID: ${area.id})`);
    });
    
    // Obtener sectores sin areaId
    const sectorsWithoutArea = await prisma.sector.findMany({
      where: { 
        companyId: company.id,
        areaId: null
      }
    });
    
    console.log(`📋 Sectores sin areaId: ${sectorsWithoutArea.length}`);
    sectorsWithoutArea.forEach(sector => {
      console.log(`- ${sector.name} (ID: ${sector.id})`);
    });
    
    if (sectorsWithoutArea.length === 0) {
      console.log('✅ Todos los sectores ya tienen areaId asignado');
      return;
    }
    
    // Asignar areaId a sectores
    for (const sector of sectorsWithoutArea) {
      let targetArea = null;
      
      // Buscar área por nombre del sector
      if (sector.name.toLowerCase().includes('mantenimiento')) {
        targetArea = areas.find(a => a.name.toLowerCase().includes('mantenimiento'));
      } else if (sector.name.toLowerCase().includes('producción') || sector.name.toLowerCase().includes('produccion')) {
        targetArea = areas.find(a => a.name.toLowerCase().includes('producción') || a.name.toLowerCase().includes('produccion'));
      } else if (sector.name.toLowerCase().includes('administración') || sector.name.toLowerCase().includes('administracion')) {
        targetArea = areas.find(a => a.name.toLowerCase().includes('administración') || a.name.toLowerCase().includes('administracion'));
      } else {
        // Por defecto, asignar al área de Mantenimiento
        targetArea = areas.find(a => a.name.toLowerCase().includes('mantenimiento'));
      }
      
      if (targetArea) {
        await prisma.sector.update({
          where: { id: sector.id },
          data: { areaId: targetArea.id }
        });
        console.log(`✅ Sector "${sector.name}" asignado a área "${targetArea.name}"`);
      } else {
        console.log(`⚠️  No se encontró área para sector "${sector.name}"`);
      }
    }
    
    console.log('\n🎉 Asignación completada');
    
  } catch (error) {
    console.error('❌ Error arreglando sectores:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSectorArea()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  }); 