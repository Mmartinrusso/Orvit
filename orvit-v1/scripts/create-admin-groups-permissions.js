const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos para grupos del sidebar de Administración
const ADMIN_GROUP_PERMISSIONS = [
  {
    name: 'ingresar_personal',
    description: 'Permite acceder al grupo Personal (Tareas, Permisos & Roles, Gestión de Usuarios)',
    category: 'Administración'
  },
  {
    name: 'ingresar_permisos_roles',
    description: 'Permite acceder a Permisos & Roles',
    category: 'Administración'
  },
  {
    name: 'ingresar_ventas',
    description: 'Permite acceder al grupo Ventas (Dashboard, Clientes, Productos, Cotizaciones, Ventas)',
    category: 'Administración'
  },
  {
    name: 'ingresar_costos',
    description: 'Permite acceder al grupo Costos',
    category: 'Administración'
  },
  {
    name: 'ingresar_controles',
    description: 'Permite acceder a la sección Controles',
    category: 'Administración'
  }
];

async function createAdminGroupsPermissions() {
  try {
    console.log('🚀 Creando permisos para grupos del sidebar de Administración...\n');

    let created = 0;
    let skipped = 0;

    for (const permission of ADMIN_GROUP_PERMISSIONS) {
      try {
        // Verificar si el permiso ya existe
        const existing = await prisma.permission.findUnique({
          where: { name: permission.name }
        });

        if (existing) {
          console.log(`⏭️  Permiso ya existe: ${permission.name} (ID: ${existing.id})`);
          skipped++;
          continue;
        }

        // Crear el permiso
        const newPermission = await prisma.permission.create({
          data: {
            name: permission.name,
            description: permission.description,
            category: permission.category,
            isActive: true
          }
        });

        console.log(`✅ Permiso creado: ${newPermission.name} (ID: ${newPermission.id})`);
        created++;

      } catch (error) {
        console.error(`❌ Error creando permiso ${permission.name}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN:');
    console.log('='.repeat(50));
    console.log(`✅ Permisos creados: ${created}`);
    console.log(`⏭️  Permisos que ya existían: ${skipped}`);
    console.log(`📋 Total procesados: ${ADMIN_GROUP_PERMISSIONS.length}`);

    if (created > 0) {
      console.log('\n🎉 ¡Permisos creados exitosamente!');
    } else {
      console.log('\nℹ️  Todos los permisos ya existían.');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminGroupsPermissions();

