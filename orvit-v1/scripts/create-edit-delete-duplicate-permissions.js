const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos para editar, eliminar y duplicar mantenimientos
const EDIT_DELETE_DUPLICATE_PERMISSIONS = [
  {
    name: 'editar_mantenimiento',
    description: 'Permite editar mantenimientos',
    category: 'Mantenimiento'
  },
  {
    name: 'eliminar_mantenimiento',
    description: 'Permite eliminar mantenimientos',
    category: 'Mantenimiento'
  },
  {
    name: 'duplicar_mantenimiento',
    description: 'Permite duplicar mantenimientos',
    category: 'Mantenimiento'
  }
];

async function createEditDeleteDuplicatePermissions() {
  try {
    console.log('🚀 Creando permisos de editar, eliminar y duplicar mantenimientos...\n');

    let created = 0;
    let skipped = 0;

    for (const permissionData of EDIT_DELETE_DUPLICATE_PERMISSIONS) {
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
    console.log(`📋 Total procesados: ${EDIT_DELETE_DUPLICATE_PERMISSIONS.length}`);

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

createEditDeleteDuplicatePermissions();

