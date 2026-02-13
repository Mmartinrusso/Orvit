const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVerAgendaEstadisticasPermissions() {
  try {
    console.log('🔍 Verificando permisos ver_agenda y ver_estadisticas...\n');

    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No se encontró ninguna empresa');
      return;
    }

    const permissionsToCheck = ['ver_agenda', 'ver_estadisticas'];

    for (const permName of permissionsToCheck) {
      console.log('📋 Verificando: ' + permName);
      
      // Buscar el permiso
      let permission = await prisma.permission.findUnique({
        where: { name: permName }
      });

      if (!permission) {
        console.log('   ❌ Permiso no encontrado. Creándolo...');
        
        let description = '';
        let category = 'Administración';
        
        if (permName === 'ver_agenda') {
          description = 'Permite ver la agenda de tareas';
        } else if (permName === 'ver_estadisticas') {
          description = 'Permite ver las estadísticas de tareas';
        }
        
        permission = await prisma.permission.create({
          data: {
            name: permName,
            description: description,
            category: category
          }
        });
        
        console.log('   ✅ Permiso creado (ID: ' + permission.id + ')');
      } else {
        console.log('   ✅ Permiso encontrado (ID: ' + permission.id + ')');
      }

      // Buscar el rol "Administrador"
      const role = await prisma.role.findFirst({
        where: {
          name: 'Administrador',
          companyId: company.id
        }
      });

      if (!role) {
        console.log('   ⚠️  Rol "Administrador" no encontrado');
        continue;
      }

      // Verificar si el rol tiene el permiso
      const rolePermission = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        }
      });

      if (!rolePermission) {
        console.log('   ❌ Permiso NO asignado al rol. Asignándolo...');
        
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
            isGranted: true
          }
        });
        
        console.log('   ✅ Permiso asignado al rol "Administrador"');
      } else if (!rolePermission.isGranted) {
        console.log('   ⚠️  Permiso asignado pero deshabilitado. Habilitándolo...');
        
        await prisma.rolePermission.update({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id
            }
          },
          data: { isGranted: true }
        });
        
        console.log('   ✅ Permiso habilitado');
      } else {
        console.log('   ✅ Permiso ya está asignado y habilitado');
      }
      
      console.log('');
    }

    console.log('🎉 Verificación completada');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVerAgendaEstadisticasPermissions();

