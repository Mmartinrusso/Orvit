const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PERMISSIONS_TO_ASSIGN = [
  'users.manage',
  'ingresar_tareas',
  'ingresar_usuarios',
  'ingresar_permisos',
  'tasks.view',
  'tasks.create',
  'tasks.edit',
  'tasks.delete',
  'tasks.assign',
  'tasks.complete',
  'tasks.view_all',
  'fixed_tasks.create',
  'fixed_tasks.edit',
  'fixed_tasks.delete',
  'ver_agenda',
  'ver_historial_tareas',
  'ver_estadisticas',
  'admin.permissions',
  'admin.roles'
];

async function createAdminEnterpriseRole() {
  try {
    console.log('🚀 Creando rol ADMIN_ENTERPRISE y asignando permisos...\n');

    // Obtener todas las empresas
    const companies = await prisma.company.findMany();

    for (const company of companies) {
      console.log('🏢 Procesando empresa: ' + company.name);

      // Verificar si el rol ya existe
      let role = await prisma.role.findFirst({
        where: {
          name: 'ADMIN_ENTERPRISE',
          companyId: company.id
        }
      });

      if (!role) {
        // Crear el rol
        role = await prisma.role.create({
          data: {
            name: 'ADMIN_ENTERPRISE',
            displayName: 'Administrador de Empresa',
            description: 'Administrador de Empresa - gestión completa de una empresa específica',
            companyId: company.id
          }
        });
        console.log('   ✅ Rol ADMIN_ENTERPRISE creado (ID: ' + role.id + ')');
      } else {
        console.log('   ⏭️  Rol ADMIN_ENTERPRISE ya existe (ID: ' + role.id + ')');
      }

      // Obtener todos los permisos que necesitamos asignar
      const permissions = await prisma.permission.findMany({
        where: {
          name: {
            in: PERMISSIONS_TO_ASSIGN
          }
        }
      });

      console.log('   📋 Permisos encontrados para asignar: ' + permissions.length);

      let assigned = 0;
      let skipped = 0;

      // Asignar cada permiso
      for (const permission of permissions) {
        const existing = await prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id
            }
          }
        });

        if (!existing) {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id,
              isGranted: true
            }
          });
          assigned++;
        } else {
          if (!existing.isGranted) {
            await prisma.rolePermission.update({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: permission.id
                }
              },
              data: { isGranted: true }
            });
            assigned++;
          } else {
            skipped++;
          }
        }
      }

      console.log('   ✅ Permisos asignados: ' + assigned);
      console.log('   ⏭️  Permisos que ya existían: ' + skipped);
      console.log('');
    }

    console.log('🎉 Proceso completado');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminEnterpriseRole();

