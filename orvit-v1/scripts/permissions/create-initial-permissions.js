const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos iniciales para el sistema de roles por empresa
const INITIAL_PERMISSIONS = [
  {
    name: 'ingreso_mantenimiento',
    description: 'Permite ingresar al área de Mantenimiento',
    category: 'Navegación'
  },
  {
    name: 'ingreso_administracion',
    description: 'Permite ingresar al área de Administración',
    category: 'Navegación'
  },
  {
    name: 'ingreso_produccion',
    description: 'Permite ingresar al área de Producción',
    category: 'Navegación'
  }
];

async function createInitialPermissions() {
  try {
    console.log('🚀 Creando permisos iniciales...\n');

    let created = 0;
    let skipped = 0;

    for (const permissionData of INITIAL_PERMISSIONS) {
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
    console.log(`📋 Total procesados: ${INITIAL_PERMISSIONS.length}`);

    if (created > 0) {
      console.log('\n🎉 ¡Permisos iniciales creados exitosamente!');
    } else {
      console.log('\nℹ️  Todos los permisos ya existían.');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createInitialPermissions();

