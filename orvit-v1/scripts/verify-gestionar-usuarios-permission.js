const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyGestionarUsuariosPermission() {
  try {
    console.log('🔍 Verificando permiso gestionar_usuarios...\n');

    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No se encontró ninguna empresa');
      return;
    }

    // Buscar el permiso
    const permission = await prisma.permission.findUnique({
      where: { name: 'gestionar_usuarios' }
    });

    if (!permission) {
      console.log('❌ Permiso gestionar_usuarios no encontrado');
      return;
    }

    console.log('✅ Permiso encontrado: gestionar_usuarios (ID: ' + permission.id + ')');
    console.log('   Descripción: ' + permission.description);
    console.log('');

    // Buscar el rol "Administrador"
    const role = await prisma.role.findFirst({
      where: {
        name: 'Administrador',
        companyId: company.id
      },
      include: {
        permissions: {
          include: {
            permission: true
          },
          where: {
            permissionId: permission.id,
            isGranted: true
          }
        }
      }
    });

    if (!role) {
      console.log('❌ Rol "Administrador" no encontrado');
      return;
    }

    if (role.permissions.length > 0) {
      console.log('✅ El permiso gestionar_usuarios está asignado al rol "Administrador"');
    } else {
      console.log('❌ El permiso gestionar_usuarios NO está asignado al rol "Administrador"');
      console.log('   Asignándolo...');
      
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          isGranted: true
        }
      });
      
      console.log('✅ Permiso asignado');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyGestionarUsuariosPermission();

