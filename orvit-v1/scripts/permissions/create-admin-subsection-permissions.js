const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos para subsecciones del sidebar de Administración
const ADMIN_SUBSECTION_PERMISSIONS = [
  // Personal - ya existen pero verificamos nombres
  // Tareas → ingresar_tareas (ya existe)
  // Permisos & Roles → ingresar_permisos_roles (ya existe)
  // Gestión de Usuarios → ingresar_usuarios (ya existe, verificar)
  
  // Ventas - crear permisos específicos
  {
    name: 'ingresar_dashboard_ventas',
    description: 'Permite acceder al Dashboard de Ventas',
    category: 'Administración'
  },
  {
    name: 'ingresar_clientes',
    description: 'Permite acceder a Clientes',
    category: 'Administración'
  },
  {
    name: 'ingresar_productos',
    description: 'Permite acceder a Productos',
    category: 'Administración'
  },
  {
    name: 'ingresar_cotizaciones',
    description: 'Permite acceder a Cotizaciones',
    category: 'Administración'
  },
  {
    name: 'ingresar_ventas_modulo',
    description: 'Permite acceder al módulo de Ventas',
    category: 'Administración'
  }
];

async function createAdminSubsectionPermissions() {
  try {
    console.log('🚀 Creando permisos para subsecciones del sidebar de Administración...\n');

    let created = 0;
    let skipped = 0;

    for (const permission of ADMIN_SUBSECTION_PERMISSIONS) {
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
    console.log(`📋 Total procesados: ${ADMIN_SUBSECTION_PERMISSIONS.length}`);

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

createAdminSubsectionPermissions();

