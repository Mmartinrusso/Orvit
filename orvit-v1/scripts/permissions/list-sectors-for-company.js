const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listSectors() {
  try {
    console.log('🔍 Listando sectores para la empresa...\n');
    
    // Obtener la empresa
    const company = await prisma.company.findFirst({
      where: { id: 3 } // Pretensados Cordoba
    });
    
    if (!company) {
      console.log('❌ No se encontró la empresa');
      return;
    }
    
    console.log(`🏢 Empresa: ${company.name} (ID: ${company.id})\n`);
    
    // Obtener todas las áreas
    const areas = await prisma.area.findMany({
      where: { companyId: company.id },
      include: {
        sectors: {
          orderBy: { name: 'asc' }
        }
      }
    });
    
    console.log(`📋 Áreas encontradas: ${areas.length}\n`);
    
    areas.forEach(area => {
      console.log(`📍 Área: ${area.name} (ID: ${area.id})`);
      console.log(`   Sectores: ${area.sectors.length}`);
      if (area.sectors.length > 0) {
        area.sectors.forEach(sector => {
          console.log(`   - ${sector.name} (ID: ${sector.id})`);
        });
      } else {
        console.log('   (Sin sectores)');
      }
      console.log('');
    });
    
    // Obtener todos los sectores de la empresa
    const allSectors = await prisma.sector.findMany({
      where: { companyId: company.id },
      include: {
        area: true
      },
      orderBy: { name: 'asc' }
    });
    
    console.log(`\n📊 Total de sectores en la empresa: ${allSectors.length}`);
    if (allSectors.length > 0) {
      console.log('\n📋 Lista completa de sectores:');
      allSectors.forEach(sector => {
        console.log(`   - ${sector.name} (ID: ${sector.id}) - Área: ${sector.area.name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listSectors();

