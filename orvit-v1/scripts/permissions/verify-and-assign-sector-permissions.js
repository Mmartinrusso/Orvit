const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAndAssignSectorPermissions() {
  try {
    // Buscar el rol Administrador
    const adminRole = await prisma.role.findFirst({
      where: { name: 'Administrador' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (!adminRole) {
      console.log('❌ Rol Administrador no encontrado');
      process.exit(1);
    }

    console.log('✅ Rol Administrador encontrado:', adminRole.id);

    // Buscar los permisos de sectores
    const sectorPerms = await prisma.permission.findMany({
      where: {
        name: { in: ['sectors.create', 'sectors.edit', 'sectors.delete'] }
      }
    });

    console.log('\n📋 Permisos de sectores encontrados:', sectorPerms.map(p => p.name));

    // Verificar qué permisos tiene el Administrador
    const adminHasPerms = adminRole.permissions.filter(
      rp => rp.isGranted && ['sectors.create', 'sectors.edit', 'sectors.delete'].includes(rp.permission.name)
    );

    console.log('\n✅ Permisos actualmente asignados al Administrador:', adminHasPerms.map(rp => rp.permission.name));

    // Si faltan permisos, crearlos y asignarlos
    const requiredPerms = ['sectors.create', 'sectors.edit', 'sectors.delete'];
    const existingPermNames = sectorPerms.map(p => p.name);
    const missingPermNames = requiredPerms.filter(name => !existingPermNames.includes(name));

    // Crear permisos faltantes
    for (const permName of missingPermNames) {
      const newPerm = await prisma.permission.create({
        data: {
          name: permName,
          description: permName === 'sectors.create' ? 'Crear sectores' :
                       permName === 'sectors.edit' ? 'Editar sectores' :
                       'Eliminar sectores',
          isActive: true
        }
      });
      sectorPerms.push(newPerm);
      console.log('✅ Permiso creado:', newPerm.name);
    }

    // Asignar todos los permisos de sectores al Administrador
    for (const perm of sectorPerms) {
      const alreadyAssigned = adminHasPerms.find(rp => rp.permissionId === perm.id);
      
      if (!alreadyAssigned) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: adminRole.id,
              permissionId: perm.id
            }
          },
          update: {
            isGranted: true
          },
          create: {
            roleId: adminRole.id,
            permissionId: perm.id,
            isGranted: true
          }
        });
        console.log('✅ Permiso asignado al Administrador:', perm.name);
      }
    }

    console.log('\n✅ Proceso completado. El rol Administrador ahora tiene todos los permisos de sectores.');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAndAssignSectorPermissions();

