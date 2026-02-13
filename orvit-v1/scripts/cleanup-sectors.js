const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupSectors() {
  try {
    console.log('🔍 Limpiando sectores problemáticos...');
    
    // Obtener la empresa
    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No hay empresas en la base de datos');
      return;
    }
    
    console.log('🏢 Empresa encontrada:', company.name);
    
    // Obtener todos los sectores
    const sectors = await prisma.sector.findMany({
      where: { companyId: company.id }
    });
    
    console.log(`📋 Sectores encontrados: ${sectors.length}`);
    sectors.forEach(sector => {
      console.log(`- ${sector.name} (ID: ${sector.id}) - AreaId: ${sector.areaId}`);
    });
    
    // Eliminar sectores problemáticos (los que no tienen areaId o tienen nombres extraños)
    const sectorsToDelete = sectors.filter(sector => 
      !sector.areaId || 
      sector.name === '1231231' || 
      sector.name.length < 3
    );
    
    if (sectorsToDelete.length > 0) {
      console.log('\n🗑️ Eliminando sectores problemáticos:');
      for (const sector of sectorsToDelete) {
        console.log(`- Eliminando: ${sector.name} (ID: ${sector.id})`);
        await prisma.sector.delete({
          where: { id: sector.id }
        });
      }
      console.log(`✅ ${sectorsToDelete.length} sectores eliminados`);
    } else {
      console.log('\n✅ No hay sectores problemáticos para eliminar');
    }
    
    // Verificar sectores restantes
    const remainingSectors = await prisma.sector.findMany({
      where: { companyId: company.id }
    });
    
    console.log(`\n📋 Sectores restantes: ${remainingSectors.length}`);
    remainingSectors.forEach(sector => {
      console.log(`- ${sector.name} (ID: ${sector.id}) - AreaId: ${sector.areaId}`);
    });
    
  } catch (error) {
    console.error('❌ Error limpiando sectores:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupSectors()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  }); 