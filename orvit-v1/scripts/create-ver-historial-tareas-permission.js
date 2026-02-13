const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permiso para ver historial de tareas
const PERMISSION = {
  name: 'ver_historial_tareas',
  description: 'Permite ver el historial de tareas',
  category: 'Administración'
};

async function createVerHistorialTareasPermission() {
  try {
    console.log('🚀 Creando permiso para ver historial de tareas...\n');

    // Verificar si el permiso ya existe
    const existing = await prisma.permission.findUnique({
      where: { name: PERMISSION.name }
    });

    if (existing) {
      console.log(`⏭️  Permiso ya existe: ${PERMISSION.name} (ID: ${existing.id})`);
      return;
    }

    // Crear el permiso
    const permission = await prisma.permission.create({
      data: {
        name: PERMISSION.name,
        description: PERMISSION.description,
        category: PERMISSION.category,
        isActive: true
      }
    });

    console.log(`✅ Permiso creado: ${permission.name} (ID: ${permission.id})`);
    console.log('\n🎉 ¡Permiso creado exitosamente!');

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createVerHistorialTareasPermission();

