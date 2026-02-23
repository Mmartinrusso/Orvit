const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSupervisorPermissions() {
  try {
    console.log('🔍 Verificando permisos del rol "Supervisor"...');
    
    // Buscar rol Supervisor para empresa 3
    const supervisorRole = await prisma.role.findFirst({
      where: {
        name: 'Supervisor',
        companyId: 3
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
    
    if (!supervisorRole) {
      console.log('❌ No se encontró rol "Supervisor" para empresa 3');
      return;
    }
    
    console.log(`\n✅ Rol encontrado: ${supervisorRole.displayName} (ID: ${supervisorRole.id})`);
    console.log(`   SectorId: ${supervisorRole.sectorId || 'null'}`);
    
    const mantenimientoPerms = supervisorRole.permissions
      .filter(p => p.isGranted && p.permission.name.includes('mantenimiento'))
      .map(p => p.permission.name);
    
    console.log(`\n📋 Permisos de mantenimiento (${mantenimientoPerms.length}):`);
    mantenimientoPerms.forEach(p => console.log(`   - ${p}`));
    
    const tieneIngresarMantenimiento = mantenimientoPerms.includes('ingresar_mantenimiento');
    console.log(`\n${tieneIngresarMantenimiento ? '✅' : '❌'} Tiene permiso 'ingresar_mantenimiento': ${tieneIngresarMantenimiento}`);
    
    if (!tieneIngresarMantenimiento) {
      console.log('\n⚠️ El rol Supervisor NO tiene el permiso ingresar_mantenimiento');
      console.log('   Necesitas asignarlo al rol.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSupervisorPermissions();

