const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos para tareas fijas
const TAREAS_FIJAS_PERMISSIONS = [
  {
    name: 'crear_tarea_fija',
    description: 'Permite crear tareas fijas',
    category: 'Administración'
  },
  {
    name: 'editar_tarea_fija',
    description: 'Permite editar tareas fijas',
    category: 'Administración'
  },
  {
    name: 'eliminar_tarea_fija',
    description: 'Permite eliminar tareas fijas',
    category: 'Administración'
  }
];

async function createTareasFijasPermissions() {
  try {
    console.log('🚀 Creando permisos para tareas fijas...\n');

    let created = 0;
    let skipped = 0;

    for (const permission of TAREAS_FIJAS_PERMISSIONS) {
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
    console.log(`📋 Total procesados: ${TAREAS_FIJAS_PERMISSIONS.length}`);

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

createTareasFijasPermissions();

