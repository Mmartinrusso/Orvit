const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createMaintenanceSector() {
  try {
    console.log('🔍 Creando sector de Mantenimiento...');
    
    // Obtener la empresa
    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No hay empresas en la base de datos');
      return;
    }
    
    console.log('🏢 Empresa encontrada:', company.name);
    
    // Obtener el área de Mantenimiento
    const maintenanceArea = await prisma.area.findFirst({
      where: { 
        name: { contains: 'Mantenimiento', mode: 'insensitive' },
        companyId: company.id
      }
    });
    
    if (!maintenanceArea) {
      console.log('❌ No se encontró el área de Mantenimiento');
      return;
    }
    
    console.log('🔧 Área de Mantenimiento encontrada:', maintenanceArea.name);
    
    // Verificar si ya existe el sector de Mantenimiento
    const existingSector = await prisma.sector.findFirst({
      where: { 
        name: 'Mantenimiento',
        companyId: company.id
      }
    });
    
    if (existingSector) {
      console.log('✅ Sector de Mantenimiento ya existe:', existingSector.name);
      return;
    }
    
    // Crear el sector de Mantenimiento
    const sector = await prisma.sector.create({
      data: {
        name: 'Mantenimiento',
        description: 'Sector de mantenimiento',
        companyId: company.id,
        areaId: maintenanceArea.id
      }
    });
    
    console.log('✅ Sector de Mantenimiento creado:', sector.name, '(ID:', sector.id, ')');
    console.log('   Asignado al área:', maintenanceArea.name);
    
  } catch (error) {
    console.error('❌ Error creando sector de Mantenimiento:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createMaintenanceSector()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  }); 