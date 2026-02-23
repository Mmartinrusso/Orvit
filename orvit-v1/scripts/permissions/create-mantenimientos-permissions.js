const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos para Mantenimientos
const MANTENIMIENTOS_PERMISSIONS = [
  {
    name: 'crear_mantenimiento',
    description: 'Permite crear nuevos mantenimientos',
    category: 'Mantenimiento'
  },
  {
    name: 'crear_checklist',
    description: 'Permite crear nuevos checklists',
    category: 'Mantenimiento'
  },
  {
    name: 'ejecucion_mantenimiento',
    description: 'Permite ejecutar mantenimientos',
    category: 'Mantenimiento'
  }
];

async function createMantenimientosPermissions() {
  try {
    console.log('🚀 Creando permisos de Mantenimientos...\n');

    let created = 0;
    let skipped = 0;

    for (const permissionData of MANTENIMIENTOS_PERMISSIONS) {
      try {
        // Verificar si el permiso ya existe
        const existing = await prisma.permission.findUnique({
          where: { name: permissionData.name }
        });

        if (existing) {
          console.log(`⏭️  Permiso ya existe: ${permissionData.name}`);
          skipped++;
          continue;
        }

        // Crear el permiso
        const permission = await prisma.permission.create({
          data: {
            name: permissionData.name,
            description: permissionData.description,
            category: permissionData.category,
            isActive: true
          }
        });

        console.log(`✅ Permiso creado: ${permission.name} (ID: ${permission.id})`);
        created++;
      } catch (error) {
        console.error(`❌ Error creando permiso ${permissionData.name}:`, error.message);
      }
    }

    console.log('\n📊 RESUMEN:');
    console.log(`✅ Permisos creados: ${created}`);
    console.log(`⏭️  Permisos ya existían: ${skipped}`);
    console.log(`📋 Total procesados: ${MANTENIMIENTOS_PERMISSIONS.length}`);

    if (created > 0) {
      console.log('\n🎉 ¡Permisos de Mantenimientos creados exitosamente!');
    } else {
      console.log('\nℹ️  Todos los permisos ya existían.');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createMantenimientosPermissions();

