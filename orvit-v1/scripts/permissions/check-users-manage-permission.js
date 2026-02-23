const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsersManagePermission() {
  try {
    console.log('🔍 Verificando permiso users.manage...\n');

    // Buscar el permiso
    const permission = await prisma.permission.findUnique({
      where: { name: 'users.manage' }
    });

    if (!permission) {
      console.log('❌ Permiso users.manage NO encontrado en la base de datos');
      console.log('📋 Necesitamos crearlo y asignarlo al rol Administrador');
      return;
    }

    console.log('✅ Permiso encontrado: users.manage (ID: ' + permission.id + ')');
    console.log('   Descripción: ' + permission.description);
    console.log('   Categoría: ' + permission.category);
    console.log('');

    // Verificar si está asignado al rol Administrador
    const companies = await prisma.company.findMany();
    
    for (const company of companies) {
      const adminRole = await prisma.role.findFirst({
        where: {
          name: 'Administrador',
          companyId: company.id
        }
      });

      if (adminRole) {
        const rolePermission = await prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: adminRole.id,
              permissionId: permission.id
            }
          }
        });

        if (rolePermission && rolePermission.isGranted) {
          console.log('✅ El permiso está asignado al rol Administrador en ' + company.name);
        } else {
          console.log('⚠️  El permiso NO está asignado al rol Administrador en ' + company.name);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsersManagePermission();

