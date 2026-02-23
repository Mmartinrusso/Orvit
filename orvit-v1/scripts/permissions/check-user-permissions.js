const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUserPermissions() {
  try {
    console.log('🔍 Verificando permisos del usuario...');

    // Buscar usuarios ADMIN y SUPERADMIN
    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'SUPERADMIN']
        }
      },
      include: {
        companies: {
          include: {
            company: true,
            role: true
          }
        }
      }
    });

    console.log(`\n📋 Usuarios ADMIN/SUPERADMIN encontrados: ${adminUsers.length}`);
    
    for (const user of adminUsers) {
      console.log(`\n👤 Usuario: ${user.name} (${user.email}) - Rol: ${user.role}`);
      
      // Verificar permisos específicos del usuario
      const userPermissions = await prisma.userPermission.findMany({
        where: {
          userId: user.id
        },
        include: {
          permission: true
        }
      });
      
      console.log(`  Permisos específicos: ${userPermissions.map(up => up.permission.name).join(', ')}`);
      
      // Verificar roles en empresas
      for (const userCompany of user.companies) {
        console.log(`  Empresa: ${userCompany.company.name}`);
        if (userCompany.role) {
          console.log(`  Rol en empresa: ${userCompany.role.name}`);
          
          // Verificar permisos del rol
          const rolePermissions = await prisma.rolePermission.findMany({
            where: {
              roleId: userCompany.role.id
            },
            include: {
              permission: true
            }
          });
          
          console.log(`  Permisos del rol: ${rolePermissions.map(rp => rp.permission.name).join(', ')}`);
        }
      }
    }

    // Verificar que los permisos necesarios existan
    const requiredPermissions = [
      'ingresar_administracion',
      'ingresar_mantenimiento',
      'ingresar_dashboard_administracion'
    ];

    console.log('\n🔍 Verificando permisos requeridos...');
    for (const permissionName of requiredPermissions) {
      const permission = await prisma.permission.findUnique({
        where: { name: permissionName }
      });
      
      if (permission) {
        console.log(`✅ Permiso existe: ${permissionName}`);
      } else {
        console.log(`❌ Permiso NO existe: ${permissionName}`);
      }
    }

    // Asignar permisos a roles ADMIN y SUPERADMIN si no los tienen
    console.log('\n🔧 Asignando permisos faltantes...');
    
    const adminRoles = await prisma.role.findMany({
      where: {
        name: {
          in: ['ADMIN', 'SUPERADMIN']
        }
      }
    });

    for (const role of adminRoles) {
      console.log(`\n🔧 Procesando rol: ${role.name}`);
      
      for (const permissionName of requiredPermissions) {
        const permission = await prisma.permission.findUnique({
          where: { name: permissionName }
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
            console.log(`  📝 Asignando permiso: ${permissionName}`);
            await prisma.rolePermission.create({
              data: {
                roleId: role.id,
                permissionId: permission.id,
                isGranted: true
              }
            });
            console.log(`  ✅ Permiso asignado: ${permissionName}`);
          } else {
            console.log(`  ✅ Permiso ya asignado: ${permissionName}`);
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

checkUserPermissions(); 