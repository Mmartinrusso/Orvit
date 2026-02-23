const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ROLE_NAME = 'Administrador';

// Permisos de subsecciones del sidebar de Administración que necesitamos asignar
const PERMISSION_NAMES = [
  // Personal - ya existen
  'ingresar_tareas',
  'ingresar_permisos_roles',
  'ingresar_usuarios',
  
  // Ventas - nuevos
  'ingresar_dashboard_ventas',
  'ingresar_clientes',
  'ingresar_productos',
  'ingresar_cotizaciones',
  'ingresar_ventas_modulo'
];

async function assignAdminSubsectionPermissionsToAdmin() {
  try {
    console.log(`🚀 Asignando permisos de subsecciones del sidebar de Administración al rol "${ROLE_NAME}" en todas las empresas...\n`);

    // 1. Obtener todas las empresas
    const companies = await prisma.company.findMany({
      orderBy: { id: 'asc' }
    });

    if (companies.length === 0) {
      console.log('⚠️  No se encontraron empresas en la base de datos');
      return;
    }

    console.log(`📋 Empresas encontradas: ${companies.length}\n`);

    let totalPermissionsAssigned = 0;
    let totalPermissionsSkipped = 0;
    let rolesProcessed = 0;
    let rolesNotFound = 0;

    // 2. Para cada empresa, encontrar el rol "Administrador" y asignar permisos
    for (const company of companies) {
      console.log(`\n🏢 Procesando empresa: ${company.name} (ID: ${company.id})`);

      try {
        // Buscar el rol "Administrador" en esta empresa
        const adminRole = await prisma.role.findFirst({
          where: {
            name: ROLE_NAME,
            companyId: company.id
          }
        });

        if (!adminRole) {
          console.log(`  ⚠️  Rol "${ROLE_NAME}" no encontrado en esta empresa`);
          rolesNotFound++;
          continue;
        }

        console.log(`  ✅ Rol "${ROLE_NAME}" encontrado (ID: ${adminRole.id})`);

        // 3. Asignar cada permiso
        for (const permissionName of PERMISSION_NAMES) {
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

      } catch (error) {
        console.error(`  ❌ Error procesando empresa ${company.name}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN FINAL:');
    console.log('='.repeat(50));
    console.log(`✅ Roles procesados: ${rolesProcessed}`);
    console.log(`⚠️  Roles no encontrados: ${rolesNotFound}`);
    console.log(`📋 Total de empresas: ${companies.length}`);
    console.log(`🔐 Permisos asignados: ${totalPermissionsAssigned}`);
    console.log(`⏭️  Permisos que ya existían: ${totalPermissionsSkipped}`);

    if (totalPermissionsAssigned > 0) {
      console.log('\n🎉 ¡Permisos asignados exitosamente!');
    } else {
      console.log('\nℹ️  Los permisos ya estaban asignados en todas las empresas.');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignAdminSubsectionPermissionsToAdmin();

