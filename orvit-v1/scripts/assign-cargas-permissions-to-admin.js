const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos de cargas a asignar
const CARGA_PERMISSIONS = [
  'cargas.view',
  'cargas.manage_trucks',
  'cargas.manage_loads'
];

async function assignCargasPermissionsToAdmin() {
  try {
    console.log('🚀 Asignando permisos de cargas a roles ADMIN/Administrador...\n');

    // Obtener todos los permisos de cargas
    const permissions = await prisma.permission.findMany({
      where: {
        name: {
          in: CARGA_PERMISSIONS
        }
      }
    });

    if (permissions.length === 0) {
      console.log('❌ No se encontraron permisos de cargas. Ejecuta primero create-cargas-permissions.js');
      return;
    }

    console.log(`📋 Permisos encontrados: ${permissions.length}`);
    permissions.forEach(p => console.log(`   - ${p.name} (ID: ${p.id})`));

    // Obtener todas las empresas
    const companies = await prisma.company.findMany();

    console.log(`\n🏢 Procesando ${companies.length} empresa(s)...\n`);

    let totalAssigned = 0;
    let totalSkipped = 0;

    for (const company of companies) {
      console.log(`\n📦 Empresa: ${company.name} (ID: ${company.id})`);

      // Buscar roles ADMIN o Administrador en esta empresa
      const adminRoles = await prisma.role.findMany({
        where: {
          companyId: company.id,
          OR: [
            { name: 'ADMIN' },
            { name: 'Administrador' },
            { displayName: { contains: 'Administrador', mode: 'insensitive' } }
          ]
        }
      });

      if (adminRoles.length === 0) {
        console.log('   ⚠️  No se encontraron roles ADMIN/Administrador en esta empresa');
        continue;
      }

      for (const role of adminRoles) {
        console.log(`\n   🔐 Rol: ${role.name}${role.displayName ? ` (${role.displayName})` : ''} (ID: ${role.id})`);

        let assigned = 0;
        let skipped = 0;

        for (const permission of permissions) {
          try {
            // Verificar si ya existe la asignación
            const existingAssignment = await prisma.rolePermission.findUnique({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: permission.id
                }
              }
            });

            if (existingAssignment) {
              // Si existe pero no está otorgado, actualizarlo
              if (!existingAssignment.isGranted) {
                await prisma.rolePermission.update({
                  where: {
                    roleId_permissionId: {
                      roleId: role.id,
                      permissionId: permission.id
                    }
                  },
                  data: {
                    isGranted: true
                  }
                });
                console.log(`   ✅ Permiso actualizado: ${permission.name}`);
                assigned++;
              } else {
                console.log(`   ⏭️  Permiso ya asignado: ${permission.name}`);
                skipped++;
              }
            } else {
              // Crear nueva asignación
              await prisma.rolePermission.create({
                data: {
                  roleId: role.id,
                  permissionId: permission.id,
                  isGranted: true
                }
              });
              console.log(`   ✅ Permiso asignado: ${permission.name}`);
              assigned++;
            }
          } catch (error) {
            if (error.code === 'P2002') {
              console.log(`   ⚠️  Conflicto de clave única: ${permission.name}`);
              skipped++;
            } else {
              console.error(`   ❌ Error asignando ${permission.name}:`, error.message);
            }
          }
        }

        console.log(`   📊 Asignados: ${assigned}, Ya existían: ${skipped}`);
        totalAssigned += assigned;
        totalSkipped += skipped;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN FINAL:');
    console.log('='.repeat(50));
    console.log(`✅ Permisos asignados: ${totalAssigned}`);
    console.log(`⏭️  Permisos que ya existían: ${totalSkipped}`);
    console.log(`📋 Total procesados: ${totalAssigned + totalSkipped}`);

    if (totalAssigned > 0) {
      console.log('\n🎉 ¡Permisos de cargas asignados exitosamente a roles ADMIN!');
    } else {
      console.log('\nℹ️  Todos los permisos ya estaban asignados.');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignCargasPermissionsToAdmin();

