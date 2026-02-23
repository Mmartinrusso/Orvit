const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permiso para gestión de usuarios
const PERMISSION = {
  name: 'gestion_usuarios',
  description: 'Permite gestionar usuarios del sistema',
  category: 'Administración'
};

async function createGestionUsuariosPermission() {
  try {
    console.log('🚀 Creando permiso de gestión de usuarios...\n');

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

createGestionUsuariosPermission();

