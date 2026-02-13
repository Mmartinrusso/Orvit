const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserRoleInCompany() {
  try {
    console.log('🔍 Verificando rol del usuario en empresas...');
    
    // Buscar usuario por email
    const userEmail = 'mariano.russo@pretensadoscba.com'; // Cambiar si es necesario
    const user = await prisma.user.findFirst({
      where: { email: userEmail },
      include: {
        companies: {
          include: {
            company: true,
            role: true
          }
        }
      }
    });
    
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    console.log(`\n👤 Usuario: ${user.name} (${user.email})`);
    console.log(`📋 Rol en tabla User: ${user.role}`);
    console.log(`\n🏢 Empresas asociadas:`);
    
    user.companies.forEach((userCompany) => {
      console.log(`\n  - Empresa: ${userCompany.company.name} (ID: ${userCompany.company.id})`);
      console.log(`    Rol en UserOnCompany: ${userCompany.role?.name || 'Sin rol'} (ID: ${userCompany.roleId})`);
      console.log(`    Rol displayName: ${userCompany.role?.displayName || 'N/A'}`);
      if (userCompany.role?.sectorId) {
        console.log(`    Sector asociado: ${userCompany.role.sectorId}`);
      }
    });
    
    // Buscar rol "supervisor viguetas" o similar
    const supervisorRole = await prisma.role.findFirst({
      where: {
        OR: [
          { name: { contains: 'supervisor', mode: 'insensitive' } },
          { displayName: { contains: 'supervisor', mode: 'insensitive' } },
          { displayName: { contains: 'viguetas', mode: 'insensitive' } }
        ]
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
    
    if (supervisorRole) {
      console.log(`\n\n🔍 Rol "Supervisor" encontrado:`);
      console.log(`  - ID: ${supervisorRole.id}`);
      console.log(`  - Name: ${supervisorRole.name}`);
      console.log(`  - DisplayName: ${supervisorRole.displayName}`);
      console.log(`  - CompanyId: ${supervisorRole.companyId}`);
      console.log(`  - SectorId: ${supervisorRole.sectorId || 'null'}`);
      console.log(`  - Permisos asignados: ${supervisorRole.permissions.filter(p => p.isGranted).length}`);
      
      const mantenimientoPerms = supervisorRole.permissions
        .filter(p => p.isGranted && p.permission.name.includes('mantenimiento'))
        .map(p => p.permission.name);
      
      console.log(`  - Permisos de mantenimiento:`, mantenimientoPerms);
    } else {
      console.log('\n❌ No se encontró rol "Supervisor"');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRoleInCompany();

