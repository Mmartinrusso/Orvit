const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixPermissionsToSpanish() {
  try {
    console.log('🔧 Corrigiendo permisos a español...\n');

    // 1. Eliminar tasks.view (duplicado de ingresar_tareas)
    const tasksView = await prisma.permission.findUnique({
      where: { name: 'tasks.view' }
    });

    if (tasksView) {
      console.log('🗑️  Eliminando permiso duplicado tasks.view (ID: ' + tasksView.id + ')');
      
      // Primero eliminar las asignaciones de roles
      await prisma.rolePermission.deleteMany({
        where: { permissionId: tasksView.id }
      });
      
      // Luego eliminar el permiso
      await prisma.permission.delete({
        where: { id: tasksView.id }
      });
      
      console.log('✅ Permiso tasks.view eliminado\n');
    }

    // 2. Renombrar users.manage a gestionar_usuarios
    const usersManage = await prisma.permission.findUnique({
      where: { name: 'users.manage' }
    });

    if (usersManage) {
      console.log('🔄 Renombrando users.manage a gestionar_usuarios...');
      
      // Verificar si ya existe gestionar_usuarios
      const existing = await prisma.permission.findUnique({
        where: { name: 'gestionar_usuarios' }
      });

      if (existing) {
        console.log('⚠️  El permiso gestionar_usuarios ya existe. Migrando asignaciones...');
        
        // Migrar todas las asignaciones de users.manage a gestionar_usuarios
        const rolePermissions = await prisma.rolePermission.findMany({
          where: { permissionId: usersManage.id }
        });

        for (const rp of rolePermissions) {
          // Verificar si ya existe la asignación para gestionar_usuarios
          const existingRP = await prisma.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: rp.roleId,
                permissionId: existing.id
              }
            }
          });

          if (!existingRP) {
            await prisma.rolePermission.create({
              data: {
                roleId: rp.roleId,
                permissionId: existing.id,
                isGranted: rp.isGranted
              }
            });
          }
        }

        // Eliminar users.manage
        await prisma.rolePermission.deleteMany({
          where: { permissionId: usersManage.id }
        });
        await prisma.permission.delete({
          where: { id: usersManage.id }
        });
        
        console.log('✅ Asignaciones migradas y users.manage eliminado\n');
      } else {
        // Renombrar directamente
        await prisma.permission.update({
          where: { id: usersManage.id },
          data: {
            name: 'gestionar_usuarios',
            description: 'Gestionar usuarios del sistema'
          }
        });
        
        console.log('✅ Permiso renombrado a gestionar_usuarios\n');
      }
    }

    console.log('🎉 Proceso completado');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPermissionsToSpanish();

