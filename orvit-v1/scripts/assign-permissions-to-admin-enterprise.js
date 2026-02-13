const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PERMISSIONS_TO_ASSIGN = ['users.manage', 'ingresar_tareas', 'ingresar_usuarios'];

async function assignPermissionsToAdminEnterprise() {
  try {
    console.log('🚀 Asignando permisos al rol ADMIN_ENTERPRISE...\n');

    // Obtener todos los permisos
    const permissions = await prisma.permission.findMany({
      where: {
        name: {
          in: PERMISSIONS_TO_ASSIGN
        }
      }
    });

    console.log('📋 Permisos encontrados: ' + permissions.length);
    permissions.forEach(p => {
      console.log('   - ' + p.name + ' (ID: ' + p.id + ')');
    });
    console.log('');

    // Obtener todas las empresas
    const companies = await prisma.company.findMany();
    let totalAssigned = 0;
    let totalSkipped = 0;

    for (const company of companies) {
      console.log('🏢 Procesando empresa: ' + company.name);

      // Buscar el rol ADMIN_ENTERPRISE
      const adminEnterpriseRole = await prisma.role.findFirst({
        where: {
          name: 'ADMIN_ENTERPRISE',
          companyId: company.id
        }
      });

      if (!adminEnterpriseRole) {
        console.log('   ⚠️  Rol ADMIN_ENTERPRISE no encontrado en esta empresa');
        continue;
      }

      console.log('   ✅ Rol ADMIN_ENTERPRISE encontrado (ID: ' + adminEnterpriseRole.id + ')');

      // Asignar cada permiso
      for (const permission of permissions) {
        const existing = await prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: adminEnterpriseRole.id,
              permissionId: permission.id
            }
          }
        });

        if (!existing) {
          await prisma.rolePermission.create({
            data: {
              roleId: adminEnterpriseRole.id,
              permissionId: permission.id,
              isGranted: true
            }
          });
          console.log('   ✅ Permiso asignado: ' + permission.name);
          totalAssigned++;
        } else {
          if (!existing.isGranted) {
            await prisma.rolePermission.update({
              where: {
                roleId_permissionId: {
                  roleId: adminEnterpriseRole.id,
                  permissionId: permission.id
                }
              },
              data: { isGranted: true }
            });
            console.log('   ✅ Permiso actualizado (habilitado): ' + permission.name);
            totalAssigned++;
          } else {
            console.log('   ⏭️  Permiso ya estaba asignado: ' + permission.name);
            totalSkipped++;
          }
        }
      }
      console.log('');
    }

    console.log('📊 RESUMEN FINAL:');
    console.log('   Permisos asignados: ' + totalAssigned);
    console.log('   Permisos que ya existían: ' + totalSkipped);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignPermissionsToAdminEnterprise();

