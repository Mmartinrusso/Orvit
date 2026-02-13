const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ROLE_NAME = 'Administrador';

// Permisos del sidebar que necesitamos asignar
const SIDEBAR_PERMISSIONS = [
  'ordenes_de_trabajo',
  'mantenimientos',
  'maquinas_mantenimiento',
  'unidades_moviles',
  'puestos_trabajo',
  'panol',
  'historial_mantenimiento',
  'reportes_mantenimiento',
  'ventas',
  'ventas_dashboard',
  'clientes',
  'productos',
  'cotizaciones',
  'ventas_modulo',
  'costos',
  'controles',
  'maquinas_produccion',
  'vehiculos_produccion'
];

async function assignSidebarPermissionsToAdmin() {
  try {
    console.log(`🚀 Asignando permisos del sidebar al rol "${ROLE_NAME}" en todas las empresas...\n`);

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

        let permissionsAssigned = 0;
        let permissionsSkipped = 0;

        // 3. Asignar cada permiso al rol
        for (const permissionName of SIDEBAR_PERMISSIONS) {
          try {
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
                permissionsAssigned++;
              } else {
                permissionsSkipped++;
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
              permissionsAssigned++;
            }
          } catch (error) {
            console.error(`  ❌ Error asignando permiso ${permissionName}:`, error.message);
          }
        }

        console.log(`  📊 Permisos asignados: ${permissionsAssigned}, ya existían: ${permissionsSkipped}`);
        totalPermissionsAssigned += permissionsAssigned;
        totalPermissionsSkipped += permissionsSkipped;
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
    console.log(`🎯 Permisos por rol: ${SIDEBAR_PERMISSIONS.length}`);

    if (totalPermissionsAssigned > 0) {
      console.log('\n🎉 ¡Permisos asignados exitosamente!');
    } else {
      console.log('\nℹ️  Todos los permisos ya estaban asignados.');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignSidebarPermissionsToAdmin();

