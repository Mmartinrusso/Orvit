const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos para Puestos de Trabajo
const PUESTOS_TRABAJO_PERMISSIONS = [
  {
    name: 'crear_puesto_trabajo',
    description: 'Permite crear nuevos puestos de trabajo',
    category: 'Mantenimiento'
  },
  {
    name: 'editar_puesto_trabajo',
    description: 'Permite editar puestos de trabajo',
    category: 'Mantenimiento'
  },
  {
    name: 'eliminar_puesto_trabajo',
    description: 'Permite eliminar puestos de trabajo',
    category: 'Mantenimiento'
  }
];

async function createPuestosTrabajoPermissions() {
  try {
    console.log('🚀 Creando permisos de Puestos de Trabajo...\n');

    let created = 0;
    let skipped = 0;

    for (const permissionData of PUESTOS_TRABAJO_PERMISSIONS) {
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
    console.log(`📋 Total procesados: ${PUESTOS_TRABAJO_PERMISSIONS.length}`);

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

createPuestosTrabajoPermissions();

