const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkIngresarTareasForAdministrador() {
  try {
    console.log('🔍 Verificando permiso ingresar_tareas para el rol "Administrador"...\n');

    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No se encontró ninguna empresa');
      return;
    }

    // Buscar el rol "Administrador"
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

    // Buscar el permiso ingresar_tareas
    const permission = await prisma.permission.findUnique({
      where: { name: 'ingresar_tareas' }
    });

    if (!permission) {
      console.log('❌ Permiso ingresar_tareas no encontrado');
      return;
    }

    console.log('✅ Permiso encontrado: ingresar_tareas (ID: ' + permission.id + ')');

    // Verificar si el rol tiene el permiso
    const rolePermission = role.permissions.find(rp => rp.permission.name === 'ingresar_tareas');

    if (rolePermission) {
      console.log('✅ El rol "Administrador" TIENE el permiso ingresar_tareas');
      console.log('   RolePermission ID: ' + rolePermission.id);
      console.log('   isGranted: ' + rolePermission.isGranted);
    } else {
      console.log('❌ El rol "Administrador" NO tiene el permiso ingresar_tareas');
      console.log('   Asignándolo...');
      
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          isGranted: true
        }
      });
      
      console.log('✅ Permiso ingresar_tareas asignado al rol "Administrador"');
    }

    // Verificar también el usuario
    console.log('\n🔍 Verificando usuario...');
    const user = await prisma.user.findFirst({
      where: {
        email: 'maartinrusso@gmail.com'
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

    if (user) {
      console.log('✅ Usuario encontrado: ' + user.name);
      console.log('   Campo role: ' + user.role);
      
      if (user.companies && user.companies.length > 0) {
        const userCompany = user.companies[0];
        console.log('   Empresa: ' + userCompany.company.name);
        console.log('   Rol en UserOnCompany: ' + (userCompany.role ? userCompany.role.name : 'NINGUNO'));
        
        if (userCompany.role && userCompany.role.name === 'Administrador') {
          console.log('   ✅ El usuario tiene el rol "Administrador" asignado en UserOnCompany');
        } else {
          console.log('   ⚠️  El usuario NO tiene el rol "Administrador" asignado en UserOnCompany');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkIngresarTareasForAdministrador();

