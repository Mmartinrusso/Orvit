const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos para el módulo de Controles
const CONTROLS_PERMISSIONS = [
  {
    name: 'ingresar_controles',
    description: 'Permite acceder a la sección Controles',
    category: 'Administración'
  },
  {
    name: 'controles.manage',
    description: 'Permite crear, editar y eliminar controles',
    category: 'Controles'
  },
  {
    name: 'controles.create_records',
    description: 'Permite crear registros en controles (ej: ingresos de impuestos)',
    category: 'Controles'
  }
];

async function createControlsPermissions() {
  try {
    console.log('🚀 Creando permisos para el módulo de Controles...\n');

    let created = 0;
    let skipped = 0;

    for (const permission of CONTROLS_PERMISSIONS) {
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
    console.log(`📋 Total procesados: ${CONTROLS_PERMISSIONS.length}`);

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

createControlsPermissions();

