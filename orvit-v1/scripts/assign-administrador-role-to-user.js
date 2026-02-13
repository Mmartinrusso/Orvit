const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function assignAdministradorRoleToUser() {
  try {
    console.log('🔍 Asignando rol "Administrador" a usuarios con rol ADMIN_ENTERPRISE...\n');

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
        console.log('      Rol actual en UserOnCompany: ' + (userCompany.role ? userCompany.role.name : 'NINGUNO'));

        // Buscar el rol "Administrador" en esta empresa
        const administradorRole = await prisma.role.findFirst({
          where: {
            name: 'Administrador',
            companyId: userCompany.company.id
          }
        });

        if (!administradorRole) {
          console.log('      ⚠️  Rol "Administrador" no existe en esta empresa');
          continue;
        }

        // Asignar el rol "Administrador" al usuario
        await prisma.userOnCompany.update({
          where: {
            userId_companyId: {
              userId: user.id,
              companyId: userCompany.company.id
            }
          },
          data: {
            roleId: administradorRole.id
          }
        });
        console.log('      ✅ Rol "Administrador" asignado en UserOnCompany');
      }
      console.log('');
    }

    console.log('🎉 Proceso completado');
    console.log('\n⚠️  NOTA: El campo "role" en la tabla User sigue siendo "ADMIN_ENTERPRISE".');
    console.log('   Esto está bien, ya que la API usa el rol de UserOnCompany para verificar permisos.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignAdministradorRoleToUser();

