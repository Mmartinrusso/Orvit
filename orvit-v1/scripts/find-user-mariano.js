const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findUserMariano() {
  try {
    console.log('🔍 Buscando usuario "Mariano Russo"...');
    
    // Buscar por nombre
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: 'Mariano', mode: 'insensitive' } },
          { name: { contains: 'mariano', mode: 'insensitive' } }
        ]
      },
      include: {
        companies: {
          include: {
            company: true,
            role: true
          }
        }
      }
    });
    
    if (users.length === 0) {
      console.log('❌ No se encontró usuario con nombre "Mariano"');
      // Buscar todos los usuarios
      const allUsers = await prisma.user.findMany({
        include: {
          companies: {
            include: {
              company: true,
              role: true
            }
          }
        }
      });
      console.log(`\n📋 Todos los usuarios (${allUsers.length}):`);
      allUsers.forEach(u => {
        console.log(`  - ${u.name} (${u.email}) - Rol: ${u.role}`);
      });
      return;
    }
    
    users.forEach(user => {
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
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findUserMariano();

