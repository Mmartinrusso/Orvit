const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAdministradorPermissions() {
  try {
    console.log('🔍 Verificando permisos del rol "Administrador"...\n');

    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No se encontró ninguna empresa');
      return;
    }

    const role = await prisma.role.findFirst({
      where: {
        name: 'Administrador',
        companyId: company.id
      },
      include: {
        permissions: {
          include: {
            permission: true
          },
          where: {
            isGranted: true
          }
        }
      }
    });

    if (!role) {
      console.log('❌ Rol "Administrador" no encontrado');
      return;
    }

    console.log('✅ Rol encontrado: ' + role.name + ' (ID: ' + role.id + ')');
    console.log('📋 Permisos asignados: ' + role.permissions.length + '\n');

    // Verificar permisos críticos
    const criticalPermissions = ['users.manage', 'ingresar_tareas', 'ingresar_usuarios'];
    console.log('🔍 Verificando permisos críticos:');
    
    let missingPermissions = [];
    for (const permName of criticalPermissions) {
      const hasPermission = role.permissions.some(rp => rp.permission.name === permName);
      if (hasPermission) {
        console.log('   ✅ ' + permName);
      } else {
        console.log('   ❌ ' + permName + ' - FALTANTE');
        missingPermissions.push(permName);
      }
    }

    if (missingPermissions.length > 0) {
      console.log('\n⚠️  Faltan permisos. Asignándolos...');
      
      for (const permName of missingPermissions) {
        const permission = await prisma.permission.findUnique({
          where: { name: permName }
        });

        if (permission) {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id,
              isGranted: true
            }
          });
          console.log('   ✅ Permiso asignado: ' + permName);
        } else {
          console.log('   ⚠️  Permiso no encontrado en BD: ' + permName);
        }
      }
    } else {
      console.log('\n✅ Todos los permisos críticos están asignados');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAdministradorPermissions();

