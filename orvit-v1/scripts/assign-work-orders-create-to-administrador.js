const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PERMISSION_NAME = 'work_orders.create';
const ROLE_NAME = 'Administrador';

async function assignWorkOrdersCreateToAdministrador() {
  try {
    console.log(`🚀 Asignando permiso "${PERMISSION_NAME}" al rol "${ROLE_NAME}" en todas las empresas...\n`);

    // 1. Verificar que el permiso existe, si no, crearlo
    let permission = await prisma.permission.findFirst({
      where: { name: PERMISSION_NAME }
    });

    if (!permission) {
      console.log(`⚠️  El permiso "${PERMISSION_NAME}" no existe. Creándolo...`);
      try {
        permission = await prisma.permission.create({
          data: {
            name: PERMISSION_NAME,
            description: 'Permite crear órdenes de trabajo',
            category: 'Mantenimiento',
            isActive: true
          }
        });
        console.log(`✅ Permiso creado: "${permission.name}" (ID: ${permission.id})`);
      } catch (error) {
        console.error(`❌ Error creando permiso:`, error);
        return;
      }
    } else {
      console.log(`✅ Permiso encontrado: "${permission.name}" (ID: ${permission.id})`);
    }
    console.log('');

    // 2. Obtener todas las empresas
    const companies = await prisma.company.findMany({
      orderBy: { id: 'asc' }
    });

    if (companies.length === 0) {
      console.log('⚠️  No se encontraron empresas en la base de datos');
      return;
    }

    console.log(`📋 Empresas encontradas: ${companies.length}\n`);

    let totalAssigned = 0;
    let totalSkipped = 0;
    let rolesNotFound = 0;

    // 3. Para cada empresa, encontrar el rol "Administrador" y asignar el permiso
    for (const company of companies) {
      console.log(`🏢 Procesando empresa: ${company.name} (ID: ${company.id})`);

      // Buscar el rol "Administrador" en esta empresa
      const role = await prisma.role.findFirst({
        where: {
          name: ROLE_NAME,
          companyId: company.id
        }
      });

      if (!role) {
        console.log(`   ⚠️  Rol "${ROLE_NAME}" no encontrado en esta empresa`);
        rolesNotFound++;
        continue;
      }

      console.log(`   ✅ Rol encontrado: "${role.displayName}" (ID: ${role.id})`);

      // Verificar si el permiso ya está asignado
      const existingPermission = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        }
      });

      if (existingPermission) {
        if (existingPermission.isGranted) {
          console.log(`   ⏭️  Permiso ya está asignado y activo`);
          totalSkipped++;
        } else {
          // Activar el permiso si estaba desactivado
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
          console.log(`   ✅ Permiso activado`);
          totalAssigned++;
        }
      } else {
        // Asignar el permiso
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
            isGranted: true
          }
        });
        console.log(`   ✅ Permiso asignado`);
        totalAssigned++;
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`   ✅ Permisos asignados/activados: ${totalAssigned}`);
    console.log(`   ⏭️  Permisos ya existentes: ${totalSkipped}`);
    console.log(`   ⚠️  Roles no encontrados: ${rolesNotFound}`);
    console.log('\n✅ Proceso completado');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
assignWorkOrdersCreateToAdministrador();

