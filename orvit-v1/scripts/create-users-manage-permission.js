const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createUsersManagePermission() {
  try {
    console.log('🚀 Creando permiso users.manage...\n');

    // Verificar si ya existe
    const existing = await prisma.permission.findUnique({
      where: { name: 'users.manage' }
    });

    if (existing) {
      console.log('⚠️  El permiso users.manage ya existe (ID: ' + existing.id + ')');
    } else {
      // Crear el permiso
      const permission = await prisma.permission.create({
        data: {
          name: 'users.manage',
          description: 'Gestionar usuarios del sistema',
          category: 'Administración'
        }
      });
      console.log('✅ Permiso creado: users.manage (ID: ' + permission.id + ')');
    }

    // Obtener el permiso (ya sea nuevo o existente)
    const permission = await prisma.permission.findUnique({
      where: { name: 'users.manage' }
    });

    // Asignar a todos los roles Administrador
    const companies = await prisma.company.findMany();
    let assigned = 0;
    let skipped = 0;

    for (const company of companies) {
      const adminRole = await prisma.role.findFirst({
        where: {
          name: 'Administrador',
          companyId: company.id
        }
      });

      if (adminRole) {
        const existing = await prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: adminRole.id,
              permissionId: permission.id
            }
          }
        });

        if (!existing) {
          await prisma.rolePermission.create({
            data: {
              roleId: adminRole.id,
              permissionId: permission.id,
              isGranted: true
            }
          });
          console.log('✅ Permiso asignado al rol Administrador en ' + company.name);
          assigned++;
        } else {
          if (!existing.isGranted) {
            await prisma.rolePermission.update({
              where: {
                roleId_permissionId: {
                  roleId: adminRole.id,
                  permissionId: permission.id
                }
              },
              data: { isGranted: true }
            });
            console.log('✅ Permiso actualizado (habilitado) en ' + company.name);
            assigned++;
          } else {
            console.log('⏭️  Permiso ya estaba asignado en ' + company.name);
            skipped++;
          }
        }
      }
    }

    console.log('\n📊 RESUMEN:');
    console.log('   Permisos asignados: ' + assigned);
    console.log('   Permisos que ya existían: ' + skipped);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUsersManagePermission();

