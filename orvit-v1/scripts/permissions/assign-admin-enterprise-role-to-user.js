const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function assignAdminEnterpriseRoleToUser() {
  try {
    console.log('🔍 Buscando usuarios con rol ADMIN_ENTERPRISE...\n');

    // Buscar usuarios con el campo role = 'ADMIN_ENTERPRISE'
    const users = await prisma.user.findMany({
      where: {
        role: 'ADMIN_ENTERPRISE'
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
      console.log('⚠️  No se encontraron usuarios con rol ADMIN_ENTERPRISE');
      return;
    }

    console.log('📋 Usuarios encontrados: ' + users.length + '\n');

    for (const user of users) {
      console.log('👤 Usuario: ' + user.name + ' (' + user.email + ')');
      console.log('   Campo role: ' + user.role);

      // Obtener todas las empresas del usuario
      const companies = user.companies || [];

      for (const userCompany of companies) {
        console.log('   🏢 Empresa: ' + userCompany.company.name);
        console.log('      Rol actual en UserCompany: ' + (userCompany.role ? userCompany.role.name : 'NINGUNO'));

        // Buscar el rol ADMIN_ENTERPRISE en esta empresa
        const adminEnterpriseRole = await prisma.role.findFirst({
          where: {
            name: 'ADMIN_ENTERPRISE',
            companyId: userCompany.company.id
          }
        });

        if (!adminEnterpriseRole) {
          console.log('      ⚠️  Rol ADMIN_ENTERPRISE no existe en esta empresa');
          continue;
        }

        // Si el usuario no tiene el rol correcto, actualizarlo
        if (!userCompany.role || userCompany.role.name !== 'ADMIN_ENTERPRISE') {
          await prisma.userOnCompany.update({
            where: {
              userId_companyId: {
                userId: user.id,
                companyId: userCompany.company.id
              }
            },
            data: {
              roleId: adminEnterpriseRole.id
            }
          });
          console.log('      ✅ Rol ADMIN_ENTERPRISE asignado en UserCompany');
        } else {
          console.log('      ⏭️  El usuario ya tiene el rol ADMIN_ENTERPRISE asignado');
        }
      }
      console.log('');
    }

    console.log('🎉 Proceso completado');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignAdminEnterpriseRoleToUser();

