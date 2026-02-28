/**
 * Script para asignar permisos de productos al rol Administrador
 *
 * Este script:
 * 1. Obtiene todos los permisos de la base de datos
 * 2. Filtra los permisos relacionados con productos (ventas.productos.view, ventas.productos.create, etc.)
 * 3. Los asigna al rol "Administrador" de todas las empresas
 *
 * Uso: node scripts/assign-productos-permissions.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PRODUCTOS_PERMISSIONS = [
  'ventas.productos.view',
  'ventas.productos.create',
  'ventas.productos.edit',
  'ventas.productos.delete'
];

async function main() {
  console.log('🚀 Iniciando asignación de permisos de productos...\n');

  try {
    // 1. Crear permisos si no existen
    console.log('🔧 Creando permisos si no existen...');
    const permissionsToCreate = [
      { name: 'ventas.productos.view', description: 'Ver listado de productos', category: 'ventas' },
      { name: 'ventas.productos.create', description: 'Crear nuevos productos', category: 'ventas' },
      { name: 'ventas.productos.edit', description: 'Editar productos existentes', category: 'ventas' },
      { name: 'ventas.productos.delete', description: 'Eliminar productos', category: 'ventas' }
    ];

    for (const perm of permissionsToCreate) {
      await prisma.permission.upsert({
        where: { name: perm.name },
        update: {},
        create: {
          name: perm.name,
          description: perm.description,
          category: perm.category,
          isActive: true
        }
      });
      console.log(`   ✅ ${perm.name}`);
    }

    // 2. Obtener todos los permisos de productos
    console.log('\n📋 Buscando permisos de productos...');
    const permissions = await prisma.permission.findMany({
      where: {
        name: {
          in: PRODUCTOS_PERMISSIONS
        }
      }
    });

    if (permissions.length === 0) {
      console.log('❌ No se encontraron permisos de productos en la base de datos.');
      console.log('   Los permisos deben existir en la tabla Permission.');
      return;
    }

    console.log(`✅ Encontrados ${permissions.length} permisos:`);
    permissions.forEach(p => {
      console.log(`   - ${p.name}: ${p.description || 'Sin descripción'}`);
    });

    // 2. Obtener todos los roles "Administrador" de todas las empresas
    console.log('\n📋 Buscando roles "Administrador"...');
    const adminRoles = await prisma.role.findMany({
      where: {
        name: 'Administrador'
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (adminRoles.length === 0) {
      console.log('❌ No se encontraron roles "Administrador" en ninguna empresa.');
      return;
    }

    console.log(`✅ Encontrados ${adminRoles.length} roles "Administrador":`);
    adminRoles.forEach(r => {
      console.log(`   - ${r.company.name} (ID: ${r.id})`);
    });

    // 3. Asignar permisos a cada rol
    console.log('\n🔧 Asignando permisos...');
    let assignedCount = 0;
    let skippedCount = 0;

    for (const role of adminRoles) {
      for (const permission of permissions) {
        // Verificar si ya existe
        const existing = await prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id
            }
          }
        });

        if (existing && existing.isGranted) {
          console.log(`   ⏭️  ${role.company.name}: ${permission.name} (ya asignado)`);
          skippedCount++;
          continue;
        }

        // Asignar permiso
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id
            }
          },
          update: {
            isGranted: true,
            updatedAt: new Date()
          },
          create: {
            roleId: role.id,
            permissionId: permission.id,
            isGranted: true
          }
        });

        console.log(`   ✅ ${role.company.name}: ${permission.name}`);
        assignedCount++;
      }
    }

    // 4. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN:');
    console.log('='.repeat(60));
    console.log(`✅ Permisos asignados: ${assignedCount}`);
    console.log(`⏭️  Permisos ya existentes: ${skippedCount}`);
    console.log(`📝 Total procesados: ${assignedCount + skippedCount}`);
    console.log('='.repeat(60));

    // 5. Verificación
    console.log('\n🔍 Verificación de asignaciones:');
    for (const role of adminRoles) {
      const rolePerms = await prisma.rolePermission.findMany({
        where: {
          roleId: role.id,
          permissionId: {
            in: permissions.map(p => p.id)
          },
          isGranted: true
        },
        include: {
          permission: {
            select: {
              name: true,
              description: true
            }
          }
        }
      });

      console.log(`\n📋 ${role.company.name}:`);
      rolePerms.forEach(rp => {
        console.log(`   ✅ ${rp.permission.name}`);
      });
    }

    console.log('\n✨ ¡Proceso completado exitosamente!');
    console.log('\n💡 Siguiente paso: Cierra sesión y vuelve a iniciar sesión para que los cambios surtan efecto.');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
