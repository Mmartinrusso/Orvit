const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAndCreateAdminPermissions() {
  try {
    console.log('🔍 Verificando permisos de administración...');

    // Lista de permisos necesarios para administración
    const adminPermissions = [
      {
        name: 'ingresar_administracion',
        description: 'Permite acceder al área de administración',
        category: 'areas'
      },
      {
        name: 'ingresar_mantenimiento',
        description: 'Permite acceder al área de mantenimiento',
        category: 'areas'
      },
      {
        name: 'ingresar_dashboard_administracion',
        description: 'Permite acceder al dashboard de administración',
        category: 'dashboard'
      }
    ];

    // Verificar y crear permisos
    for (const permissionData of adminPermissions) {
      const existingPermission = await prisma.permission.findUnique({
        where: { name: permissionData.name }
      });

      if (!existingPermission) {
        console.log(`📝 Creando permiso: ${permissionData.name}`);
        await prisma.permission.create({
          data: permissionData
        });
        console.log(`✅ Permiso creado: ${permissionData.name}`);
      } else {
        console.log(`✅ Permiso ya existe: ${permissionData.name}`);
      }
    }

    // Verificar roles existentes
    const roles = await prisma.role.findMany({
      include: {
        company: true,
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    console.log('\n📋 Roles encontrados:');
    for (const role of roles) {
      const companyName = role.company ? role.company.name : 'Sin empresa';
      console.log(`- ${role.name} (${companyName})`);
      console.log(`  Permisos: ${role.permissions.map(rp => rp.permission.name).join(', ')}`);
    }

    // Asignar permisos de administración a roles ADMIN y SUPERADMIN
    const adminRoles = await prisma.role.findMany({
      where: {
        name: {
          in: ['ADMIN', 'SUPERADMIN']
        }
      }
    });

    for (const role of adminRoles) {
      console.log(`\n🔧 Asignando permisos a rol: ${role.name}`);
      
      for (const permissionData of adminPermissions) {
        const permission = await prisma.permission.findUnique({
          where: { name: permissionData.name }
        });

        if (permission) {
          const existingRolePermission = await prisma.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id
              }
            }
          });

          if (!existingRolePermission) {
            console.log(`  📝 Asignando permiso: ${permissionData.name}`);
            try {
              await prisma.rolePermission.create({
                data: {
                  roleId: role.id,
                  permissionId: permission.id,
                  isGranted: true
                }
              });
              console.log(`  ✅ Permiso asignado: ${permissionData.name}`);
            } catch (error) {
              if (error.code === 'P2002') {
                console.log(`  ⚠️  Permiso ya existe (conflicto de ID): ${permissionData.name}`);
              } else {
                throw error;
              }
            }
          } else {
            console.log(`  ✅ Permiso ya asignado: ${permissionData.name}`);
          }
        }
      }
    }

    console.log('\n✅ Verificación de permisos completada');

  } catch (error) {
    console.error('❌ Error verificando permisos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndCreateAdminPermissions(); 