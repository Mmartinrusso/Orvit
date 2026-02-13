const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos de controles a asignar
const CONTROLS_PERMISSIONS = [
  'ingresar_controles',
  'controles.manage',
  'controles.create_records'
];

async function assignControlsPermissionsToAdmin() {
  try {
    console.log('🚀 Asignando permisos de controles a roles ADMIN y SUPERADMIN...\n');

    // Obtener todas las empresas
    const companies = await prisma.company.findMany();

    if (companies.length === 0) {
      console.log('⚠️  No se encontraron empresas');
      return;
    }

    let totalPermissionsAssigned = 0;
    let totalPermissionsSkipped = 0;
    let rolesProcessed = 0;

    for (const company of companies) {
      console.log(`\n🏢 Procesando empresa: ${company.name} (ID: ${company.id})`);

      // Buscar roles ADMIN y SUPERADMIN para esta empresa
      const adminRoles = await prisma.role.findMany({
        where: {
          name: {
            in: ['ADMIN', 'SUPERADMIN']
          },
          companyId: company.id
        }
      });

      if (adminRoles.length === 0) {
        console.log(`  ⚠️  No se encontraron roles ADMIN o SUPERADMIN para esta empresa`);
        continue;
      }

      // Procesar cada rol
      for (const adminRole of adminRoles) {
        console.log(`\n  🔧 Procesando rol: ${adminRole.name} (ID: ${adminRole.id})`);

        // Asignar cada permiso
        for (const permissionName of CONTROLS_PERMISSIONS) {
          // Buscar el permiso
          const permission = await prisma.permission.findUnique({
            where: { name: permissionName }
          });

          if (!permission) {
            console.log(`  ⚠️  Permiso no encontrado: ${permissionName}`);
            continue;
          }

          // Verificar si la asignación ya existe
          const existingAssignment = await prisma.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: adminRole.id,
                permissionId: permission.id
              }
            }
          });

          if (existingAssignment) {
            // Si ya existe pero no está granted, actualizarlo
            if (!existingAssignment.isGranted) {
              await prisma.rolePermission.update({
                where: {
                  roleId_permissionId: {
                    roleId: adminRole.id,
                    permissionId: permission.id
                  }
                },
                data: {
                  isGranted: true
                }
              });
              console.log(`  ✅ Permiso asignado (actualizado): ${permissionName}`);
              totalPermissionsAssigned++;
            } else {
              console.log(`  ⏭️  Permiso ya estaba asignado: ${permissionName}`);
              totalPermissionsSkipped++;
            }
          } else {
            // Crear la asignación
            await prisma.rolePermission.create({
              data: {
                roleId: adminRole.id,
                permissionId: permission.id,
                isGranted: true
              }
            });
            console.log(`  ✅ Permiso asignado: ${permissionName}`);
            totalPermissionsAssigned++;
          }
        }

        rolesProcessed++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN:');
    console.log('='.repeat(50));
    console.log(`✅ Permisos asignados: ${totalPermissionsAssigned}`);
    console.log(`⏭️  Permisos que ya estaban asignados: ${totalPermissionsSkipped}`);
    console.log(`👥 Roles procesados: ${rolesProcessed}`);
    console.log(`🏢 Empresas procesadas: ${companies.length}`);

    if (totalPermissionsAssigned > 0) {
      console.log('\n🎉 ¡Permisos asignados exitosamente!');
      console.log('💡 Nota: Los usuarios necesitarán cerrar sesión y volver a iniciar sesión para que los cambios surtan efecto.');
    } else {
      console.log('\nℹ️  Todos los permisos ya estaban asignados.');
    }

  } catch (error) {
    console.error('❌ Error asignando permisos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignControlsPermissionsToAdmin();

