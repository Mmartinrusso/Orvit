const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testIngresarTareasPermission() {
  try {
    console.log('🔍 Probando verificación de permiso ingresar_tareas...\n');

    // Buscar el usuario
    const user = await prisma.user.findFirst({
      where: {
        email: 'maartinrusso@gmail.com'
      },
      include: {
        companies: {
          include: {
            company: true,
            role: {
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
            }
          }
        }
      }
    });

    if (!user) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    console.log('✅ Usuario encontrado: ' + user.name);
    console.log('   Campo role: ' + user.role);
    console.log('');

    const company = user.companies[0];
    if (!company) {
      console.log('❌ Usuario no tiene empresa asignada');
      return;
    }

    console.log('🏢 Empresa: ' + company.company.name);
    console.log('   Rol en UserOnCompany: ' + (company.role ? company.role.name : 'NINGUNO'));
    console.log('');

    // Simular la lógica de la API
    const companyId = company.company.id;
    let userRoleInCompany = user.role; // Rol por defecto
    
    if (company.role) {
      userRoleInCompany = company.role.name;
    }

    console.log('🔍 Verificando permiso con:');
    console.log('   userRoleInCompany: ' + userRoleInCompany);
    console.log('   companyId: ' + companyId);
    console.log('   permission: ingresar_tareas');
    console.log('');

    // Buscar el permiso
    const permission = await prisma.permission.findUnique({
      where: { name: 'ingresar_tareas' }
    });

    if (!permission) {
      console.log('❌ Permiso ingresar_tareas no encontrado');
      return;
    }

    // Verificar permisos del rol (simulando la lógica de la API)
    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role: {
          name: userRoleInCompany,
          companyId: companyId
        },
        permission: {
          name: 'ingresar_tareas',
          isActive: true
        },
        isGranted: true
      },
      include: {
        permission: true,
        role: true
      }
    });

    if (rolePermission) {
      console.log('✅ PERMISO ENCONTRADO:');
      console.log('   RolePermission ID: ' + rolePermission.id);
      console.log('   Rol: ' + rolePermission.role.name);
      console.log('   Permiso: ' + rolePermission.permission.name);
      console.log('   isGranted: ' + rolePermission.isGranted);
      console.log('');
      console.log('✅ El usuario DEBERÍA tener acceso a ingresar_tareas');
    } else {
      console.log('❌ PERMISO NO ENCONTRADO');
      console.log('');
      console.log('🔍 Buscando todos los roles con nombre "' + userRoleInCompany + '" en la empresa ' + companyId + ':');
      
      const roles = await prisma.role.findMany({
        where: {
          name: userRoleInCompany,
          companyId: companyId
        }
      });
      
      console.log('   Roles encontrados: ' + roles.length);
      roles.forEach(r => {
        console.log('   - ' + r.name + ' (ID: ' + r.id + ')');
      });
      
      console.log('');
      console.log('🔍 Buscando todos los permisos del rol:');
      if (company.role) {
        console.log('   Permisos del rol "' + company.role.name + '":');
        company.role.permissions.forEach(rp => {
          console.log('   - ' + rp.permission.name);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testIngresarTareasPermission();

