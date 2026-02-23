const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkGestionUsuariosPermission() {
  try {
    console.log('🔍 Verificando permiso de gestión de usuarios...\n');

    // Buscar el permiso
    const permission = await prisma.permission.findUnique({
      where: { name: 'ingresar_usuarios' }
    });

    if (!permission) {
      console.log('❌ El permiso ingresar_usuarios NO existe');
      return;
    }

    console.log(`✅ Permiso encontrado: ${permission.name} (ID: ${permission.id})`);
    console.log(`   Descripción: ${permission.description || 'Sin descripción'}`);
    console.log(`   Categoría: ${permission.category || 'Sin categoría'}\n`);

    // Buscar el rol Administrador en todas las empresas
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
          console.log(`✅ El permiso está asignado al rol Administrador en ${company.name}`);
        } else {
          console.log(`❌ El permiso NO está asignado al rol Administrador en ${company.name}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGestionUsuariosPermission();

