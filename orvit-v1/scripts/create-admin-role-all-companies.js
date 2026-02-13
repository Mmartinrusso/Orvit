const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ROLE_NAME = 'Administrador';
const ROLE_DISPLAY_NAME = 'Administrador';
const ROLE_DESCRIPTION = 'Administrador con todos los permisos del sistema';

async function createAdminRoleInAllCompanies() {
  try {
    console.log('🚀 Creando rol "Administrador" en todas las empresas...\n');

    // 1. Obtener todas las empresas
    const companies = await prisma.company.findMany({
      orderBy: { id: 'asc' }
    });

    if (companies.length === 0) {
      console.log('⚠️  No se encontraron empresas en la base de datos');
      return;
    }

    console.log(`📋 Empresas encontradas: ${companies.length}\n`);

    // 2. Obtener todos los permisos activos
    const allPermissions = await prisma.permission.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    if (allPermissions.length === 0) {
      console.log('⚠️  No se encontraron permisos en la base de datos');
      return;
    }

    console.log(`🔐 Permisos encontrados: ${allPermissions.length}\n`);

    let rolesCreated = 0;
    let rolesExisted = 0;
    let totalPermissionsAssigned = 0;

    // 3. Para cada empresa, crear el rol "Administrador" si no existe
    for (const company of companies) {
      console.log(`\n🏢 Procesando empresa: ${company.name} (ID: ${company.id})`);

      try {
        // Usar upsert para crear o actualizar el rol
        const role = await prisma.role.upsert({
          where: {
            companyId_name: {
              companyId: company.id,
              name: ROLE_NAME
            }
          },
          update: {
            displayName: ROLE_DISPLAY_NAME,
            description: ROLE_DESCRIPTION
          },
          create: {
            name: ROLE_NAME,
            displayName: ROLE_DISPLAY_NAME,
            description: ROLE_DESCRIPTION,
            companyId: company.id
          }
        });

        // Verificar si era un rol nuevo o existente
        const wasNew = !role.updatedAt || 
          new Date(role.updatedAt).getTime() === new Date(role.createdAt).getTime() ||
          Math.abs(new Date(role.updatedAt).getTime() - new Date().getTime()) < 1000;

        if (wasNew) {
          console.log(`  ✅ Rol "${ROLE_NAME}" creado (ID: ${role.id})`);
          rolesCreated++;
        } else {
          console.log(`  ⏭️  Rol "${ROLE_NAME}" ya existía, actualizado (ID: ${role.id})`);
          rolesExisted++;
        }

        // 4. Asignar todos los permisos al rol
        let permissionsAssigned = 0;
        let permissionsSkipped = 0;

        for (const permission of allPermissions) {
          try {
            // Verificar si la asignación ya existe
            const existingAssignment = await prisma.rolePermission.findUnique({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
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
                      roleId: role.id,
                      permissionId: permission.id
                    }
                  },
                  data: {
                    isGranted: true
                  }
                });
                permissionsAssigned++;
              } else {
                permissionsSkipped++;
              }
            } else {
              // Crear la asignación
              await prisma.rolePermission.create({
                data: {
                  roleId: role.id,
                  permissionId: permission.id,
                  isGranted: true
                }
              });
              permissionsAssigned++;
            }
          } catch (error) {
            console.error(`  ❌ Error asignando permiso ${permission.name}:`, error.message);
          }
        }

        console.log(`  📊 Permisos asignados: ${permissionsAssigned}, ya existían: ${permissionsSkipped}`);
        totalPermissionsAssigned += permissionsAssigned;

      } catch (error) {
        console.error(`  ❌ Error procesando empresa ${company.name}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN FINAL:');
    console.log('='.repeat(50));
    console.log(`✅ Roles creados: ${rolesCreated}`);
    console.log(`⏭️  Roles que ya existían: ${rolesExisted}`);
    console.log(`📋 Total de empresas procesadas: ${companies.length}`);
    console.log(`🔐 Total de permisos asignados: ${totalPermissionsAssigned}`);
    console.log(`🎯 Permisos por rol: ${allPermissions.length}`);

    if (rolesCreated > 0 || totalPermissionsAssigned > 0) {
      console.log('\n🎉 ¡Proceso completado exitosamente!');
    } else {
      console.log('\nℹ️  Todos los roles y permisos ya estaban configurados.');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminRoleInAllCompanies();

