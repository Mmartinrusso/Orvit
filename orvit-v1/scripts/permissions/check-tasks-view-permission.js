const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTasksViewPermission() {
  try {
    console.log('🔍 Verificando permiso tasks.view para el rol "Administrador"...\n');

    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No se encontró ninguna empresa');
      return;
    }

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
            isGranted: true
          }
        }
      }
    });

    if (!role) {
      console.log('❌ Rol "Administrador" no encontrado');
      return;
    }

    console.log('✅ Rol encontrado: ' + role.name + ' (ID: ' + role.id + ')');

    // Buscar el permiso tasks.view
    const permission = await prisma.permission.findUnique({
      where: { name: 'tasks.view' }
    });

    if (!permission) {
      console.log('❌ Permiso tasks.view no encontrado');
      console.log('   Creándolo...');
      
      const newPermission = await prisma.permission.create({
        data: {
          name: 'tasks.view',
          description: 'Ver tareas del sistema',
          category: 'Tareas'
        }
      });
      
      console.log('✅ Permiso tasks.view creado (ID: ' + newPermission.id + ')');
      
      // Asignarlo al rol Administrador
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: newPermission.id,
          isGranted: true
        }
      });
      
      console.log('✅ Permiso tasks.view asignado al rol "Administrador"');
      return;
    }

    console.log('✅ Permiso encontrado: tasks.view (ID: ' + permission.id + ')');

    // Verificar si el rol tiene el permiso
    const rolePermission = role.permissions.find(rp => rp.permission.name === 'tasks.view');

    if (rolePermission) {
      console.log('✅ El rol "Administrador" TIENE el permiso tasks.view');
      console.log('   RolePermission ID: ' + rolePermission.id);
      console.log('   isGranted: ' + rolePermission.isGranted);
    } else {
      console.log('❌ El rol "Administrador" NO tiene el permiso tasks.view');
      console.log('   Asignándolo...');
      
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          isGranted: true
        }
      });
      
      console.log('✅ Permiso tasks.view asignado al rol "Administrador"');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTasksViewPermission();

