const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos de cargas
const CARGA_PERMISSIONS = [
  {
    name: 'cargas.view',
    description: 'Permite ver camiones y cargas, verlas e imprimirlas',
    category: 'Cargas'
  },
  {
    name: 'cargas.manage_trucks',
    description: 'Permite crear, editar y eliminar camiones',
    category: 'Cargas'
  },
  {
    name: 'cargas.manage_loads',
    description: 'Permite crear, editar y eliminar cargas',
    category: 'Cargas'
  }
];

async function createCargasPermissions() {
  try {
    console.log('🚀 Creando permisos de cargas...\n');

    let created = 0;
    let skipped = 0;

    for (const permissionData of CARGA_PERMISSIONS) {
      try {
        // Verificar si el permiso ya existe
        const existing = await prisma.permission.findUnique({
          where: { name: permissionData.name }
        });

        if (existing) {
          console.log(`⏭️  Permiso ya existe: ${permissionData.name} (ID: ${existing.id})`);
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

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN:');
    console.log('='.repeat(50));
    console.log(`✅ Permisos creados: ${created}`);
    console.log(`⏭️  Permisos que ya existían: ${skipped}`);
    console.log(`📋 Total procesados: ${CARGA_PERMISSIONS.length}`);

    if (created > 0) {
      console.log('\n🎉 ¡Permisos de cargas creados exitosamente!');
    } else {
      console.log('\nℹ️  Todos los permisos ya existían.');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createCargasPermissions();

