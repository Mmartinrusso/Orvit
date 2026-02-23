const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAdminEnterprisePermissions() {
  try {
    console.log('🔍 Verificando permisos del rol ADMIN_ENTERPRISE...\n');

    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No se encontró ninguna empresa');
      return;
    }

    const role = await prisma.role.findFirst({
      where: {
        name: 'ADMIN_ENTERPRISE',
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
      console.log('❌ Rol ADMIN_ENTERPRISE no encontrado');
      return;
    }

    console.log('✅ Rol encontrado: ' + role.name + ' (ID: ' + role.id + ')');
    console.log('📋 Permisos asignados: ' + role.permissions.length + '\n');

    role.permissions.forEach(rp => {
      console.log('   ✅ ' + rp.permission.name + ' - ' + rp.permission.description);
    });

    // Verificar permisos críticos
    const criticalPermissions = ['users.manage', 'ingresar_tareas', 'ingresar_usuarios'];
    console.log('\n🔍 Verificando permisos críticos:');
    
    for (const permName of criticalPermissions) {
      const hasPermission = role.permissions.some(rp => rp.permission.name === permName);
      if (hasPermission) {
        console.log('   ✅ ' + permName);
      } else {
        console.log('   ❌ ' + permName + ' - FALTANTE');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAdminEnterprisePermissions();

